#!/usr/bin/env python3
"""
Topic Generation for Parliamentary Debates

Generates human-readable topic names for clustered parliamentary debates using rule-based method.
Reads from hansard_inference, updates topic_labels there, and writes structured topics to hansard_topic.

Features:
    - Fast: Processes all pipelines in seconds
    - Reliable: No external dependencies
    - Customizable: Edit utils_topic_generation.py to add categories
    - Cost: $0

Writes to:
    - hansard_inference: topic_labels field (per pipeline doc)
    - hansard_topic: one document per cluster (pipeline_id, cluster_id, keywords, topic_label, metadata)

Usage:
    # Generate topic names for all pipelines
    python topic_generation.py
    
    # Generate for specific pipeline only
    python topic_generation.py --pipeline pipeline3
    
    # Force regeneration (overwrite existing)
    python topic_generation.py --force
"""
import argparse
import os
from pathlib import Path
from datetime import datetime

from pymongo import MongoClient
from dotenv import load_dotenv

# Import rule-based topic generation utilities
from utils_topic_generation import batch_generate_topic_names

# Load environment
project_root = Path(__file__).resolve().parents[2]
backend_env_path = project_root / "3_app_system" / "backend" / ".env"
load_dotenv(backend_env_path, override=True)

MONGO_URI = os.getenv("MONGO_URI")
if not MONGO_URI:
    raise RuntimeError("MONGO_URI not found in environment")




def process_pipeline(pipeline_id: str, force: bool = False) -> bool:
    """
    Generate topic names for all clusters in a pipeline using rule-based method.
    
    Args:
        pipeline_id: Pipeline identifier (e.g., "pipeline3")
        force: If True, regenerate even if topic_labels already exist
    
    Returns:
        True if successful, False otherwise
    """
    client = MongoClient(MONGO_URI)
    db = client["MyParliament"]
    collection = db["hansard_inference"]
    
    # Get inference results
    inference = collection.find_one({"pipelineId": pipeline_id})
    if not inference:
        print(f"WARNING: No inference found for {pipeline_id}")
        client.close()
        return False
    
    # Check if already has topic_labels
    if not force and "topic_labels" in inference and inference["topic_labels"]:
        print(f"INFO: {pipeline_id} already has topic_labels. Use --force to regenerate.")
        client.close()
        return True
    
    cluster_topics = inference.get("cluster_topics", {})
    if not cluster_topics:
        print(f"WARNING: No cluster_topics found for {pipeline_id}")
        client.close()
        return False
    
    print(f"\n{'='*60}")
    print(f"Processing {pipeline_id}")
    print(f"{'='*60}")
    print(f"Total clusters: {len(cluster_topics)}")
    print(f"Method: Rule-based (fast)")
    
    # Generate topic names using rule-based method
    print("\nGenerating topic names...")
    topic_labels = batch_generate_topic_names(cluster_topics)
    
    # Print results
    for cluster_id, label in topic_labels.items():
        print(f"  Cluster {cluster_id}: {label['name_en']}")
    
    # Update hansard_inference (topic_labels field)
    generated_at = datetime.utcnow().isoformat()
    update_data = {
        "topic_labels": topic_labels,
        "topic_labels_generated_at": generated_at,
        "topic_labels_method": "rule_based",
    }
    
    print(f"\nUpdating hansard_inference...")
    collection.update_one(
        {"pipelineId": pipeline_id},
        {"$set": update_data}
    )
    
    # Write to hansard_topic (normal insert: delete existing for pipeline then insert_many)
    topic_collection = db["hansard_topic"]
    n_clusters = inference.get("n_clusters", len(cluster_topics))
    metrics = inference.get("metrics", {})
    
    print(f"Writing to hansard_topic...")
    topic_collection.delete_many({"pipeline_id": pipeline_id})
    
    topic_docs = []
    for cluster_id, keywords in cluster_topics.items():
        if cluster_id not in topic_labels:
            continue
        label = topic_labels[cluster_id]
        topic_docs.append({
            "pipeline_id": pipeline_id,
            "cluster_id": int(cluster_id),
            "keywords": keywords,
            "topic_label": {
                "name_en": label.get("name_en", ""),
                "name_ms": label.get("name_ms", ""),
                "description": label.get("description", ""),
            },
            "metadata": {
                "n_clusters": n_clusters,
                "metrics": metrics,
                "generated_at": generated_at,
                "method": "rule_based",
                "label_quality": label.get("label_quality", "medium"),  # high | medium | low
                "created_at": datetime.utcnow().isoformat(),
            },
        })
    
    if topic_docs:
        topic_collection.insert_many(topic_docs)
    
    # Ensure index exists (idempotent)
    topic_collection.create_index([("pipeline_id", 1), ("cluster_id", 1)], unique=True)
    
    print(f"SUCCESS: Generated {len(topic_labels)} topic labels for {pipeline_id}")
    print(f"         Wrote {len(topic_docs)} docs to hansard_topic")
    client.close()
    return True


def main():
    """
    Main entry point for topic generation.
    """
    parser = argparse.ArgumentParser(
        description="Generate topic names using rule-based method",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Generate for all pipelines
  python topic_generation.py
  
  # Generate for specific pipeline
  python topic_generation.py --pipeline pipeline3
  
  # Force regeneration
  python topic_generation.py --force

Customization:
  Edit utils_topic_generation.py to add/update topic categories and patterns.
        """
    )
    
    parser.add_argument(
        "--pipeline",
        type=str,
        help="Specific pipeline to process (e.g., pipeline3). If not specified, processes all."
    )
    
    parser.add_argument(
        "--force",
        action="store_true",
        help="Force regeneration even if topic_labels already exist"
    )
    
    args = parser.parse_args()
    
    print("Using rule-based method (fast, no external dependencies)")
    
    # Determine which pipelines to process
    if args.pipeline:
        pipelines = [args.pipeline]
    else:
        # Process all pipelines (P1 uses LDA, P3-P6 use MEHTC)
        pipelines = ["pipeline1", "pipeline2", "pipeline3", "pipeline4", "pipeline5", "pipeline6"]
    
    # Process each pipeline
    results = []
    for pipeline_id in pipelines:
        success = process_pipeline(pipeline_id, force=args.force)
        results.append((pipeline_id, success))
    
    # Summary
    print(f"\n{'='*60}")
    print("Summary")
    print(f"{'='*60}")
    for pipeline_id, success in results:
        status = "SUCCESS" if success else "FAILED"
        print(f"  {pipeline_id}: {status}")
    
    # Return exit code
    all_success = all(success for _, success in results)
    return 0 if all_success else 1


if __name__ == "__main__":
    exit_code = main()
    exit(exit_code)
