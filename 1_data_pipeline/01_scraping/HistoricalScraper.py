import os
import sys
import logging
import json
import glob
import psutil
import pytz
import io
import time
import concurrent.futures
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from pathlib import Path

# Setup proper requirements installation
def install_requirements():
    try:
        import pip
        requirements = [
            'pymongo',
            'pdfplumber',
            'requests',
            'tqdm',
            'python-dotenv',
            'pandas',
            'plotly'
        ]
        for package in requirements:
            if package not in sys.modules:
                pip.main(['install', package])
    except Exception as e:
        print(f"Error installing requirements: {e}")
        sys.exit(1)

# Install required packages
install_requirements()

# Import the installed packages
import pymongo
import pdfplumber
import requests
from tqdm import tqdm
from dotenv import load_dotenv

# Configure logging for VM environment
log_dir = Path.home() / 'hansard_logs'
log_dir.mkdir(parents=True, exist_ok=True)
log_file = log_dir / 'scraper.log'

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(log_file),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

class SystemMonitor:
    @staticmethod
    def check_memory_usage():
        memory = psutil.virtual_memory()
        if memory.percent > 90:
            logger.warning(f"High memory usage: {memory.percent}%")
            return False
        return True

    @staticmethod
    def check_disk_space():
        disk = psutil.disk_usage('/')
        if disk.percent > 90:
            logger.warning(f"Low disk space: {disk.percent}% used")
            return False
        return True

class ProgressManager:
    def __init__(self, checkpoint_dir: str = str(Path.home() / 'hansard_checkpoints')):
        self.checkpoint_dir = Path(checkpoint_dir)
        self.checkpoint_dir.mkdir(parents=True, exist_ok=True)

    def save_checkpoint(self, results: Dict, current_date: datetime):
        try:
            checkpoint = {
                'results': results,
                'last_processed_date': current_date.isoformat(),
                'timestamp': datetime.now().isoformat()
            }
            filename = f"checkpoint_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
            filepath = self.checkpoint_dir / filename
            
            with open(filepath, 'w') as f:
                json.dump(checkpoint, f)

            # Keep only last 5 checkpoints
            checkpoints = list(self.checkpoint_dir.glob('checkpoint_*.json'))
            if len(checkpoints) > 5:
                oldest = min(checkpoints, key=lambda x: x.stat().st_mtime)
                oldest.unlink()
                
        except Exception as e:
            logger.error(f"Error saving checkpoint: {e}")

    def load_latest_checkpoint(self) -> Optional[Dict]:
        try:
            checkpoints = list(self.checkpoint_dir.glob('checkpoint_*.json'))
            if not checkpoints:
                return None
                
            latest = max(checkpoints, key=lambda x: x.stat().st_mtime)
            with open(latest, 'r') as f:
                return json.load(f)
                
        except Exception as e:
            logger.error(f"Error loading checkpoint: {e}")
            return None

class HansardScraper:
    def __init__(self, mongodb_uri: str, max_workers: int = 10):
        self.mongodb_uri = mongodb_uri
        self.max_workers = max_workers
        self.system_monitor = SystemMonitor()
        self.progress_manager = ProgressManager()
        self.MY_TZ = pytz.timezone('Asia/Kuala_Lumpur')
        
        try:
            self.client = pymongo.MongoClient(
                mongodb_uri, 
                serverSelectionTimeoutMS=5000,
                connectTimeoutMS=30000,
                socketTimeoutMS=None,
                maxPoolSize=100
            )
            self.db = self.client['MyParliament']
            self.collection = self.db['HansardDocument']
            
            # Create indexes
            self._setup_indexes()
            
        except Exception as e:
            logger.error(f"MongoDB connection failed: {e}")
            raise

    def _setup_indexes(self):
        try:
            existing_indexes = self.collection.index_information()
            if "url_1" not in existing_indexes:
                self.collection.create_index([("url", pymongo.ASCENDING)], unique=True)
            if "hansardDate_1" not in existing_indexes:
                self.collection.create_index([("hansardDate", pymongo.ASCENDING)])
        except Exception as e:
            logger.error(f"Error setting up indexes: {e}")

    def process_date_range(self, start_date: datetime, end_date: datetime, batch_size: int = 50):
        """Process date range with resource monitoring and error handling"""
        checkpoint = self.progress_manager.load_latest_checkpoint()
        if checkpoint:
            start_date = datetime.fromisoformat(checkpoint['last_processed_date'])
            results = checkpoint['results']
            logger.info(f"Resuming from checkpoint: {start_date}")
        else:
            results = {'success': 0, 'failed': 0, 'skipped': 0, 'failures': []}

        current_date = start_date
        while current_date <= end_date:
            # Check system resources
            if not (self.system_monitor.check_memory_usage() and 
                   self.system_monitor.check_disk_space()):
                logger.warning("System resources low - waiting 5 minutes")
                time.sleep(300)  # Wait 5 minutes
                continue

            batch_dates = []
            for _ in range(batch_size):
                if current_date <= end_date:
                    if current_date.weekday() < 5:  # Monday to Friday
                        batch_dates.append(current_date)
                    current_date += timedelta(days=1)
                else:
                    break

            if not batch_dates:
                break

            try:
                with concurrent.futures.ThreadPoolExecutor(max_workers=self.max_workers) as executor:
                    future_to_date = {
                        executor.submit(self.process_single_date, date): date 
                        for date in batch_dates
                    }
                    
                    for future in concurrent.futures.as_completed(future_to_date):
                        date = future_to_date[future]
                        try:
                            result = future.result()
                            self._update_results(results, result)
                        except Exception as e:
                            logger.error(f"Error processing date {date}: {e}")
                            results['failed'] += 1
                            results['failures'].append({
                                'date': date.strftime('%Y-%m-%d'),
                                'error': str(e)
                            })

                # Save checkpoint after each batch
                self.progress_manager.save_checkpoint(results, batch_dates[-1])
                
            except Exception as e:
                logger.error(f"Batch processing failed: {e}")
                self.progress_manager.save_checkpoint(results, batch_dates[0])

        return results

    def process_single_date(self, date: datetime) -> Dict:
        """Process a single date with robust error handling"""
        url = f"https://www.parlimen.gov.my/files/hindex/pdf/DR-{date.strftime('%d%m%Y')}.pdf"
        logger.info(f"Processing URL: {url}")
        
        for attempt in range(3):  # 3 retries
            try:
                response = requests.get(url, timeout=30)
                if response.status_code == 404:
                    return {'status': 'skipped', 'date': date, 'reason': 'no_document'}
                    
                response.raise_for_status()
                text = self._extract_text_from_pdf(response.content)
                self._store_document(url, date, text)
                return {'status': 'success', 'date': date}
                
            except requests.RequestException as e:
                logger.warning(f"Attempt {attempt + 1} failed for {url}: {e}")
                if attempt == 2:  # Last attempt
                    return {
                        'status': 'failed',
                        'date': date,
                        'error': f"Request failed after 3 attempts: {str(e)}"
                    }
                time.sleep(5 * (attempt + 1))  # Exponential backoff
                
            except Exception as e:
                logger.error(f"Error processing {url}: {e}")
                return {'status': 'failed', 'date': date, 'error': str(e)}

    def _extract_text_from_pdf(self, content: bytes) -> str:
        try:
            with pdfplumber.open(io.BytesIO(content)) as pdf:
                text = []
                for page in pdf.pages:
                    try:
                        text.append(page.extract_text() or "")
                    except Exception as e:
                        logger.warning(f"Error extracting text from page: {e}")
                return " ".join(text)
        except Exception as e:
            logger.error(f"PDF processing error: {e}")
            raise

    def _store_document(self, url: str, date: datetime, text: str):
        try:
            document = {
                'url': url,
                'downloadDate': datetime.now(self.MY_TZ),
                'processedStatus': 'completed',
                'content_text': text,
                'hansardDate': date
            }
            self.collection.insert_one(document)
        except Exception as e:
            logger.error(f"MongoDB storage error: {e}")
            raise

def _update_results(self, results: Dict, result: Dict):
    """Update results dictionary with processing outcomes"""
    try:
        if result['status'] == 'success':
            results['success'] += 1
        elif result['status'] == 'skipped':
            results['skipped'] += 1
        else:
            results['failed'] += 1
            results['failures'].append({
                'date': result['date'].strftime('%Y-%m-%d') if isinstance(result['date'], datetime) else str(result['date']),
                'error': result.get('error', 'Unknown error')
            })
    except Exception as e:
        logger.error(f"Error updating results: {e}")

def main():
    # MongoDB connection string
    MONGODB_URI = os.getenv('MONGODB_URI')
    if not MONGODB_URI:
        env_path = Path(__file__).parent.parent / '3_app_system' / 'backend' / '.env'
        load_dotenv(env_path)
        MONGODB_URI = os.getenv('MONGODB_URI')
    
    if not MONGODB_URI:
        logger.error("MONGODB_URI not found in environment variables")
        sys.exit(1)
    
    try:
        scraper = HansardScraper(MONGODB_URI)
        results = scraper.process_date_range(
            start_date=datetime(1959, 9, 11),
            end_date=datetime(2024, 11, 12),
            batch_size=50
        )
        
        logger.info("Processing complete")
        logger.info(f"Results: {json.dumps(results, default=str, indent=2)}")
        
    except Exception as e:
        logger.error(f"Scraper failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()