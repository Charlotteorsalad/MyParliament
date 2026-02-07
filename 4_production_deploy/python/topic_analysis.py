#!/usr/bin/env python3
"""
Advanced Topic Analysis for Parliamentary Debates

Implements 5 analysis dimensions:
1. Dynamic Topic Trends (DTM): Monthly/quarterly topic probability distributions with Plotly
2. Party Agenda Setting: Topic prevalence comparison across parties
3. Speaker Profiling: Top 5 speakers for each topic
4. Sentiment & Stance Analysis: Topic sentiment by party using VADER
5. Topic Co-occurrence: Network analysis of topics appearing together

Usage:
    python topic_analysis.py --pipeline pipeline5
    python topic_analysis.py --pipeline all                     # Process all pipelines
    python topic_analysis.py --pipeline pipeline5 --analysis dtm
    python topic_analysis.py --pipeline all --analysis all      # Full analysis for all pipelines
"""
import argparse
import os
import warnings
from pathlib import Path
from datetime import datetime
from collections import defaultdict, Counter
from typing import Dict, List, Tuple, Optional

import numpy as np
import pandas as pd
from pymongo import MongoClient
from dotenv import load_dotenv
from bson import ObjectId

warnings.filterwarnings("ignore")

project_root = Path(__file__).resolve().parents[2]
backend_env_path = project_root / "3_app_system" / "backend" / ".env"
load_dotenv(backend_env_path, override=True)

MONGO_URI = os.getenv("MONGO_URI")
if not MONGO_URI:
    raise RuntimeError("MONGO_URI not found in environment")

COLLECTION_ANALYSIS = "hansard_analysis"


def _sanitize_for_mongo(obj):
    """Convert numpy/pandas types to native Python for MongoDB JSON serialization."""
    if obj is None:
        return None
    if isinstance(obj, dict):
        return {str(k): _sanitize_for_mongo(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_sanitize_for_mongo(x) for x in obj]
    if isinstance(obj, (np.integer, np.int32, np.int64)):
        return int(obj)
    if isinstance(obj, (np.floating, np.float32, np.float64)):
        return float(obj)
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    if hasattr(obj, "to_dict"):
        return _sanitize_for_mongo(obj.to_dict())
    if hasattr(obj, "item"):  # numpy scalar
        return obj.item()
    return obj


def load_inference_data(client, pipeline_id: str) -> Dict:
    """Load inference results and topic labels from MongoDB."""
    db = client["MyParliament"]
    
    inference = db["hansard_inference"].find_one({"pipelineId": pipeline_id})
    if not inference:
        raise ValueError(f"No inference found for {pipeline_id}")
    
    topics = list(db["hansard_topic"].find({"pipeline_id": pipeline_id}))
    
    return {
        "inference": inference,
        "topics": topics,
        "doc_ids": inference.get("docIds", []),
        "clusters": np.array(inference.get("clusters", [])),
        "n_clusters": len(topics)
    }


def load_document_metadata(client, doc_ids: List, pipeline_id: str) -> pd.DataFrame:
    """Load document metadata (date, speaker, party, tokens) from source collections."""
    db = client["MyParliament"]
    
    if pipeline_id in ["pipeline1", "pipeline2"]:
        collection = db["HansardDocument"]
        text_field = "ocr_text"
    else:
        collection = db["hansard_cpatf"]
        text_field = "cleaned_text"
    
    obj_ids = []
    for doc_id in doc_ids:
        if isinstance(doc_id, ObjectId):
            obj_ids.append(doc_id)
        else:
            try:
                obj_ids.append(ObjectId(doc_id))
            except:
                obj_ids.append(doc_id)
    
    cursor = collection.find(
        {"_id": {"$in": obj_ids}},
        {
            "_id": 1,
            "hansardDate": 1,
            "speaker": 1,
            "party": 1,
            "tokens": 1,
            text_field: 1
        }
    )
    
    docs = []
    for doc in cursor:
        docs.append({
            "doc_id": str(doc["_id"]),
            "date": doc.get("hansardDate"),
            "speaker": doc.get("speaker", "Unknown"),
            "party": doc.get("party", "Unknown"),
            "tokens": doc.get("tokens", []),
            "text": doc.get(text_field, "")
        })
    
    df = pd.DataFrame(docs)
    
    if "date" in df.columns:
        df["date"] = pd.to_datetime(df["date"], errors="coerce")
    
    return df


def analysis_1_dynamic_topic_trends(
    data: Dict,
    metadata_df: pd.DataFrame,
    output_dir: Path,
    time_aggregation: str = "M"
) -> Optional[Dict]:
    """
    Analysis 1: Dynamic Topic Trends (DTM)
    
    Computes topic probability distribution over time and generates interactive plots.
    
    Args:
        data: Inference data with clusters
        metadata_df: Document metadata with dates
        output_dir: Directory to save plots
        time_aggregation: 'M' for monthly, 'Q' for quarterly
    """
    try:
        import plotly.graph_objects as go
        import plotly.express as px
    except ImportError:
        print("ERROR: plotly required. Run: pip install plotly")
        return
    
    print("\n" + "="*60)
    print("Analysis 1: Dynamic Topic Trends (DTM)")
    print("="*60)
    
    metadata_df = metadata_df.copy()
    metadata_df["cluster"] = data["clusters"][:len(metadata_df)]
    
    metadata_df = metadata_df.dropna(subset=["date"])
    
    if len(metadata_df) == 0:
        print("WARNING: No documents with valid dates. Skipping DTM analysis.")
        return None
    
    freq_name = "Monthly" if time_aggregation == "M" else "Quarterly"
    metadata_df["period"] = metadata_df["date"].dt.to_period(time_aggregation)
    
    topic_labels = {
        t["cluster_id"]: t["topic_label"]["name_en"]
        for t in data["topics"]
    }
    
    metadata_df["topic_name"] = metadata_df["cluster"].map(topic_labels)
    
    trend_data = metadata_df.groupby(["period", "topic_name"]).size().reset_index(name="count")
    
    trend_pivot = trend_data.pivot(index="period", columns="topic_name", values="count").fillna(0)
    
    trend_pivot_pct = trend_pivot.div(trend_pivot.sum(axis=1), axis=0) * 100
    
    print(f"\n{freq_name} Trend Data Shape: {trend_pivot.shape}")
    print(f"Time Range: {trend_pivot.index[0]} to {trend_pivot.index[-1]}")
    
    fig = go.Figure()
    
    for topic in trend_pivot_pct.columns:
        fig.add_trace(go.Scatter(
            x=[str(p) for p in trend_pivot_pct.index],
            y=trend_pivot_pct[topic],
            mode="lines+markers",
            name=topic,
            line=dict(width=2),
            hovertemplate=f"<b>{topic}</b><br>Period: %{{x}}<br>Percentage: %{{y:.2f}}%<extra></extra>"
        ))
    
    fig.update_layout(
        title=f"Dynamic Topic Trends - {freq_name} Distribution",
        xaxis_title="Time Period",
        yaxis_title="Topic Prevalence (%)",
        hovermode="x unified",
        template="plotly_white",
        height=600,
        legend=dict(
            orientation="v",
            yanchor="top",
            y=1,
            xanchor="left",
            x=1.02
        )
    )
    
    output_file = output_dir / f"dtm_{time_aggregation.lower()}.html"
    fig.write_html(str(output_file))
    print(f"\nSaved interactive plot: {output_file}")
    
    surge_threshold = 10.0
    for topic in trend_pivot_pct.columns:
        series = trend_pivot_pct[topic]
        if len(series) < 2:
            continue
        
        changes = series.diff()
        surges = changes[changes > surge_threshold]
        
        if len(surges) > 0:
            print(f"\n  Topic: {topic}")
            for period, change in surges.items():
                print(f"    Surge at {period}: +{change:.2f}%")
    
    summary_file = output_dir / f"dtm_summary_{time_aggregation.lower()}.csv"
    trend_pivot_pct.to_csv(summary_file)
    print(f"\nSaved summary data: {summary_file}")

    periods = [str(p) for p in trend_pivot_pct.index]
    topic_prevalence_pct = {
        str(topic): [float(x) for x in trend_pivot_pct[topic].values]
        for topic in trend_pivot_pct.columns
    }
    return {
        "time_aggregation": time_aggregation,
        "periods": periods,
        "topic_prevalence_pct": topic_prevalence_pct,
    }


def analysis_2_party_agenda_setting(
    data: Dict,
    metadata_df: pd.DataFrame,
    output_dir: Path
) -> Optional[Dict]:
    """
    Analysis 2: Party Agenda Setting
    
    Analyzes topic prevalence by party and identifies party biases.
    """
    try:
        import plotly.graph_objects as go
        from scipy import stats
    except ImportError:
        print("ERROR: plotly and scipy required. Run: pip install plotly scipy")
        return
    
    print("\n" + "="*60)
    print("Analysis 2: Party Agenda Setting")
    print("="*60)
    
    metadata_df = metadata_df.copy()
    metadata_df["cluster"] = data["clusters"][:len(metadata_df)]
    
    topic_labels = {
        t["cluster_id"]: t["topic_label"]["name_en"]
        for t in data["topics"]
    }
    metadata_df["topic_name"] = metadata_df["cluster"].map(topic_labels)
    
    metadata_df = metadata_df[metadata_df["party"] != "Unknown"]
    
    if len(metadata_df) == 0:
        print("WARNING: No documents with party information. Skipping party analysis.")
        return None
    
    party_topic_counts = metadata_df.groupby(["party", "topic_name"]).size().reset_index(name="count")
    
    party_totals = metadata_df.groupby("party").size().reset_index(name="total")
    
    party_topic_prevalence = party_topic_counts.merge(party_totals, on="party")
    party_topic_prevalence["prevalence"] = (
        party_topic_prevalence["count"] / party_topic_prevalence["total"] * 100
    )
    
    prevalence_pivot = party_topic_prevalence.pivot(
        index="topic_name",
        columns="party",
        values="prevalence"
    ).fillna(0)
    
    print(f"\nParty-Topic Matrix Shape: {prevalence_pivot.shape}")
    print(f"Parties: {', '.join(prevalence_pivot.columns)}")
    
    fig = go.Figure(data=go.Heatmap(
        z=prevalence_pivot.values,
        x=prevalence_pivot.columns,
        y=prevalence_pivot.index,
        colorscale="Blues",
        hovertemplate="Party: %{x}<br>Topic: %{y}<br>Prevalence: %{z:.2f}%<extra></extra>"
    ))
    
    fig.update_layout(
        title="Party Agenda Setting - Topic Prevalence by Party",
        xaxis_title="Political Party",
        yaxis_title="Topic",
        height=max(400, len(prevalence_pivot.index) * 20),
        template="plotly_white"
    )
    
    output_file = output_dir / "party_agenda_heatmap.html"
    fig.write_html(str(output_file))
    print(f"\nSaved heatmap: {output_file}")
    
    print("\n  Significant Party-Topic Associations (ANOVA):")
    
    significant_topics = []
    for topic in prevalence_pivot.index:
        party_data = []
        for party in prevalence_pivot.columns:
            topic_docs = metadata_df[
                (metadata_df["party"] == party) & (metadata_df["topic_name"] == topic)
            ]
            party_data.append(len(topic_docs))
        
        if len(set(party_data)) > 1:
            try:
                f_stat, p_value = stats.f_oneway(*[
                    [1] * party_data[i] + [0] * (party_totals.iloc[i]["total"] - party_data[i])
                    for i in range(len(party_data))
                ])
                
                if p_value < 0.05:
                    dominant_party = prevalence_pivot.loc[topic].idxmax()
                    max_prevalence = prevalence_pivot.loc[topic].max()
                    significant_topics.append({
                        "topic": topic,
                        "p_value": p_value,
                        "dominant_party": dominant_party,
                        "prevalence": max_prevalence
                    })
            except:
                pass
    
    significant_topics = sorted(significant_topics, key=lambda x: x["p_value"])
    
    for item in significant_topics[:10]:
        print(f"    {item['topic']}")
        print(f"      Dominant Party: {item['dominant_party']} ({item['prevalence']:.2f}%)")
        print(f"      p-value: {item['p_value']:.4f}")
    
    summary_file = output_dir / "party_agenda_prevalence.csv"
    prevalence_pivot.to_csv(summary_file)
    print(f"\nSaved prevalence data: {summary_file}")

    sig_list = [
        {"topic": x["topic"], "dominant_party": x["dominant_party"], "prevalence": float(x["prevalence"]), "p_value": float(x["p_value"])}
        for x in significant_topics[:50]
    ]
    return {
        "prevalence": prevalence_pivot.to_dict(),
        "significant_topics": sig_list,
    }


def analysis_3_speaker_profiling(
    data: Dict,
    metadata_df: pd.DataFrame,
    output_dir: Path,
    top_n: int = 5
) -> Optional[Dict]:
    """
    Analysis 3: Speaker Profiling
    
    Identifies top speakers for each topic based on contribution.
    """
    print("\n" + "="*60)
    print("Analysis 3: Speaker Profiling")
    print("="*60)
    
    metadata_df = metadata_df.copy()
    metadata_df["cluster"] = data["clusters"][:len(metadata_df)]
    
    topic_labels = {
        t["cluster_id"]: t["topic_label"]["name_en"]
        for t in data["topics"]
    }
    metadata_df["topic_name"] = metadata_df["cluster"].map(topic_labels)
    
    metadata_df = metadata_df[metadata_df["speaker"] != "Unknown"]
    
    if len(metadata_df) == 0:
        print("WARNING: No documents with speaker information. Skipping speaker profiling.")
        return None
    
    speaker_profiles = []
    
    for topic_id in sorted(topic_labels.keys()):
        topic_name = topic_labels[topic_id]
        topic_docs = metadata_df[metadata_df["cluster"] == topic_id]
        
        if len(topic_docs) == 0:
            continue
        
        speaker_counts = topic_docs.groupby("speaker").size().reset_index(name="count")
        speaker_counts["percentage"] = (speaker_counts["count"] / len(topic_docs) * 100)
        
        top_speakers = speaker_counts.nlargest(top_n, "count")
        
        print(f"\n  Topic: {topic_name}")
        for idx, row in top_speakers.iterrows():
            print(f"    {row['speaker']}: {row['count']} docs ({row['percentage']:.2f}%)")
            speaker_profiles.append({
                "topic_id": topic_id,
                "topic_name": topic_name,
                "speaker": row["speaker"],
                "count": row["count"],
                "percentage": row["percentage"]
            })
    
    profile_df = pd.DataFrame(speaker_profiles)
    
    summary_file = output_dir / "speaker_profiles.csv"
    profile_df.to_csv(summary_file, index=False)
    print(f"\nSaved speaker profiles: {summary_file}")

    return {"speaker_profiles": profile_df.to_dict("records")}


def analysis_4_sentiment_stance(
    data: Dict,
    metadata_df: pd.DataFrame,
    output_dir: Path
) -> Optional[Dict]:
    """
    Analysis 4: Sentiment & Stance Analysis
    
    Analyzes sentiment polarity by topic and party using VADER.
    """
    try:
        from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
        import plotly.graph_objects as go
    except ImportError:
        print("ERROR: vaderSentiment and plotly required. Run: pip install vaderSentiment plotly")
        return
    
    print("\n" + "="*60)
    print("Analysis 4: Sentiment & Stance Analysis")
    print("="*60)
    
    analyzer = SentimentIntensityAnalyzer()
    
    metadata_df = metadata_df.copy()
    metadata_df["cluster"] = data["clusters"][:len(metadata_df)]
    
    topic_labels = {
        t["cluster_id"]: t["topic_label"]["name_en"]
        for t in data["topics"]
    }
    metadata_df["topic_name"] = metadata_df["cluster"].map(topic_labels)
    
    def analyze_sentiment(text: str) -> float:
        if not text or not isinstance(text, str):
            return 0.0
        scores = analyzer.polarity_scores(text)
        return scores["compound"]
    
    print("\n  Computing sentiment scores...")
    metadata_df["sentiment"] = metadata_df["text"].apply(analyze_sentiment)
    
    topic_sentiment = metadata_df.groupby("topic_name")["sentiment"].mean().reset_index()
    topic_sentiment = topic_sentiment.sort_values("sentiment", ascending=False)
    
    print("\n  Average Sentiment by Topic:")
    for idx, row in topic_sentiment.iterrows():
        sentiment_label = "Positive" if row["sentiment"] > 0.05 else "Negative" if row["sentiment"] < -0.05 else "Neutral"
        print(f"    {row['topic_name']}: {row['sentiment']:.4f} ({sentiment_label})")
    
    party_topic_sentiment = metadata_df[metadata_df["party"] != "Unknown"].groupby(
        ["party", "topic_name"]
    )["sentiment"].mean().reset_index()
    
    sentiment_pivot = party_topic_sentiment.pivot(
        index="topic_name",
        columns="party",
        values="sentiment"
    ).fillna(0)
    
    fig = go.Figure(data=go.Heatmap(
        z=sentiment_pivot.values,
        x=sentiment_pivot.columns,
        y=sentiment_pivot.index,
        colorscale="RdYlGn",
        zmid=0,
        hovertemplate="Party: %{x}<br>Topic: %{y}<br>Sentiment: %{z:.3f}<extra></extra>"
    ))
    
    fig.update_layout(
        title="Sentiment Analysis - Party Stance by Topic",
        xaxis_title="Political Party",
        yaxis_title="Topic",
        height=max(400, len(sentiment_pivot.index) * 20),
        template="plotly_white"
    )
    
    output_file = output_dir / "sentiment_party_topic.html"
    fig.write_html(str(output_file))
    print(f"\nSaved sentiment heatmap: {output_file}")
    
    summary_file = output_dir / "sentiment_analysis.csv"
    topic_sentiment.to_csv(summary_file, index=False)
    print(f"Saved sentiment data: {summary_file}")

    return {
        "topic_sentiment": topic_sentiment.to_dict("records"),
        "party_topic_sentiment": sentiment_pivot.to_dict(),
    }


def analysis_5_topic_cooccurrence(
    data: Dict,
    metadata_df: pd.DataFrame,
    output_dir: Path,
    min_cooccurrence: int = 5
) -> Optional[Dict]:
    """
    Analysis 5: Topic Co-occurrence Network
    
    Builds topic co-occurrence matrix and generates network graph.
    """
    try:
        import networkx as nx
        import plotly.graph_objects as go
    except ImportError:
        print("ERROR: networkx and plotly required. Run: pip install networkx plotly")
        return
    
    print("\n" + "="*60)
    print("Analysis 5: Topic Co-occurrence Network")
    print("="*60)
    
    metadata_df = metadata_df.copy()
    metadata_df["cluster"] = data["clusters"][:len(metadata_df)]
    
    topic_labels = {
        t["cluster_id"]: t["topic_label"]["name_en"]
        for t in data["topics"]
    }
    
    if "date" not in metadata_df.columns or metadata_df["date"].isna().all():
        print("WARNING: No date information. Cannot compute co-occurrence.")
        return None
    
    metadata_df["date_str"] = metadata_df["date"].dt.strftime("%Y-%m-%d")
    
    debate_sessions = metadata_df.groupby("date_str")["cluster"].apply(list).reset_index()
    
    cooccurrence = defaultdict(int)
    
    for _, row in debate_sessions.iterrows():
        clusters = list(set(row["cluster"]))
        
        for i in range(len(clusters)):
            for j in range(i+1, len(clusters)):
                c1, c2 = sorted([clusters[i], clusters[j]])
                cooccurrence[(c1, c2)] += 1
    
    cooccurrence = {k: v for k, v in cooccurrence.items() if v >= min_cooccurrence}
    
    print(f"\n  Total co-occurrence pairs: {len(cooccurrence)}")
    
    if len(cooccurrence) == 0:
        print("WARNING: No significant co-occurrences found. Try lowering min_cooccurrence.")
        return None
    
    G = nx.Graph()
    
    for cluster_id, label in topic_labels.items():
        G.add_node(cluster_id, label=label)
    
    for (c1, c2), weight in cooccurrence.items():
        G.add_edge(c1, c2, weight=weight)
    
    pos = nx.spring_layout(G, k=0.5, iterations=50)
    
    edge_trace = []
    for edge in G.edges():
        x0, y0 = pos[edge[0]]
        x1, y1 = pos[edge[1]]
        weight = G[edge[0]][edge[1]]["weight"]
        
        edge_trace.append(go.Scatter(
            x=[x0, x1, None],
            y=[y0, y1, None],
            mode="lines",
            line=dict(width=min(weight/2, 10), color="lightgray"),
            hoverinfo="none",
            showlegend=False
        ))
    
    node_x = []
    node_y = []
    node_text = []
    node_size = []
    
    for node in G.nodes():
        x, y = pos[node]
        node_x.append(x)
        node_y.append(y)
        
        label = topic_labels.get(node, f"Topic {node}")
        degree = G.degree(node)
        node_text.append(f"{label}<br>Connections: {degree}")
        node_size.append(20 + degree * 5)
    
    node_trace = go.Scatter(
        x=node_x,
        y=node_y,
        mode="markers+text",
        text=[topic_labels.get(n, f"T{n}") for n in G.nodes()],
        textposition="top center",
        marker=dict(
            size=node_size,
            color="lightblue",
            line=dict(width=2, color="darkblue")
        ),
        hovertext=node_text,
        hoverinfo="text"
    )
    
    fig = go.Figure(data=edge_trace + [node_trace])
    
    fig.update_layout(
        title="Topic Co-occurrence Network",
        showlegend=False,
        hovermode="closest",
        template="plotly_white",
        xaxis=dict(showgrid=False, zeroline=False, showticklabels=False),
        yaxis=dict(showgrid=False, zeroline=False, showticklabels=False),
        height=800
    )
    
    output_file = output_dir / "topic_cooccurrence_network.html"
    fig.write_html(str(output_file))
    print(f"\nSaved network graph: {output_file}")
    
    print("\n  Top Co-occurring Topic Pairs:")
    top_pairs = sorted(cooccurrence.items(), key=lambda x: x[1], reverse=True)[:10]
    for (c1, c2), count in top_pairs:
        label1 = topic_labels.get(c1, f"Topic {c1}")
        label2 = topic_labels.get(c2, f"Topic {c2}")
        print(f"    {label1} <-> {label2}: {count} times")
    
    cooccurrence_df = pd.DataFrame([
        {
            "topic_1": topic_labels.get(c1, f"Topic {c1}"),
            "topic_2": topic_labels.get(c2, f"Topic {c2}"),
            "count": count
        }
        for (c1, c2), count in cooccurrence.items()
    ])
    
    summary_file = output_dir / "topic_cooccurrence.csv"
    cooccurrence_df.to_csv(summary_file, index=False)
    print(f"Saved co-occurrence data: {summary_file}")

    return {"cooccurrence": cooccurrence_df.to_dict("records")}


def _save_analysis_to_mongodb(client, pipeline_id: str, analyses: Dict) -> None:
    """Write analysis results to hansard_analysis collection (one doc per pipeline, overwrite)."""
    if not analyses:
        return
    doc = {
        "pipeline_id": pipeline_id,
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "analyses": _sanitize_for_mongo(analyses),
    }
    db = client["MyParliament"]
    col = db[COLLECTION_ANALYSIS]
    col.delete_many({"pipeline_id": pipeline_id})
    col.insert_one(doc)
    print(f"\nSaved to MongoDB collection: {COLLECTION_ANALYSIS}")


def main():
    parser = argparse.ArgumentParser(
        description="Advanced topic analysis for parliamentary debates",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    
    parser.add_argument(
        "--pipeline",
        type=str,
        required=True,
        help="Pipeline ID (e.g., pipeline5) or 'all' to process all pipelines"
    )
    
    parser.add_argument(
        "--analysis",
        type=str,
        choices=["all", "dtm", "party", "speaker", "sentiment", "cooccurrence"],
        default="all",
        help="Which analysis to run (default: all)"
    )
    
    parser.add_argument(
        "--output-dir",
        type=str,
        default=None,
        help="Output directory for results (default: ./analysis_output/<pipeline_id>)"
    )
    
    parser.add_argument(
        "--time-aggregation",
        type=str,
        choices=["M", "Q"],
        default="M",
        help="Time aggregation for DTM: M=monthly, Q=quarterly (default: M)"
    )
    
    args = parser.parse_args()
    
    client = MongoClient(MONGO_URI)
    
    # Determine which pipelines to process
    if args.pipeline.lower() == "all":
        # Get all pipelines from hansard_inference
        inference_col = client["MyParliament"]["hansard_inference"]
        pipeline_ids = [doc["pipelineId"] for doc in inference_col.find({}, {"pipelineId": 1})]
        if not pipeline_ids:
            print("No pipelines found in hansard_inference. Run production_inference.py first.")
            client.close()
            return 1
        print(f"Processing {len(pipeline_ids)} pipelines: {', '.join(pipeline_ids)}")
    else:
        pipeline_ids = [args.pipeline]
    
    # Process each pipeline
    success_count = 0
    for pipeline_id in pipeline_ids:
        if args.output_dir:
            output_dir = Path(args.output_dir) / pipeline_id
        else:
            output_dir = Path(__file__).parent / "analysis_output" / pipeline_id
        
        output_dir.mkdir(parents=True, exist_ok=True)
        
        print("="*60)
        print("Advanced Topic Analysis for Parliamentary Debates")
        print("="*60)
        print(f"Pipeline: {pipeline_id}")
        print(f"Output Directory: {output_dir}")
        print(f"Analysis Mode: {args.analysis}")
        
        try:
            print("\nLoading inference data...")
            data = load_inference_data(client, pipeline_id)
            print(f"  Documents: {len(data['doc_ids'])}")
            print(f"  Topics: {data['n_clusters']}")
            
            print("\nLoading document metadata...")
            metadata_df = load_document_metadata(client, data["doc_ids"], pipeline_id)
            print(f"  Metadata loaded: {len(metadata_df)} documents")
            
            analyses = {}
            if args.analysis in ["all", "dtm"]:
                out = analysis_1_dynamic_topic_trends(data, metadata_df, output_dir, args.time_aggregation)
                if out is not None:
                    analyses["dtm"] = out
            if args.analysis in ["all", "party"]:
                out = analysis_2_party_agenda_setting(data, metadata_df, output_dir)
                if out is not None:
                    analyses["party_agenda"] = out
            if args.analysis in ["all", "speaker"]:
                out = analysis_3_speaker_profiling(data, metadata_df, output_dir)
                if out is not None:
                    analyses["speaker_profiles"] = out.get("speaker_profiles", out)
            if args.analysis in ["all", "sentiment"]:
                out = analysis_4_sentiment_stance(data, metadata_df, output_dir)
                if out is not None:
                    analyses["sentiment"] = out
            if args.analysis in ["all", "cooccurrence"]:
                out = analysis_5_topic_cooccurrence(data, metadata_df, output_dir)
                if out is not None:
                    analyses["cooccurrence"] = out.get("cooccurrence", out)

            if analyses:
                _save_analysis_to_mongodb(client, pipeline_id, analyses)

            print("\n" + "="*60)
            print(f"Analysis Complete for {pipeline_id}!")
            print(f"Results saved to: {output_dir}")
            if analyses:
                print(f"MongoDB: {COLLECTION_ANALYSIS} (pipeline_id={pipeline_id})")
            print("="*60)
            success_count += 1
            
        except Exception as e:
            print(f"\n[ERROR] Error processing {pipeline_id}: {e}")
            import traceback
            traceback.print_exc()
            continue
    
    client.close()
    
    print(f"\n{'='*60}")
    print(f"Completed: {success_count}/{len(pipeline_ids)} pipelines")
    print(f"{'='*60}")
    
    return 0 if success_count == len(pipeline_ids) else 1


if __name__ == "__main__":
    exit(main())
