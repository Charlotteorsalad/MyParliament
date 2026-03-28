#!/usr/bin/env python3
"""
ARIMA Trend Forecast — Issue Portal Topic Activity
Pipeline: 08 (precompute companion to pipelines 01–07)

Reads hansard_inference + hansard_cpatf + hansard_topic from MongoDB,
builds a per-era (parlimen_penggal_mesyuarat) time series of document counts
per topic cluster, then fits ARIMA(1,1,0) on each high/medium quality topic.

Writes results to:
  - MongoDB collection  : hansard_arima
  - JSON (local)        : 2_ml_modeling/results/arima_forecast_results.json

Zero-shot approach: fixed ARIMA(1,1,0) order — no grid search / auto-arima.

Requirements:
    pip install pandas statsmodels pymongo python-dotenv

Usage:
    python 08_arima_trend_forecast.py
    python 08_arima_trend_forecast.py --pipeline pipeline5 --forecast-steps 5
    python 08_arima_trend_forecast.py --all-pipelines
    python 08_arima_trend_forecast.py --no-save       # dry-run, no DB write
"""
import argparse
import json
import os
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Optional

import numpy as np

# ---------------------------------------------------------------------------
# Optional imports (graceful failure with clear messages)
# ---------------------------------------------------------------------------
try:
    from bson import ObjectId
except ImportError:
    print("ERROR: pymongo required.  pip install pymongo")
    sys.exit(1)

try:
    from pymongo import MongoClient
except ImportError:
    print("ERROR: pymongo required.  pip install pymongo")
    sys.exit(1)

try:
    from dotenv import load_dotenv
except ImportError:
    print("ERROR: python-dotenv required.  pip install python-dotenv")
    sys.exit(1)

try:
    from statsmodels.tsa.arima.model import ARIMA
except ImportError:
    print("ERROR: statsmodels required.  pip install statsmodels")
    sys.exit(1)

# ---------------------------------------------------------------------------
# Paths & config
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).resolve().parent           # 2_ml_modeling/
PROJECT_ROOT = SCRIPT_DIR.parent
BACKEND_ENV = PROJECT_ROOT / "3_app_system" / "backend" / ".env"
RESULTS_DIR = SCRIPT_DIR / "results"
OUTPUT_JSON = RESULTS_DIR / "arima_forecast_results.json"

load_dotenv(BACKEND_ENV, override=True)
MONGO_URI = os.getenv("MONGO_URI")
if not MONGO_URI:
    print(f"ERROR: MONGO_URI not set.  Checked: {BACKEND_ENV}")
    sys.exit(1)

DB_NAME = "MyParliament"
ARIMA_COLLECTION = "hansard_arima"
INFERENCE_COLLECTION = "hansard_inference"
TOPIC_COLLECTION = "hansard_topic"
CPATF_COLLECTION = "hansard_cpatf"
RAW_COLLECTION = "HansardDocument"

# ARIMA order — zero-shot fixed order (p=1, d=1, q=0)
ARIMA_ORDER = (1, 1, 0)

ALL_PIPELINES = ["pipeline1", "pipeline2", "pipeline3", "pipeline4", "pipeline5", "pipeline6"]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _era_sort_key(era: str) -> tuple:
    """Sort era strings chronologically: '13_1_2' -> (13, 1, 2)."""
    try:
        parts = str(era).replace("-", "_").split("_")
        return tuple(int(x) for x in parts[:3] if x.isdigit())
    except (ValueError, AttributeError):
        return (0, 0, 0)


def _coerce_object_id(raw_id):
    if isinstance(raw_id, ObjectId):
        return raw_id
    try:
        return ObjectId(str(raw_id))
    except Exception:
        return raw_id


def _format_era_label(era: str) -> str:
    """Turn '13_1_2' into 'P13 Pg1 M2' for display."""
    parts = str(era).split("_")
    if len(parts) >= 3:
        return f"P{parts[0]} Pg{parts[1]} M{parts[2]}"
    return era


# ---------------------------------------------------------------------------
# Core: fetch document eras
# ---------------------------------------------------------------------------

def get_doc_eras(db, doc_ids: list, pipeline_id: str) -> list:
    """
    For each doc_id return its era string (parlimen_penggal_mesyuarat).
    Pipelines 1–2 read from HansardDocument; 3–6 from hansard_cpatf.
    Falls back to 'Unknown' when fields are absent.
    """
    coll_name = RAW_COLLECTION if pipeline_id in ("pipeline1", "pipeline2") else CPATF_COLLECTION
    coll = db[coll_name]

    id_list = [_coerce_object_id(d) for d in doc_ids]
    proj = {"_id": 1, "parlimen": 1, "penggal": 1, "mesyuarat": 1, "parlimen_range": 1}
    cursor = coll.find({"_id": {"$in": id_list}}, proj)
    id_to_doc = {str(d["_id"]): d for d in cursor}

    eras = []
    for raw_id in doc_ids:
        key = str(raw_id) if not isinstance(raw_id, ObjectId) else str(raw_id)
        # try direct key, then ObjectId-converted key
        d = id_to_doc.get(key) or id_to_doc.get(str(_coerce_object_id(raw_id)))
        if not d:
            eras.append("Unknown")
            continue
        # Prefer parlimen_range if already set
        pr = d.get("parlimen_range")
        if pr:
            eras.append(str(pr).strip())
            continue
        p, pg, m = d.get("parlimen"), d.get("penggal"), d.get("mesyuarat")
        if p is not None and pg is not None and m is not None:
            eras.append(f"{p}_{pg}_{m}")
        else:
            eras.append("Unknown")
    return eras


# ---------------------------------------------------------------------------
# Core: build era x cluster count matrix
# ---------------------------------------------------------------------------

def build_era_counts(doc_ids: list, clusters: np.ndarray, doc_eras: list):
    """
    Returns (unique_eras_sorted, freq_matrix).
    freq_matrix shape: (n_clusters, len(unique_eras)).
    """
    n_clusters = int(np.max(clusters)) + 1
    counts: dict = defaultdict(lambda: defaultdict(int))

    for i, raw_id in enumerate(doc_ids):
        if i >= len(clusters):
            break
        era = doc_eras[i] if i < len(doc_eras) else "Unknown"
        if era == "Unknown":
            continue
        c = int(clusters[i])
        counts[era][c] += 1

    unique_eras = sorted(
        [e for e in counts if e != "Unknown"],
        key=_era_sort_key,
    )
    freq = np.zeros((n_clusters, len(unique_eras)), dtype=np.float64)
    for idx, era in enumerate(unique_eras):
        for c, cnt in counts[era].items():
            if 0 <= c < n_clusters:
                freq[c, idx] = cnt
    return unique_eras, freq


# ---------------------------------------------------------------------------
# Core: run ARIMA for one pipeline
# ---------------------------------------------------------------------------

def run_arima(
    db,
    pipeline_id: str,
    forecast_steps: int = 3,
    arima_order: tuple = ARIMA_ORDER,
) -> dict:
    """
    Full ARIMA pipeline for one pipeline_id.
    Returns result dict ready for MongoDB / JSON storage.
    """
    # 1. Load inference
    inf = db[INFERENCE_COLLECTION].find_one({"pipelineId": pipeline_id})
    if not inf:
        return {"error": f"No inference document found for {pipeline_id}"}

    doc_ids = list(inf.get("docIds") or [])
    clusters_raw = list(inf.get("clusters") or [])
    if not doc_ids or not clusters_raw:
        return {"error": f"Empty docIds/clusters for {pipeline_id}"}

    clusters = np.array(clusters_raw, dtype=np.int32)
    n_clusters = int(np.max(clusters)) + 1

    # 2. Resolve eras
    print(f"  Resolving {len(doc_ids)} document eras ...")
    doc_eras = get_doc_eras(db, doc_ids, pipeline_id)

    # 3. Build era x cluster matrix
    unique_eras, freq = build_era_counts(doc_ids, clusters, doc_eras)
    n_eras = len(unique_eras)
    print(f"  {n_eras} eras, {n_clusters} clusters")

    if n_eras < 2:
        return {
            "pipeline_id": pipeline_id,
            "time_points": unique_eras,
            "time_labels": [_format_era_label(e) for e in unique_eras],
            "series": {},
            "forecasts": {},
            "n_clusters": n_clusters,
            "n_eras": n_eras,
            "status": "insufficient_eras",
            "message": f"Need >= 2 eras, found {n_eras}",
            "forecast_steps": forecast_steps,
            "arima_order": list(arima_order),
            "generated_at": datetime.utcnow().isoformat(),
        }

    # 4. Load high/medium quality topic labels
    topic_docs = list(
        db[TOPIC_COLLECTION].find(
            {
                "pipeline_id": pipeline_id,
                "metadata.label_quality": {"$in": ["high", "medium"]},
            },
            {"cluster_id": 1, "topic_label": 1, "_id": 0},
        )
    )
    cluster_id_to_label: dict = {}
    for td in topic_docs:
        cid = td.get("cluster_id")
        lbl = (td.get("topic_label") or {})
        name = lbl.get("name_en") or lbl.get("name_ms") or f"Cluster_{cid}"
        if cid is not None:
            cluster_id_to_label[int(cid)] = name

    if not cluster_id_to_label:
        # Fallback: use all clusters generically
        for c in range(n_clusters):
            cluster_id_to_label[c] = f"Cluster_{c}"

    # 5. Fit ARIMA per cluster
    series_out: dict = {}
    forecasts_out: dict = {}
    trend_out: dict = {}

    for cid, label in cluster_id_to_label.items():
        if cid >= n_clusters:
            continue
        series = freq[cid].tolist()
        series_out[label] = series

        total = sum(series)
        if total == 0 or n_eras < 2:
            forecasts_out[label] = [0.0] * forecast_steps
            trend_out[label] = "stable"
            continue

        try:
            model = ARIMA(series, order=arima_order).fit()
            raw_fc = model.forecast(steps=forecast_steps).tolist()
            forecasts_out[label] = [max(0.0, round(float(x), 4)) for x in raw_fc]

            # Simple trend: compare mean of last 3 historical vs forecast
            recent = np.mean(series[-3:]) if len(series) >= 3 else np.mean(series)
            future = np.mean(forecasts_out[label])
            if future > recent * 1.1:
                trend_out[label] = "increasing"
            elif future < recent * 0.9:
                trend_out[label] = "decreasing"
            else:
                trend_out[label] = "stable"
        except Exception as exc:
            forecasts_out[label] = [0.0] * forecast_steps
            trend_out[label] = "unknown"
            print(f"    ARIMA failed for '{label}': {exc}")

    # 6. Compute total activity per topic (for ranking)
    topic_totals = {lbl: sum(v) for lbl, v in series_out.items()}

    return {
        "pipeline_id": pipeline_id,
        "time_points": unique_eras,
        "time_labels": [_format_era_label(e) for e in unique_eras],
        "series": series_out,
        "forecasts": forecasts_out,
        "trends": trend_out,
        "topic_totals": topic_totals,
        "n_clusters": n_clusters,
        "n_eras": n_eras,
        "n_topics_forecasted": len(forecasts_out),
        "status": "ok",
        "forecast_steps": forecast_steps,
        "arima_order": list(arima_order),
        "generated_at": datetime.utcnow().isoformat(),
    }


# ---------------------------------------------------------------------------
# Save helpers
# ---------------------------------------------------------------------------

def save_to_mongodb(client, result: dict):
    if "error" in result:
        print(f"  Skipping MongoDB save (error result)")
        return
    db = client[DB_NAME]
    col = db[ARIMA_COLLECTION]
    pid = result["pipeline_id"]
    col.delete_many({"pipeline_id": pid})
    # Remove _id if present before insert
    doc = {k: v for k, v in result.items() if k != "_id"}
    col.insert_one(doc)
    print(f"  Saved to MongoDB collection '{ARIMA_COLLECTION}' (pipeline_id={pid})")


def save_to_json(all_results: dict):
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    # Convert to JSON-serialisable (numpy values -> python)
    def _clean(obj):
        if isinstance(obj, np.integer):
            return int(obj)
        if isinstance(obj, np.floating):
            return float(obj)
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        if isinstance(obj, dict):
            return {k: _clean(v) for k, v in obj.items()}
        if isinstance(obj, list):
            return [_clean(i) for i in obj]
        return obj

    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(_clean(all_results), f, indent=2, ensure_ascii=False)
    print(f"  Saved JSON to {OUTPUT_JSON}")


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="ARIMA trend forecast for Issue Portal topic activity (zero-shot ARIMA(1,1,0))"
    )
    parser.add_argument(
        "--pipeline",
        type=str,
        default="pipeline5",
        help="Pipeline ID to process (default: pipeline5)",
    )
    parser.add_argument(
        "--all-pipelines",
        action="store_true",
        help="Process all 6 pipelines instead of just --pipeline",
    )
    parser.add_argument(
        "--forecast-steps",
        type=int,
        default=3,
        help="Number of future sessions to forecast (default: 3)",
    )
    parser.add_argument(
        "--no-save",
        action="store_true",
        help="Dry-run: print results but do not write to MongoDB or JSON",
    )
    args = parser.parse_args()

    pipelines = ALL_PIPELINES if args.all_pipelines else [args.pipeline]

    print(f"Connecting to MongoDB ...")
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=10_000)
    db = client[DB_NAME]

    all_results = {}

    for pid in pipelines:
        print(f"\n[{pid}] Running ARIMA(1,1,0) forecast ...")
        result = run_arima(db, pid, forecast_steps=args.forecast_steps)

        if "error" in result:
            print(f"  ERROR: {result['error']}")
            all_results[pid] = result
            continue

        status = result.get("status", "unknown")
        n_eras = result.get("n_eras", 0)
        n_fc = result.get("n_topics_forecasted", 0)
        print(f"  status          : {status}")
        print(f"  eras            : {n_eras}")
        print(f"  topics forecast : {n_fc}")
        if result.get("trends"):
            inc = sum(1 for t in result["trends"].values() if t == "increasing")
            dec = sum(1 for t in result["trends"].values() if t == "decreasing")
            print(f"  trends          : {inc} increasing, {dec} decreasing, {n_fc - inc - dec} stable/unknown")

        all_results[pid] = result

        if not args.no_save:
            save_to_mongodb(client, result)

    if not args.no_save:
        save_to_json(all_results)
    else:
        print("\n[dry-run] Results NOT saved (--no-save flag set)")

    client.close()
    print("\nDone.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
