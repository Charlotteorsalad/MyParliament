# CELL 1: Install Dependencies
#pip3 install pymongo pandas dnspython requests beautifulsoup4 lxml

# CELL 2: Import Libraries
import requests
from bs4 import BeautifulSoup
import re
import json
import pymongo
from datetime import datetime
from collections import defaultdict, Counter
import pandas as pd
import time
import os
from urllib.parse import urljoin, urlparse
from dotenv import load_dotenv

# CELL 3: Comprehensive MP Scraper Class
class ComprehensiveMPScraper:
    def __init__(self, db_connection_string, database_name="MyParliament", mp_collection_name="MP", honorific_collection_name="honorific_dictionary"):
        self.client = pymongo.MongoClient(db_connection_string)
        self.db = self.client[database_name]
        self.mp_collection = self.db[mp_collection_name]
        self.honorific_collection = self.db[honorific_collection_name]
        
        # Base URLs
        self.base_url = "https://www.parlimen.gov.my/"
        self.main_listing_url = "https://www.parlimen.gov.my/ahli-dewan.html?uweb=dr&"
        
        # Session for requests
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        })
        
        print(f"Initialized ComprehensiveMPScraper:")
        print(f"  Database: {database_name}")
        print(f"  MP Collection: {mp_collection_name}")
        print(f"  Honorific Collection: {honorific_collection_name}")
        print(f"  Main listing URL: {self.main_listing_url}")
        
        # Test connection
        try:
            self.client.admin.command('ping')
            print("  MongoDB connection: SUCCESS")
        except Exception as e:
            print(f"  MongoDB connection: FAILED - {str(e)}")
        
        # Initialize honorific storage
        self.all_honorifics = set()
        self.honorific_dict = {
            'royal_noble_titles': set(),
            'datuk_titles': set(),
            'parliamentary_titles': set(),
            'professional_titles': set(),
            'religious_titles': set(),
            'military_titles': set(),
            'gender_titles': set(),
            'regional_titles': set()
        }
        
        # Party mapping
        self.party_full_names = {
            'PH': 'Pakatan Harapan',
            'BN': 'Barisan Nasional', 
            'GPS': 'Gabungan Parti Sarawak',
            'GRS': 'Gabungan Rakyat Sabah',
            'PN': 'Perikatan Nasional',
            'WARISAN': 'Parti Warisan',
            'KDM': 'Parti Kesejahteraan Demokratik Masyarakat',
            'PBM': 'Parti Bangsa Malaysia',
            'MUDA': 'Malaysian United Democratic Alliance',
            'BEBAS': 'Independent'
        }
    
    def scrape_main_listing(self):
        """Scrape the main MP listing page to get all profile URLs"""
        print("Scraping main MP listing page...")
        
        try:
            response = self.session.get(self.main_listing_url)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Find all profile links
            profile_links = []
            
            # Look for links with pattern profile-ahli.html?uweb=dr&id=
            links = soup.find_all('a', href=re.compile(r'profile-ahli\.html\?uweb=dr&id=\d+'))
            
            for link in links:
                href = link.get('href')
                if href:
                    # Convert to absolute URL
                    full_url = urljoin(self.base_url, href)
                    
                    # Extract ID
                    match = re.search(r'id=(\d+)', href)
                    if match:
                        mp_id = match.group(1)
                        profile_links.append({
                            'id': mp_id,
                            'url': full_url,
                            'href': href
                        })
            
            # Remove duplicates
            unique_links = []
            seen_ids = set()
            for link in profile_links:
                if link['id'] not in seen_ids:
                    unique_links.append(link)
                    seen_ids.add(link['id'])
            
            print(f"Found {len(unique_links)} unique MP profile URLs")
            return unique_links
            
        except Exception as e:
            print(f"Error scraping main listing: {str(e)}")
            return []
    
    def scrape_mp_profile(self, profile_url, mp_id):
        """Scrape individual MP profile page"""
        try:
            time.sleep(1)  
            
            response = self.session.get(profile_url)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Initialize MP data
            mp_data = {
                # Schema fields
                'name': 'unknown',
                'full_name_with_titles': 'unknown',
                'honorifics': [],
                'party': 'unknown',
                'party_full_name': 'unknown',
                'constituency': 'unknown',  # Combined: "P063 Tambun"
                'constituency_code': 'unknown',  # P063
                'constituency_name': 'unknown',  # Tambun  
                'positionInParliament': 'Member of Parliament',
                'parliament_term': '15th',
                'status': 'current',
                'service': 'active',
                'created_at': datetime.now(),
                'performance': {
                    'attendanceRate': None,
                    'responseRate': None,
                    'escalateRate': None,
                    'topicDiscussed': [],
                    'sentimentAnalysis': {
                        'content': None,
                        'score': None,
                        'date': None
                    }
                },
                'mentionedInHansard': [],
                'profilePicture': None,
                'mp_id': mp_id,
                'profile_url': profile_url,
                'state': 'unknown',
                'positionInCabinet': None,
                'seatNumber': 'unknown',
                'phone': 'unknown',
                'fax': 'unknown', 
                'email': 'unknown',
                'address': 'unknown'
            }
            
            # Extract profile data from the structured format 
            # Look for the table/info section with key-value pairs
            
            # Method 1: Look for table rows with Malay labels
            tables = soup.find_all('table')
            for table in tables:
                rows = table.find_all('tr')
                for row in rows:
                    cells = row.find_all(['td', 'th'])
                    if len(cells) >= 2:
                        key = cells[0].get_text(strip=True)
                        value = cells[1].get_text(strip=True)
                        
                        self._extract_field_from_key_value(key, value, mp_data)
            
            # Method 2: Look for div/span structure with classes
            info_sections = soup.find_all(['div', 'section'], class_=re.compile(r'info|profile|detail'))
            for section in info_sections:
                # Look for pattern: label followed by value
                labels = section.find_all(['label', 'span', 'div'], text=re.compile(r'Nama|Jawatan|Parti|Parlimen|Kawasan|Negeri|Telefon|Faks|Email|Alamat'))
                for label in labels:
                    key = label.get_text(strip=True)
                    # Find the next sibling or nearby element with the value
                    value_element = label.find_next_sibling() or label.parent.find_next_sibling()
                    if value_element:
                        value = value_element.get_text(strip=True)
                        self._extract_field_from_key_value(key, value, mp_data)
            
            # Method 3: Look for specific text patterns in the entire page
            page_text = soup.get_text()
            
            # Extract using regex patterns for the exact format 
            patterns = {
                'name': r'Nama\s*([^Jawatan]+?)(?=Jawatan|$)',
                'position_parliament': r'Jawatan dalam Parlimen\s*([^Jawatan]+?)(?=Jawatan dalam Kabinet|Parti|$)',
                'position_cabinet': r'Jawatan dalam Kabinet\s*([^Parti]+?)(?=Parti|$)',
                'party': r'Parti\s*([^Tempat]+?)(?=Tempat|$)',
                'seat': r'Tempat Duduk\s*([^Parlimen]+?)(?=Parlimen|$)',
                'parliament_code': r'Parlimen\s*([^Kawasan]+?)(?=Kawasan|$)',
                'constituency': r'Kawasan\s*([^Negeri]+?)(?=Negeri|$)',
                'state': r'Negeri\s*([^No\.\s*Telefon]+?)(?=No\.\s*Telefon|$)',
                'phone': r'No\.\s*Telefon\s*([^No\.\s*Faks]+?)(?=No\.\s*Faks|$)',
                'fax': r'No\.\s*Faks\s*([^Email]+?)(?=Email|$)',
                'email': r'Email\s*([^Alamat]+?)(?=Alamat|$)',
                'address': r'Alamat Surat-menyurat\s*(.+?)(?=\n|$)'
            }
            
            for field, pattern in patterns.items():
                match = re.search(pattern, page_text, re.DOTALL | re.IGNORECASE)
                if match:
                    value = match.group(1).strip()
                    
                    if field == 'name' and value:
                        mp_data['full_name_with_titles'] = value
                    elif field == 'position_parliament' and value:
                        mp_data['positionInParliament'] = value
                    elif field == 'position_cabinet' and value:
                        mp_data['positionInCabinet'] = value
                    elif field == 'party' and value:
                        mp_data['party'] = value
                        mp_data['party_full_name'] = self.party_full_names.get(value, value)
                    elif field == 'seat' and value:
                        mp_data['seatNumber'] = value
                    elif field == 'parliament_code' and value:
                        mp_data['constituency_code'] = value
                    elif field == 'constituency' and value:
                        mp_data['constituency_name'] = value
                    elif field == 'state' and value:
                        mp_data['state'] = value
                    elif field == 'phone' and value:
                        mp_data['phone'] = value
                    elif field == 'fax' and value:
                        mp_data['fax'] = value
                    elif field == 'email' and value:
                        mp_data['email'] = value
                    elif field == 'address' and value:
                        mp_data['address'] = value
            
            # Combine constituency code and name for the constituency field
            if mp_data['constituency_code'] != 'unknown' and mp_data['constituency_name'] != 'unknown':
                mp_data['constituency'] = f"{mp_data['constituency_code']} {mp_data['constituency_name']}"
            elif mp_data['constituency_code'] != 'unknown':
                mp_data['constituency'] = mp_data['constituency_code']
            elif mp_data['constituency_name'] != 'unknown':
                mp_data['constituency'] = mp_data['constituency_name']
            
            # Extract profile picture URL if available
            img_elements = soup.find_all('img', src=True)
            for img in img_elements:
                src = img.get('src')
                if src and ('profile' in src.lower() or 'mp' in src.lower() or 'ahli' in src.lower()):
                    mp_data['profilePicture'] = urljoin(self.base_url, src)
                    break
            
            # Process honorifics and clean name
            if mp_data['full_name_with_titles'] != 'unknown':
                honorifics = self.extract_honorifics_from_name(mp_data['full_name_with_titles'])
                mp_data['honorifics'] = honorifics
                mp_data['name'] = self.clean_name_from_honorifics(mp_data['full_name_with_titles'])
            
            print(f"Scraped MP {mp_id}: {mp_data['name']} ({mp_data['party']}) - {mp_data['constituency']}")
            return mp_data
            
        except Exception as e:
            print(f"Error scraping MP profile {mp_id}: {str(e)}")
            return None
    
    def _extract_field_from_key_value(self, key, value, mp_data):
        """Helper method to extract field from key-value pairs"""
        key_lower = key.lower()
        
        if 'nama' in key_lower:
            mp_data['full_name_with_titles'] = value
        elif 'jawatan dalam parlimen' in key_lower:
            mp_data['positionInParliament'] = value
        elif 'jawatan dalam kabinet' in key_lower:
            mp_data['positionInCabinet'] = value
        elif 'parti' in key_lower:
            mp_data['party'] = value
            mp_data['party_full_name'] = self.party_full_names.get(value, value)
        elif 'tempat duduk' in key_lower:
            mp_data['seatNumber'] = value
        elif 'parlimen' in key_lower and 'jawatan' not in key_lower:
            mp_data['constituency_code'] = value
        elif 'kawasan' in key_lower:
            mp_data['constituency_name'] = value
        elif 'negeri' in key_lower:
            mp_data['state'] = value
        elif 'telefon' in key_lower:
            mp_data['phone'] = value
        elif 'faks' in key_lower:
            mp_data['fax'] = value
        elif 'email' in key_lower:
            mp_data['email'] = value
        elif 'alamat' in key_lower:
            mp_data['address'] = value
    
    def extract_honorifics_from_name(self, full_name):
        """Extract honorifics from a name and add to global collection"""
        honorifics = []
        words = full_name.replace('’', "'").split()  # Normalize apostrophes

        for i in range(len(words)):
            word_raw = words[i]
            word_clean = word_raw.strip("(),.'")  # Centralized cleanup
            
            # Normalize apostrophes again after strip
            word_clean = word_clean.replace('’', "'")

            # Detect individual honorifics
            is_honorific = any([
                word_clean.isupper() and len(word_clean) <= 4,  # e.g., YB, YAB
                word_clean.startswith('Dato'),
                word_clean.startswith('Datuk'),
                word_clean in ['Seri', 'Sri', 'Tun', 'Tengku', 'Tunku', 'Tuanku'],
                word_clean in ['Dr','Dr.' ],
                word_clean in['Prof','Prof.'],
                word_clean in ['Ir', 'Ir.'],  
                word_clean in ['Ts', 'Ts.'],  
                word_clean in ['Haji', 'Hajah', 'Sheikh', 'Syeikh','Hj.','Hajjah'],
                word_clean in ['Kapten', 'Komander', 'General', 'Admiral'],
                word_clean in ['Tuan', 'Puan', 'Encik', 'Cik'],
                word_clean in ['Panglima', 'Wira', 'Indera', 'Paduka', 'Utama']
            ])

            if is_honorific:
                honorifics.append(word_clean)
                self.all_honorifics.add(word_clean)

            # Detect combined titles
            if i < len(words) - 1:
                next_word = words[i + 1].strip("(),.'").replace('’', "'")
                combined = f"{word_clean} {next_word}"

                if any([
                    combined.startswith("Dato' Seri"),
                    combined.startswith("Datuk Seri"),
                    combined.startswith("Dato' Sri"),
                    combined.startswith("Tan Sri"),
                    combined.startswith("Tan' Seri")
                ]):
                    honorifics.append(combined)
                    self.all_honorifics.add(combined)

        return honorifics

    
    def clean_name_from_honorifics(self, full_name_with_titles):
        """Remove honorifics from full name to get clean name"""
        name = full_name_with_titles.replace('’', "'")  # Normalize apostrophes early

        # Remove detected honorifics (longest first to avoid partial match issues)
        for honorific in sorted(self.all_honorifics, key=lambda x: -len(x)):
            name = re.sub(rf'\b{re.escape(honorific)}\b\.?', '', name, flags=re.IGNORECASE)

        # Final cleanup
        name = re.sub(r'[()\']', '', name)       # Remove brackets and apostrophes
        name = re.sub(r'\s+', ' ', name)         # Normalize multiple spaces
        name = re.sub(r'^\s*[-]*\s*', '', name)  # Remove leading hyphen or whitespace
        name = re.sub(r'\s*[-]*\s*$', '', name)  # Remove trailing hyphen or whitespace
        return name.strip()

    
    def categorize_honorifics(self):
        """Categorize all collected honorifics"""
        for title in self.all_honorifics:
            title_lower = title.lower().replace("’", "'")  # Normalize apostrophes

            # Royal/Noble titles
            if any(x in title_lower for x in ['yab','yang amat berhormat', 'tan sri','tan seri', 'tun', 'tengku', 'tunku', 'tuanku']):
                self.honorific_dict['royal_noble_titles'].add(title)

            # Datuk titles
            elif any(x in title_lower for x in [ 
                "dato", "dato'", "datuk",
                "dato seri", "dato' seri",
                "dato sri", "dato' sri",
                "datuk seri", "datuk sri"]):
                self.honorific_dict['datuk_titles'].add(title)

            # Parliamentary titles
            elif title_lower in ['yb', 'yang berhormat']:
                self.honorific_dict['parliamentary_titles'].add(title)

            # Professional titles 
            elif title_lower in ['ir', 'ir.', 'ts', 'ts.','dr','dr.','prof','prof.']:
                self.honorific_dict['professional_titles'].add(title)

            # Religious titles
            elif any(x in title_lower for x in ['haji', 'hajah', 'sheikh', 'syeikh', 'ustaz', 'ustazah','hajjah','hj.']):
                self.honorific_dict['religious_titles'].add(title)

            # Military titles
            elif any(x in title_lower for x in ['kapten', 'komander', 'general', 'admiral', 'colonel', 'major', 'brigadier']):
                self.honorific_dict['military_titles'].add(title)

            # Gender titles
            elif title_lower in ['tuan', 'puan', 'encik', 'cik']:
                self.honorific_dict['gender_titles'].add(title)

            # Regional or chivalric titles
            elif any(x in title_lower for x in ['panglima', 'wira', 'indera', 'paduka', 'utama']):
                self.honorific_dict['regional_titles'].add(title)

    
    def save_mp_records(self, mp_records):
        """Save MP records to MongoDB"""
        print(f"Saving {len(mp_records)} MP records to database...")
        
        try:
            # Clear existing records for 15th parliament
            self.mp_collection.delete_many({'parliament_term': '15th'})
            
            # Filter out None records
            valid_records = [record for record in mp_records if record is not None]
            
            if valid_records:
                result = self.mp_collection.insert_many(valid_records)
                print(f"Successfully saved {len(result.inserted_ids)} MP records")
                
                # Create indexes
                self.mp_collection.create_index('name')
                self.mp_collection.create_index('party')
                self.mp_collection.create_index('constituency_code')
                self.mp_collection.create_index('parliament_term')
                self.mp_collection.create_index('service')
                self.mp_collection.create_index('mp_id')
                self.mp_collection.create_index([('service', 1), ('parliament_term', 1)])
                
                print("Database indexes created")
            else:
                print("No valid MP records to save")
                
        except Exception as e:
            print(f"Error saving MP records: {str(e)}")
    
    def save_honorific_dictionary(self):
        """Save honorific dictionary to file and database"""
        # Categorize honorifics first
        self.categorize_honorifics()
        
        # Convert sets to lists for JSON serialization
        honorific_dict_serializable = {}
        for category, titles in self.honorific_dict.items():
            honorific_dict_serializable[category] = sorted(list(titles))
        
        # Save to JSON file
        with open('honorific_dictionary_scraped.json', 'w', encoding='utf-8') as f:
            json.dump(honorific_dict_serializable, f, indent=2, ensure_ascii=False)
        
        # Save to database
        self.honorific_collection.delete_many({})
        
        honorific_record = {
            'version': '2.0',
            'source': 'Parliament Website Scraping',
            'created_at': datetime.now(),
            'total_honorifics': len(self.all_honorifics),
            'categories': honorific_dict_serializable
        }
        
        self.honorific_collection.insert_one(honorific_record)
        
        print("Honorific dictionary saved to file and database")
        return honorific_dict_serializable
    
    def generate_analysis_report(self, mp_records):
        """Generate analysis report"""
        valid_records = [record for record in mp_records if record is not None]
        
        print(f"\n=== SCRAPING ANALYSIS REPORT ===")
        print(f"Total MP records scraped: {len(valid_records)}")
        print(f"Failed scrapes: {len(mp_records) - len(valid_records)}")
        
        # Party distribution
        party_count = Counter(mp['party'] for mp in valid_records)
        print(f"\nParty distribution:")
        for party, count in party_count.most_common():
            full_name = self.party_full_names.get(party, party)
            print(f"  {party} ({full_name}): {count} MPs")
        
        # Position distribution
        position_count = Counter(mp['positionInParliament'] for mp in valid_records)
        print(f"\nParliament position distribution:")
        for position, count in position_count.most_common():
            print(f"  {position}: {count} MPs")
        
        # Cabinet position distribution
        cabinet_positions = [mp['positionInCabinet'] for mp in valid_records if mp.get('positionInCabinet')]
        if cabinet_positions:
            cabinet_count = Counter(cabinet_positions)
            print(f"\nCabinet position distribution:")
            for position, count in cabinet_count.most_common():
                print(f"  {position}: {count} MPs")
        
        # State distribution
        state_count = Counter(mp['state'] for mp in valid_records if mp['state'] != 'unknown')
        print(f"\nState distribution:")
        for state, count in state_count.most_common():
            print(f"  {state}: {count} MPs")
        
        # Honorifics analysis
        print(f"\nTotal unique honorifics found: {len(self.all_honorifics)}")
        for category, titles in self.honorific_dict.items():
            if titles:
                print(f"  {category.replace('_', ' ').title()}: {len(titles)} titles")
        
        # Data completeness analysis
        fields_to_check = {
            'name': lambda mp: mp['name'] != 'unknown',
            'party': lambda mp: mp['party'] != 'unknown',
            'constituency': lambda mp: mp['constituency'] != 'unknown',
            'state': lambda mp: mp['state'] != 'unknown',
            'phone': lambda mp: mp['phone'] != 'unknown',
            'email': lambda mp: mp['email'] != 'unknown',
            'address': lambda mp: mp['address'] != 'unknown',
            'seatNumber': lambda mp: mp.get('seatNumber', 'unknown') != 'unknown',
            'profilePicture': lambda mp: mp.get('profilePicture') is not None
        }
        
        print(f"\nData completeness:")
        for field, check_func in fields_to_check.items():
            complete_count = sum(1 for mp in valid_records if check_func(mp))
            percentage = complete_count / len(valid_records) * 100
            print(f"  {field}: {complete_count}/{len(valid_records)} ({percentage:.1f}%)")
        
        # Overall completeness 
        core_complete = sum(1 for mp in valid_records if 
                          mp['name'] != 'unknown' and 
                          mp['party'] != 'unknown' and 
                          mp['constituency'] != 'unknown')
        
        print(f"\nCore data completeness: {core_complete}/{len(valid_records)} ({core_complete/len(valid_records)*100:.1f}%)")
    
    def scrape_all_mps(self):
        """Main scraping function"""
        print("=== COMPREHENSIVE MP SCRAPER ===")
        
        # Step 1: Get all profile URLs
        profile_links = self.scrape_main_listing()
        if not profile_links:
            print("Failed to get MP profile URLs")
            return
        
        print(f"Found {len(profile_links)} MP profiles to scrape")
        
        # Step 2: Scrape each MP profile
        mp_records = []
        failed_count = 0
        
        for i, link in enumerate(profile_links, 1):
            print(f"Scraping {i}/{len(profile_links)}: ID {link['id']}")
            
            mp_data = self.scrape_mp_profile(link['url'], link['id'])
            if mp_data:
                mp_records.append(mp_data)
            else:
                failed_count += 1
            
            # Progress update every 20 MPs
            if i % 20 == 0:
                print(f"Progress: {i}/{len(profile_links)} completed, {failed_count} failed")
        
        print(f"Scraping completed: {len(mp_records)} successful, {failed_count} failed")
        
        # Step 3: Save data
        self.save_honorific_dictionary()
        self.save_mp_records(mp_records)
        
        # Step 4: Generate report
        self.generate_analysis_report(mp_records)
        
        print("=== SCRAPING COMPLETE ===")
        
        return {
            'mp_records': mp_records,
            'total_scraped': len(mp_records),
            'failed_scrapes': failed_count,
            'total_honorifics': len(self.all_honorifics)
        }

# CELL 4: Configuration and Execution
# MongoDB Atlas Configuration
# Load MongoDB Atlas URI from 3_app_system/backend/.env

env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), '3_app_system', 'backend', '.env')
load_dotenv(env_path)

MONGODB_ATLAS_URI = os.getenv("MONGODB_ATLAS_URI")
if not MONGODB_ATLAS_URI:
    raise ValueError("MONGODB_ATLAS_URI not found in .env file at 3_app_system/backend/.env")

# Database Configuration
DATABASE_NAME = "MyParliament"
MP_COLLECTION_NAME = "MP"
HONORIFIC_COLLECTION_NAME = "honorific_dictionary"

# CELL 5: Execute Comprehensive Scraping
scraper = ComprehensiveMPScraper(
    db_connection_string=MONGODB_ATLAS_URI,
    database_name=DATABASE_NAME,
    mp_collection_name=MP_COLLECTION_NAME,
    honorific_collection_name=HONORIFIC_COLLECTION_NAME
)

# Start comprehensive scraping
results = scraper.scrape_all_mps()

print(f"\nFINAL SUMMARY:")
print(f"- Database: {DATABASE_NAME}")
print(f"- MP Collection: {MP_COLLECTION_NAME}")
print(f"- Total MPs scraped: {results['total_scraped']}")
print(f"- Failed scrapes: {results['failed_scrapes']}")
print(f"- Total honorifics discovered: {results['total_honorifics']}")
print(f"- Honorific dictionary saved to 'honorific_dictionary_scraped.json'")

print("\nScraping complete. All MP data saved to MongoDB Atlas.")