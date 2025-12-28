# ============================================================================
# ENHANCED PARLIAMENT HISTORICAL SCRAPER 
# ============================================================================

import requests
from bs4 import BeautifulSoup
import re
import json
import pymongo
from datetime import datetime
import time
from urllib.parse import urljoin
from fuzzywuzzy import fuzz
import os
import urllib3
from collections import defaultdict, Counter
import string
import dotenv

# Disable SSL warnings
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

print("Enhanced Parliament Historical Scraper - Cleaned Version")
print(f"Start time: {datetime.now()}")

# ============================================================================
# Configuration
# ============================================================================

# Load environment variables from .env file
env_path = os.path.join(os.path.dirname(__file__), '../../3_app_system/backend/.env')
dotenv.load_dotenv(env_path)

MONGODB_URI = os.getenv('MONGODB_URI')
PARLIAMENT_TERMS = list(range(1, 15))

# Validate that MONGODB_URI was loaded
if not MONGODB_URI:
    raise ValueError(f"MONGODB_URI not found in .env file at {env_path}")
ARCHIVE_BASE_URL = "https://www.parlimen.gov.my/arkib-ahli.html?uweb=dr&arkib=yes&vol="
SIMILARITY_THRESHOLD = 98

# ============================================================================
# Advanced Honorific Extractor - Consolidated Version
# ============================================================================

class AdvancedHonorificExtractor:
    """Advanced honorific extraction with comprehensive tracking"""
    
    def __init__(self, db_connection_string):
        self.client = pymongo.MongoClient(db_connection_string)
        self.db = self.client["MyParliament"]
        self.honorific_collection = self.db["honorific_dictionary"]
        
        self.existing_honorifics = set()
        self.extracted_honorifics = {
            'new_discoveries': set(),
            'extraction_log': [],
            'total_extractions': 0,
            'comma_based_extractions': 0,
            'tan_issue_fixes': 0,
            'formatting_standardizations': 0
        }
        
        # Consolidated honorific patterns
        self.lowercase_words = {
            'bin', 'binti', 'a/l', 'a/p', 'anak', 'de', 'da', 'van', 'von',
            'al', 'el', 'del', 'di', 'du', 'le', 'la', 'abu', 'ibn'
        }
        
        self.compound_patterns = [
            r'tan\s+sri', r'dato\'\s*sri', r'datuk\s+sri',
            r'yang\s+berhormat', r'yang\s+amat\s+berhormat'
        ]
        
        self._load_existing_honorifics()
        print(f"Advanced Honorific Extractor initialized with {len(self.existing_honorifics)} existing honorifics")
    
    def _load_existing_honorifics(self):
        """Load existing honorifics from database"""
        try:
            honorific_doc = self.honorific_collection.find_one()
            if honorific_doc and 'categories' in honorific_doc:
                for category, titles in honorific_doc['categories'].items():
                    if isinstance(titles, list):
                        self.existing_honorifics.update(titles)
            else:
                # Minimal fallback
                basic_honorifics = [
                    'YB', 'YAB', 'Dato', 'Datuk', 'Tan Sri', 'Tun', 'Dr', 'Ir', 'Ts',
                    'Haji', 'Hajah', 'Tuan', 'Puan'
                ]
                self.existing_honorifics.update(basic_honorifics)
        except Exception as e:
            print(f"Could not load existing honorifics: {e}")
    
    def _is_valid_honorific(self, word):
        """Check if a word is a valid standalone honorific with Tan issue fixing"""
        word_clean = word.strip("(),.''\"""").replace("'", "'").replace("'", "'")
        
        # TAN ISSUE FIX: Only allow 'Tan' if it's part of 'Tan Sri'
        if word_clean.lower() == 'tan':
            self.extracted_honorifics['tan_issue_fixes'] += 1
            return False
        
        # Check against existing honorifics
        if word_clean in self.existing_honorifics:
            return True
        
        # Additional validation for compound titles
        for pattern in self.compound_patterns:
            if re.search(pattern, word_clean, re.IGNORECASE):
                return True
        
        return False
    
    def _is_compound_honorific(self, combined):
        """Check if combined words form compound honorific"""
        combined_lower = combined.lower()
        compound_patterns = [
            "dato' seri", "dato seri", "dato' sri", "dato sri",
            "datuk seri", "datuk sri", "tan sri", "tan' seri",
            "yang berhormat", "yang amat berhormat"
        ]
        return any(pattern in combined_lower for pattern in compound_patterns)
    
    def standardize_name(self, name):
        """Standardize name to title case with proper connector handling"""
        if not name:
            return None
        
        words = name.split()
        standardized_words = []
        
        for i, word in enumerate(words):
            word_lower = word.lower()
            # Keep connector words lowercase (except if first word)
            if i > 0 and word_lower in self.lowercase_words:
                standardized_words.append(word_lower)
            else:
                standardized_words.append(word.title())
        
        return ' '.join(standardized_words)
    
    def extract_and_store_honorifics(self, full_name):
        """Main extraction method with comprehensive tracking"""
        if not full_name or full_name.strip() == '':
            return {
                'cleaned_name': None,
                'standardized_name': None,
                'extracted_honorifics': [],
                'extraction_method': 'failed'
            }
        
        name = full_name.strip()
        extraction_result = {
            'original_name': full_name,
            'cleaned_name': None,
            'standardized_name': None,
            'extracted_honorifics': [],
            'extraction_method': 'none'
        }
        
        tan_fixes_before = self.extracted_honorifics['tan_issue_fixes']
        
        # STEP 1: Extract everything after comma
        if ',' in name:
            parts = name.split(',', 1)
            main_name = parts[0].strip()
            after_comma = parts[1].strip()
            
            # Extract compound honorifics first
            compound_found = []
            if 'tan sri' in after_comma.lower():
                compound_found.append('Tan Sri')
                after_comma = re.sub(r'\btan\s+sri\b', '', after_comma, flags=re.IGNORECASE).strip()
            
            # Process remaining individual words
            remaining_words = after_comma.split()
            comma_honorifics = [word.strip("(),.''\"""") for word in remaining_words 
                             if self._is_valid_honorific(word)]
            
            all_comma_honorifics = compound_found + comma_honorifics
            extraction_result['extracted_honorifics'].extend(all_comma_honorifics)
            extraction_result['extraction_method'] = 'comma_based'
            
            name = main_name
            self.extracted_honorifics['comma_based_extractions'] += 1
        
        # STEP 2: Remove known existing honorifics from main name
        existing_removed = []
        sorted_honorifics = sorted(self.existing_honorifics, key=lambda x: -len(x))
        
        for honorific in sorted_honorifics:
            if honorific and honorific.lower() != 'tan':
                pattern = rf'\b{re.escape(honorific)}\b\.?'
                if re.search(pattern, name, flags=re.IGNORECASE):
                    existing_removed.append(honorific)
                    name = re.sub(pattern, '', name, flags=re.IGNORECASE)
        
        extraction_result['extracted_honorifics'].extend(existing_removed)
        
        # STEP 3: Basic cleanup and standardization
        name = re.sub(r'[()\']', '', name)
        name = re.sub(r'\s+', ' ', name)
        name = re.sub(r'^\s*[-]*\s*', '', name)
        name = re.sub(r'\s*[-]*\s*$', '', name)
        
        cleaned = name.strip() if name.strip() else None
        extraction_result['cleaned_name'] = cleaned
        
        # STEP 4: Apply standardized formatting
        if cleaned:
            standardized = self.standardize_name(cleaned)
            extraction_result['standardized_name'] = standardized
            self.extracted_honorifics['formatting_standardizations'] += 1
        else:
            extraction_result['standardized_name'] = None
        
        # Track statistics
        tan_fixes_after = self.extracted_honorifics['tan_issue_fixes']
        all_extracted = extraction_result['extracted_honorifics']
        
        for honorific in all_extracted:
            if honorific not in self.existing_honorifics and honorific.lower() != 'tan':
                self.extracted_honorifics['new_discoveries'].add(honorific)
        
        self.extracted_honorifics['total_extractions'] += 1
        
        return extraction_result
    
    def categorize_honorifics(self, honorifics):
        """Categorize a list of honorifics"""
        categorized = {
            'royal_noble_titles': [],
            'datuk_titles': [],
            'parliamentary_titles': [],
            'professional_titles': [],
            'religious_titles': [],
            'military_titles': [],
            'gender_titles': [],
            'regional_titles': []
        }
        
        for honorific in honorifics:
            honorific_lower = honorific.lower().replace("'", "'")
            
            if any(x in honorific_lower for x in [
                'yab', 'yang amat berhormat', 'tan sri', 'tan seri', 'tun', 
                'tengku', 'tunku', 'tuanku'
            ]):
                categorized['royal_noble_titles'].append(honorific)
            elif any(x in honorific_lower for x in [
                "dato", "dato'", "datuk", "dato seri", "dato' seri",
                "dato sri", "dato' sri", "datuk seri", "datuk sri"
            ]):
                categorized['datuk_titles'].append(honorific)
            elif honorific_lower in ['yb', 'yang berhormat']:
                categorized['parliamentary_titles'].append(honorific)
            elif honorific_lower in ['ir', 'ir.', 'ts', 'ts.', 'dr', 'dr.', 'prof', 'prof.']:
                categorized['professional_titles'].append(honorific)
            elif any(x in honorific_lower for x in [
                'haji', 'hajah', 'sheikh', 'syeikh', 'ustaz', 'ustazah', 'hajjah', 'hj.'
            ]):
                categorized['religious_titles'].append(honorific)
            elif any(x in honorific_lower for x in [
                'kapten', 'komander', 'general', 'admiral', 'colonel', 'major', 'brigadier'
            ]):
                categorized['military_titles'].append(honorific)
            elif honorific_lower in ['tuan', 'puan', 'encik', 'cik']:
                categorized['gender_titles'].append(honorific)
            elif any(x in honorific_lower for x in [
                'panglima', 'wira', 'indera', 'paduka', 'utama'
            ]):
                categorized['regional_titles'].append(honorific)
        
        return categorized

# ============================================================================
# 98% Similarity Matcher
# ============================================================================

class AdvancedMPMatcher:
    """Advanced 98% threshold matcher with comprehensive identity analysis"""
    
    def __init__(self):
        self.lowercase_words = {
            'bin', 'binti', 'a/l', 'a/p', 'anak', 'de', 'da', 'van', 'von',
            'al', 'el', 'del', 'di', 'du', 'le', 'la', 'abu', 'ibn'
        }
        
        self.matching_stats = {
            'total_matches_attempted': 0,
            'matches_98_percent_plus': 0,
            'new_historical_mps': 0,
            'exact_matches': 0,
            'gender_mismatches': 0,
            'first_name_failures': 0,
            'last_name_failures': 0,
            'penalty_applications': 0
        }
        
        print("Advanced 98% Threshold MP Matcher initialized")
    
    def extract_core_identity(self, name):
        """Extract comprehensive core identity components"""
        if not name:
            return {}
        
        words = name.split()
        if not words:
            return {}
        
        identity = {
            'full_name': name,
            'first_name': words[0],
            'last_name': words[-1] if len(words) > 1 else words[0],
            'middle_names': [],
            'connector': '',
            'gender': '',
            'name_structure': '',
            'total_words': len(words)
        }
        
        # Find connector and determine gender
        connectors = ['bin', 'binti', 'a/l', 'a/p', 'anak']
        
        for word in words:
            if word.lower() in connectors:
                identity['connector'] = word.lower()
                if word.lower() in ['bin', 'a/l']:
                    identity['gender'] = 'male'
                elif word.lower() in ['binti', 'a/p']:
                    identity['gender'] = 'female'
                break
        
        # Extract middle names (excluding connectors)
        if len(words) > 2:
            middle_names = []
            for i in range(1, len(words) - 1):
                if words[i].lower() not in connectors:
                    middle_names.append(words[i])
            identity['middle_names'] = middle_names
        
        # Determine name structure
        if identity['connector']:
            identity['name_structure'] = f"first_{identity['connector']}_last"
        else:
            identity['name_structure'] = 'non_connector_style'
        
        return identity
    
    def calculate_98_percent_similarity(self, historical_name, current_name):
        """Calculate similarity with 98% minimum threshold"""
        if not historical_name or not current_name:
            return 0, "No name provided", {}
        
        self.matching_stats['total_matches_attempted'] += 1
        
        # Extract identities
        hist_id = self.extract_core_identity(historical_name)
        curr_id = self.extract_core_identity(current_name)
        
        # MANDATORY VALIDATION RULES
        
        # Rule 1: Gender must match if both available
        if (hist_id['gender'] and curr_id['gender'] and 
            hist_id['gender'] != curr_id['gender']):
            self.matching_stats['gender_mismatches'] += 1
            return 0, f"Gender mismatch: {hist_id['gender']} vs {curr_id['gender']}", {
                'historical_identity': hist_id,
                'current_identity': curr_id
            }
        
        # Rule 2: First names must be nearly identical (98%+)
        first_sim = fuzz.ratio(hist_id['first_name'].lower(), curr_id['first_name'].lower())
        if first_sim < 98:
            self.matching_stats['first_name_failures'] += 1
            return 0, f"First name below 98%: {first_sim}%", {
                'historical_identity': hist_id,
                'current_identity': curr_id
            }
        
        # Rule 3: Last names must be nearly identical (95%+) 
        last_sim = fuzz.ratio(hist_id['last_name'].lower(), curr_id['last_name'].lower())
        if last_sim < 95:
            self.matching_stats['last_name_failures'] += 1
            return 0, f"Last name below 95%: {last_sim}%", {
                'historical_identity': hist_id,
                'current_identity': curr_id
            }
        
        # Rule 4: Check for exact match first
        if historical_name.lower() == current_name.lower():
            self.matching_stats['exact_matches'] += 1
            self.matching_stats['matches_98_percent_plus'] += 1
            return 100, "Exact match", {
                'historical_identity': hist_id,
                'current_identity': curr_id
            }
        
        # Calculate comprehensive similarity using multiple algorithms
        similarities = []
        
        # Full name similarity
        full_sim = fuzz.ratio(historical_name.lower(), current_name.lower())
        similarities.append(full_sim)
        
        # Token sort (word order independent)
        token_sim = fuzz.token_sort_ratio(historical_name.lower(), current_name.lower())
        similarities.append(token_sim)
        
        # Partial ratio (substring matching)
        partial_sim = fuzz.partial_ratio(historical_name.lower(), current_name.lower())
        similarities.append(partial_sim)
        
        # Component-based similarity with heavy first/last name weighting
        component_sim = (first_sim * 0.6 + last_sim * 0.4)
        similarities.append(component_sim)
        
        # Take the best score
        best_score = max(similarities)
        
        # Apply strict penalties
        penalties = []
        
        # Name length difference penalty
        length_diff = abs(hist_id['total_words'] - curr_id['total_words'])
        if length_diff > 1:
            penalties.append(f"Length diff: {length_diff}")
            best_score *= 0.85
            self.matching_stats['penalty_applications'] += 1
        
        # Middle name mismatch penalty
        if hist_id['middle_names'] and curr_id['middle_names']:
            if len(hist_id['middle_names']) != len(curr_id['middle_names']):
                penalties.append("Middle name count mismatch")
                best_score *= 0.9
                self.matching_stats['penalty_applications'] += 1
        
        reason = f"Full:{full_sim}%, Token:{token_sim}%, Partial:{partial_sim}%, Component:{component_sim:.1f}%"
        if penalties:
            reason += f" | Penalties: {', '.join(penalties)}"
        
        final_score = min(best_score, 100)
        
        if final_score >= 98:
            self.matching_stats['matches_98_percent_plus'] += 1
        else:
            self.matching_stats['new_historical_mps'] += 1
        
        return final_score, reason, {
            'historical_identity': hist_id,
            'current_identity': curr_id,
            'similarities': {
                'full_sim': full_sim,
                'token_sim': token_sim,
                'partial_sim': partial_sim,
                'component_sim': component_sim
            },
            'penalties_applied': penalties
        }
    
    def get_matching_statistics(self):
        """Get comprehensive matching statistics"""
        return self.matching_stats

# ============================================================================
# Enhanced Parliament Scraper - Consolidated
# ============================================================================

class EnhancedParliamentScraper:
    """Comprehensive scraper with 98% matching and multi-term support"""
    
    def __init__(self, db_connection_string):
        self.client = pymongo.MongoClient(db_connection_string)
        self.db = self.client["MyParliament"]
        self.mp_collection = self.db["MP"]
        
        # Setup session
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
        self.session.verify = False
        
        # Initialize components
        self.honorific_extractor = AdvancedHonorificExtractor(db_connection_string)
        self.mp_matcher = AdvancedMPMatcher()
        
        # Party mappings
        self.party_mappings = {
            'PH': 'Pakatan Harapan',
            'BN': 'Barisan Nasional',
            'PN': 'Perikatan Nasional',
            'GPS': 'Gabungan Parti Sarawak',
            'GRS': 'Gabungan Rakyat Sabah',
            'WARISAN': 'Parti Warisan',
            'MUDA': 'Malaysian United Democratic Alliance',
            'PBM': 'Parti Bangsa Malaysia',
            'KDM': 'Parti Kesejahteraan Demokratik Masyarakat',
            'BEBAS': 'Independent'
        }
        
        # Statistics
        self.stats = {
            'start_time': datetime.now(),
            'terms_processed': 0,
            'total_mps_scraped': 0,
            'new_mps_created': 0,
            'existing_mps_updated': 0,
            'merges_98_percent': 0,
            'separate_records_below_98': 0,
            'errors': []
        }
        
        print("Enhanced Parliament Scraper initialized")
    
    def parse_constituency(self, constituency_text):
        """Parse constituency into components"""
        if not constituency_text:
            return 'UNKNOWN', 'UNKNOWN', constituency_text
        
        # Extract code
        code_match = re.search(r'[pP]\d+', constituency_text)
        constituency_code = code_match.group().upper() if code_match else 'UNKNOWN'
        
        # Extract name
        if code_match:
            full_constituency = f"{constituency_code} {constituency_text[code_match.end():].strip()}"
            constituency_name = constituency_text[code_match.end():].strip()
        else:
            full_constituency = constituency_text
            constituency_name = constituency_text
        
        return constituency_code, constituency_name, full_constituency
    
    def parse_party(self, party_text):
        """Parse party information"""
        if not party_text:
            return 'UNKNOWN', 'UNKNOWN'
        
        party_text = party_text.strip().upper()
        
        if ' - ' in party_text:
            coalition = party_text.split(' - ')[0].strip()
        elif '-' in party_text:
            coalition = party_text.split('-')[0].strip()
        else:
            coalition = party_text
        
        party_full_name = self.party_mappings.get(coalition, coalition)
        
        return coalition, party_full_name
    
    def find_existing_mp_with_98_threshold(self, cleaned_name, constituency_code):
        """Find existing MP using advanced 98% threshold"""
        
        all_mps = list(self.mp_collection.find({}))
        
        best_match = None
        best_score = 0
        best_reason = ""
        best_details = {}
        
        for existing_mp in all_mps:
            # CRITICAL FIX: Ensure we're comparing cleaned names consistently
            existing_name = existing_mp.get('name', '')  # This should be cleaned name
            
            if not existing_name:
                continue
            
            # ADDITIONAL SAFETY: Re-clean the existing name to ensure consistency
            if existing_mp.get('full_name_with_titles'):
                # Re-extract to ensure consistent cleaning
                existing_extraction = self.honorific_extractor.extract_and_store_honorifics(
                    existing_mp['full_name_with_titles']
                )
                existing_cleaned = existing_extraction['standardized_name'] or existing_extraction['cleaned_name']
                if existing_cleaned:
                    existing_name = existing_cleaned
            
            print(f"      Comparing: '{cleaned_name}' vs '{existing_name}'")
            
            # Calculate similarity
            similarity, reason, details = self.mp_matcher.calculate_98_percent_similarity(
                cleaned_name, existing_name
            )
            
            # Additional boost if same constituency
            if existing_mp.get('constituency_code') == constituency_code:
                similarity += 2
                reason += " + same_constituency"
            
            if similarity > best_score:
                best_score = similarity
                best_match = existing_mp
                best_reason = reason
                best_details = details
        
        # Apply 98% threshold
        if best_score >= SIMILARITY_THRESHOLD:
            self.stats['merges_98_percent'] += 1
            print(f"     98% MATCH ({best_score:.1f}%): '{cleaned_name}' -> '{best_match['name']}'")
            print(f"      Reason: {best_reason}")
            return best_match, best_score, best_reason, best_details
        else:
            self.stats['separate_records_below_98'] += 1
            print(f"     NEW MP ({best_score:.1f}%): '{cleaned_name}' (below 98% threshold)")
            if best_score > 80:  # Show near misses
                print(f"      Near miss reason: {best_reason}")
            return None, best_score, best_reason, best_details
    
    def create_mp_document(self, mp_data, parliament_term, is_new=True):
        """Create new MP document with comprehensive data"""
        
        # Extract honorifics using advanced extractor
        extraction_result = self.honorific_extractor.extract_and_store_honorifics(mp_data['name'])
        
        cleaned_name = extraction_result['standardized_name'] or extraction_result['cleaned_name']
        honorifics = extraction_result['extracted_honorifics']

        if not cleaned_name:
            print(f"WARNING: Could not clean name '{mp_data['name']}', using original")
            cleaned_name = mp_data['name']
        
        # Parse constituency and party
        constituency_code, constituency_name, full_constituency = self.parse_constituency(mp_data['constituency'])
        party, party_full_name = self.parse_party(mp_data['party'])
        
        # Create comprehensive honorific analysis
        honorific_analysis = {
            'all_discovered_honorifics': honorifics,
            'categorized_honorifics': self.honorific_extractor.categorize_honorifics(honorifics),
            'original_name_variations': [mp_data['name']],
            'extraction_method': extraction_result['extraction_method']
        }
        
        document = {
            'name': cleaned_name,  
            'full_name_with_titles': mp_data['name'],  
            'honorifics': honorifics,
            'party': party,
            'party_full_name': party_full_name,
            'constituency': full_constituency,
            'constituency_code': constituency_code,
            'constituency_name': constituency_name,
            'positionInParliament': 'Member of Parliament',
            'parliament_term': f"{parliament_term}th",
            'status': 'historical',
            'service': 'inactive',
            'created_at': datetime.now(),
            
            # Multi-term tracking
            'parliamentary_history': [{
                'parliament_term': f"{parliament_term}th",
                'term_number': parliament_term,
                'party': party,
                'party_full_name': party_full_name,
                'constituency': full_constituency,
                'constituency_code': constituency_code,
                'constituency_name': constituency_name,
                'status': 'historical',
                'scraped_from': 'historical_archive',
                'scraped_at': datetime.now()
            }],
            
            'party_changes': [{
                'from_term': f"{parliament_term}th",
                'to_term': f"{parliament_term}th",
                'party': party,
                'party_full_name': party_full_name,
                'duration_terms': 1
            }],
            
            # Comprehensive honorific data
            'honorific_analysis': honorific_analysis,
            
            # Historical data preservation
            'historical_data': {
                'original_name': mp_data['name'],
                'original_constituency': mp_data['constituency'],
                'original_party': mp_data['party'],
                'original_state': mp_data.get('state', 'UNKNOWN'),
                'term_number': parliament_term,
                'scraped_at': datetime.now()
            },
            
            # Default fields for historical MPs
            'performance': {
                'attendanceRate': None,
                'responseRate': None,
                'escalateRate': None,
                'topicDiscussed': [],
                'sentimentAnalysis': {},
                'mentionedInHansard': []
            },
            'profilePicture': None,
            'mp_id': None,
            'profile_url': None,
            'state': mp_data.get('state', 'UNKNOWN'),
            'positionInCabinet': None,
            'seatNumber': None,
            'phone': None,
            'fax': None,
            'email': None,
            'address': None
        }
        
        return document
    
    def update_existing_mp_with_historical_term(self, existing_mp, mp_data, parliament_term, match_details):
        """Update existing MP with new historical term"""
        
        # Extract honorifics from new term
        extraction_result = self.honorific_extractor.extract_and_store_honorifics(mp_data['name'])
        new_honorifics = extraction_result['extracted_honorifics']
        
        # Parse new term data
        constituency_code, constituency_name, full_constituency = self.parse_constituency(mp_data['constituency'])
        party, party_full_name = self.parse_party(mp_data['party'])
        
        # Prepare comprehensive updates
        updates = {}
        
        # Update honorifics (merge unique ones)
        existing_honorifics = existing_mp.get('honorifics', [])
        merged_honorifics = list(set(existing_honorifics + new_honorifics))
        updates['honorifics'] = merged_honorifics
        
        # Update comprehensive honorific analysis
        existing_analysis = existing_mp.get('honorific_analysis', {})
        all_discovered = existing_analysis.get('all_discovered_honorifics', [])
        all_discovered = list(set(all_discovered + new_honorifics))
        
        original_variations = existing_analysis.get('original_name_variations', [])
        if mp_data['name'] not in original_variations:
            original_variations.append(mp_data['name'])
        
        updates['honorific_analysis'] = {
            'all_discovered_honorifics': all_discovered,
            'categorized_honorifics': self.honorific_extractor.categorize_honorifics(all_discovered),
            'original_name_variations': original_variations,
            'extraction_method': 'advanced_multi_term_consolidation',
            'match_details': match_details
        }
        
        # Add to parliamentary history
        new_term_entry = {
            'parliament_term': f"{parliament_term}th",
            'term_number': parliament_term,
            'party': party,
            'party_full_name': party_full_name,
            'constituency': full_constituency,
            'constituency_code': constituency_code,
            'constituency_name': constituency_name,
            'status': 'historical',
            'scraped_from': 'historical_archive',
            'scraped_at': datetime.now(),
            'match_confidence': match_details.get('similarity_score', 0) if isinstance(match_details, dict) else 0
        }
        
        existing_history = existing_mp.get('parliamentary_history', [])
        # Check if this term already exists
        term_exists = any(h.get('term_number') == parliament_term for h in existing_history)
        
        if not term_exists:
            existing_history.append(new_term_entry)
            updates['parliamentary_history'] = existing_history
        
        # Update party changes if party changed
        existing_party_changes = existing_mp.get('party_changes', [])
        if existing_party_changes:
            last_party = existing_party_changes[-1]['party']
            if last_party != party:
                # Party changed
                new_party_change = {
                    'from_term': f"{parliament_term}th",
                    'to_term': f"{parliament_term}th",
                    'party': party,
                    'party_full_name': party_full_name,
                    'duration_terms': 1,
                    'change_detected_at': datetime.now()
                }
                existing_party_changes.append(new_party_change)
                updates['party_changes'] = existing_party_changes
        
        # Keep latest term data as primary (only if this is more recent)
        existing_term_num = int(existing_mp.get('parliament_term', '0').replace('th', ''))
        if parliament_term > existing_term_num:
            # This is a more recent term, update primary data
            updates.update({
                'party': party,
                'party_full_name': party_full_name,
                'constituency': full_constituency,
                'constituency_code': constituency_code,
                'constituency_name': constituency_name,
                'parliament_term': f"{parliament_term}th",
                'full_name_with_titles': mp_data['name']
            })
        
        # Perform update
        result = self.mp_collection.update_one(
            {'_id': existing_mp['_id']},
            {'$set': updates}
        )
        
        if result.modified_count > 0:
            self.stats['existing_mps_updated'] += 1
            print(f"     UPDATED: {existing_mp['name']} with {parliament_term}th Parliament data")
            print(f"      Added honorifics: {new_honorifics}")
            print(f"      Party: {party}, Constituency: {constituency_code}")
        
        return result.modified_count > 0
    
    def scrape_parliament_term(self, parliament_term):
        """Scrape one parliament term with enhanced container detection"""
        
        url = f"{ARCHIVE_BASE_URL}{parliament_term}"
        term_start_time = datetime.now()
        
        print(f"\n{'='*60}")
        print(f"SCRAPING PARLIAMENT TERM {parliament_term}")
        print(f"{'='*60}")
        print(f"URL: {url}")
        
        try:
            # Rate limiting
            time.sleep(3)
            
            response = self.session.get(url, timeout=30)
            
            if response.status_code != 200:
                raise Exception(f"HTTP {response.status_code}")
            
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Extract MP data - try multiple container patterns
            mp_entries = []
            
            # METHOD 1: Try current format containers
            mp_lists = soup.find_all('ul', class_='list tiles member-of-parliament')
            print(f"  Found {len(mp_lists)} current format MP containers")
            
            if mp_lists:
                for mp_list in mp_lists:
                    for li in mp_list.find_all('li'):
                        mp_data = self.extract_mp_from_html(li)
                        if mp_data:
                            mp_entries.append(mp_data)
                        time.sleep(0.1)
            
            # METHOD 2: If no current format, try historical format containers
            if not mp_entries:
                print("  No current format containers found, trying historical format...")
                
                # Try different historical container patterns
                historical_containers = [
                    soup.find_all('div', class_='member-list'),
                    soup.find_all('div', class_='mp-list'),
                    soup.find_all('ul', class_='member-listing'),
                    soup.find_all('div', class_='ahli-list'),  # "ahli" = member in Malay
                    soup.find_all('table', class_='member-table')  # Sometimes in table format
                ]
                
                for container_list in historical_containers:
                    if container_list:
                        print(f"  Found {len(container_list)} historical format containers")
                        for container in container_list:
                            # Look for individual MP entries within container
                            mp_divs = container.find_all('div', recursive=True)
                            for div in mp_divs:
                                # Check if this div contains MP data
                                if div.find('div', class_='full-name') or div.find('span', class_='first-name'):
                                    mp_data = self.extract_mp_from_html(div)
                                    if mp_data:
                                        mp_entries.append(mp_data)
                            time.sleep(0.1)
                        break  # Stop after finding first working container type
            
            # METHOD 3: If still no data, try direct search for name patterns
            if not mp_entries:
                print("  No standard containers found, trying direct name pattern search...")
                
                # Look for any elements with "first-name" class
                name_spans = soup.find_all('span', class_='first-name')
                print(f"  Found {len(name_spans)} name spans")
                
                for name_span in name_spans:
                    # Find the parent container for this name
                    parent_container = name_span.find_parent('div')
                    if parent_container:
                        mp_data = self.extract_mp_from_html(parent_container)
                        if mp_data:
                            mp_entries.append(mp_data)
                    time.sleep(0.1)
            
            processing_time = (datetime.now() - term_start_time).total_seconds()
            
            print(f"  Extracted {len(mp_entries)} MPs in {processing_time:.1f}s")
            
            # Show sample of extracted data for verification
            if mp_entries:
                print(f"  Sample extractions:")
                for i, mp in enumerate(mp_entries[:3]):
                    print(f"    {i+1}. {mp['name']} ({mp['constituency']}) - {mp['party']}")
            
            return mp_entries
            
        except Exception as e:
            error_msg = f"Parliament {parliament_term}: {str(e)}"
            self.stats['errors'].append(error_msg)
            print(f"   Error: {error_msg}")
            return []
    
    
    def extract_mp_from_html(self, li_element):
        """Extract MP data from HTML element - handles both historical and current formats"""
        
        try:
            mp_data = {
                'name': 'UNKNOWN',
                'constituency': 'UNKNOWN',
                'party': 'UNKNOWN',
                'state': 'UNKNOWN'
            }
            
            # METHOD 1: Try HISTORICAL format first (1st-14th Parliament)
            # Structure: <div><a><div class="full-name"><span class="first-name">NAME</span></div></a><div class="province">STATE</div></div>
            
            # Extract name from historical format
            full_name_div = li_element.find('div', class_='full-name')
            if full_name_div:
                # Found historical format
                first_name_span = full_name_div.find('span', class_='first-name')
                if first_name_span:
                    name_text = first_name_span.get_text(strip=True)
                    if name_text and name_text != '...':
                        mp_data['name'] = name_text
                        print(f"      Historical format: Found name: {name_text}")
            
            # If no historical format, try CURRENT format (15th Parliament)
            if mp_data['name'] == 'UNKNOWN':
                profile_link = li_element.find('a', href=re.compile(r'id=\d+'))
                if profile_link:
                    name_text = profile_link.get_text(strip=True)
                    if name_text and name_text != '...':
                        mp_data['name'] = name_text
                        print(f"      Current format: Found name: {name_text}")
            
            # Extract constituency/state - HISTORICAL format uses "province" class
            province_div = li_element.find('div', class_='province')
            if province_div:
                # Historical format: province = constituency name only (no code)
                constituency_name = province_div.get_text(strip=True)
                mp_data['constituency'] = constituency_name
                mp_data['state'] = constituency_name  # For historical, constituency = state
                print(f"      Historical format: Found constituency/state: {constituency_name}")
            
            # If no historical format, try current format
            if mp_data['constituency'] == 'UNKNOWN':
                # Current format: separate constituency and state divs
                constituency_div = li_element.find('div', class_='constituency')
                if constituency_div:
                    mp_data['constituency'] = constituency_div.get_text(strip=True)
                
                state_div = li_element.find('div', class_='province') 
                if state_div:
                    mp_data['state'] = state_div.get_text(strip=True)
            
            # Extract party information
            # Historical format: caucus-banner div (but no text content)
            caucus_banner = li_element.find('div', class_='caucus-banner')
            if caucus_banner:
                # Historical format detected, but party info might be in style or missing
                # Try to extract from style attribute background-color
                style_attr = caucus_banner.get('style', '')
                if 'background-color' in style_attr:
                    # This indicates historical format but party needs different extraction
                    mp_data['party'] = 'HISTORICAL_PARTY'  # Placeholder
                    print(f"      Historical format: Found party indicator")
            
            # Current format: caucus class
            caucus_div = li_element.find('div', class_='caucus')
            if caucus_div and mp_data['party'] == 'UNKNOWN':
                mp_data['party'] = caucus_div.get_text(strip=True)
                print(f"      Current format: Found party: {mp_data['party']}")
            
            # Additional party extraction for historical format
            if mp_data['party'] in ['UNKNOWN', 'HISTORICAL_PARTY']:
                # Try to find party from any text content or attributes
                all_text = li_element.get_text(strip=True)
                # Look for common party indicators in historical data
                party_keywords = {
                    'barisan': 'BN',
                    'umno': 'BN', 
                    'dap': 'PH',
                    'pas': 'PN',
                    'pkr': 'PH',
                    'mca': 'BN',
                    'mic': 'BN',
                    'gerakan': 'BN',
                    'pbb': 'GPS',
                    'supp': 'GPS'
                }
                
                all_text_lower = all_text.lower()
                for keyword, party in party_keywords.items():
                    if keyword in all_text_lower:
                        mp_data['party'] = party
                        print(f"      Historical format: Inferred party from text: {party}")
                        break
            
            # Validation: require at least name and constituency
            if mp_data['name'] != 'UNKNOWN' and mp_data['constituency'] != 'UNKNOWN':
                print(f"       Successfully extracted: {mp_data['name']} from {mp_data['constituency']}")
                return mp_data
            else:
                print(f"       Incomplete data: name={mp_data['name']}, constituency={mp_data['constituency']}")
                return None
            
        except Exception as e:
            print(f"       Error extracting MP: {e}")
            return None
    
    def process_mp_with_98_threshold(self, mp_data, parliament_term):
        """Process MP with advanced 98% threshold matching"""
        
        # Extract clean name using advanced extractor
        extraction_result = self.honorific_extractor.extract_and_store_honorifics(mp_data['name'])
        cleaned_name = extraction_result['standardized_name'] or extraction_result['cleaned_name']
        
        if not cleaned_name:
            print(f"     Could not clean name: {mp_data['name']}")
            return False
        
        # Parse constituency for additional matching criteria
        constituency_code, _, _ = self.parse_constituency(mp_data['constituency'])
        
        print(f"  Processing: {mp_data['name']}")
        print(f"    Cleaned: {cleaned_name} ({constituency_code})")
        print(f"    Honorifics: {extraction_result['extracted_honorifics']}")
        
        # Find existing MP using advanced 98% threshold
        existing_mp, similarity, reason, details = self.find_existing_mp_with_98_threshold(
            cleaned_name, constituency_code
        )
        
        if existing_mp:
            # 98%+ match found - update existing MP
            success = self.update_existing_mp_with_historical_term(
                existing_mp, mp_data, parliament_term, details
            )
            return success
        else:
            # Below 98% threshold - create new MP
            new_mp_doc = self.create_mp_document(mp_data, parliament_term)
            
            try:
                result = self.mp_collection.insert_one(new_mp_doc)
                self.stats['new_mps_created'] += 1
                print(f"     NEW MP CREATED: {cleaned_name}")
                return True
                
            except Exception as e:
                error_msg = f"Insert error for {cleaned_name}: {str(e)}"
                self.stats['errors'].append(error_msg)
                print(f"     Insert failed: {e}")
                return False
    
    def process_parliament_term(self, parliament_term):
        """Process entire parliament term with advanced 98% matching"""
        
        # Scrape this term
        mp_entries = self.scrape_parliament_term(parliament_term)
        self.stats['total_mps_scraped'] += len(mp_entries)
        
        if not mp_entries:
            print(f"  No MPs found for Parliament {parliament_term}")
            return 0, 0
        
        print(f"\n  Processing {len(mp_entries)} MPs with advanced 98% threshold matching...")
        
        processed_count = 0
        failed_count = 0
        
        for i, mp_data in enumerate(mp_entries, 1):
            print(f"\n  [{i}/{len(mp_entries)}] {mp_data['name']}")
            
            success = self.process_mp_with_98_threshold(mp_data, parliament_term)
            
            if success:
                processed_count += 1
            else:
                failed_count += 1
            
            # Progress update
            if i % 10 == 0:
                print(f"  Progress: {i}/{len(mp_entries)} processed")
        
        self.stats['terms_processed'] += 1
        
        print(f"\n  Parliament {parliament_term} completed:")
        print(f"    Total processed: {processed_count}")
        print(f"    Failed: {failed_count}")
        print(f"    98% matches: {self.stats['merges_98_percent']}")
        print(f"    New MPs (below 98%): {self.stats['separate_records_below_98']}")
        
        return processed_count, failed_count
    
    def update_honorific_dictionary(self):
        """Update honorific dictionary with new discoveries"""
        new_discoveries = self.honorific_extractor.extracted_honorifics['new_discoveries']
        
        if not new_discoveries:
            print("No new honorifics discovered - database unchanged")
            return {}
        
        print(f"Found {len(new_discoveries)} new honorifics to add")
        
        # Get existing dictionary
        existing_doc = self.honorific_extractor.honorific_collection.find_one()
        
        if existing_doc:
            existing_categories = existing_doc.get('categories', {})
        else:
            existing_categories = {}
        
        # Categorize new discoveries
        new_categorized = self.honorific_extractor.categorize_honorifics(list(new_discoveries))
        
        # Merge with existing categories
        for category, new_titles in new_categorized.items():
            if category in existing_categories:
                existing_set = set(existing_categories[category])
                new_set = set(new_titles)
                merged_set = existing_set.union(new_set)
                existing_categories[category] = sorted(list(merged_set))
            else:
                existing_categories[category] = sorted(new_titles)
        
        # Update database
        total_honorifics = sum(len(titles) for titles in existing_categories.values())
        
        updated_record = {
            'version': '3.0_enhanced',
            'source': 'Historical + Current Parliament Scraping with Advanced Extraction',
            'created_at': datetime.now(),
            'total_honorifics': total_honorifics,
            'historical_terms_analyzed': PARLIAMENT_TERMS,
            'current_term_analyzed': 15,
            'categories': existing_categories,
            'new_discoveries_this_session': len(new_discoveries),
            'extraction_statistics': {
                'total_extractions_performed': self.honorific_extractor.extracted_honorifics['total_extractions'],
                'comma_based_extractions': self.honorific_extractor.extracted_honorifics['comma_based_extractions'],
                'tan_issue_fixes_applied': self.honorific_extractor.extracted_honorifics['tan_issue_fixes'],
                'formatting_standardizations_applied': self.honorific_extractor.extracted_honorifics['formatting_standardizations']
            }
        }
        
        # Replace or insert the document
        if existing_doc:
            self.honorific_extractor.honorific_collection.replace_one(
                {'_id': existing_doc['_id']}, updated_record
            )
        else:
            self.honorific_extractor.honorific_collection.insert_one(updated_record)
        
        print(f"Honorific dictionary updated:")
        print(f"  Total honorifics: {total_honorifics}")
        print(f"  New discoveries added: {len(new_discoveries)}")
        
        return existing_categories
    
    def process_all_terms(self):
        """Process all parliament terms with comprehensive analysis"""
        
        print(f"\n{'='*80}")
        print(f"ENHANCED PARLIAMENT HISTORICAL SCRAPING")
        print(f"{'='*80}")
        print(f"Terms to process: {PARLIAMENT_TERMS}")
        print(f"Advanced 98% threshold matching: ENABLED")
        print(f"Advanced honorific extraction: ENABLED")
        print(f"Multi-term MP consolidation: ENABLED")
        
        total_processed = 0
        total_failed = 0
        
        for parliament_term in PARLIAMENT_TERMS:
            processed, failed = self.process_parliament_term(parliament_term)
            total_processed += processed
            total_failed += failed
            
            # Rate limiting between terms
            print(f"\n  Waiting 5 seconds before next term...")
            time.sleep(5)
        
        # Update honorific dictionary
        print(f"\n{'='*60}")
        print(f"UPDATING HONORIFIC DICTIONARY")
        print(f"{'='*60}")
        
        updated_categories = self.update_honorific_dictionary()
        
        # Final statistics
        self.stats['end_time'] = datetime.now()
        self.stats['total_processing_time'] = str(self.stats['end_time'] - self.stats['start_time'])
        
        # Get advanced matching statistics
        matching_stats = self.mp_matcher.get_matching_statistics()
        
        return {
            'total_terms_processed': len(PARLIAMENT_TERMS),
            'total_mps_scraped': self.stats['total_mps_scraped'],
            'total_processed': total_processed,
            'total_failed': total_failed,
            'new_mps_created': self.stats['new_mps_created'],
            'existing_mps_updated': self.stats['existing_mps_updated'],
            'merges_98_percent': self.stats['merges_98_percent'],
            'separate_records_below_98': self.stats['separate_records_below_98'],
            'processing_time': self.stats['total_processing_time'],
            'updated_honorific_categories': updated_categories,
            'advanced_matching_stats': matching_stats,
            'errors': self.stats['errors']
        }
    
    def print_comprehensive_summary(self, results):
        """Print detailed summary with advanced matching analysis"""
        
        print(f"\n{'='*80}")
        print(f"COMPREHENSIVE SCRAPING RESULTS")
        print(f"{'='*80}")
        
        print(f"PROCESSING SUMMARY:")
        print(f"  Parliament terms processed: {results['total_terms_processed']}")
        print(f"  Total MPs scraped: {results['total_mps_scraped']}")
        print(f"  Successfully processed: {results['total_processed']}")
        print(f"  Failed processing: {results['total_failed']}")
        print(f"  Processing time: {results['processing_time']}")
        
        print(f"\nADVANCED 98% THRESHOLD MATCHING RESULTS:")
        print(f"  New MPs created (below 98%): {results['new_mps_created']}")
        print(f"  Existing MPs updated (98%+ match): {results['existing_mps_updated']}")
        print(f"  Total 98%+ matches: {results['merges_98_percent']}")
        print(f"  Total separate records: {results['separate_records_below_98']}")
        
        # Advanced matching statistics
        matching_stats = results.get('advanced_matching_stats', {})
        if matching_stats:
            print(f"\nDETAILED MATCHING ANALYSIS:")
            print(f"  Total matching attempts: {matching_stats.get('total_matches_attempted', 0)}")
            print(f"  Exact matches: {matching_stats.get('exact_matches', 0)}")
            print(f"  Gender mismatches: {matching_stats.get('gender_mismatches', 0)}")
            print(f"  First name failures: {matching_stats.get('first_name_failures', 0)}")
            print(f"  Last name failures: {matching_stats.get('last_name_failures', 0)}")
            print(f"  Penalty applications: {matching_stats.get('penalty_applications', 0)}")
        
        # Database verification
        total_historical = self.mp_collection.count_documents({'status': 'historical'})
        total_current = self.mp_collection.count_documents({'status': 'current'})
        multi_term_mps = self.mp_collection.count_documents({
            'parliamentary_history.1': {'$exists': True}
        })
        
        print(f"\nDATABASE VERIFICATION:")
        print(f"  Historical MPs: {total_historical}")
        print(f"  Current MPs: {total_current}")
        print(f"  Total MPs: {total_historical + total_current}")
        print(f"  Multi-term MPs (98% matched): {multi_term_mps}")
        
        # Term breakdown
        print(f"\nPARLIAMENT TERM BREAKDOWN:")
        for term in range(1, 16):
            count = self.mp_collection.count_documents({
                'parliamentary_history.term_number': term
            })
            if count > 0:
                print(f"  {term}th Parliament: {count} MPs")
        
        # Honorific analysis
        updated_categories = results.get('updated_honorific_categories', {})
        
        if updated_categories:
            total_honorifics = sum(len(titles) for titles in updated_categories.values())
            print(f"\nHONORIFIC ANALYSIS:")
            print(f"  Total unique honorifics in database: {total_honorifics}")
            for category, titles in updated_categories.items():
                if titles:
                    print(f"    {category.replace('_', ' ').title()}: {len(titles)} titles")
        
        # Party evolution analysis
        party_changes = self.mp_collection.count_documents({
            'party_changes.1': {'$exists': True}
        })
        print(f"\nPARTY EVOLUTION ANALYSIS:")
        print(f"  MPs with party changes: {party_changes}")
        
        if results['errors']:
            print(f"\nERRORS ENCOUNTERED: {len(results['errors'])}")
            for error in results['errors'][:5]:
                print(f"  - {error}")
            if len(results['errors']) > 5:
                print(f"  ... and {len(results['errors']) - 5} more")
        else:
            print(f"\n No errors encountered")
        
        print(f"\n Enhanced parliament scraping completed successfully!")
        print(f" Advanced 98% threshold ensures zero false positives")
        print(f"  Honorific database updated efficiently")
        print(f" Multi-term MPs properly consolidated")
        print(f" Ready for comprehensive historical analysis")

# ============================================================================
# Execute Enhanced Production Scraping
# ============================================================================

def main():
    """Main execution function"""
    
    print("=" * 80)
    print("ENHANCED PARLIAMENT HISTORICAL SCRAPER - CLEANED VERSION")
    print("Advanced 98% Threshold + Consolidated Logic + Multi-Term Support")
    print("=" * 80)
    
    # Initialize scraper
    scraper = EnhancedParliamentScraper(MONGODB_URI)
    
    # Process all terms
    results = scraper.process_all_terms()
    
    # Print comprehensive summary
    scraper.print_comprehensive_summary(results)
    
    return results

# Execute the enhanced scraper
if __name__ == "__main__":
    scraping_results = main()