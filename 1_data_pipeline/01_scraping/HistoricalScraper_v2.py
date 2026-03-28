import sys
from datetime import datetime, timedelta
from typing import Dict
import io
import time
import concurrent.futures
import os
from pathlib import Path
from dotenv import load_dotenv

# Setup proper requirements installation
def install_requirements():
    try:
        import pip
        requirements = [
            'pymongo',
            'pdfplumber',
            'requests',
            'pytz',
            'urllib3',
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
import pytz
import urllib3

# Disable SSL warnings
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

class HansardScraper:
    def __init__(self, mongodb_uri: str, max_workers: int = 10):
        self.mongodb_uri = mongodb_uri
        self.max_workers = max_workers
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
            print(f"MongoDB connection failed: {e}")
            raise

    def _setup_indexes(self):
        try:
            existing_indexes = self.collection.index_information()
            if "url_1" not in existing_indexes:
                self.collection.create_index([("url", pymongo.ASCENDING)], unique=True)
            if "hansardDate_1" not in existing_indexes:
                self.collection.create_index([("hansardDate", pymongo.ASCENDING)])
        except Exception as e:
            print(f"Error setting up indexes: {e}")

    def process_date_range(self, start_date: datetime, end_date: datetime, batch_size: int = 50):
        """Process date range with error handling"""
        results = {'success': 0, 'failed': 0, 'skipped': 0, 'failures': []}

        current_date = start_date
        while current_date <= end_date:
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
                            print(f"Error processing date {date}: {e}")
                            results['failed'] += 1
                            results['failures'].append({
                                'date': date.strftime('%Y-%m-%d'),
                                'error': str(e)
                            })

                print(f"Batch complete. Success: {results['success']}, Skipped: {results['skipped']}, Failed: {results['failed']}")
                
            except Exception as e:
                print(f"Batch processing failed: {e}")

        return results

    def process_single_date(self, date: datetime) -> Dict:
        """Process a single date with robust error handling"""
        url = f"https://www.parlimen.gov.my/files/hindex/pdf/DR-{date.strftime('%d%m%Y')}.pdf"
        
        # Check if already exists in database
        try:
            existing = self.collection.find_one({'url': url})
            if existing:
                print(f"Already exists: {url}")
                return {'status': 'skipped', 'date': date, 'reason': 'already_exists'}
        except Exception as e:
            print(f"Error checking existing document: {e}")
        
        print(f"Processing: {url}")
        
        for attempt in range(3):  # 3 retries
            try:
                response = requests.get(url, timeout=30, verify=False)
                if response.status_code == 404:
                    return {'status': 'skipped', 'date': date, 'reason': 'no_document'}
                    
                response.raise_for_status()
                
                # Check if content is actually a PDF
                content_type = response.headers.get('Content-Type', '')
                if 'pdf' not in content_type.lower() and len(response.content) < 1000:
                    print(f"Invalid content: {url}")
                    return {'status': 'skipped', 'date': date, 'reason': 'invalid_content'}
                
                text = self._extract_text_from_pdf(response.content)
                self._store_document(url, date, text)
                print(f"✓ Success: {url}")
                return {'status': 'success', 'date': date}
                
            except requests.RequestException as e:
                print(f"Attempt {attempt + 1} failed for {url}: {e}")
                if attempt == 2:  # Last attempt
                    return {
                        'status': 'failed',
                        'date': date,
                        'error': f"Request failed after 3 attempts: {str(e)}"
                    }
                time.sleep(5 * (attempt + 1))  # Exponential backoff
                
            except Exception as e:
                print(f"Error processing {url}: {e}")
                return {'status': 'failed', 'date': date, 'error': str(e)}

    def _extract_text_from_pdf(self, content: bytes) -> str:
        try:
            with pdfplumber.open(io.BytesIO(content)) as pdf:
                text = []
                for page in pdf.pages:
                    try:
                        text.append(page.extract_text() or "")
                    except Exception as e:
                        print(f"Warning: Error extracting text from page: {e}")
                return " ".join(text)
        except Exception as e:
            print(f"PDF processing error: {e}")
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
        except pymongo.errors.DuplicateKeyError:
            print(f"Document already exists (duplicate key): {url}")
        except Exception as e:
            print(f"MongoDB storage error: {e}")
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
            print(f"Error updating results: {e}")

def main():
    # 1. Get URI from environment
    MONGODB_URI = os.getenv('MONGODB_URI')
    
    # 2. If not found, try to load from .env file
    if not MONGODB_URI:
        project_root = Path.cwd().parent.parent
        backend_env_path = project_root / "3_app_system" / "backend" / ".env"
        load_dotenv(backend_env_path)
        
        MONGODB_URI = os.getenv("MONGO_URI") 
    
    if not MONGODB_URI:
        print("MONGODB_URI not found in environment variables")
        sys.exit(1)
    
    try:
        scraper = HansardScraper(MONGODB_URI)
        results = scraper.process_date_range(
            start_date=datetime(2026, 1, 24),
            end_date=datetime(2026, 2, 21),
            batch_size=50
        )
        
        print("\n=== PROCESSING COMPLETE ===")
        print(f"Success: {results['success']}")
        print(f"Skipped: {results['skipped']}")
        print(f"Failed: {results['failed']}")
        
        if results['failures']:
            print("\nFailed items:")
            for failure in results['failures'][:10]:  # Show first 10
                print(f"  - {failure['date']}: {failure['error']}")
        
    except Exception as e:
        print(f"Scraper failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()