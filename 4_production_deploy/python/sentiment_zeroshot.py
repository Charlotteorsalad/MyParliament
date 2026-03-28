#!/usr/bin/env python3
"""
Parliamentary timeline sentiment: XLM-RoBERTa zero-shot (EN + Malay).
Uses joeddav/xlm-roberta-large-xnli (positive / negative / neutral).
"""
import os
import sys
import time
import shutil
from pathlib import Path

project_root = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(project_root))

SENTIMENT_PORT = int(os.environ.get("SENTIMENT_PORT", "5002"))
HF_TOKEN       = os.environ.get("HF_TOKEN") or os.environ.get("HUGGING_FACE_HUB_TOKEN")
BATCH_SIZE     = int(os.environ.get("SENTIMENT_BATCH_SIZE", "16"))
MAX_LENGTH     = int(os.environ.get("SENTIMENT_MAX_LENGTH", "256"))

_pipeline = None
LABELS = ["positive", "negative", "neutral"]


def _resolve_model(model_id: str):
    """
    Return the local snapshot path if cached, otherwise return model_id (will download).
    Loading from local path skips ALL network calls → much faster.
    """
    try:
        from huggingface_hub import scan_cache_dir
        info = scan_cache_dir()
        for repo in info.repos:
            if repo.repo_id == model_id:
                for rev in repo.revisions:
                    p = str(rev.snapshot_path)
                    if p and Path(p).exists():
                        return p, True
    except Exception:
        pass
    return model_id, False


def _tqdm_bar(desc, total=None):
    try:
        from tqdm import tqdm
        return tqdm(total=total, desc=desc, unit="step", file=sys.stderr, dynamic_ncols=True)
    except ImportError:
        return None


def _clear_model_cache(model_id: str):
    cache_dir   = os.path.join(os.path.expanduser("~"), ".cache", "huggingface", "hub")
    model_cache = os.path.join(cache_dir, f"models--{model_id.replace('/', '--')}")
    if os.path.exists(model_cache):
        shutil.rmtree(model_cache, ignore_errors=True)
        print(f"[sentiment_zeroshot] Cleared corrupt cache: {model_cache}", file=sys.stderr)


def get_pipeline():
    global _pipeline
    if _pipeline is not None:
        return _pipeline
    try:
        from transformers import AutoTokenizer, AutoModelForSequenceClassification, pipeline
        import torch
    except ImportError:
        raise RuntimeError("Install: pip install transformers torch sentencepiece")

    model_id = os.environ.get("SENTIMENT_MODEL", "joeddav/xlm-roberta-large-xnli")
    max_retries = 2

    for attempt in range(max_retries):
        local_path, is_cached = _resolve_model(model_id)
        source_label = "local cache" if is_cached else "HuggingFace Hub"
        bar = _tqdm_bar(f"[sentiment_zeroshot] Loading ({source_label})", total=3)
        try:
            # Step 1: tokenizer
            tok_kwargs = {"use_fast": False, "local_files_only": is_cached}
            if HF_TOKEN and not is_cached:
                tok_kwargs["token"] = HF_TOKEN
            tokenizer = AutoTokenizer.from_pretrained(local_path, **tok_kwargs)
            if bar: bar.update(1); bar.set_postfix_str("tokenizer ✓")

            # Step 2: model
            model = AutoModelForSequenceClassification.from_pretrained(
                local_path,
                local_files_only=is_cached,
                low_cpu_mem_usage=True,
                dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
                **({} if is_cached else {"token": HF_TOKEN} if HF_TOKEN else {}),
            )
            model.eval()
            if bar: bar.update(1); bar.set_postfix_str("model ✓")

            # Step 3: pipeline
            _pipeline = pipeline(
                "zero-shot-classification",
                model=model, tokenizer=tokenizer,
                device=-1, truncation=True, max_length=MAX_LENGTH,
            )
            if bar: bar.update(1); bar.set_postfix_str("pipeline ✓"); bar.close()
            return _pipeline

        except Exception as e:
            if bar:
                try: bar.close()
                except Exception: pass
            err_str = str(e).lower()
            is_cache_error = (
                "sentencepiece" in err_str or "could not extract" in err_str
                or "models--joed" in err_str
                or ("extract" in err_str and "model" in err_str)
            )
            if is_cache_error and attempt < max_retries - 1:
                print(f"[sentiment_zeroshot] Cache corrupt – clearing and retrying...", file=sys.stderr)
                _clear_model_cache(model_id)
                continue
            raise


def _scores_to_0_100(result):
    """Map zero-shot label scores to 0–100 with 2 decimal places (e.g., 65.23)."""
    labels   = result.get("labels") or []
    scores   = result.get("scores") or []
    by_label = dict(zip(labels, scores))
    pos = by_label.get("positive", 0.0)
    neg = by_label.get("negative", 0.0)
    raw = 50 + (pos - neg) * 50 if (pos + neg) > 1e-6 else 50.0
    return round(max(0.0, min(100.0, raw)) * 100) / 100  # 2 decimal places


def analyze_one(text: str):
    if not (text and str(text).strip()):
        return 50.0
    pipe = get_pipeline()
    out  = pipe(str(text).strip()[:5000], candidate_labels=LABELS, multi_label=False)
    return _scores_to_0_100(out)


def analyze_batch(texts: list):
    if not texts:
        return []
    pipe    = get_pipeline()
    results = [50.0] * len(texts)

    total_batches = (len(texts) + BATCH_SIZE - 1) // BATCH_SIZE
    bar = _tqdm_bar("[sentiment_zeroshot] Analyzing", total=total_batches) if total_batches > 1 else None

    for start in range(0, len(texts), BATCH_SIZE):
        batch    = texts[start : start + BATCH_SIZE]
        clean    = []
        orig_idx = []
        for j, t in enumerate(batch):
            if t and str(t).strip():
                clean.append(str(t).strip()[:5000])
                orig_idx.append(start + j)
        if not clean:
            if bar: bar.update(1)
            continue
        try:
            out_list = pipe(clean, candidate_labels=LABELS, multi_label=False)
        except Exception:
            out_list = [{"labels": LABELS, "scores": [0.33, 0.33, 0.34]} for _ in clean]
        if not isinstance(out_list, list):
            out_list = [out_list] if out_list else [{"labels": LABELS, "scores": [0.33, 0.33, 0.34]}]
        for k, out in enumerate(out_list):
            if k < len(orig_idx):
                results[orig_idx[k]] = _scores_to_0_100(out)
        if bar: bar.update(1)

    if bar: bar.close()
    return results


def create_app():
    from flask import Flask, request, jsonify
    app = Flask(__name__)

    @app.route("/health", methods=["GET"])
    def health():
        return jsonify({"status": "ok", "service": "sentiment-zeroshot"})

    @app.route("/analyze", methods=["POST"])
    def analyze():
        try:
            data  = request.get_json(force=True, silent=True) or {}
            texts = data.get("texts", [])
            if isinstance(texts, str):
                texts = [texts]
            if not texts:
                return jsonify({"scores": []})
            return jsonify({"scores": analyze_batch(texts)})
        except Exception as e:
            return jsonify({"scores": [], "error": str(e)}), 200

    @app.route("/analyze_one", methods=["POST"])
    def analyze_one_route():
        try:
            data = request.get_json(force=True, silent=True) or {}
            return jsonify({"score": analyze_one(data.get("text", ""))})
        except Exception as e:
            return jsonify({"score": 50.0, "error": str(e)}), 200

    return app


if __name__ == "__main__":
    try:
        from flask import Flask
    except ImportError:
        print("Install Flask: pip install flask", file=sys.stderr)
        sys.exit(1)

    print(f"[sentiment_zeroshot] Port {SENTIMENT_PORT}", file=sys.stderr)
    if HF_TOKEN:
        print("[sentiment_zeroshot] Using HF_TOKEN", file=sys.stderr)

    t0 = time.time()
    try:
        analyze_one("warmup")
        elapsed = time.time() - t0
        print(f"[sentiment_zeroshot] Done load. ({elapsed:.1f}s)", file=sys.stderr)
        print("=" * 60, file=sys.stderr)
    except Exception as e:
        print(f"[sentiment_zeroshot] Model load failed: {e}", file=sys.stderr)
        sys.exit(1)

    app = create_app()
    app.run(host="0.0.0.0", port=SENTIMENT_PORT, debug=False, threaded=True)
