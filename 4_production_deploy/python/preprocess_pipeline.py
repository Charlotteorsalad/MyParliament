#!/usr/bin/env python3
"""
Production preprocessing pipeline:
1) Segmentation: HansardDocument -> hansard_segmented
2) CPATF: hansard_segmented -> hansard_cpatf

This replaces the notebooks with a resumable, production-safe script.
All outputs come from MongoDB source data.
"""
import argparse
import hashlib
import json
import os
import re
import threading
import time
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

import pymongo
from bson import ObjectId
from dotenv import load_dotenv
from rapidfuzz import process as rf_process
import pandas as pd
from tqdm import tqdm

try:
    import fasttext
except ImportError as exc:
    raise ImportError("fasttext is required for CPATF. Install with: pip install fasttext") from exc

project_root = Path(__file__).resolve().parents[2]
backend_env_path = project_root / "3_app_system" / "backend" / ".env"
load_dotenv(backend_env_path, override=True)

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/MyParliament")

CONFIG = {
    "DB_NAME": "MyParliament",
    "SOURCE_COLLECTION": "HansardDocument",
    "CORE500_COLLECTION": "hansard_core500",
    "SEGMENTED_COLLECTION": "hansard_segmented",
    "CPATF_COLLECTION": "hansard_cpatf",
    "HONORIFIC_COLLECTION": "honorific_dictionary",
    "MP_COLLECTION": "MP",
    "MAX_WORKERS": int(os.getenv("PREPROCESS_MAX_WORKERS", "48")),
    "BATCH_SIZE": int(os.getenv("PREPROCESS_BATCH_SIZE", "100")),
    "FASTTEXT_MODEL_PATH": os.getenv("FASTTEXT_MODEL_PATH", str(Path(__file__).parent / "lid.176.bin")),
    "AUTO_DOWNLOAD_FASTTEXT": os.getenv("AUTO_DOWNLOAD_FASTTEXT", "true").lower() == "true",
    "EXECUTOR": os.getenv("PREPROCESS_EXECUTOR", "process").lower(),
    "HEARTBEAT_SECS": int(os.getenv("PREPROCESS_HEARTBEAT_SECS", "60")),
    "WARN_DOC_SECS": int(os.getenv("PREPROCESS_WARN_DOC_SECS", "300")),
    "DISABLE_FUZZY": os.getenv("PREPROCESS_DISABLE_FUZZY", "false").lower() == "true"
}

thread_local = threading.local()
_SEGMENTATION_CONTEXT = {}
_CPATF_CONTEXT = {}
_MP_NAMES_TUPLE = ()


def _set_mp_names(names: List[str]):
    global _MP_NAMES_TUPLE
    _MP_NAMES_TUPLE = tuple(names)


def _cached_match(candidate: str):
    from functools import lru_cache

    @lru_cache(maxsize=50000)
    def _match(text: str):
        if not _MP_NAMES_TUPLE:
            return None, 0
        return rf_process.extractOne(text, _MP_NAMES_TUPLE)

    return _match(candidate)


def get_db_connection():
    if not hasattr(thread_local, "client"):
        thread_local.client = pymongo.MongoClient(MONGO_URI)
    return thread_local.client[CONFIG["DB_NAME"]]


def load_session_ranges_dataframe():
    """Load Session_range.xlsx for filling session fields if missing."""
    session_file = project_root / "2_ml_modeling" / "Session_range.xlsx"
    if not session_file.exists():
        print("Session_range.xlsx not found, will not fill session fields.")
        return None
    try:
        session_df = pd.read_excel(session_file)
        return session_df
    except Exception as exc:
        print(f"Failed to read Session_range.xlsx: {exc}")
        return None


def _find_date_columns(columns: List[str]):
    """Heuristic to find start/end date columns."""
    lowered = [c.lower() for c in columns]
    start_candidates = ["start", "begin", "from", "mula", "tarikh mula", "date start"]
    end_candidates = ["end", "until", "to", "akhir", "tarikh akhir", "date end"]

    start_col = None
    end_col = None

    for idx, name in enumerate(lowered):
        if (any(k in name for k in start_candidates) and ("date" in name or "tarikh" in name)):
            start_col = columns[idx]
        if (any(k in name for k in end_candidates) and ("date" in name or "tarikh" in name)):
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


def resolve_session_fields(hansard_date: datetime, session_df: Optional[pd.DataFrame]) -> Dict:
    """Fill parlimen/penggal/mesyuarat/parlimen_range using Session_range.xlsx."""
    if session_df is None or hansard_date is None:
        return {}

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
            lowered = col.lower()
            if "mesyuarat" in lowered and "range" in lowered:
                range_col = col
                break
        if not range_col:
            return {}

        def _split_range(value):
            text = str(value or "").strip()
            if "_" in text:
                parts = text.split("_", 1)
                return parts[0].strip(), parts[1].strip()
            match = re.search(r"(\d{4}-\d{2}-\d{2}).*(\d{4}-\d{2}-\d{2})", text)
            if match:
                return match.group(1), match.group(2)
            return None, None

        ranges = df[range_col].apply(_split_range)
        df["_range_start"] = pd.to_datetime([r[0] for r in ranges], errors="coerce")
        df["_range_end"] = pd.to_datetime([r[1] for r in ranges], errors="coerce")
        mask = (df["_range_start"] <= hansard_date) & (df["_range_end"] >= hansard_date)
        match = df[mask]

    if match.empty:
        return {}

    row = match.iloc[0]
    def _normalize_numeric(value):
        if value is None:
            return None
        if isinstance(value, (int, float, bool)):
            return int(value)
        if hasattr(value, "item"):
            try:
                return int(value.item())
            except Exception:
                return value.item()
        return value

    return {
        "parlimen": _normalize_numeric(row["parlimen"]) if "parlimen" in row else None,
        "penggal": _normalize_numeric(row["penggal"]) if "penggal" in row else None,
        "mesyuarat": _normalize_numeric(row["mesyuarat"]) if "mesyuarat" in row else None,
        "parlimen_range": row["parlimen_range"] if "parlimen_range" in row else None,
    }


def ensure_fasttext_model():
    model_path = Path(CONFIG["FASTTEXT_MODEL_PATH"])
    if model_path.exists():
        return str(model_path)
    if not CONFIG["AUTO_DOWNLOAD_FASTTEXT"]:
        raise FileNotFoundError(
            f"FastText model not found at {model_path}. "
            "Download it or set AUTO_DOWNLOAD_FASTTEXT=true."
        )
    print("Downloading FastText language model (lid.176.bin)...")
    import urllib.request
    url = "https://dl.fbaipublicfiles.com/fasttext/supervised-models/lid.176.bin"
    urllib.request.urlretrieve(url, str(model_path))
    if not model_path.exists():
        raise FileNotFoundError("FastText model download failed.")
    return str(model_path)


def load_honorifics(db) -> List[str]:
    honorific_doc = db[CONFIG["HONORIFIC_COLLECTION"]].find_one({"version": "2.0"})
    if not honorific_doc:
        raise ValueError("honorific_dictionary version 2.0 not found")
    all_honorifics = set()
    for category in honorific_doc["categories"].values():
        all_honorifics.update([h.strip().rstrip("'") for h in category])
    all_honorifics.update(["Yang Berhormat", "Timbalan Yang di-Pertua", "Enche'", "Mr."])
    return sorted(all_honorifics, key=len, reverse=True)


def build_honorific_regex(all_honorifics: List[str]) -> str:
    return "|".join(all_honorifics)


def clean_line(line: str) -> Optional[str]:
    line = re.sub(r"\s+", " ", line.strip())
    if not line or re.match(r"^[\d\W]+$", line):
        return None
    return line


def _select_document_text(doc: Dict) -> str:
    ocr_text = doc.get("ocr_text") or ""
    processable = doc.get("processable")
    low_ocr_resol = doc.get("low_ocr_resol")
    text_quality = doc.get("text_quality")
    ocr_status = doc.get("ocr_status")

    # Follow OCR pipeline flags: only trust OCR text when marked processable/solved
    if ocr_text and ocr_text.strip():
        if processable is True or low_ocr_resol == "solved":
            return ocr_text

    full_text = doc.get("full_text") or ""
    if full_text and full_text.strip():
        return full_text
    content_text = doc.get("content_text") or ""
    if content_text and content_text.strip():
        return content_text
    return ""


def skip_header_and_doa(lines: List[str], all_honorifics: List[str], max_lines: int = 300) -> int:
    start_idx = 0
    in_attendance = False
    attendance_keywords = ["KEHADIRAN AHLI-AHLI", "AHLI-AHLI YANG HADIR", "KEHADIRAN"]
    for i, line in enumerate(lines[:max_lines]):
        stripped = line.strip().upper()
        if any(kw in stripped for kw in attendance_keywords + [
            "NASKHAH BELUM DISEM", "DEWAN RAKYAT", "PENGGAL", "MESYUARAT",
            "KANDUNGAN", "WAKTU PERTANYAAN", "BIL."
        ]):
            start_idx = i + 1
            if any(kw in stripped for kw in attendance_keywords):
                in_attendance = True
        if "DOA" in stripped and len(stripped.split()) < 10:
            start_idx = max(start_idx, i + 1)
        if in_attendance and (":" in stripped and any(h in stripped.upper() for h in all_honorifics)):
            in_attendance = False
            start_idx = i
    return start_idx


def get_decade(year: int) -> str:
    return "pre1970" if year < 1970 else "post1970"


def build_speaker_patterns(honorific_regex: str):
    primary = re.compile(
        rf"^({honorific_regex})\s+([A-Za-z'\s]+?)\s*(\[([A-Za-z\s\-]+)\])?:?\s*",
        re.IGNORECASE
    )
    fallback = re.compile(r"^([A-Z][A-Za-z'\s]+?)\s*(\[.*?\])?:?\s*", re.IGNORECASE)
    english_old = re.compile(r"^(Mr\.|Encik|Tuan|Enche')\s+([A-Za-z\s]+?):", re.IGNORECASE)
    return primary, fallback, english_old


def _normalize_name(name: str) -> str:
    normalized = re.sub(r"\s+", " ", (name or "").strip()).lower()
    normalized = re.sub(r"[^\w\s'\-\.]", "", normalized)
    return normalized


def _looks_like_person_name(text: str) -> bool:
    if not text:
        return False
    if len(text) > 80:
        return False
    if any(char.isdigit() for char in text):
        return False
    tokens = text.split()
    if len(tokens) > 8:
        return False
    return True


ORDINAL_MAP = {
    "PERTAMA": 1,
    "KEDUA": 2,
    "KETIGA": 3,
    "KEEMPAT": 4,
    "KELIMA": 5,
    "KEENAM": 6,
    "KETUJUH": 7,
    "KELAPAN": 8,
    "KESEMBILAN": 9,
    "KESEPULUH": 10,
    "KESEBELAS": 11,
    "KEDUA BELAS": 12,
    "KETIGA BELAS": 13,
    "KEEMPAT BELAS": 14,
    "KELIMA BELAS": 15,
    "KEENAM BELAS": 16,
    "KETUJUH BELAS": 17,
    "KELAPAN BELAS": 18,
    "KESEMBILAN BELAS": 19,
    "KEDUA PULUH": 20
}


def _normalize_ordinal_text(text: str) -> str:
    cleaned = re.sub(r"[\-]", " ", text.upper()).strip()
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned


def parse_ordinal(text: str) -> Optional[int]:
    if not text:
        return None
    num_match = re.search(r"\b(\d{1,2})\b", text)
    if num_match:
        try:
            return int(num_match.group(1))
        except ValueError:
            return None
    normalized = _normalize_ordinal_text(text)
    return ORDINAL_MAP.get(normalized)


def extract_header_metadata(text: str) -> Dict[str, Optional[int]]:
    """
    Extract parlimen/penggal/mesyuarat from document header text.
    Returns numeric values when possible.
    """
    result = {
        "parlimen": None,
        "penggal": None,
        "mesyuarat": None
    }
    if not text:
        return result

    for line in text.splitlines()[:80]:
        upper = line.upper().strip()
        if "PARLIMEN" in upper and result["parlimen"] is None:
            after = upper.split("PARLIMEN", 1)[1].strip()
            result["parlimen"] = parse_ordinal(after)
        if "PENGGAL" in upper and result["penggal"] is None:
            after = upper.split("PENGGAL", 1)[1].strip()
            result["penggal"] = parse_ordinal(after)
        if "MESYUARAT" in upper and result["mesyuarat"] is None:
            after = upper.split("MESYUARAT", 1)[1].strip()
            result["mesyuarat"] = parse_ordinal(after)

    return result


def extract_speaker(line: str, decade: str, mp_names: List[str], mp_name_lookup: Dict[str, str], primary, fallback, english_old):
    if ":" not in line:
        return None, None
    if decade == "pre1970":
        m = english_old.match(line)
        if m:
            candidate = m.group(1) + " " + m.group(2).strip()
            normalized = _normalize_name(candidate)
            if normalized in mp_name_lookup:
                return mp_name_lookup[normalized], None
            if CONFIG["DISABLE_FUZZY"] or not _looks_like_person_name(candidate):
                return candidate, None
            best_match, score, _ = _cached_match(candidate)
            if score and score > 85:
                return best_match, None

    m = primary.match(line)
    if m:
        honorific = m.group(1).strip()
        name = m.group(2).strip()
        candidate = f"{honorific} {name}"
        normalized = _normalize_name(candidate)
        if normalized in mp_name_lookup:
            constituency = m.group(4) if m.group(4) else None
            return mp_name_lookup[normalized], constituency
        if CONFIG["DISABLE_FUZZY"] or not _looks_like_person_name(candidate):
            constituency = m.group(4) if m.group(4) else None
            return candidate, constituency
        best_match, score, _ = _cached_match(candidate)
        if score and score > 85:
            constituency = m.group(4) if m.group(4) else None
            return best_match, constituency

    m = fallback.match(line)
    if m:
        candidate = m.group(1).strip()
        normalized = _normalize_name(candidate)
        if normalized in mp_name_lookup:
            return mp_name_lookup[normalized], m.group(2)[1:-1] if m.group(2) else None
        if CONFIG["DISABLE_FUZZY"] or not _looks_like_person_name(candidate):
            return candidate, m.group(2)[1:-1] if m.group(2) else None
        best_match, score, _ = _cached_match(candidate)
        if score and score > 85:
            return best_match, m.group(2)[1:-1] if m.group(2) else None
    return None, None


def segment_document(
    doc_id,
    text: str,
    year: int,
    mp_names: List[str],
    mp_name_lookup: Dict[str, str],
    patterns,
    all_honorifics: List[str]
) -> Dict:
    primary, fallback, english_old = patterns
    lines = [clean_line(l) for l in text.splitlines() if clean_line(l)]
    decade = get_decade(year)
    start_idx = skip_header_and_doa(lines, all_honorifics)

    segments = []
    current_speaker = None
    current_constituency = None
    current_text = []
    current_start_line = start_idx

    for i, line in enumerate(lines[start_idx:], start=start_idx):
        speaker, constituency = extract_speaker(line, decade, mp_names, mp_name_lookup, primary, fallback, english_old)
        if speaker:
            if current_speaker and current_text:
                segments.append({
                    "speaker": current_speaker,
                    "constituency": current_constituency,
                    "start_line": current_start_line,
                    "text": " ".join(current_text).strip()
                })
            current_speaker = speaker
            current_constituency = constituency
            content = line.split(":", 1)[1].strip() if ":" in line else line
            current_text = [content] if content else []
            current_start_line = i
        elif current_speaker:
            current_text.append(line)

    if current_speaker and current_text:
        segments.append({
            "speaker": current_speaker,
            "constituency": current_constituency,
            "start_line": current_start_line,
            "text": " ".join(current_text).strip()
        })

    return {
        "document_id": str(doc_id),
        "hansardDate": year,
        "decade": decade,
        "segment_count": len(segments),
        "segments": segments
    }


def _ensure_unique_original_id_index(collection, collection_label: str):
    try:
        collection.create_index([("original_id", pymongo.ASCENDING)], unique=True, name="uniq_original_id")
    except pymongo.errors.OperationFailure as exc:
        raise RuntimeError(
            f"Failed to create unique index on {collection_label}.original_id. "
            "Resolve duplicate data before rerunning."
        ) from exc


def _safe_insert_many(collection, batch: List[Dict], label: str):
    if not batch:
        return 0, 0
    try:
        result = collection.insert_many(batch, ordered=False)
        return len(result.inserted_ids), 0
    except pymongo.errors.BulkWriteError as exc:
        details = exc.details or {}
        inserted = details.get("nInserted", 0)
        dup_errors = [e for e in details.get("writeErrors", []) if e.get("code") == 11000]
        dup_count = len(dup_errors)
        print(f"{label}: DuplicateKeyError x{dup_count}, skipped duplicates.")
        return inserted, dup_count


def _init_segmentation_worker(
    mp_names: List[str],
    mp_name_lookup: Dict[str, str],
    patterns,
    all_honorifics: List[str],
    session_df: Optional[pd.DataFrame],
    core500_ids: set,
    check_existing: bool,
    processed_ids: Optional[set],
    processed_ids_lock: Optional[threading.Lock]
):
    global _SEGMENTATION_CONTEXT
    _SEGMENTATION_CONTEXT = {
        "mp_names": mp_names,
        "mp_name_lookup": mp_name_lookup,
        "patterns": patterns,
        "all_honorifics": all_honorifics,
        "session_df": session_df,
        "core500_ids": core500_ids,
        "check_existing": check_existing,
        "processed_ids": processed_ids,
        "processed_ids_lock": processed_ids_lock
    }
    _set_mp_names(mp_names)


def _process_single_doc_segmentation(doc):
    start_time = time.monotonic()
    ctx = _SEGMENTATION_CONTEXT
    original_id = str(doc["_id"])
    if ctx.get("check_existing"):
        lock = ctx.get("processed_ids_lock")
        processed_ids = ctx.get("processed_ids")
        if lock is not None and processed_ids is not None:
            with lock:
                if original_id in processed_ids:
                    return None
        local_segmented_col = get_db_connection()[CONFIG["SEGMENTED_COLLECTION"]]
        if local_segmented_col.find_one({"original_id": original_id}, {"_id": 1}):
            if lock is not None and processed_ids is not None:
                with lock:
                    processed_ids.add(original_id)
            return None

    text = _select_document_text(doc)
    if not text or not doc.get("hansardDate"):
        return None
    year = doc["hansardDate"].year
    header_meta = extract_header_metadata(text)
    session_fields = resolve_session_fields(doc.get("hansardDate"), ctx.get("session_df"))
    segmented_result = segment_document(
        doc["_id"],
        text,
        year,
        ctx["mp_names"],
        ctx["mp_name_lookup"],
        ctx["patterns"],
        ctx["all_honorifics"]
    )
    split_type = doc.get("split_type")
    if not split_type:
        split_type = "core500" if doc["_id"] in ctx["core500_ids"] else "notApplicable"

    result = {
        "original_id": original_id,
        "parent_doc_id": doc["_id"],
        "hansardDate": doc.get("hansardDate"),
        "full_text": text,
        "split_type": split_type,
        "mesyuarat": (
            doc.get("mesyuarat")
            or header_meta["mesyuarat"]
            or session_fields.get("mesyuarat")
            or 0
        ),
        "parlimen": (
            doc.get("parlimen")
            or header_meta["parlimen"]
            or session_fields.get("parlimen")
            or 0
        ),
        "parlimen_range": doc.get("parlimen_range") or session_fields.get("parlimen_range") or "unknown",
        "penggal": (
            doc.get("penggal")
            or header_meta["penggal"]
            or session_fields.get("penggal")
            or 0
        ),
        "decade": segmented_result["decade"],
        "segment_count": segmented_result["segment_count"],
        "segmentation_output": segmented_result["segments"],
        "processed_at": datetime.now(),
        "source_collection": CONFIG["SOURCE_COLLECTION"]
    }
    elapsed = time.monotonic() - start_time
    if elapsed >= CONFIG["WARN_DOC_SECS"]:
        print(
            "Segmentation: slow doc "
            f"original_id={original_id} elapsed={elapsed:.1f}s chars={len(text)}"
        )
    return result


def _init_cpatf_worker(
    honorifics: set,
    fasttext_path: str,
    check_existing: bool,
    processed_ids: Optional[set],
    processed_ids_lock: Optional[threading.Lock]
):
    global _CPATF_CONTEXT
    ft_model = fasttext.load_model(fasttext_path)
    _CPATF_CONTEXT = {
        "honorifics": honorifics,
        "get_lang_indicator": get_lang_indicator_factory(ft_model),
        "check_existing": check_existing,
        "processed_ids": processed_ids,
        "processed_ids_lock": processed_ids_lock
    }


def _process_single_doc_cpatf(doc):
    start_time = time.monotonic()
    ctx = _CPATF_CONTEXT
    original_id = doc.get("original_id")
    if not original_id:
        return None
    if ctx.get("check_existing"):
        lock = ctx.get("processed_ids_lock")
        processed_ids = ctx.get("processed_ids")
        if lock is not None and processed_ids is not None:
            with lock:
                if original_id in processed_ids:
                    return None
        local_cpatf_col = get_db_connection()[CONFIG["CPATF_COLLECTION"]]
        if local_cpatf_col.find_one({"original_id": original_id}, {"_id": 1}):
            if lock is not None and processed_ids is not None:
                with lock:
                    processed_ids.add(original_id)
            return None

    raw_segments = doc.get("segmentation_output", [])
    if not raw_segments:
        return None

    cleaned_segments = []
    cleaned_texts = []

    for idx, item in enumerate(raw_segments):
        if isinstance(item, str):
            original_text = item.strip()
            speaker = None
            constituency = None
            start_line = None
        elif isinstance(item, dict):
            original_text = (item.get("text") or item.get("content") or "").strip()
            speaker = item.get("speaker")
            constituency = item.get("constituency")
            start_line = item.get("start_line")
        else:
            continue

        if not original_text:
            continue

        cleaned = process_long_segment(original_text, ctx["get_lang_indicator"], ctx["honorifics"])
        if not cleaned:
            continue

        cleaned_texts.append(cleaned)
        cleaned_segments.append({
            "segment_index": idx,
            "speaker": speaker,
            "constituency": constituency,
            "start_line": start_line,
            "original_text": original_text,
            "cleaned_text": cleaned,
            "original_token_count": len(original_text.split()),
            "cleaned_token_count": len(cleaned.split()),
            "original_text_hash": hashlib.md5(original_text.encode("utf-8")).hexdigest()
        })

    if not cleaned_segments:
        result = {
            "original_id": doc.get("original_id"),
            "parent_doc_id": doc.get("parent_doc_id"),
            "hansardDate": doc.get("hansardDate"),
            "parlimen": doc.get("parlimen"),
            "penggal": doc.get("penggal"),
            "mesyuarat": doc.get("mesyuarat"),
            "decade": doc.get("decade"),
            "segment_count": len(raw_segments),
            "cleaned_segment_count": 0,
            "cleaned_text": "",
            "segments_cleaned": [],
            "status": "empty",
            "processed_at": datetime.now(),
            "source_collection": CONFIG["SEGMENTED_COLLECTION"]
        }
        elapsed = time.monotonic() - start_time
        if elapsed >= CONFIG["WARN_DOC_SECS"]:
            print(
                "CPATF: slow doc "
                f"original_id={original_id} elapsed={elapsed:.1f}s segments={len(raw_segments)}"
            )
        return result

    result = {
        "original_id": doc.get("original_id"),
        "parent_doc_id": doc.get("parent_doc_id"),
        "hansardDate": doc.get("hansardDate"),
        "parlimen": doc.get("parlimen"),
        "penggal": doc.get("penggal"),
        "mesyuarat": doc.get("mesyuarat"),
        "decade": doc.get("decade"),
        "segment_count": len(raw_segments),
        "cleaned_segment_count": len(cleaned_segments),
        "cleaned_text": " ".join(cleaned_texts),
        "segments_cleaned": cleaned_segments,
        "status": "success",
        "processed_at": datetime.now(),
        "source_collection": CONFIG["SEGMENTED_COLLECTION"]
    }
    elapsed = time.monotonic() - start_time
    if elapsed >= CONFIG["WARN_DOC_SECS"]:
        print(
            "CPATF: slow doc "
            f"original_id={original_id} elapsed={elapsed:.1f}s segments={len(raw_segments)}"
        )
    return result


def run_segmentation(
    max_docs: Optional[int] = None,
    only_missing: bool = True,
    check_existing: bool = True
):
    db = get_db_connection()
    hansard_col = db[CONFIG["SOURCE_COLLECTION"]]
    segmented_col = db[CONFIG["SEGMENTED_COLLECTION"]]
    mp_col = db[CONFIG["MP_COLLECTION"]]
    core_col = db[CONFIG["CORE500_COLLECTION"]]

    _ensure_unique_original_id_index(segmented_col, CONFIG["SEGMENTED_COLLECTION"])

    mp_names = [mp["full_name_with_titles"] for mp in mp_col.find({}, {"full_name_with_titles": 1})]
    mp_name_lookup = {}
    for name in mp_names:
        normalized = _normalize_name(name)
        if normalized and normalized not in mp_name_lookup:
            mp_name_lookup[normalized] = name
    all_honorifics = load_honorifics(db)
    honorific_regex = build_honorific_regex(all_honorifics)
    patterns = build_speaker_patterns(honorific_regex)
    session_df = load_session_ranges_dataframe()
    try:
        core500_ids = set(core_col.distinct("_id"))
    except Exception:
        core500_ids = set()

    executor_type = CONFIG["EXECUTOR"]
    use_process_pool = executor_type == "process"
    processed_ids = set(segmented_col.distinct("original_id")) if only_missing else set()
    processed_ids_lock = threading.Lock() if (check_existing and not use_process_pool) else None
    if processed_ids:
        object_ids = []
        for pid in processed_ids:
            try:
                object_ids.append(ObjectId(pid))
            except Exception:
                continue
        query_filter = {"_id": {"$nin": object_ids}}
    else:
        query_filter = {}

    cursor = hansard_col.find(query_filter, {
        "_id": 1,
        "full_text": 1,
        "content_text": 1,
        "hansardDate": 1,
        "split_type": 1,
        "mesyuarat": 1,
        "parlimen": 1,
        "parlimen_range": 1,
        "penggal": 1
    })
    all_documents = list(cursor)
    if max_docs:
        all_documents = all_documents[:max_docs]

    if not all_documents:
        print("Segmentation: No documents to process.")
        return

    processed_count = 0
    batch = []
    target_collection = get_db_connection()[CONFIG["SEGMENTED_COLLECTION"]]
    total_docs = len(all_documents)
    last_progress_lock = threading.Lock()
    last_progress_time = time.monotonic()
    heartbeat_stop = threading.Event()

    def heartbeat():
        while not heartbeat_stop.wait(CONFIG["HEARTBEAT_SECS"]):
            with last_progress_lock:
                elapsed = time.monotonic() - last_progress_time
                current = processed_count
            if elapsed >= CONFIG["HEARTBEAT_SECS"]:
                print(
                    "Segmentation: heartbeat "
                    f"processed={current}/{total_docs} idle={elapsed:.0f}s"
                )

    heartbeat_thread = threading.Thread(target=heartbeat, daemon=True)
    heartbeat_thread.start()

    _init_segmentation_worker(
        mp_names,
        mp_name_lookup,
        patterns,
        all_honorifics,
        session_df,
        core500_ids,
        check_existing,
        processed_ids if check_existing and not use_process_pool else None,
        processed_ids_lock
    )
    executor_class = ProcessPoolExecutor if use_process_pool else ThreadPoolExecutor
    executor_kwargs = {
        "max_workers": CONFIG["MAX_WORKERS"]
    }
    if use_process_pool:
        executor_kwargs.update({
            "initializer": _init_segmentation_worker,
            "initargs": (
                mp_names,
                mp_name_lookup,
                patterns,
                all_honorifics,
                session_df,
                core500_ids,
                check_existing,
                None,
                None
            )
        })

    with executor_class(**executor_kwargs) as executor:
        futures = [executor.submit(_process_single_doc_segmentation, doc) for doc in all_documents]
        for future in tqdm(
            as_completed(futures),
            total=len(futures),
            desc="Segmentation",
            unit="doc"
        ):
            result = future.result()
            if result:
                batch.append(result)
                processed_count += 1
            with last_progress_lock:
                last_progress_time = time.monotonic()
            if len(batch) >= CONFIG["BATCH_SIZE"]:
                inserted, dupes = _safe_insert_many(target_collection, batch, "Segmentation")
                print(
                    "Segmentation: inserted "
                    f"{inserted} (dupes {dupes}) | total {processed_count}/{len(all_documents)}"
                )
                batch = []

    if batch:
        inserted, dupes = _safe_insert_many(target_collection, batch, "Segmentation")
        print(f"Segmentation: final batch inserted {inserted} (dupes {dupes})")

    heartbeat_stop.set()
    heartbeat_thread.join(timeout=1)
    print(f"Segmentation completed: {processed_count} documents saved to {CONFIG['SEGMENTED_COLLECTION']}")


def backfill_segmented_metadata(limit: Optional[int] = None):
    """
    Backfill missing parlimen/penggal/mesyuarat fields in hansard_segmented
    using header parsing from stored full_text.
    """
    db = get_db_connection()
    segmented_col = db[CONFIG["SEGMENTED_COLLECTION"]]
    session_df = load_session_ranges_dataframe()

    query = {
        "$or": [
            {"parlimen": None},
            {"penggal": None},
            {"mesyuarat": None}
        ]
    }
    cursor = segmented_col.find(query, {
        "_id": 1,
        "full_text": 1,
        "parlimen": 1,
        "penggal": 1,
        "mesyuarat": 1
    })
    docs = list(cursor)
    if limit:
        docs = docs[:limit]

    if not docs:
        print("Backfill: No segmented documents need metadata update.")
        return

    updated = 0
    for doc in docs:
        header_meta = extract_header_metadata(doc.get("full_text", ""))
        session_fields = resolve_session_fields(doc.get("hansardDate"), session_df)
        updates = {}
        if doc.get("parlimen") is None and header_meta["parlimen"] is not None:
            updates["parlimen"] = header_meta["parlimen"]
        if doc.get("parlimen") is None and session_fields.get("parlimen") is not None:
            updates["parlimen"] = session_fields.get("parlimen")
        if doc.get("penggal") is None and header_meta["penggal"] is not None:
            updates["penggal"] = header_meta["penggal"]
        if doc.get("penggal") is None and session_fields.get("penggal") is not None:
            updates["penggal"] = session_fields.get("penggal")
        if doc.get("mesyuarat") is None and header_meta["mesyuarat"] is not None:
            updates["mesyuarat"] = header_meta["mesyuarat"]
        if doc.get("mesyuarat") is None and session_fields.get("mesyuarat") is not None:
            updates["mesyuarat"] = session_fields.get("mesyuarat")
        if doc.get("parlimen_range") is None and session_fields.get("parlimen_range") is not None:
            updates["parlimen_range"] = session_fields.get("parlimen_range")

        if updates:
            segmented_col.update_one({"_id": doc["_id"]}, {"$set": updates})
            updated += 1

    print(f"Backfill: updated {updated} segmented documents.")


# =========================
# CPATF Processing
# =========================
W_LANG = 0.30
W_POS = 0.30
W_RED = 0.15
THRESHOLD = 0.40
LANG_CONF_THRESHOLD = 0.6
REDUNDANCY_WINDOW = 15
CONTENT_POS_TAGS = {"NOUN", "PROPN", "VERB", "ADJ", "ADV", "NUM"}


def is_attendance_list(text: str) -> bool:
    dot_pattern = re.compile(r"(\.\s+[A-Z][a-z]+){5,}")
    num_pattern = re.compile(r"^\d+\.", re.MULTILINE)
    return bool(dot_pattern.search(text) or len(num_pattern.findall(text)) > 5)


def get_lang_indicator_factory(ft_model):
    from functools import lru_cache

    @lru_cache(maxsize=30000)
    def get_lang_indicator(token: str) -> int:
        pred = ft_model.predict(token.replace("\n", " "), k=1)
        lang, conf = pred[0][0].replace("__label__", ""), pred[1][0]
        return 1 if lang in ["ms", "en", "id"] and conf > LANG_CONF_THRESHOLD else 0

    return get_lang_indicator


def get_redundancy_penalty(tokens: List[str], idx: int, honorifics: set) -> float:
    start = max(0, idx - REDUNDANCY_WINDOW // 2)
    end = min(len(tokens), idx + REDUNDANCY_WINDOW // 2 + 1)
    window = [t.lower() for t in tokens[start:end]]
    repeated = sum(max(0, window.count(h) - 1) for h in honorifics if h in window)
    return min(repeated * 0.15, 0.4)


def simple_malay_stem(word: str) -> str:
    word_lower = word.lower()
    if len(word_lower) <= 4:
        return word_lower
    suffixes = ["kan", "an", "i", "lah", "kah", "nya", "tah", "pun", "mu", "ku"]
    for suffix in suffixes:
        if word_lower.endswith(suffix):
            return word_lower[:-len(suffix)]
    return word_lower


def rule_based_pos(word: str) -> str:
    if word and word[0].isupper():
        return "PROPN"
    if word.isdigit() or re.match(r"^\d", word):
        return "NUM"
    if word.lower().endswith(("kan", "i", "lah", "nya", "tah")):
        return "VERB"
    return "NOUN"


def process_segment(segment: str, get_lang_indicator, honorifics: set) -> str:
    if isinstance(segment, list):
        segment = " ".join([s.strip() for s in segment if s.strip()])
    if not segment or not segment.strip():
        return ""
    if is_attendance_list(segment):
        return ""

    segment = segment[:6000]
    words = segment.split()
    if not words:
        return ""

    pos_tags = [rule_based_pos(word) for word in words]
    retained = []

    for idx, word in enumerate(words):
        lang_ind = get_lang_indicator(word)
        pos_ind = 1 if pos_tags[idx] in CONTENT_POS_TAGS else 0
        red_pen = get_redundancy_penalty(words, idx, honorifics)
        score = W_LANG * lang_ind + W_POS * pos_ind - W_RED * red_pen

        force_retain = (
            pos_tags[idx] == "PROPN" or
            pos_tags[idx] == "NUM" or
            len(word) > 8
        )

        if force_retain or score >= THRESHOLD:
            word_lower = word.lower()
            if lang_ind == 1 and not word[0].isupper():
                normalized = simple_malay_stem(word_lower)
            else:
                normalized = word_lower
            retained.append(normalized)

    return " ".join(retained)


def process_long_segment(segment: str, get_lang_indicator, honorifics: set, max_chunk_tokens: int = 1200) -> str:
    words = segment.split()
    total_tokens = len(words)
    if total_tokens <= max_chunk_tokens:
        return process_segment(segment, get_lang_indicator, honorifics)

    retained_words = []
    overlap = 200
    start = 0
    while start < total_tokens:
        end = min(start + max_chunk_tokens, total_tokens)
        chunk_text = " ".join(words[start:end])
        cleaned_chunk = process_segment(chunk_text, get_lang_indicator, honorifics)
        chunk_words = cleaned_chunk.split()
        if chunk_words:
            if retained_words and chunk_words[:50] == retained_words[-50:]:
                retained_words.extend(chunk_words[50:])
            else:
                retained_words.extend(chunk_words)
        start = end - overlap if end < total_tokens else end

    return " ".join(retained_words)


def run_cpatf(
    max_docs: Optional[int] = None,
    only_missing: bool = True,
    check_existing: bool = True
):
    db = get_db_connection()
    segmented_col = db[CONFIG["SEGMENTED_COLLECTION"]]
    cpatf_col = db[CONFIG["CPATF_COLLECTION"]]

    _ensure_unique_original_id_index(cpatf_col, CONFIG["CPATF_COLLECTION"])

    executor_type = CONFIG["EXECUTOR"]
    use_process_pool = executor_type == "process"

    honorific_doc = db[CONFIG["HONORIFIC_COLLECTION"]].find_one({}, {"categories": 1})
    if not honorific_doc:
        raise ValueError("Honorific dictionary not found")
    honorifics = set()
    for titles in honorific_doc.get("categories", {}).values():
        honorifics.update([t.lower() for t in titles])

    fasttext_path = ensure_fasttext_model()
    if not use_process_pool:
        ft_model = fasttext.load_model(fasttext_path)
        get_lang_indicator = get_lang_indicator_factory(ft_model)
    else:
        get_lang_indicator = None

    processed_ids = set(cpatf_col.distinct("original_id")) if only_missing else set()
    processed_ids_lock = threading.Lock() if (check_existing and not use_process_pool) else None
    query_filter = {"original_id": {"$nin": list(processed_ids)}} if processed_ids else {}

    cursor = segmented_col.find(query_filter, {
        "_id": 1,
        "original_id": 1,
        "parent_doc_id": 1,
        "segmentation_output": 1,
        "hansardDate": 1,
        "mesyuarat": 1,
        "parlimen": 1,
        "penggal": 1,
        "decade": 1
    })
    all_docs = list(cursor)
    if max_docs:
        all_docs = all_docs[:max_docs]

    if not all_docs:
        print("CPATF: No documents to process.")
        return

    processed_count = 0
    batch = []
    target_collection = get_db_connection()[CONFIG["CPATF_COLLECTION"]]
    total_docs = len(all_docs)
    last_progress_lock = threading.Lock()
    last_progress_time = time.monotonic()
    heartbeat_stop = threading.Event()

    def heartbeat():
        while not heartbeat_stop.wait(CONFIG["HEARTBEAT_SECS"]):
            with last_progress_lock:
                elapsed = time.monotonic() - last_progress_time
                current = processed_count
            if elapsed >= CONFIG["HEARTBEAT_SECS"]:
                print(
                    "CPATF: heartbeat "
                    f"processed={current}/{total_docs} idle={elapsed:.0f}s"
                )

    heartbeat_thread = threading.Thread(target=heartbeat, daemon=True)
    heartbeat_thread.start()

    if not use_process_pool:
        global _CPATF_CONTEXT
        _CPATF_CONTEXT = {
            "honorifics": honorifics,
            "get_lang_indicator": get_lang_indicator,
            "check_existing": check_existing,
            "processed_ids": processed_ids if check_existing else None,
            "processed_ids_lock": processed_ids_lock
        }

    executor_class = ProcessPoolExecutor if use_process_pool else ThreadPoolExecutor
    executor_kwargs = {
        "max_workers": CONFIG["MAX_WORKERS"]
    }
    if use_process_pool:
        executor_kwargs.update({
            "initializer": _init_cpatf_worker,
            "initargs": (
                honorifics,
                fasttext_path,
                check_existing,
                None,
                None
            )
        })

    with executor_class(**executor_kwargs) as executor:
        futures = [executor.submit(_process_single_doc_cpatf, doc) for doc in all_docs]
        for future in tqdm(
            as_completed(futures),
            total=len(futures),
            desc="CPATF",
            unit="doc"
        ):
            result = future.result()
            if result:
                batch.append(result)
                processed_count += 1
            with last_progress_lock:
                last_progress_time = time.monotonic()
            if len(batch) >= CONFIG["BATCH_SIZE"]:
                inserted, dupes = _safe_insert_many(target_collection, batch, "CPATF")
                print(f"CPATF: inserted {inserted} (dupes {dupes}) | total {processed_count}/{len(all_docs)}")
                batch = []

    if batch:
        inserted, dupes = _safe_insert_many(target_collection, batch, "CPATF")
        print(f"CPATF: final batch inserted {inserted} (dupes {dupes})")

    heartbeat_stop.set()
    heartbeat_thread.join(timeout=1)
    print(f"CPATF completed: {processed_count} documents saved to {CONFIG['CPATF_COLLECTION']}")


def main():
    parser = argparse.ArgumentParser(description="Production preprocessing pipeline")
    parser.add_argument("--skip-segmentation", action="store_true", help="Skip segmentation step")
    parser.add_argument("--skip-cpatf", action="store_true", help="Skip CPATF step")
    parser.add_argument("--max-docs", type=int, default=None, help="Limit documents (testing)")
    parser.add_argument("--process-all", action="store_true", help="Process all docs (ignore resume)")
    parser.add_argument("--backfill-segmented-metadata", action="store_true", help="Backfill segmented metadata from headers")
    parser.add_argument("--backfill-limit", type=int, default=None, help="Limit backfill updates")
    parser.add_argument("--skip-exists-check", action="store_true", help="Disable DB existence check before processing")
    args = parser.parse_args()

    only_missing = not args.process_all
    check_existing = not args.skip_exists_check

    if args.backfill_segmented_metadata:
        backfill_segmented_metadata(limit=args.backfill_limit)
        return

    if not args.skip_segmentation:
        run_segmentation(max_docs=args.max_docs, only_missing=only_missing, check_existing=check_existing)
    if not args.skip_cpatf:
        run_cpatf(max_docs=args.max_docs, only_missing=only_missing, check_existing=check_existing)


if __name__ == "__main__":
    main()
