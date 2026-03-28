#!/usr/bin/env python3
"""
Forum content moderation: Multilingual toxicity detection (EN + Malay).
Uses textdetox/xlmr-large-toxicity-classifier-v2 (fine-tuned for toxicity).
"""
import os
import sys
import time
from pathlib import Path

project_root = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(project_root))

MODERATION_PORT = int(os.environ.get("MODERATION_PORT", "5001"))
FLAG_THRESHOLD  = float(os.environ.get("MODERATION_FLAG_THRESHOLD", "0.5"))
HF_TOKEN        = os.environ.get("HF_TOKEN") or os.environ.get("HUGGING_FACE_HUB_TOKEN")

_pipeline = None


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


def get_pipeline():
    global _pipeline
    if _pipeline is not None:
        return _pipeline
    try:
        from transformers import AutoModelForSequenceClassification, AutoTokenizer, pipeline
        import torch
    except ImportError:
        raise RuntimeError("Install: pip install transformers torch")

    model_id = os.environ.get("MODERATION_MODEL", "textdetox/xlmr-large-toxicity-classifier-v2")
    local_path, is_cached = _resolve_model(model_id)
    source_label = "local cache" if is_cached else "HuggingFace Hub"

    bar = _tqdm_bar(f"[forum_content_moderation] Loading ({source_label})", total=3)

    tok_kwargs = {"use_fast": False, "local_files_only": is_cached}
    if HF_TOKEN and not is_cached:
        tok_kwargs["token"] = HF_TOKEN
    tokenizer = AutoTokenizer.from_pretrained(local_path, **tok_kwargs)
    if bar: bar.update(1); bar.set_postfix_str("tokenizer ✓")

    model = AutoModelForSequenceClassification.from_pretrained(
        local_path,
        local_files_only=is_cached,
        low_cpu_mem_usage=True,
        dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
        **({} if is_cached else {"token": HF_TOKEN} if HF_TOKEN else {}),
    )
    model.eval()
    if bar: bar.update(1); bar.set_postfix_str("model ✓")

    _pipeline = pipeline("text-classification", model=model, tokenizer=tokenizer, device=-1)
    if bar: bar.update(1); bar.set_postfix_str("pipeline ✓"); bar.close()

    return _pipeline


def check_text(text: str):
    if not (text and str(text).strip()):
        return {"flagged": False, "label": "clean", "score": 0.0, "reason": ""}
    text = str(text).strip()[:5000]
    pipe = get_pipeline()
    result = pipe(text)[0]
    raw_label = (result.get("label") or "neutral").lower()
    score = float(result.get("score", 0))

    if "1" in raw_label:
        label = "toxic"
    elif "0" in raw_label:
        label = "neutral"
    else:
        label = raw_label

    if label == "toxic" and score >= FLAG_THRESHOLD:
        return {"flagged": True, "label": "toxic", "score": score,
                "reason": f"Auto-flagged: toxic content (score {score:.2f})"}
    return {"flagged": False, "label": label, "score": score, "reason": ""}


def create_app():
    from flask import Flask, request, jsonify
    app = Flask(__name__)

    @app.route("/health", methods=["GET"])
    def health():
        return jsonify({"status": "ok", "service": "forum-moderation"})

    @app.route("/check", methods=["POST"])
    def check():
        try:
            data = request.get_json(force=True, silent=True) or {}
            return jsonify(check_text(data.get("text", "")))
        except Exception as e:
            return jsonify({"flagged": False, "label": "clean", "score": 0.0,
                            "reason": "", "error": str(e)}), 200

    return app


if __name__ == "__main__":
    try:
        from flask import Flask
    except ImportError:
        print("Install Flask: pip install flask", file=sys.stderr)
        sys.exit(1)

    print(f"[forum_content_moderation] Port {MODERATION_PORT}", file=sys.stderr)
    if HF_TOKEN:
        print("[forum_content_moderation] Using HF_TOKEN", file=sys.stderr)

    t0 = time.time()
    try:
        check_text("warmup")
        elapsed = time.time() - t0
        print(f"[forum_content_moderation] Done load. ({elapsed:.1f}s)", file=sys.stderr)
        print("=" * 60, file=sys.stderr)
    except Exception as e:
        print(f"[forum_content_moderation] Model load failed: {e}", file=sys.stderr)
        sys.exit(1)

    app = create_app()
    app.run(host="0.0.0.0", port=MODERATION_PORT, debug=False, threaded=True)
