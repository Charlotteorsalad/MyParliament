#!/usr/bin/env python3
"""
Production inference (no macro labels or ARIMA).

Aligned with 2_ml_modeling:
- Same pipeline logic as 07_evaluation_visualization_test.ipynb (P1–P6).
- Same model dir (2_ml_modeling/model/), same metrics (silhouette, coherence_cv, npmi, topic_diversity).
- P1/P2: raw document text (2_ml uses full_text from hansard_core500; production uses ocr_text/content_text from RAW_COLLECTION, default HansardDocument).
- P3–P6: CPATF cleaned text (2_ml uses hansard_cpatf500; production uses hansard_cpatf).

Data source:
- Pipelines 1–2: raw from RAW_COLLECTION (HansardDocument: ocr_text or content_text if no ocr).
- Pipelines 3–6: hansard_cpatf (cleaned_text). Run preprocess_pipeline.py (CPATF stage) first.

DB safety: Only READS from RAW_COLLECTION and hansard_cpatf. Only WRITES to inferred_results (upsert by pipelineId). Original collections are never modified.
"""
import argparse
import json
import os
import pickle
from pathlib import Path
from datetime import datetime

import numpy as np
import torch
from pymongo import MongoClient
from dotenv import load_dotenv
from tqdm import tqdm

from utils_inference import (
    extract_top_words_from_clusters,
    compute_all_metrics,
    compute_silhouette_score,
    get_stopwords
)

try:
    import spacy
except ImportError:
    spacy = None

project_root = Path(__file__).resolve().parents[2]
backend_env_path = project_root / "3_app_system" / "backend" / ".env"
load_dotenv(backend_env_path, override=True)


def _safe_pickle_load(path):
    """Load pickle with NumPy 1.x/2.x compat (LDA with legacy MT19937 state)."""
    errors = []
    
    # Try 1: Standard pickle (works with NumPy 1.26.4)
    try:
        with open(path, "rb") as f:
            return pickle.load(f)
    except Exception as e:
        errors.append(f"pickle: {e}")
    
    # Try 2: joblib (better numpy compat)
    try:
        import joblib
        return joblib.load(path)
    except Exception as e:
        errors.append(f"joblib: {e}")
    
    # Try 3: dill (more robust for complex objects)
    try:
        import dill
        with open(path, "rb") as f:
            return dill.load(f)
    except Exception as e:
        errors.append(f"dill: {e}")
    
    # Final fallback: give actionable error
    raise RuntimeError(
        f"Failed to load {path}.\n"
        f"Errors:\n" + "\n".join(f"  - {err}" for err in errors) + "\n"
        f"Solutions:\n"
        f"1. Ensure NumPy 1.x is installed: pip install 'numpy<2.0'\n"
        f"2. Install joblib and dill: pip install joblib dill\n"
        f"3. Re-save models with current NumPy (re-run training notebooks)"
    )

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/MyParliament")
MODEL_DIR = Path(os.getenv("INFERENCE_MODEL_DIR", str(project_root / "2_ml_modeling" / "model")))
# P1/P2: raw from HansardDocument — ocr_text or content_text (if no ocr).
RAW_COLLECTION = os.getenv("INFERENCE_RAW_COLLECTION", "HansardDocument")

PIPELINE_CONFIGS = {
    "pipeline1": {"name": "TF-IDF + KMeans", "model_file": "tfidf_kmeans_model.pkl", "type": "traditional"},
    "pipeline2": {"name": "LDA Topic Modeling", "model_file": "best_lda_model.pkl", "type": "traditional"},
    "pipeline3": {"name": "MEHTC Entity-Only", "model_file": "mehtcEntity_model.pkl", "type": "transformer"},
    "pipeline4": {"name": "MEHTC XLM Zero-shot", "model_file": "mehtc_xlm_zeroshot_model.pkl", "type": "transformer"},
    "pipeline5": {
        "name": "MEHTC LoRA Fine-tuned",
        "model_file": "mehtc_lora_weighted_mlm_finetuned/mehtc_lora_mlm_best_model/mehtc_lora_merged_model",
        "type": "transformer"
    },
    "pipeline6": {"name": "E5-Large SOTA", "model_file": "e5_large_sota_model_bundle.pkl", "type": "transformer"}
}

_TRANSFORMER_MODEL_CACHE = {}
_SPACY_MODEL = None


def get_cached_transformer_model(model_name):
    if model_name in _TRANSFORMER_MODEL_CACHE:
        return _TRANSFORMER_MODEL_CACHE[model_name]
    from transformers import AutoModel, AutoTokenizer
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    model = AutoModel.from_pretrained(model_name)
    _TRANSFORMER_MODEL_CACHE[model_name] = (model, tokenizer)
    return model, tokenizer


def _get_spacy_model():
    global _SPACY_MODEL
    if _SPACY_MODEL is not None:
        return _SPACY_MODEL
    if spacy is None:
        raise ImportError("spaCy is required for entity extraction. Install spacy and xx_ent_wiki_sm.")
    _SPACY_MODEL = spacy.load("xx_ent_wiki_sm")
    return _SPACY_MODEL


def _init_worker_spacy():
    """Load spaCy once per worker so we don't load 32x on first task (avoids 30+ min stuck at 0%)."""
    global _SPACY_MODEL
    if spacy is not None and _SPACY_MODEL is None:
        _SPACY_MODEL = spacy.load("xx_ent_wiki_sm")


def _extract_single_p3(text):
    """Extract entities from a single document (P3). Module-level for pickling."""
    nlp = _get_spacy_model()
    doc = nlp(text)
    return [ent.text for ent in doc.ents if ent.label_ in ["PERSON", "ORG", "LOC"]]


def _extract_single_p4(text):
    """Extract labeled entities from a single document (P4/P5). Module-level for pickling."""
    nlp = _get_spacy_model()
    allowed = {"PERSON", "ORG", "LOC", "BILL", "OTHER"}
    doc = nlp(text)
    ents = []
    for ent in doc.ents:
        label = ent.label_ if ent.label_ in allowed else "OTHER"
        ents.append(f"{label}:{ent.text}")
    return ents


def _extract_entities_p3(texts, n_jobs=-1):
    """
    Extract entities (PERSON, ORG, LOC) from texts using spaCy with parallel processing.
    
    Args:
        texts: List of text strings
        n_jobs: Number of parallel jobs (-1 = use all CPUs, 1 = serial)
    
    Returns:
        List of entity lists (one per document)
    """
    import multiprocessing as mp
    
    # Determine number of workers (cap to 8 to avoid excessive memory/disk usage)
    if n_jobs == -1:
        n_jobs = min(8, mp.cpu_count())
    else:
        n_jobs = min(n_jobs, 8)
    
    # Use parallel processing for large batches, serial for small ones
    if len(texts) < 50 or n_jobs == 1:
        # Serial processing for small batches (overhead not worth it)
        entities_list = []
        for text in tqdm(texts, desc="Entities (P3)"):
            entities_list.append(_extract_single_p3(text))
        return entities_list
    
    # Parallel processing with progress bar
    # Use 'spawn' method to avoid forking issues and reduce memory overhead
    from concurrent.futures import ProcessPoolExecutor
    mp_context = mp.get_context('spawn')
    with ProcessPoolExecutor(max_workers=n_jobs, mp_context=mp_context) as executor:
        entities_list = list(tqdm(
            executor.map(_extract_single_p3, texts, chunksize=10),
            total=len(texts),
            desc=f"Entities (P3, {n_jobs} workers)"
        ))
    return entities_list


def _extract_entities_p4(texts, n_jobs=-1):
    """
    Extract entities (PERSON, ORG, LOC, BILL, OTHER) from texts using spaCy with parallel processing.
    
    Args:
        texts: List of text strings
        n_jobs: Number of parallel jobs (-1 = use all CPUs, 1 = serial)
    
    Returns:
        List of labeled entity lists (one per document)
    """
    import multiprocessing as mp
    
    # Determine number of workers (cap to 8 to avoid excessive memory/disk usage)
    if n_jobs == -1:
        n_jobs = min(8, mp.cpu_count())
    else:
        n_jobs = min(n_jobs, 8)
    n_workers = n_jobs
    
    # Use parallel processing for large batches
    if len(texts) < 50 or n_workers == 1:
        # Serial processing for small batches
        entities_list = []
        for text in tqdm(texts, desc="Entities (P4/P5)"):
            entities_list.append(_extract_single_p4(text))
        return entities_list
    
    # Parallel: each worker loads spaCy once via initializer
    # Use 'spawn' method to avoid forking issues and reduce memory overhead
    from concurrent.futures import ProcessPoolExecutor
    mp_context = mp.get_context('spawn')
    with ProcessPoolExecutor(max_workers=n_workers, initializer=_init_worker_spacy, mp_context=mp_context) as executor:
        entities_list = list(tqdm(
            executor.map(_extract_single_p4, texts, chunksize=10),
            total=len(texts),
            desc=f"Entities (P4/P5, {n_workers} workers)"
        ))
    return entities_list


def _weighted_jaccard_p3(ents1, ents2):
    if not ents1 or not ents2:
        return 0.0
    inter = set(ents1) & set(ents2)
    union = set(ents1) | set(ents2)
    if not union:
        return 0.0
    return len(inter) / len(union)


def _weighted_jaccard_p4(ents1, ents2):
    if not ents1 or not ents2:
        return 0.0
    entity_weights = {"PERSON": 3, "ORG": 2, "LOC": 1, "BILL": 4, "OTHER": 1}
    inter = set(ents1) & set(ents2)
    union = set(ents1) | set(ents2)
    w_inter = sum(entity_weights.get(e.split(":")[0], 1) for e in inter)
    w_union = sum(entity_weights.get(e.split(":")[0], 1) for e in union)
    return w_inter / w_union if w_union > 0 else 0.0


def _build_tfidf_vectorizer():
    from sklearn.feature_extraction.text import TfidfVectorizer
    stopwords = list(get_stopwords())
    return TfidfVectorizer(
        max_df=0.7,
        min_df=5,
        stop_words=stopwords,
        ngram_range=(1, 3),
        sublinear_tf=True,
        lowercase=True
    )


def _determine_optimal_clusters(n_docs, min_cluster_size=50):
    """
    Automatically determine optimal number of clusters based on document count.
    
    Strategy: Balance between granularity and meaningful cluster sizes.
    - Target: 50-100 documents per cluster on average
    - Use sqrt-based scaling for larger datasets
    
    Args:
        n_docs: Number of documents
        min_cluster_size: Minimum average documents per cluster
    
    Returns:
        Optimal number of clusters
    """
    if n_docs < 100:
        # Small datasets: fewer clusters (5-10)
        return max(5, n_docs // 10)
    elif n_docs < 1000:
        # Medium datasets: sqrt-based scaling
        return max(10, int(np.sqrt(n_docs * 1.5)))
    else:
        # Large datasets: balance between sqrt and fixed target size
        # Use geometric mean of sqrt(n) and n/target_size
        sqrt_based = int(np.sqrt(n_docs))
        size_based = max(30, n_docs // min_cluster_size)
        # Take average and cap at reasonable range
        optimal = int((sqrt_based + size_based) / 2)
        return max(20, min(100, optimal))


def _cluster_precomputed(dist_matrix, n_clusters=None):
    """
    Agglomerative clustering with precomputed distance matrix.
    
    Args:
        dist_matrix: Precomputed distance matrix
        n_clusters: Number of clusters (None = auto-determine)
    """
    from sklearn.cluster import AgglomerativeClustering
    
    if n_clusters is None:
        n_clusters = _determine_optimal_clusters(len(dist_matrix))
    
    # Ensure n_clusters is valid
    n_clusters = max(2, min(n_clusters, len(dist_matrix) - 1))
    
    try:
        clustering = AgglomerativeClustering(n_clusters=n_clusters, metric="precomputed", linkage="average")
    except TypeError:
        clustering = AgglomerativeClustering(n_clusters=n_clusters, affinity="precomputed", linkage="average")
    return clustering.fit_predict(dist_matrix)


def light_clean(text):
    try:
        stopwords = get_stopwords()
    except Exception:
        stopwords = set()
    tokens = text.lower().split()
    tokens = [t for t in tokens if t not in stopwords and len(t) > 2]
    return " ".join(tokens)


def _segmented_text_from_doc(doc):
    segments = doc.get("segmentation_output")
    if isinstance(segments, list) and segments:
        parts = []
        for item in segments:
            if isinstance(item, dict):
                text = (item.get("text") or item.get("content") or "").strip()
                if text:
                    parts.append(text)
            elif isinstance(item, str):
                parts.append(item.strip())
        if parts:
            return " ".join(parts)
    return (doc.get("full_text") or doc.get("content_text") or "").strip()


def _raw_text_from_doc(doc):
    """Raw text from HansardDocument: ocr_text first, else content_text (if no ocr)."""
    ocr = (doc.get("ocr_text") or "").strip()
    if ocr:
        return ocr
    return (doc.get("content_text") or "").strip()


def fetch_raw_documents(collection, batch_size=500, skip=0):
    """Fetch HansardDocument docs with ocr_text or content_text for P1/P2 (raw baseline)."""
    cursor = collection.find(
        {"$or": [{"ocr_text": {"$exists": True, "$ne": ""}}, {"content_text": {"$exists": True, "$ne": ""}}]},
        {"_id": 1, "ocr_text": 1, "content_text": 1, "hansardDate": 1}
    ).skip(skip).limit(batch_size)
    return list(cursor)


def fetch_segmented_documents(collection, batch_size=500, skip=0):
    cursor = collection.find(
        {"segmentation_output": {"$exists": True}},
        {"_id": 1, "segmentation_output": 1, "full_text": 1, "content_text": 1, "hansardDate": 1}
    ).skip(skip).limit(batch_size)
    return list(cursor)


def fetch_cpatf_documents(collection, batch_size=500, skip=0):
    cursor = collection.find(
        {"cleaned_text": {"$exists": True, "$ne": ""}},
        {"_id": 1, "cleaned_text": 1, "hansardDate": 1}
    ).skip(skip).limit(batch_size)
    return list(cursor)


def run_pipeline_inference(pipeline_id, documents, batch_size=500):
    config = PIPELINE_CONFIGS[pipeline_id]
    model_path = MODEL_DIR / config["model_file"]

    # Fail fast: P6 requires sentence_transformers (avoid failing deep inside P6).
    if pipeline_id == "pipeline6":
        try:
            import sentence_transformers  # noqa: F401
        except ImportError as exc:
            raise ImportError(
                "Pipeline 6 (E5-Large SOTA) requires the sentence_transformers package. "
                "Install it with: pip install sentence-transformers"
            ) from exc

    print(f"\nPipeline: {config['name']}")
    print(f"Model: {model_path}")
    print(f"Documents: {len(documents)}")

    if not model_path.exists():
        raise FileNotFoundError(f"Model not found: {model_path}")

    if pipeline_id in ("pipeline1", "pipeline2"):
        texts = [_raw_text_from_doc(doc) for doc in documents]
    else:
        texts = [doc.get("cleaned_text", "") for doc in documents]

    # Keep only docs with non-empty text so doc_ids[i] always matches clusters[i] / topics[i]
    paired = [(doc, t) for doc, t in zip(documents, texts) if (t and t.strip())]
    if not paired:
        data_src = f"raw ({RAW_COLLECTION}: ocr_text/content_text)" if pipeline_id in ("pipeline1", "pipeline2") else "hansard_cpatf (cleaned_text)"
        raise RuntimeError(
            f"No usable text found for inference (data source: {data_src}). "
            f"For P1/P2 ensure {RAW_COLLECTION} has ocr_text or content_text."
        )
    documents = [p[0] for p in paired]
    texts = [p[1] for p in paired]
    doc_ids = [str(doc["_id"]) for doc in documents]

    if pipeline_id == "pipeline1":
        bundle = _safe_pickle_load(model_path)
        tfidf_vec = bundle.get("vectorizer") or bundle.get("tfidf")
        if not tfidf_vec:
            raise RuntimeError("TF-IDF vectorizer not found in bundle.")
        kmeans = bundle["kmeans"]
        X_tfidf = tfidf_vec.transform(texts)
        clusters = kmeans.predict(X_tfidf)
        cluster_topics = extract_top_words_from_clusters(texts, clusters, tfidf_vec, n_words=10)
        metrics, _ = compute_all_metrics(texts, clusters, embeddings=X_tfidf, vectorizer=tfidf_vec)

    elif pipeline_id == "pipeline2":
        # ===== Pipeline 2: TF-IDF + LDA Topic Modeling =====
        # Following 07_evaluation_visualization_test.ipynb logic:
        # 1. Load LDA model (just the model, not a bundle)
        # 2. Load P1's vectorizer (shared vectorizer for P1 and P2)
        # 3. Transform texts to TF-IDF matrix using P1's vectorizer
        # 4. Convert TF-IDF sparse matrix to Gensim BOW format (list of (term_id, count) tuples)
        # 5. Use LDA model to get topic distribution for each document
        # 6. Assign dominant topic (highest probability) as cluster label
        # 7. Extract top words per topic using lda_model.show_topic()
        # 8. Compute metrics (silhouette on TF-IDF space, topic coherence, etc.)
        
        # Load LDA model (NOTE: This is just the LdaModel object, not a bundle)
        lda_model = _safe_pickle_load(model_path)
        
        # Load P1's vectorizer (shared between P1 and P2 for fair comparison)
        p1_model_path = MODEL_DIR / "tfidf_kmeans_model.pkl"
        if not p1_model_path.exists():
            raise RuntimeError(f"P1 model not found at {p1_model_path}. P2 requires P1's vectorizer.")
        p1_bundle = _safe_pickle_load(p1_model_path)
        tfidf_vec = p1_bundle.get("vectorizer") or p1_bundle.get("tfidf")
        if not tfidf_vec:
            raise RuntimeError("TF-IDF vectorizer not found in P1 bundle. P2 requires P1's vectorizer.")
        
        # Transform texts to TF-IDF matrix using P1's vectorizer
        X_tfidf = tfidf_vec.transform(texts)
        
        # Convert TF-IDF sparse matrix to Gensim BOW format
        # Filter out terms that exceed LDA model's vocabulary size
        # (LDA was trained on same vocab as P1, but may have different num_terms)
        max_term_id = lda_model.num_terms - 1
        test_corpus = []
        for i in range(X_tfidf.shape[0]):
            row = X_tfidf[i].tocoo()  # Convert to coordinate format for easy iteration
            bow = [
                (int(col), float(data)) 
                for col, data in zip(row.col, row.data)
                if col <= max_term_id and data > 0
            ]
            test_corpus.append(bow)
        
        # Get topic distribution for each document and assign dominant topic
        # minimum_probability=0.0 ensures we get all topics (not just high-prob ones)
        test_topics = [
            lda_model.get_document_topics(bow, minimum_probability=0.0) 
            for bow in test_corpus
        ]
        clusters = []
        for topics in test_topics:
            if topics:
                # Find topic with highest probability
                dominant = max(topics, key=lambda x: x[1])
                clusters.append(dominant[0])  # topic_id
            else:
                clusters.append(0)  # Default to topic 0 if no topics found
        clusters = np.array(clusters)
        
        # Extract top words per topic using LDA's show_topic method
        # This gives the most representative words for each topic
        # IMPORTANT: Use string keys for MongoDB compatibility
        cluster_topics = {}
        for topic_id in range(lda_model.num_topics):
            # Get top 10 words and their probabilities for this topic
            top_words = [word for word, prob in lda_model.show_topic(topic_id, topn=10)]
            # Convert topic_id to string (MongoDB requires string keys)
            cluster_topics[str(topic_id)] = top_words
        
        # Compute metrics
        # Check if we have enough unique clusters for silhouette score
        unique_count = len(set(clusters))
        if unique_count < 2:
            # Only 1 cluster found - common in parliamentary data with LDA
            # (all documents may be assigned to the same dominant topic)
            print(f"Warning: Only {unique_count} dominant topic found, setting Silhouette to 0")
            silhouette = 0.0
            metrics, _ = compute_all_metrics(
                texts, clusters, embeddings=X_tfidf, vectorizer=tfidf_vec
            )
            metrics["silhouette"] = 0.0000  # Format as 4 decimal places for consistency
        else:
            # Multiple clusters - compute silhouette on TF-IDF space with cosine distance
            from sklearn.metrics import silhouette_score
            silhouette = silhouette_score(X_tfidf, clusters, metric='cosine')
            metrics, _ = compute_all_metrics(
                texts, clusters, embeddings=X_tfidf, vectorizer=tfidf_vec
            )
            metrics["silhouette"] = float(f"{silhouette:.4f}")

    elif pipeline_id == "pipeline3":
        # ===== Pipeline 3: MEHTC Entity-Only =====
        # OPTIMIZATION: Limit parallelism to avoid disk usage on /mnt
        # - Cap workers to 8 to reduce memory pressure and temp files
        # - Use 'threading' backend instead of 'multiprocessing' to avoid temp files
        # - Set TMPDIR to /tmp (not /mnt) for any remaining temp operations
        import tempfile
        import os as os_module
        original_tmpdir = os_module.environ.get('TMPDIR')
        try:
            # Force temp files to /tmp instead of /mnt to avoid SSH crash
            os_module.environ['TMPDIR'] = '/tmp'
            tempfile.tempdir = '/tmp'
            
            # Auto-determine optimal clusters (scalable)
            n_clusters = _determine_optimal_clusters(len(texts))
            print(f"Auto-determined {n_clusters} clusters for {len(texts)} documents")
            
            vectorizer = _build_tfidf_vectorizer()
            tfidf_matrix = vectorizer.fit_transform(texts)
            from sklearn.metrics.pairwise import cosine_similarity
            tfidf_sim = cosine_similarity(tfidf_matrix)

            # Cap workers to 8 to reduce memory/disk pressure (was: -1 = all CPUs)
            entities_list = _extract_entities_p3(texts, n_jobs=8)
            n = len(entities_list)
            entity_sim = np.zeros((n, n), dtype=np.float32)
            
            # Parallel Jaccard similarity computation for upper triangle
            from joblib import Parallel, delayed
            import multiprocessing as mp
            n_jobs = min(8, mp.cpu_count())  # Cap to 8 workers
            
            def compute_row_similarities(i, entities_list):
                """Compute similarities for row i (only upper triangle j >= i)."""
                row_sims = []
                for j in range(i, len(entities_list)):
                    sim = _weighted_jaccard_p3(entities_list[i], entities_list[j])
                    row_sims.append((i, j, sim))
                return row_sims
            
            # Use 'threading' backend to avoid multiprocessing temp files
            results = Parallel(n_jobs=n_jobs, backend='threading')(
                delayed(compute_row_similarities)(i, entities_list)
                for i in tqdm(range(n), desc=f"Entity Jaccard (P3, {n_jobs} workers)")
            )
            
            # Fill the symmetric matrix
            for row_sims in results:
                for i, j, sim in row_sims:
                    entity_sim[i, j] = entity_sim[j, i] = sim

            sim_matrix = 0.8 * tfidf_sim + 0.2 * entity_sim
            
            # Clear intermediate matrices to free memory before distance computation
            del tfidf_sim
            
            dist_matrix = np.clip(1 - sim_matrix, 0, None)
            del sim_matrix  # Free memory
            np.fill_diagonal(dist_matrix, 0)
            clusters = _cluster_precomputed(dist_matrix, n_clusters=n_clusters)
        finally:
            # Restore original TMPDIR
            if original_tmpdir is not None:
                os_module.environ['TMPDIR'] = original_tmpdir
            else:
                os_module.environ.pop('TMPDIR', None)
            tempfile.tempdir = None

        from sklearn.metrics import silhouette_score
        silhouette = silhouette_score(dist_matrix, clusters, metric="precomputed")
        cluster_topics = extract_top_words_from_clusters(texts, clusters, vectorizer, n_words=10)
        metrics, _ = compute_all_metrics(texts, clusters, embeddings=tfidf_matrix, vectorizer=vectorizer)
        metrics["silhouette"] = float(f"{silhouette:.4f}")

    elif pipeline_id == "pipeline4":
        # ===== Pipeline 4: MEHTC XLM Zero-shot =====
        # OPTIMIZATION: Same as P3 - limit parallelism to avoid disk issues
        import tempfile
        import os as os_module
        original_tmpdir = os_module.environ.get('TMPDIR')
        try:
            os_module.environ['TMPDIR'] = '/tmp'
            tempfile.tempdir = '/tmp'
            
            # Auto-determine optimal clusters (scalable)
            n_clusters = _determine_optimal_clusters(len(texts))
            print(f"Auto-determined {n_clusters} clusters for {len(texts)} documents")
            
            vectorizer = _build_tfidf_vectorizer()
            tfidf_matrix = vectorizer.fit_transform(texts)
            from sklearn.metrics.pairwise import cosine_similarity
            tfidf_sim = cosine_similarity(tfidf_matrix)

            model, tokenizer = get_cached_transformer_model("xlm-roberta-base")
            embeddings = []
            for i in tqdm(range(0, len(texts), batch_size), desc="Embeddings (P4)"):
                batch_texts = texts[i:i + batch_size]
                inputs = tokenizer(batch_texts, return_tensors="pt", padding=True, truncation=True, max_length=512)
                with torch.no_grad():
                    outputs = model(**inputs)
                    batch_emb = outputs.last_hidden_state.mean(dim=1).cpu().numpy()
                embeddings.append(batch_emb)
            embeddings = np.vstack(embeddings)
            emb_sim = cosine_similarity(embeddings)

            # Cap workers to 8 to reduce memory/disk pressure
            entities_list = _extract_entities_p4(texts, n_jobs=8)
            n = len(entities_list)
            entity_sim = np.zeros((n, n), dtype=np.float32)
            
            # Parallel Jaccard similarity computation
            from joblib import Parallel, delayed
            import multiprocessing as mp
            n_jobs = min(8, mp.cpu_count())  # Cap to 8 workers
            
            def compute_row_similarities_p4(i, entities_list):
                """Compute similarities for row i (P4)."""
                row_sims = []
                for j in range(i, len(entities_list)):
                    sim = _weighted_jaccard_p4(entities_list[i], entities_list[j])
                    row_sims.append((i, j, sim))
                return row_sims
            
            # Use 'threading' backend to avoid multiprocessing temp files
            results = Parallel(n_jobs=n_jobs, backend='threading')(
                delayed(compute_row_similarities_p4)(i, entities_list)
                for i in tqdm(range(n), desc=f"Entity Jaccard (P4, {n_jobs} workers)")
            )
            
            for row_sims in results:
                for i, j, sim in row_sims:
                    entity_sim[i, j] = entity_sim[j, i] = sim

            results_path = project_root / "2_ml_modeling" / "results" / "pipeline4_results.json"
            if results_path.exists():
                with open(results_path, "r") as f:
                    best_weights = json.load(f).get("best_weights", {})
            else:
                best_weights = {}
            alpha = best_weights.get("alpha", 0.347)
            beta = best_weights.get("beta", 0.605)
            gamma = best_weights.get("gamma", 0.122)
            total = alpha + beta + gamma
            sim_matrix = (alpha / total) * tfidf_sim + (beta / total) * emb_sim + (gamma / total) * entity_sim

            # Clear intermediate matrices to free memory
            del tfidf_sim, emb_sim, entity_sim
            
            dist_matrix = np.clip(1 - sim_matrix, 0, None)
            del sim_matrix
            np.fill_diagonal(dist_matrix, 0)
            clusters = _cluster_precomputed(dist_matrix, n_clusters=n_clusters)
        finally:
            if original_tmpdir is not None:
                os_module.environ['TMPDIR'] = original_tmpdir
            else:
                os_module.environ.pop('TMPDIR', None)
            tempfile.tempdir = None

        from sklearn.metrics import silhouette_score
        silhouette = silhouette_score(dist_matrix, clusters, metric="precomputed")
        cluster_topics = extract_top_words_from_clusters(texts, clusters, vectorizer, n_words=10)
        metrics, _ = compute_all_metrics(texts, clusters, embeddings=tfidf_matrix, vectorizer=vectorizer)
        metrics["silhouette"] = float(f"{silhouette:.4f}")

    elif pipeline_id == "pipeline5":
        # ===== Pipeline 5: MEHTC LoRA Fine-tuned =====
        # OPTIMIZATION: Same as P3/P4 - limit parallelism to avoid disk issues
        import tempfile
        import os as os_module
        original_tmpdir = os_module.environ.get('TMPDIR')
        try:
            os_module.environ['TMPDIR'] = '/tmp'
            tempfile.tempdir = '/tmp'
            
            from transformers import AutoModel, AutoTokenizer
            # Auto-determine optimal clusters (scalable)
            n_clusters = _determine_optimal_clusters(len(texts))
            print(f"Auto-determined {n_clusters} clusters for {len(texts)} documents")
            
            model = AutoModel.from_pretrained(str(model_path))
            tokenizer = AutoTokenizer.from_pretrained(str(model_path))
            embeddings = []
            for i in tqdm(range(0, len(texts), batch_size), desc="Embeddings (P5)"):
                batch_texts = texts[i:i + batch_size]
                inputs = tokenizer(batch_texts, return_tensors="pt", padding=True, truncation=True, max_length=256)
                with torch.no_grad():
                    outputs = model(**inputs)
                    batch_emb = outputs.last_hidden_state.mean(dim=1).cpu().numpy()
                embeddings.append(batch_emb)
            embeddings = np.vstack(embeddings)

            vectorizer = _build_tfidf_vectorizer()
            tfidf_matrix = vectorizer.fit_transform(texts)
            from sklearn.metrics.pairwise import cosine_similarity
            tfidf_sim = cosine_similarity(tfidf_matrix)
            emb_sim = cosine_similarity(embeddings)

            # Cap workers to 8 to reduce memory/disk pressure
            entities_list = _extract_entities_p4(texts, n_jobs=8)
            n = len(entities_list)
            entity_sim = np.zeros((n, n), dtype=np.float32)
            
            # Parallel Jaccard similarity computation
            from joblib import Parallel, delayed
            import multiprocessing as mp
            n_jobs = min(8, mp.cpu_count())  # Cap to 8 workers
            
            def compute_row_similarities_p5(i, entities_list):
                """Compute similarities for row i (P5)."""
                row_sims = []
                for j in range(i, len(entities_list)):
                    sim = _weighted_jaccard_p4(entities_list[i], entities_list[j])
                    row_sims.append((i, j, sim))
                return row_sims
            
            # Use 'threading' backend to avoid multiprocessing temp files
            results = Parallel(n_jobs=n_jobs, backend='threading')(
                delayed(compute_row_similarities_p5)(i, entities_list)
                for i in tqdm(range(n), desc=f"Entity Jaccard (P5, {n_jobs} workers)")
            )
            
            for row_sims in results:
                for i, j, sim in row_sims:
                    entity_sim[i, j] = entity_sim[j, i] = sim

            best_weights = {"alpha": 0.347, "beta": 0.605, "gamma": 0.122}
            total = best_weights["alpha"] + best_weights["beta"] + best_weights["gamma"]
            sim_matrix = (
                (best_weights["alpha"] / total) * tfidf_sim
                + (best_weights["beta"] / total) * emb_sim
                + (best_weights["gamma"] / total) * entity_sim
            )
            
            # Clear intermediate matrices to free memory
            del tfidf_sim, emb_sim, entity_sim
            
            dist_matrix = np.clip(1 - sim_matrix, 0, None)
            del sim_matrix
            np.fill_diagonal(dist_matrix, 0)
            clusters = _cluster_precomputed(dist_matrix, n_clusters=n_clusters)
        finally:
            if original_tmpdir is not None:
                os_module.environ['TMPDIR'] = original_tmpdir
            else:
                os_module.environ.pop('TMPDIR', None)
            tempfile.tempdir = None

        from sklearn.metrics import silhouette_score
        silhouette = silhouette_score(dist_matrix, clusters, metric="precomputed")
        cluster_topics = extract_top_words_from_clusters(texts, clusters, vectorizer, n_words=10)
        metrics, _ = compute_all_metrics(texts, clusters, embeddings=tfidf_matrix, vectorizer=vectorizer)
        metrics["silhouette"] = float(f"{silhouette:.4f}")

    elif pipeline_id == "pipeline6":
        cleaned_texts = [light_clean(t) for t in texts]
        from sentence_transformers import SentenceTransformer
        model = SentenceTransformer("intfloat/multilingual-e5-large", device="cuda" if torch.cuda.is_available() else "cpu")
        # Use larger batch size for faster processing on high-CPU machines (c2d-highcpu-32)
        embeddings = model.encode(cleaned_texts, batch_size=128, show_progress_bar=True, normalize_embeddings=True)

        from sklearn.metrics.pairwise import cosine_similarity
        sim_matrix = cosine_similarity(embeddings)
        dist_matrix = np.clip(1 - sim_matrix, 0, None)
        np.fill_diagonal(dist_matrix, 0)

        # Auto-determine optimal clusters (scalable)
        n_clusters = _determine_optimal_clusters(len(texts))
        print(f"Auto-determined {n_clusters} clusters for {len(texts)} documents")
        
        clusters = _cluster_precomputed(dist_matrix, n_clusters=n_clusters)
        from sklearn.metrics import silhouette_score
        silhouette = silhouette_score(dist_matrix, clusters, metric="precomputed")
        cluster_topics = extract_top_words_from_clusters(texts, clusters, None, n_words=10)
        metrics, _ = compute_all_metrics(texts, clusters, embeddings=embeddings, vectorizer=None)
        metrics["silhouette"] = float(f"{silhouette:.4f}")

    else:
        raise ValueError(f"Unknown pipeline: {pipeline_id}")

    result = {
        "success": True,
        "pipelineId": pipeline_id,
        "docCount": len(texts),
        "docIds": doc_ids,
        "clusters": clusters.tolist(),
        "topics": [f"Topic_{c}" for c in clusters],
        "cluster_topics": cluster_topics,
        "metrics": metrics,
        "timestamp": datetime.utcnow().isoformat()
    }
    return result


def _sanitize_for_mongodb(obj):
    """
    Recursively convert numpy types to Python native types for MongoDB compatibility.
    
    MongoDB requires:
    - Keys must be strings (not numpy.int32/int64)
    - Values must be JSON-serializable Python types
    """
    import os
    # Suppress tokenizers parallelism warning
    os.environ.setdefault('TOKENIZERS_PARALLELISM', 'false')
    if isinstance(obj, dict):
        # Convert all keys to strings and recursively sanitize values
        return {str(k): _sanitize_for_mongodb(v) for k, v in obj.items()}
    elif isinstance(obj, (list, tuple)):
        return [_sanitize_for_mongodb(item) for item in obj]
    elif isinstance(obj, np.integer):
        return int(obj)
    elif isinstance(obj, np.floating):
        return float(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    else:
        return obj


def save_to_mongodb(result):
    """
    Write inference result to MongoDB. Same DB as 2_ml_modeling; different sink:
    - 2_ml_modeling: local files (results/pipelineN_results.json, model/*.pkl).
    - Production: MongoDB MyParliament.hansard_inference (one doc per pipelineId, upsert).
    
    IMPORTANT: Sanitizes all numpy types to Python native types before saving.
    """
    # Sanitize the result to ensure MongoDB compatibility
    sanitized_result = _sanitize_for_mongodb(result)
    
    client = MongoClient(MONGO_URI)
    db = client["MyParliament"]
    collection = db["hansard_inference"]
    collection.update_one(
        {"pipelineId": sanitized_result["pipelineId"]},
        {"$set": sanitized_result},
        upsert=True
    )
    client.close()


def main():
    # Suppress tokenizers parallelism warning
    import os
    os.environ.setdefault('TOKENIZERS_PARALLELISM', 'false')
    
    parser = argparse.ArgumentParser(description="Production Inference (no macro/ARIMA)")
    parser.add_argument("--batch-size", type=int, default=500)
    parser.add_argument("--pipelines", type=str, default="all")
    parser.add_argument("--max-docs", type=int, default=None)
    parser.add_argument("--dry-run", action="store_true", help="Run inference but do not write to MongoDB (safe to test)")
    args = parser.parse_args()

    pipelines_to_run = list(PIPELINE_CONFIGS.keys()) if args.pipelines == "all" else [
        f"pipeline{p}" if not p.startswith("pipeline") else p for p in args.pipelines.split(",")
    ]

    client = MongoClient(MONGO_URI)
    db = client["MyParliament"]
    raw_col = db[RAW_COLLECTION]
    cpatf_col = db["hansard_cpatf"]

    for pipeline_id in pipelines_to_run:
        if pipeline_id in ("pipeline1", "pipeline2"):
            total_docs = raw_col.count_documents(
                {"$or": [{"ocr_text": {"$exists": True, "$ne": ""}}, {"content_text": {"$exists": True, "$ne": ""}}]}
            )
            if args.max_docs:
                total_docs = min(total_docs, args.max_docs)
            documents = fetch_raw_documents(raw_col, batch_size=total_docs, skip=0)
        else:
            total_docs = cpatf_col.count_documents({"cleaned_text": {"$exists": True, "$ne": ""}})
            if args.max_docs:
                total_docs = min(total_docs, args.max_docs)
            documents = fetch_cpatf_documents(cpatf_col, batch_size=total_docs, skip=0)

        if args.max_docs:
            documents = documents[:args.max_docs]

        if not documents:
            coll = RAW_COLLECTION if pipeline_id in ("pipeline1", "pipeline2") else "hansard_cpatf"
            print(f"Skipping {pipeline_id}: no documents from {coll}. "
                  f"For P1/P2 ensure {coll} has ocr_text or content_text.")
            continue

        result = run_pipeline_inference(pipeline_id, documents, args.batch_size)
        if args.dry_run:
            print(f"[dry-run] Would save {pipeline_id} to hansard_inference (skipped)")
        else:
            save_to_mongodb(result)
            print(f"Saved {pipeline_id} inference to MongoDB")

    client.close()


if __name__ == "__main__":
    main()
