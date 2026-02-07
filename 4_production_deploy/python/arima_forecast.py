#!/usr/bin/env python3
"""
ARIMA forecasting for topic trends across parliamentary sessions.

- Uses Session_range.xlsx (2_ml_modeling) for session -> era mapping.
- Reads docIds + clusters from hansard_inference; session (parlimen/penggal/mesyuarat)
  from hansard_cpatf (P3-P6) or HansardDocument (P1-P2). P1/P2 may have 0 eras if
  raw collection lacks session fields; use takwim_scheduler or backfill session on raw.
- Only runs ARIMA for high/medium quality topics (hansard_topic.metadata.label_quality).
- User can select time range (--start-era, --end-era).
- Writes results to hansard_arima for display and takwim_scheduler.

Requirements: pip install pandas openpyxl statsmodels pymongo python-dotenv

Usage:
  python arima_forecast.py
  python arima_forecast.py --start-era 10_1_1 --end-era 14_2_3
  python arima_forecast.py --pipeline pipeline5 --forecast-steps 5
"""
import argparse
import re
import os
from pathlib import Path
from datetime import datetime
from collections import defaultdict
from typing import Optional

import numpy as np
from bson import ObjectId
from pymongo import MongoClient
from dotenv import load_dotenv

try:
    import pandas as pd
except ImportError:
    pd = None

try:
    from statsmodels.tsa.arima.model import ARIMA
except ImportError:
    ARIMA = None

# Paths
project_root = Path(__file__).resolve().parents[2]
backend_env_path = project_root / "3_app_system" / "backend" / ".env"
load_dotenv(backend_env_path, override=True)

SESSION_EXCEL = project_root / "2_ml_modeling" / "Session_range.xlsx"
MONGO_URI = os.getenv("MONGO_URI")
if not MONGO_URI:
    raise RuntimeError("MONGO_URI not set")

PIPELINES = ["pipeline1", "pipeline2", "pipeline3", "pipeline4", "pipeline5", "pipeline6"]

# P1/P2 use raw/segmented; P3-P6 use cpatf. For session we always need parlimen/penggal/mesyuarat.
# Inference docIds for P3-P6 are from hansard_cpatf; P1 from raw.
CPATF_COLLECTION = "hansard_cpatf"
SEGMENTED_COLLECTION = "hansard_segmented"
RAW_COLLECTION = "HansardDocument"


def _find_date_columns(columns):
    """Heuristic to find start/end date columns in Session_range.xlsx."""
    lowered = [c.lower().strip() for c in columns]
    start_candidates = ["start", "begin", "from", "mula", "tarikh mula", "date start"]
    end_candidates = ["end", "until", "to", "akhir", "tarikh akhir", "date end"]
    start_col = end_col = None
    for idx, name in enumerate(lowered):
        if any(k in name for k in start_candidates) and ("date" in name or "tarikh" in name):
            start_col = columns[idx]
        if any(k in name for k in end_candidates) and ("date" in name or "tarikh" in name):
            end_col = columns[idx]
    if not start_col:
        for idx, name in enumerate(lowered):
            if name in ("start_date", "date_start", "tarikh_mula", "mula"):
                start_col = columns[idx]
                break
    if not end_col:
        for idx, name in enumerate(lowered):
            if name in ("end_date", "date_end", "tarikh_akhir", "akhir"):
                end_col = columns[idx]
                break
    return start_col, end_col


def load_session_dataframe(excel_path: Path):
    """Load Session_range.xlsx as DataFrame for date-to-era lookup (hansardDate fallback)."""
    if not pd or not excel_path.exists():
        return None
    try:
        df = pd.read_excel(excel_path)
        df = df.rename(columns={c: c.strip() for c in df.columns})
        return df
    except Exception:
        return None


def date_to_era(hansard_date, session_df, session_lookup: dict) -> Optional[str]:
    """
    Map a hansard date to era (parlimen_range) using Session_range.xlsx date ranges.
    Used when document has no parlimen/penggal/mesyuarat/parlimen_range.
    """
    if session_df is None or hansard_date is None:
        return None
    if getattr(hansard_date, "tzinfo", None) is not None:
        hansard_date = hansard_date.replace(tzinfo=None)
    if isinstance(hansard_date, str):
        try:
            hansard_date = pd.to_datetime(hansard_date).to_pydatetime()
            if hasattr(hansard_date, "tzinfo") and hansard_date.tzinfo:
                hansard_date = hansard_date.replace(tzinfo=None)
        except Exception:
            return None
    columns = list(session_df.columns)
    start_col, end_col = _find_date_columns(columns)
    df = session_df.copy()
    if start_col and end_col:
        df[start_col] = pd.to_datetime(df[start_col], errors="coerce")
        df[end_col] = pd.to_datetime(df[end_col], errors="coerce")
        mask = (df[start_col] <= hansard_date) & (df[end_col] >= hansard_date)
        match = df[mask]
    else:
        range_col = None
        for col in columns:
            if "mesyuarat" in col.lower() and "range" in col.lower():
                range_col = col
                break
        if not range_col:
            return None

        def _split_range(value):
            text = str(value or "").strip()
            if "_" in text:
                parts = text.split("_", 1)
                return parts[0].strip(), parts[1].strip()
            m = re.search(r"(\d{4}-\d{2}-\d{2}).*(\d{4}-\d{2}-\d{2})", text)
            if m:
                return m.group(1), m.group(2)
            return None, None

        ranges = df[range_col].apply(_split_range)
        df["_range_start"] = pd.to_datetime([r[0] for r in ranges], errors="coerce")
        df["_range_end"] = pd.to_datetime([r[1] for r in ranges], errors="coerce")
        mask = (df["_range_start"] <= hansard_date) & (df["_range_end"] >= hansard_date)
        match = df[mask]

    if match.empty:
        return None
    row = match.iloc[0]
    cols_lower = {c.strip().lower(): c for c in row.index}
    p = row.get(cols_lower.get("parlimen"))
    pg = row.get(cols_lower.get("penggal"))
    m = row.get(cols_lower.get("mesyuarat"))
    pr = row.get(cols_lower.get("parlimen_range"))
    if p is not None and pg is not None and m is not None:
        composite = f"{str(p).strip()}_{str(pg).strip()}_{str(m).strip()}"
        return session_lookup.get(composite, composite) if session_lookup else composite
    if pr is not None:
        return str(pr).strip()
    return None


def load_session_lookup(excel_path: Path):
    """Build composite_key (parlimen_penggal_mesyuarat) -> parlimen_range from Excel."""
    if not pd or not excel_path.exists():
        return {}
    df = pd.read_excel(excel_path)
    # Normalize: strip and lowercase for lookup
    strip_cols = {c: c.strip() for c in df.columns}
    df = df.rename(columns=strip_cols)
    cols_lower = {c.strip().lower(): c.strip() for c in df.columns}
    p_col = cols_lower.get("parlimen")
    pg_col = cols_lower.get("penggal")
    m_col = cols_lower.get("mesyuarat")
    range_col = None
    for k, v in cols_lower.items():
        if "parlimen" in k and "range" in k:
            range_col = v
            break
    if not all([p_col, pg_col, m_col]):
        return {}
    for col in [p_col, pg_col, m_col]:
        df[col] = df[col].astype(str).str.strip()
    df["_pk"] = df[p_col] + "_" + df[pg_col] + "_" + df[m_col]
    if range_col and range_col in df.columns:
        return dict(zip(df["_pk"], df[range_col].astype(str)))
    return dict(zip(df["_pk"], df["_pk"]))


def _era_sort_key(era: str):
    """Sort era strings chronologically (e.g. 12_1_1 -> 12, 1, 1)."""
    try:
        parts = era.replace("-", "_").split("_")
        return tuple(int(x) for x in parts[:3] if x.isdigit())
    except (ValueError, AttributeError):
        return (0, 0, 0)


def get_doc_eras(client, doc_ids, pipeline_id: str, session_df=None, session_lookup: dict = None):
    """
    For each doc_id, get era (parlimen_range) from parlimen/penggal/mesyuarat/parlimen_range.
    If those are missing, resolve from hansardDate using Session_range.xlsx (date_to_era).
    Returns list of era per doc (same order as doc_ids).
    """
    db = client["MyParliament"]
    if pipeline_id in ("pipeline1", "pipeline2"):
        coll = db[RAW_COLLECTION]
        proj = {"_id": 1, "parlimen": 1, "penggal": 1, "mesyuarat": 1, "parlimen_range": 1, "hansardDate": 1}
    else:
        coll = db[CPATF_COLLECTION]
        proj = {"_id": 1, "parlimen": 1, "penggal": 1, "mesyuarat": 1, "parlimen_range": 1, "hansardDate": 1}

    session_lookup = session_lookup or {}

    # doc_ids from inference may be str (ObjectId hex); DB may use ObjectId
    id_list = []
    for _id in doc_ids:
        if isinstance(_id, ObjectId):
            id_list.append(_id)
        else:
            try:
                id_list.append(ObjectId(_id))
            except Exception:
                id_list.append(_id)
    cursor = coll.find({"_id": {"$in": id_list}}, proj)
    id_to_doc = {d["_id"]: d for d in cursor}

    def lookup_id(_id):
        if _id in id_to_doc:
            return id_to_doc[_id]
        try:
            return id_to_doc.get(ObjectId(_id))
        except Exception:
            return None

    eras = []
    for _id in doc_ids:
        d = lookup_id(_id)
        if not d:
            eras.append("Unknown")
            continue
        pr = d.get("parlimen_range")
        p, pg, m = d.get("parlimen"), d.get("penggal"), d.get("mesyuarat")
        if pr:
            eras.append(str(pr).strip())
        elif p is not None and pg is not None and m is not None:
            eras.append(f"{p}_{pg}_{m}")
        else:
            # Fallback: resolve era from hansardDate using Session_range.xlsx
            era = date_to_era(d.get("hansardDate"), session_df, session_lookup)
            eras.append(era if era else "Unknown")
    return eras


def build_era_counts(doc_ids, clusters, doc_eras, session_lookup):
    """Map doc era (may be composite key) to parlimen_range if needed, then count per (cluster, era)."""
    # If session_lookup maps composite_key -> parlimen_range, normalize era
    def to_era(tag):
        if not tag or tag == "Unknown":
            return "Unknown"
        return session_lookup.get(tag.strip(), tag)

    n_clusters = int(np.max(clusters)) + 1 if len(clusters) else 0
    counts = defaultdict(lambda: defaultdict(int))
    for i, doc_id in enumerate(doc_ids):
        if i >= len(clusters):
            break
        era = to_era(doc_eras[i] if i < len(doc_eras) else "Unknown")
        if era == "Unknown":
            continue
        c = int(clusters[i])
        counts[era][c] += 1

    unique_eras = sorted(
        [e for e in set(k for k in counts) if e != "Unknown"],
        key=_era_sort_key,
    )
    real_freq = np.zeros((n_clusters, len(unique_eras)))
    for idx, era in enumerate(unique_eras):
        for c, cnt in counts[era].items():
            if c < n_clusters:
                real_freq[c, idx] = cnt
    return unique_eras, real_freq


def run_arima_one_pipeline(
    client,
    pipeline_id: str,
    session_lookup: dict,
    session_df=None,
    start_era: str = None,
    end_era: str = None,
    forecast_steps: int = 3,
    arima_order=(1, 1, 0),
):
    """
    Load inference + session, build counts, run ARIMA for high/medium topics only.
    Returns dict with time_points, forecasts, topic labels, and status.
    """
    db = client["MyParliament"]
    inf = db["hansard_inference"].find_one({"pipelineId": pipeline_id})
    if not inf:
        return {"error": f"No inference for {pipeline_id}"}

    doc_ids = inf.get("docIds") or []
    clusters = inf.get("clusters") or []
    if not doc_ids or not clusters:
        return {"error": f"Missing docIds/clusters for {pipeline_id}"}

    doc_ids = list(doc_ids)
    clusters = np.array(clusters, dtype=np.int32)
    n_clusters = int(np.max(clusters)) + 1

    doc_eras = get_doc_eras(
        client, doc_ids, pipeline_id,
        session_df=session_df,
        session_lookup=session_lookup,
    )
    unique_eras, real_freq = build_era_counts(doc_ids, clusters, doc_eras, session_lookup)

    # User time range filter: keep only eras in [start_era, end_era]
    if start_era or end_era:
        key_fn = _era_sort_key
        indices = []
        for i, e in enumerate(unique_eras):
            k = key_fn(e)
            if start_era and k < key_fn(start_era):
                continue
            if end_era and k > key_fn(end_era):
                continue
            indices.append(i)
        unique_eras = [unique_eras[i] for i in indices]
        real_freq = real_freq[:, indices] if indices else np.zeros((n_clusters, 0))

    # High/medium topics only
    topic_docs = list(
        db["hansard_topic"].find(
            {"pipeline_id": pipeline_id, "metadata.label_quality": {"$in": ["high", "medium"]}}
        )
    )
    cluster_id_to_label = {d["cluster_id"]: d["topic_label"]["name_en"] for d in topic_docs}
    cluster_ids_to_forecast = set(cluster_id_to_label.keys())

    forecasts = {}
    if len(unique_eras) < 2:
        series_by_name = {
            cluster_id_to_label.get(c, f"Cluster_{c}"): real_freq[c].tolist()
            for c in cluster_ids_to_forecast
        }
        for _cid, name in cluster_id_to_label.items():
            forecasts[name] = [0.0] * forecast_steps
        actual_start = start_era if start_era else (unique_eras[0] if unique_eras else None)
        actual_end = end_era if end_era else (unique_eras[-1] if unique_eras else None)
        return {
            "pipeline_id": pipeline_id,
            "time_points": unique_eras,
            "series": series_by_name,
            "forecasts": forecasts,
            "n_clusters": n_clusters,
            "status": "insufficient_eras",
            "message": f"Need at least 2 eras, got {len(unique_eras)}",
            "start_era": actual_start,
            "end_era": actual_end,
            "forecast_steps": forecast_steps,
        }

    # Build history (per-topic counts per era) and forecasts for display
    series_by_name = {}
    for c in range(n_clusters):
        if c not in cluster_ids_to_forecast:
            continue
        name = cluster_id_to_label.get(c, f"Cluster_{c}")
        series = real_freq[c]
        series_by_name[name] = series.tolist()
        try:
            if np.sum(series) == 0:
                forecasts[name] = [0.0] * forecast_steps
            else:
                model = ARIMA(series, order=arima_order).fit()
                raw = model.forecast(steps=forecast_steps).tolist()
                forecasts[name] = [max(0.0, round(float(x), 4)) for x in raw]
        except Exception:
            forecasts[name] = [0.0] * forecast_steps

    # If user didn't specify range, use actual time_points bounds
    actual_start = start_era if start_era else (unique_eras[0] if unique_eras else None)
    actual_end = end_era if end_era else (unique_eras[-1] if unique_eras else None)
    
    return {
        "pipeline_id": pipeline_id,
        "time_points": unique_eras,
        "series": series_by_name,
        "forecasts": forecasts,
        "n_clusters": n_clusters,
        "n_eras": len(unique_eras),
        "status": "ok",
        "generated_at": datetime.utcnow().isoformat(),
        "start_era": actual_start,
        "end_era": actual_end,
        "forecast_steps": forecast_steps,
    }


def _sanitize_forecasts(forecasts_dict: dict) -> dict:
    """Clamp forecast values to >= 0 and round; avoid storing near-zero or negative."""
    out = {}
    for name, values in forecasts_dict.items():
        out[name] = [max(0.0, round(float(x), 4)) for x in values]
    return out


def save_arima_to_mongodb(client, result: dict):
    """Write one document per pipeline to hansard_arima (delete existing then insert)."""
    if "error" in result:
        return
    db = client["MyParliament"]
    col = db["hansard_arima"]
    pid = result["pipeline_id"]
    doc = dict(result)
    if doc.get("status") == "ok":
        doc.pop("message", None)
        if "forecasts" in doc and doc["forecasts"]:
            doc["forecasts"] = _sanitize_forecasts(doc["forecasts"])
    col.delete_many({"pipeline_id": pid})
    col.insert_one(doc)


def main():
    parser = argparse.ArgumentParser(description="ARIMA forecast for topic trends (6 pipelines, high/medium only)")
    parser.add_argument("--pipeline", type=str, help="Single pipeline (e.g. pipeline5). Default: all.")
    parser.add_argument("--start-era", type=str, help="Start era (e.g. 12_1_1 or parlimen_range value)")
    parser.add_argument("--end-era", type=str, help="End era (e.g. 14_2_3)")
    parser.add_argument("--forecast-steps", type=int, default=3, help="ARIMA forecast steps (default 3)")
    parser.add_argument("--no-save", action="store_true", help="Do not write to hansard_arima")
    args = parser.parse_args()

    if not pd:
        print("ERROR: pandas required. pip install pandas openpyxl")
        return 1
    if not ARIMA:
        print("ERROR: statsmodels required. pip install statsmodels")
        return 1

    session_lookup = load_session_lookup(SESSION_EXCEL)
    session_df = load_session_dataframe(SESSION_EXCEL)
    if not session_lookup:
        print("WARNING: Session_range.xlsx not loaded or empty; using era as-is from DB.")
    if session_df is None:
        print("WARNING: Session_range.xlsx not loaded; P1/P2 era fallback from hansardDate disabled.")

    pipelines = [args.pipeline] if args.pipeline else PIPELINES
    client = MongoClient(MONGO_URI)

    for pipeline_id in pipelines:
        print(f"\n{pipeline_id} ...")
        result = run_arima_one_pipeline(
            client,
            pipeline_id,
            session_lookup,
            session_df=session_df,
            start_era=args.start_era,
            end_era=args.end_era,
            forecast_steps=args.forecast_steps,
        )
        if "error" in result:
            print(f"  ERROR: {result['error']}")
            continue
        print(f"  time_points: {len(result['time_points'])} eras")
        print(f"  forecasts: {len(result['forecasts'])} topics")
        print(f"  status: {result.get('status')}")
        if not args.no_save:
            save_arima_to_mongodb(client, result)
            print("  saved to hansard_arima")

    client.close()
    return 0


if __name__ == "__main__":
    exit(main())
