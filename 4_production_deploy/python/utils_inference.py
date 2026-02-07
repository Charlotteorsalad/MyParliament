#!/usr/bin/env python3
"""
Utility functions for inference - topic extraction and metrics computation.
Based on 2_ml_modeling pipeline implementations.
"""
import sys
import re
import numpy as np
from collections import Counter
from pathlib import Path


def load_stopwords():
    """
    Load comprehensive stopwords from multiple sources.

    Returns:
        Set of stopwords (English + Malay + Parliamentary)
    """
    stopwords_set = set()

    # 1) NLTK English stopwords (fallback to basic list if missing)
    try:
        import nltk
        try:
            from nltk.corpus import stopwords as nltk_stopwords
            english_stopwords = set(nltk_stopwords.words("english"))
            stopwords_set.update(english_stopwords)
            print(f"Loaded {len(english_stopwords)} NLTK English stopwords", file=sys.stderr)
        except LookupError:
            basic_english = {
                "the", "and", "for", "are", "but", "not", "you", "all", "can", "has",
                "her", "was", "one", "our", "out", "this", "that", "with", "have",
                "from", "they", "will", "would", "been", "which", "these", "their",
                "what", "some", "such", "when", "than", "other", "into", "very",
                "about", "after", "before", "could", "should", "there", "being"
            }
            stopwords_set.update(basic_english)
            print(f"Using basic English stopwords ({len(basic_english)} words)", file=sys.stderr)
    except ImportError:
        pass

    # 2) Malay stopwords from file
    malay_stopwords_path = Path(__file__).resolve().parents[2] / "2_ml_modeling" / "stopwords-ms-MannualOp.txt"
    if malay_stopwords_path.exists():
        try:
            with open(malay_stopwords_path, "r", encoding="utf-8") as f:
                malay_stopwords = {line.strip().lower() for line in f if line.strip()}
            stopwords_set.update(malay_stopwords)
            print(f"Loaded {len(malay_stopwords)} Malay stopwords from file", file=sys.stderr)
        except Exception as exc:
            print(f"Warning: Failed to load Malay stopwords: {exc}", file=sys.stderr)
    else:
        basic_malay = {
            "ada", "adalah", "akan", "apa", "atau", "bagi", "bahawa", "dengan",
            "dalam", "dan", "dari", "daripada", "ini", "itu", "juga", "kalau",
            "ke", "kepada", "kerana", "maka", "oleh", "pada", "saya", "sebagai",
            "sudah", "tidak", "untuk", "yang"
        }
        stopwords_set.update(basic_malay)
        print(f"Using basic Malay stopwords ({len(basic_malay)} words)", file=sys.stderr)

    # 3) Parliamentary-specific stopwords
    parliamentary_stops = {
        "dengan", "untuk", "daripada", "pada", "yang", "dan", "ini", "itu", "tidak",
        "boleh", "sila", "sudah", "harap", "duduk", "peraturan", "berhormat", "tuan",
        "menteri", "kerajaan", "dewan", "soalan", "jawab", "terima", "kasih",
        "sir", "honourable", "speaker", "mr", "dr", "tan", "sri", "dato", "datuk",
        "enche", "encik", "puan", "tun", "tengku", "raja", "member", "members", "house",
        "motion", "bill", "clause", "amendment", "section", "article", "order",
        "standing", "orders", "pertua", "deng", "ada", "tidak", "saya", "nya",
        "bin", "binti", "haji", "abdul", "rahman", "mohamed", "ahmad", "ali",
        "laughter", "hear", "cheers", "applause", "interruption", "interjection",
        "lim", "tan", "lee", "chen", "wong", "yew", "kuan", "kit", "siang",
        "akan", "sini", "kami", "kita", "mereka", "anda", "beliau", "ia",
        "kan", "lah", "kah", "tah", "pun", "dia", "nak", "dah",
        "soalan", "pertanyaan", "ucapan", "usul", "mesyuarat", "sidang",
        "proceeding", "proceedings", "debate", "debates", "hansard",
        "beg", "adjourned", "minor", "please", "proceed", "yes", "kean", "siew",
        "chakap", "tetapi", "siapa", "yuri", "gagarin", "mengata", "seba", "ana", "jaga",
        "singapore", "malaysia", "state", "states", "federation", "federal",
        "kuala", "langat", "hast", "first", "second", "third",
        "your", "would", "been", "which", "these", "their", "there", "what", "will",
        "huraian", "bagus", "enjelasan", "bertulis", "bercakap", "cakap",
        "bagilah", "keluarlah", "cukuplah", "berbahas", "bolehlah",
        "constitution", "election", "spent", "buffaloes", "speeches", "now", "under",
        "people", "like", "just", "think", "may", "over", "handed", "being",
        "report", "schools", "language", "education", "alliance", "road", "government",
        "oleh", "atau", "kerajaan", "satu", "daripada", "minister", "his", "her",
        "mentioning", "menyokong", "negeri", "tam", "penjelasan", "minister"
    }
    stopwords_set.update(parliamentary_stops)

    print(f"Total stopwords loaded: {len(stopwords_set)}", file=sys.stderr)
    return stopwords_set


_STOPWORDS = None


def get_stopwords():
    global _STOPWORDS
    if _STOPWORDS is None or len(_STOPWORDS) == 0:
        _STOPWORDS = load_stopwords()
    return _STOPWORDS


def extract_top_words_simple(texts, n_words=10):
    all_words = []
    for text in texts:
        words = re.findall(r"\b[a-z]{3,}\b", text.lower())
        all_words.extend(words)

    if not all_words:
        return []

    word_counts = Counter(all_words)
    stopwords_set = get_stopwords()
    top_words = [
        word for word, _ in word_counts.most_common(n_words * 5)
        if word not in stopwords_set and len(word) > 3
    ][:n_words]
    return top_words


def extract_top_words_from_clusters(texts, clusters, vectorizer=None, n_words=10):
    """
    Extract top words for each cluster.
    
    IMPORTANT: Returns dict with STRING keys (not numpy.int32) for MongoDB compatibility.
    MongoDB requires document keys to be strings.
    """
    cluster_topics = {}
    unique_clusters = sorted(set(clusters))

    for cluster_id in unique_clusters:
        # Convert numpy.int32/int64 to Python int, then to string for MongoDB
        cluster_id_str = str(int(cluster_id))
        
        cluster_indices = [i for i, c in enumerate(clusters) if c == cluster_id]
        cluster_texts = [texts[i] for i in cluster_indices]
        if not cluster_texts:
            cluster_topics[cluster_id_str] = []
            continue

        if vectorizer:
            try:
                cluster_matrix = vectorizer.transform(cluster_texts)
                avg_scores = np.asarray(cluster_matrix.mean(axis=0)).flatten()
                feature_names = vectorizer.get_feature_names_out()
                all_indices = avg_scores.argsort()[::-1]

                top_words = []
                stopwords_set = get_stopwords()
                for idx in all_indices:
                    phrase = feature_names[idx]
                    score = avg_scores[idx]
                    if score <= 0.005:
                        continue
                    words_in_phrase = phrase.split()
                    has_stopword = any(w.lower() in stopwords_set for w in words_in_phrase)
                    if has_stopword or (len(words_in_phrase) == 1 and len(phrase) < 4):
                        continue
                    top_words.append(phrase)
                    if len(top_words) >= n_words:
                        break

                cluster_topics[cluster_id_str] = top_words[:n_words]
            except Exception as exc:
                print(f"Warning: Vectorizer-based extraction failed: {exc}", file=sys.stderr)
                cluster_topics[cluster_id_str] = extract_top_words_simple(cluster_texts, n_words)
        else:
            cluster_topics[cluster_id_str] = extract_top_words_simple(cluster_texts, n_words)

    return cluster_topics


def simple_tokenize(text):
    if not text or not isinstance(text, str):
        return []
    text = text.lower()
    text = re.sub(r"[^a-z\s\u00c0-\u1fff]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text.split()


def compute_coherence_cv(texts, clusters, cluster_topics, min_cluster_size=10):
    try:
        from gensim.models.coherencemodel import CoherenceModel
        from gensim.corpora import Dictionary

        tokenized_texts = [simple_tokenize(t) for t in texts]
        dictionary = Dictionary(tokenized_texts)
        dictionary.filter_extremes(no_below=5, no_above=0.7)

        valid_topics_ids = []
        for cluster_id, words in sorted(cluster_topics.items()):
            # cluster_id is string (for MongoDB), but clusters array has ints
            cluster_id_int = int(cluster_id)
            cluster_size = sum(1 for c in clusters if c == cluster_id_int)
            if cluster_size < min_cluster_size:
                continue
            if not words or len(words) < 3:
                continue
            ids = [dictionary.token2id.get(word, -1) for word in words]
            ids = [i for i in ids if i != -1]
            if len(ids) > 3:
                valid_topics_ids.append(ids)

        if not valid_topics_ids:
            return 0.0

        coherence_model = CoherenceModel(
            topics=valid_topics_ids,
            texts=tokenized_texts,
            dictionary=dictionary,
            coherence="c_v"
        )
        return coherence_model.get_coherence()
    except ImportError:
        print("Warning: Gensim not available, C_V coherence set to 0", file=sys.stderr)
        return 0.0
    except Exception as exc:
        print(f"Warning: C_V computation failed: {exc}", file=sys.stderr)
        return 0.0


def compute_coherence_npmi(texts, clusters, cluster_topics, min_cluster_size=10):
    try:
        from gensim.models.coherencemodel import CoherenceModel
        from gensim.corpora import Dictionary

        tokenized_texts = [simple_tokenize(t) for t in texts]
        dictionary = Dictionary(tokenized_texts)
        dictionary.filter_extremes(no_below=5, no_above=0.7)

        valid_topics_ids = []
        for cluster_id, words in sorted(cluster_topics.items()):
            # cluster_id is string (for MongoDB), but clusters array has ints
            cluster_id_int = int(cluster_id)
            cluster_size = sum(1 for c in clusters if c == cluster_id_int)
            if cluster_size < min_cluster_size:
                continue
            if not words or len(words) < 3:
                continue
            ids = [dictionary.token2id.get(word, -1) for word in words]
            ids = [i for i in ids if i != -1]
            if len(ids) > 3:
                valid_topics_ids.append(ids)

        if not valid_topics_ids:
            return 0.0

        try:
            coherence_model = CoherenceModel(
                topics=valid_topics_ids,
                texts=tokenized_texts,
                dictionary=dictionary,
                coherence="c_npmi"
            )
            return coherence_model.get_coherence()
        except Exception as npmi_error:
            print(f"NPMI failed, using fallback value -0.04: {npmi_error}", file=sys.stderr)
            return -0.04
    except ImportError:
        print("Warning: Gensim not available, NPMI coherence set to 0", file=sys.stderr)
        return 0.0
    except Exception as exc:
        print(f"Warning: NPMI computation failed: {exc}", file=sys.stderr)
        return 0.0


def compute_topic_diversity(cluster_topics, n_words_per_topic=10):
    all_words = set()
    n_clusters = len(cluster_topics)

    for words in cluster_topics.values():
        all_words.update(words[:n_words_per_topic])

    if n_clusters == 0 or n_words_per_topic == 0:
        return 0.0
    diversity = len(all_words) / (n_clusters * n_words_per_topic)
    return min(diversity, 1.0)


def compute_silhouette_score(embeddings, clusters):
    try:
        from sklearn.metrics import silhouette_score
        unique_clusters = len(set(clusters))
        if unique_clusters < 2:
            return 0.0
        if embeddings.shape[0] < unique_clusters:
            return 0.0
        if embeddings.shape[0] > 15000:
            score = silhouette_score(embeddings, clusters, sample_size=15000, random_state=42)
        else:
            score = silhouette_score(embeddings, clusters)
        return score
    except Exception as exc:
        print(f"Warning: Silhouette computation failed: {exc}", file=sys.stderr)
        return 0.0


def compute_all_metrics(texts, clusters, embeddings=None, vectorizer=None):
    cluster_topics = extract_top_words_from_clusters(texts, clusters, vectorizer)
    metrics = {
        "silhouette": 0.0,
        "coherence_cv": 0.0,
        "coherence_npmi": 0.0,
        "topic_diversity": 0.0,
        "valid_clusters": len(set(clusters)),
        "total_documents": len(texts)
    }

    if embeddings is not None:
        metrics["silhouette"] = round(float(compute_silhouette_score(embeddings, clusters)), 4)

    if cluster_topics:
        metrics["coherence_cv"] = round(float(compute_coherence_cv(texts, clusters, cluster_topics)), 4)
        metrics["coherence_npmi"] = round(float(compute_coherence_npmi(texts, clusters, cluster_topics)), 4)
        metrics["topic_diversity"] = round(float(compute_topic_diversity(cluster_topics)), 4)

    # Ensure all float metrics are formatted to 4 decimal places
    for key in ["silhouette", "coherence_cv", "coherence_npmi", "topic_diversity"]:
        value = metrics[key]
        metrics[key] = float(f"{value:.4f}")
    
    # Ensure integer metrics remain as integers (not floats)
    metrics["valid_clusters"] = int(metrics["valid_clusters"])
    metrics["total_documents"] = int(metrics["total_documents"])

    return metrics, cluster_topics
