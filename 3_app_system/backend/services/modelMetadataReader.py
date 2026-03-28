#!/usr/bin/env python3
"""
Script to read ML model metadata from .pkl files
Returns JSON with model information
"""

import os
import sys
import json
import pickle
from pathlib import Path
from datetime import datetime

def get_model_metadata(model_path):
    """Extract metadata from a pickle model file"""
    model_name = os.path.basename(model_path).replace('.pkl', '')
    model = None
    
    try:
        # Try to load the model
        with open(model_path, 'rb') as f:
            model = pickle.load(f)
    except Exception as load_error:
        # If loading fails, still return basic metadata
        file_stats = os.stat(model_path)
        file_size_mb = file_stats.st_size / (1024 * 1024)
        modified_time = datetime.fromtimestamp(file_stats.st_mtime)
        
        # Determine type from filename
        model_type = 'Unknown'
        if 'lda' in model_name.lower():
            model_type = 'Topic Modeling'
        elif 'kmeans' in model_name.lower():
            model_type = 'Clustering'
        elif 'entity' in model_name.lower():
            model_type = 'Named Entity Recognition'
        elif 'sota' in model_name.lower() or 'e5' in model_name.lower():
            model_type = 'Text Classification'
        elif 'tfidf' in model_name.lower():
            model_type = 'Feature Extraction'
        elif 'xlm' in model_name.lower() or 'zeroshot' in model_name.lower():
            model_type = 'Zero-Shot Classification'
        
        return {
            'id': model_name.lower().replace(' ', '-').replace('_', '-'),
            'name': model_name.replace('_', ' ').title(),
            'filename': os.path.basename(model_path),
            'type': model_type,
            'fileSize': round(file_size_mb, 2),
            'lastModified': modified_time.isoformat(),
            'status': 'active',  # Still mark as active even if we can't load it
            'loadWarning': str(load_error)[:100]  # Truncate error message
        }
    
    try:
        
        # Get file stats
        file_stats = os.stat(model_path)
        file_size_mb = file_stats.st_size / (1024 * 1024)
        modified_time = datetime.fromtimestamp(file_stats.st_mtime)
        
        # Try to extract model attributes
        model_type = type(model).__name__
        
        # Try to get common sklearn attributes
        metadata = {
            'id': model_name.lower().replace(' ', '-').replace('_', '-'),
            'name': model_name.replace('_', ' ').title(),
            'filename': os.path.basename(model_path),
            'type': model_type,
            'fileSize': round(file_size_mb, 2),
            'lastModified': modified_time.isoformat(),
            'status': 'active'
        }
        
        # Extract REAL metrics from model - NO RANDOM GENERATION
        metrics = {}
        
        # Handle dictionary-based models (like tfidf_kmeans_model.pkl)
        if isinstance(model, dict):
            # Extract all available metrics from dictionary
            metric_keys = ['silhouette_score', 'coherence_cv', 'coherence_npmi', 'topic_diversity', 
                          'n_clusters', 'accuracy', 'precision', 'recall', 'f1_score', 'f1Score',
                          'loss', 'finalLoss', 'finalAccuracy', 'meanCVScore', 'bestScore']
            for key in metric_keys:
                if key in model:
                    value = model[key]
                    if isinstance(value, (int, float)):
                        metrics[key] = float(value)
                    elif isinstance(value, list) and len(value) > 0:
                        metrics[key] = float(value[-1])  # Get last value if it's a list
            
            # Also check nested structures
            if 'metrics' in model and isinstance(model['metrics'], dict):
                for k, v in model['metrics'].items():
                    if isinstance(v, (int, float)):
                        metrics[k] = float(v)
            
            if 'training_history' in model:
                history = model['training_history']
                if isinstance(history, dict):
                    for key in ['loss', 'accuracy', 'val_loss', 'val_accuracy']:
                        if key in history:
                            hist_list = history[key]
                            if isinstance(hist_list, list) and len(hist_list) > 0:
                                metrics[key] = float(hist_list[-1])
        
        # Handle Gensim LDA models
        elif hasattr(model, 'num_topics'):
            try:
                metrics['numTopics'] = model.num_topics
                if hasattr(model, 'alpha'):
                    alpha = model.alpha
                    if hasattr(alpha, '__len__'):
                        metrics['alpha'] = float(alpha[0]) if len(alpha) > 0 else None
                    else:
                        metrics['alpha'] = float(alpha)
                if hasattr(model, 'eta'):
                    eta = model.eta
                    if hasattr(eta, '__len__'):
                        metrics['eta'] = float(eta[0]) if len(eta) > 0 else None
                    else:
                        metrics['eta'] = float(eta)
            except:
                pass
        
        # Handle sklearn models
        elif hasattr(model, 'get_params'):
            try:
                # Try to get score if available
                if hasattr(model, 'score_'):
                    try:
                        score_val = model.score_
                        if isinstance(score_val, (int, float)):
                            metrics['score'] = float(score_val)
                    except:
                        pass
                
                # Get parameters
                params = model.get_params()
                metadata['parameters'] = {k: str(v) for k, v in list(params.items())[:10]}
                
                # Get feature count
                if hasattr(model, 'feature_names_in_'):
                    metrics['numFeatures'] = len(model.feature_names_in_)
                elif hasattr(model, 'n_features_in_'):
                    metrics['numFeatures'] = model.n_features_in_
                
                # Get CV results if available
                if hasattr(model, 'cv_results_'):
                    try:
                        cv_results = model.cv_results_
                        if 'mean_test_score' in cv_results and len(cv_results['mean_test_score']) > 0:
                            metrics['meanCVScore'] = float(cv_results['mean_test_score'][-1])
                        if 'std_test_score' in cv_results and len(cv_results['std_test_score']) > 0:
                            metrics['stdCVScore'] = float(cv_results['std_test_score'][-1])
                    except:
                        pass
                
                # Get best score if available
                if hasattr(model, 'best_score_'):
                    try:
                        best_score = model.best_score_
                        if isinstance(best_score, (int, float)):
                            metrics['bestScore'] = float(best_score)
                    except:
                        pass
                
                # For KMeans
                if hasattr(model, 'n_clusters'):
                    metrics['numClusters'] = model.n_clusters
                if hasattr(model, 'inertia_'):
                    metrics['inertia'] = float(model.inertia_)
                if hasattr(model, 'labels_'):
                    metrics['numSamples'] = len(model.labels_)
                
                # For LDA (sklearn)
                if hasattr(model, 'components_'):
                    components = model.components_
                    metrics['numTopics'] = len(components)
                    metrics['vocabSize'] = components.shape[1] if len(components.shape) > 1 else 0
            except:
                pass
        
        # Only add metrics if we found real ones
        if metrics:
            metadata['metrics'] = metrics
        
        # Model-specific handling
        if 'lda' in model_name.lower():
            metadata['type'] = 'Topic Modeling'
            if hasattr(model, 'components_'):
                metadata['topics'] = len(model.components_)
        elif 'kmeans' in model_name.lower():
            metadata['type'] = 'Clustering'
            if hasattr(model, 'n_clusters'):
                metadata['clusters'] = model.n_clusters
        elif 'entity' in model_name.lower():
            metadata['type'] = 'Named Entity Recognition'
        elif 'sentiment' in model_name.lower() or 'sota' in model_name.lower() or 'e5' in model_name.lower():
            metadata['type'] = 'Text Classification'
        elif 'tfidf' in model_name.lower():
            metadata['type'] = 'Feature Extraction'
        elif 'xlm' in model_name.lower() or 'zeroshot' in model_name.lower():
            metadata['type'] = 'Zero-Shot Classification'
        elif isinstance(model, dict):
            # Handle dictionary-based models
            if 'model' in model or 'classifier' in model or 'predictor' in model:
                metadata['type'] = 'Text Classification'
            else:
                metadata['type'] = 'Model Bundle'
        
        return metadata
        
    except Exception as e:
        # Final fallback if anything else fails
        file_stats = os.stat(model_path)
        file_size_mb = file_stats.st_size / (1024 * 1024)
        modified_time = datetime.fromtimestamp(file_stats.st_mtime)
        
        return {
            'id': os.path.basename(model_path).replace('.pkl', '').lower().replace(' ', '-').replace('_', '-'),
            'name': os.path.basename(model_path).replace('.pkl', '').replace('_', ' ').title(),
            'filename': os.path.basename(model_path),
            'type': 'Unknown',
            'fileSize': round(file_size_mb, 2),
            'lastModified': modified_time.isoformat(),
            'status': 'active',
            'loadWarning': str(e)[:100]
        }

def scan_models_directory(models_dir):
    """Scan directory for .pkl files and extract metadata"""
    models = []
    
    if not os.path.exists(models_dir):
        return models
    
    for file in os.listdir(models_dir):
        if file.endswith('.pkl'):
            model_path = os.path.join(models_dir, file)
            metadata = get_model_metadata(model_path)
            models.append(metadata)
    
    return models

if __name__ == '__main__':
    # Get models directory from command line or use default
    if len(sys.argv) > 1:
        models_dir = sys.argv[1]
    else:
        # Default path relative to script location
        script_dir = os.path.dirname(os.path.abspath(__file__))
        project_root = os.path.dirname(os.path.dirname(os.path.dirname(script_dir)))
        models_dir = os.path.join(project_root, '2_ml_modeling', 'model')
    
    models = scan_models_directory(models_dir)
    
    # Calculate summary statistics
    total_models = len(models)
    active_models = len([m for m in models if m.get('status') == 'active'])
    
    # Output as JSON
    output = {
        'models': models,
        'summary': {
            'totalModels': total_models,
            'activeModels': active_models,
            'scanTime': datetime.now().isoformat()
        }
    }
    
    print(json.dumps(output, indent=2))
