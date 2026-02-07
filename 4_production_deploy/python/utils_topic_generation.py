#!/usr/bin/env python3
"""
Topic generation utilities - Rule-based approach

Provides fast, rule-based topic naming for Malaysian parliamentary debates.
Focuses on political issues, policies, and reforms rather than dates/names.
Can be easily updated with new rules and categories.
"""
from typing import List, Dict, Tuple, Optional
import re


def is_year_or_date(keyword: str) -> bool:
    """Check if keyword is a year or date."""
    # Match years (1970-2099)
    if re.match(r'^(19\d{2}|20\d{2})$', keyword):
        return True
    # Match month-year patterns
    if re.match(r'^(januari|februari|mac|april|mei|jun|julai|ogos|september|oktober|november|disember|january|february|march|april|may|june|july|august|september|october|november|december)\s*\d{4}$', keyword, re.I):
        return True
    # Match date patterns
    if re.match(r'^\d{1,2}[\s\-/]\d{1,2}[\s\-/]?\d{0,4}$', keyword):
        return True
    # Match month patterns
    if keyword.lower() in ['januari', 'februari', 'mac', 'april', 'mei', 'jun', 'julai', 'ogos', 'september', 'oktober', 'november', 'disember']:
        return True
    return False


def is_person_name(keyword: str) -> bool:
    """Check if keyword is likely a person name (basic heuristic)."""
    # Common titles
    if any(title in keyword.lower() for title in ['dato', 'datin', 'tan sri', 'tun', 'dr ', 'prof']):
        return True
    # Capitalized words (2-3 words, proper case)
    words = keyword.split()
    if len(words) >= 2 and all(w[0].isupper() if w else False for w in words if len(w) > 2):
        return True
    return False


def clean_keywords(keywords: List[str], max_keywords: int = 15) -> List[str]:
    """
    Filter out years, dates, person names, and non-meaningful words from keywords.
    Returns cleaned list of meaningful political keywords.
    """
    # Common generic/filler words to skip
    skip_words = {
        'beta', 'clan', 'okey', 'also', 'therefore', 'made', 'able', 'said',
        'untok', 'kapada', 'lebeh', 'ra ayat', 'berchakap', 'samada',
        'sebenamya', 'pemah', 'berhonnat', 'tuany', 'yangb', 'yangd',
        'bdul', 'yaahnlbgie', 'thish', 'hajia', 'honourablem',
        'pcmbangunan', 'mcsyuarat', 'schingga', 'pengemsi', 'kondisi',
        'pulo', 'waiau', 'kato', 'tagong', 'sibat', 'oleochemicals', 'porla',
        'izr1', 'alblieanhb',  # OCR garbage
        'gombak', 'padang serai', 'maksud 47', 'maksud 48',
        'thef', 'wouldl', 'theg', 'arliament', 'thep', 'eptember',
        'aib', 'nmg', 'gsh', 'haija', 'suhboirhn', 'bahagianp',
        '9hb', 'tiap tiap', 'disebabkan per', 'terlebih berkhidmat',
        'congratulations', 'ranchangan',
    }
    
    # Common Malaysian politician names and titles (partial matching)
    name_patterns = [
        r'vijandran', r'badruddin', r'amiruldin', r'juhar', r'mahiruddin',
        r'ong tee', r'khalid', r'kasim', r'ismail', r'muhamad', r'husam',
        r'chan teck', r'sabran', r'khadri', r'khalil', r'yacob', r'ghazalee',
        r'manivannan', r'gowindasamy', r'alice lau', r'kiong', r'madani',
        r'nik ahmed', r'hamid jaafar', r'dahlan', r'seng chai', r'hasnon',
        r'eric chia', r'soros', r'george', r'paduka', r'si cheng',
        r'wan wan', r'mamat', r'kiat', r'hu sepang', r'yacob',
    ]
    
    cleaned = []
    for kw in keywords:
        # Skip empty or very short keywords
        if not kw or len(kw) < 3:
            continue
            
        kw_lower = kw.lower().strip()
        
        # Skip years and dates
        if is_year_or_date(kw_lower):
            continue
            
        # Skip pure numbers and number patterns
        if re.match(r'^\d+[\s\d]*$', kw_lower):
            continue
            
        # Skip date-like patterns (e.g., "12 92", "11 98")
        if re.match(r'^\d{1,2}\s+\d{2,4}$', kw_lower):
            continue
            
        # Skip garbled text (OCR errors) - too many consonants or mixed numbers/letters
        if re.search(r'\d+[a-z]+\d+|[a-z]+\d+[a-z]+', kw_lower):  # Mixed numbers and letters
            continue
        consonant_ratio = sum(1 for c in kw_lower if c in 'bcdfghjklmnpqrstvwxyz') / max(len(kw_lower), 1)
        if consonant_ratio > 0.8:  # Too many consonants (likely garbled)
            continue
            
        # Skip generic terms
        if kw_lower in skip_words:
            continue
            
        # Skip politician names (partial match)
        is_name = False
        for pattern in name_patterns:
            if re.search(pattern, kw_lower):
                is_name = True
                break
        if is_name:
            continue
            
        # Skip if starts with common honorifics/titles
        if re.match(r'^(dato|datin|tan sri|tun|dr|prof|yang|yang di)', kw_lower):
            continue
            
        # Skip if appears to be person name (basic heuristic - capitalized 2+ words)
        words = kw.split()
        if len(words) >= 2 and all(w[0].isupper() if w and len(w) > 1 else False for w in words[:3]):
            # Check if it matches a known category or pattern keyword
            is_known = False
            for cat_key in TOPIC_CATEGORIES.keys():
                if cat_key in kw_lower:
                    is_known = True
                    break
            if not is_known:
                continue
        
        cleaned.append(kw)
        
        if len(cleaned) >= max_keywords:
            break
    
    return cleaned


# Malaysian parliamentary topic categories (expanded)
TOPIC_CATEGORIES = {
    # Economy & Finance
    "ekonomi": {"en": "Economic Policy", "ms": "Dasar Ekonomi"},
    "kewangan": {"en": "Financial Affairs", "ms": "Hal Kewangan"},
    "bajet": {"en": "Budget Policy", "ms": "Dasar Bajet"},
    "belanjawan": {"en": "National Budget", "ms": "Belanjawan Negara"},
    "cukai": {"en": "Taxation", "ms": "Cukai"},
    "duti": {"en": "Duties & Tariffs", "ms": "Duti"},
    "kastam": {"en": "Customs", "ms": "Kastam"},
    "perdagangan": {"en": "Trade Policy", "ms": "Dasar Perdagangan"},
    "pelaburan": {"en": "Investment Policy", "ms": "Dasar Pelaburan"},
    "perniagaan": {"en": "Business Affairs", "ms": "Hal Perniagaan"},
    "pasaran": {"en": "Market Reform", "ms": "Reformasi Pasaran"},
    "bank": {"en": "Banking Sector", "ms": "Sektor Perbankan"},
    "wang": {"en": "Monetary Policy", "ms": "Dasar Wang"},
    "kdnk": {"en": "GDP Growth", "ms": "Pertumbuhan KDNK"},
    "inflasi": {"en": "Inflation", "ms": "Inflasi"},
    "bursa": {"en": "Stock Market", "ms": "Pasaran Saham"},
    
    # Education Reform
    "pendidikan": {"en": "Education Reform", "ms": "Reformasi Pendidikan"},
    "sekolah": {"en": "School System", "ms": "Sistem Sekolah"},
    "universiti": {"en": "Higher Education", "ms": "Pendidikan Tinggi"},
    "pelajar": {"en": "Student Affairs", "ms": "Hal Pelajar"},
    "guru": {"en": "Teacher Welfare", "ms": "Kebajikan Guru"},
    "ilmu": {"en": "Knowledge Policy", "ms": "Dasar Ilmu"},
    "biasiswa": {"en": "Scholarship", "ms": "Biasiswa"},
    "ptptn": {"en": "Education Loans", "ms": "Pinjaman Pendidikan"},
    "matrikulasi": {"en": "Matriculation", "ms": "Matrikulasi"},
    
    # Healthcare Policy
    "kesihatan": {"en": "Healthcare Policy", "ms": "Dasar Kesihatan"},
    "hospital": {"en": "Hospital System", "ms": "Sistem Hospital"},
    "doktor": {"en": "Medical Services", "ms": "Perkhidmatan Perubatan"},
    "ubat": {"en": "Pharmaceutical Policy", "ms": "Dasar Ubat"},
    "penyakit": {"en": "Disease Control", "ms": "Kawalan Penyakit"},
    "covid": {"en": "COVID-19 Response", "ms": "Tindakan COVID-19"},
    "wabak": {"en": "Pandemic Management", "ms": "Pengurusan Wabak"},
    "jururawat": {"en": "Nursing Services", "ms": "Perkhidmatan Kejururawatan"},
    "klinik": {"en": "Clinic Services", "ms": "Perkhidmatan Klinik"},
    "pesakit": {"en": "Patient Care", "ms": "Penjagaan Pesakit"},
    "penjagaan": {"en": "Healthcare Services", "ms": "Perkhidmatan Penjagaan"},
    
    # Infrastructure & Development
    "infrastruktur": {"en": "Infrastructure", "ms": "Infrastruktur"},
    "pembangunan": {"en": "Development", "ms": "Pembangunan"},
    "jalan": {"en": "Roads", "ms": "Jalan Raya"},
    "pengangkutan": {"en": "Transportation", "ms": "Pengangkutan"},
    "projek": {"en": "Projects", "ms": "Projek"},
    "binaan": {"en": "Construction", "ms": "Pembinaan"},
    
    # Agriculture & Rural
    "pertanian": {"en": "Agriculture", "ms": "Pertanian"},
    "petani": {"en": "Farmers", "ms": "Petani"},
    "peladang": {"en": "Farmers", "ms": "Peladang"},
    "luar": {"en": "Rural", "ms": "Luar Bandar"},
    "desa": {"en": "Rural", "ms": "Desa"},
    "tanaman": {"en": "Crops", "ms": "Tanaman"},
    
    # Environment
    "alam": {"en": "Environment", "ms": "Alam Sekitar"},
    "sekitar": {"en": "Environment", "ms": "Alam Sekitar"},
    "hutan": {"en": "Forest", "ms": "Hutan"},
    "air": {"en": "Water", "ms": "Air"},
    "sungai": {"en": "River", "ms": "Sungai"},
    "laut": {"en": "Sea", "ms": "Laut"},
    "sampah": {"en": "Waste", "ms": "Sampah"},
    "pencemaran": {"en": "Pollution", "ms": "Pencemaran"},
    
    # Law & Justice Reform
    "undang": {"en": "Legislative Reform", "ms": "Reformasi Undang-undang"},
    "perlembagaan": {"en": "Constitutional Reform", "ms": "Reformasi Perlembagaan"},
    "mahkamah": {"en": "Judicial System", "ms": "Sistem Kehakiman"},
    "hakim": {"en": "Judiciary Reform", "ms": "Reformasi Kehakiman"},
    "jenayah": {"en": "Criminal Justice", "ms": "Keadilan Jenayah"},
    "polis": {"en": "Police Reform", "ms": "Reformasi Polis"},
    "akta": {"en": "Act Amendment", "ms": "Pindaan Akta"},
    "pindaan": {"en": "Amendment", "ms": "Pindaan"},
    "rang": {"en": "Bill", "ms": "Rang Undang-undang"},
    "fasal": {"en": "Clause", "ms": "Fasal"},
    "seksyen": {"en": "Section", "ms": "Seksyen"},
    "peruntukan": {"en": "Provision", "ms": "Peruntukan"},
    "kehakiman": {"en": "Judicial Affairs", "ms": "Hal Kehakiman"},
    "rasuah": {"en": "Anti-Corruption", "ms": "Anti-Rasuah"},
    
    # Social Welfare
    "kebajikan": {"en": "Welfare", "ms": "Kebajikan"},
    "rakyat": {"en": "Citizens", "ms": "Rakyat"},
    "masyarakat": {"en": "Society", "ms": "Masyarakat"},
    "kemiskinan": {"en": "Poverty", "ms": "Kemiskinan"},
    "bantuan": {"en": "Aid", "ms": "Bantuan"},
    
    # Housing
    "perumahan": {"en": "Housing", "ms": "Perumahan"},
    "rumah": {"en": "Housing", "ms": "Perumahan"},
    
    # Employment & Labor
    "pekerjaan": {"en": "Employment", "ms": "Pekerjaan"},
    "buruh": {"en": "Labor", "ms": "Buruh"},
    "pekerja": {"en": "Workers", "ms": "Pekerja"},
    "gaji": {"en": "Wages", "ms": "Gaji"},
    
    # Energy
    "tenaga": {"en": "Energy", "ms": "Tenaga"},
    "elektrik": {"en": "Electricity", "ms": "Elektrik"},
    "minyak": {"en": "Oil", "ms": "Minyak"},
    "gas": {"en": "Gas", "ms": "Gas"},
    
    # Defense & Security
    "pertahanan": {"en": "National Defense", "ms": "Pertahanan Negara"},
    "keselamatan": {"en": "Security Affairs", "ms": "Hal Keselamatan"},
    "tentera": {"en": "Military Affairs", "ms": "Hal Tentera"},
    
    # Parliamentary Procedure & Ethics
    "contempt": {"en": "Parliamentary Contempt", "ms": "Penghinaan Parlimen"},
    "penghinaan": {"en": "Parliamentary Contempt", "ms": "Penghinaan Parlimen"},
    "kelaku": {"en": "Parliamentary Conduct", "ms": "Kelakuan Parlimen"},
    "mesyuarat": {"en": "Parliamentary Session", "ms": "Mesyuarat Parlimen"},
    "memilih": {"en": "Electoral Process", "ms": "Proses Pilihan Raya"},
    "mengangkat": {"en": "Appointment Process", "ms": "Proses Pelantikan"},
    "sumpah": {"en": "Oath Taking", "ms": "Mengangkat Sumpah"},
    "kelayakan": {"en": "Qualification", "ms": "Kelayakan"},
    
    # Foreign Affairs
    "luar": {"en": "Foreign Affairs", "ms": "Luar Negeri"},
    "negeri": {"en": "Foreign Affairs", "ms": "Luar Negeri"},
    "antarabangsa": {"en": "International", "ms": "Antarabangsa"},
    
    # Technology & Digital
    "teknologi": {"en": "Technology", "ms": "Teknologi"},
    "digital": {"en": "Digital", "ms": "Digital"},
    "internet": {"en": "Internet", "ms": "Internet"},
    "rangkaian": {"en": "Network", "ms": "Rangkaian"},
    
    # Religion & Culture
    "agama": {"en": "Religion", "ms": "Agama"},
    "islam": {"en": "Islam", "ms": "Islam"},
    "budaya": {"en": "Culture", "ms": "Budaya"},
    
    # Parliament & Governance
    "parlimen": {"en": "Parliamentary Affairs", "ms": "Hal Parlimen"},
    "kerajaan": {"en": "Government Policy", "ms": "Dasar Kerajaan"},
    "menteri": {"en": "Ministerial Affairs", "ms": "Hal Menteri"},
    "ahli": {"en": "Parliamentary Members", "ms": "Ahli Parlimen"},
    "dasar": {"en": "Policy Reform", "ms": "Reformasi Dasar"},
    "keraja": {"en": "Government Affairs", "ms": "Hal Kerajaan"},
    "negeri": {"en": "State Affairs", "ms": "Hal Negeri"},
    "negara": {"en": "National Affairs", "ms": "Hal Negara"},
    "pakatan": {"en": "Coalition Affairs", "ms": "Hal Pakatan"},
    "parti": {"en": "Political Parties", "ms": "Parti Politik"},
    "pemerintahan": {"en": "Governance", "ms": "Pemerintahan"},
    "pentadbiran": {"en": "Administration", "ms": "Pentadbiran"},
    "pilihan": {"en": "Elections", "ms": "Pilihan Raya"},
    "pru": {"en": "General Elections", "ms": "Pilihan Raya Umum"},
    "pengundi": {"en": "Electoral Reform", "ms": "Reformasi Pilihan Raya"},
    "spr": {"en": "Election Commission", "ms": "Suruhanjaya Pilihan Raya"},
    "persempadanan": {"en": "Constituency Redelineation", "ms": "Persempadanan Semula"},
    
    # Ethnic & Social Policy
    "bumiputra": {"en": "Bumiputera Policy", "ms": "Dasar Bumiputera"},
    "bumiputera": {"en": "Bumiputera Policy", "ms": "Dasar Bumiputera"},
    "melayu": {"en": "Malay Affairs", "ms": "Hal Melayu"},
    "cina": {"en": "Chinese Community", "ms": "Masyarakat Cina"},
    "india": {"en": "Indian Community", "ms": "Masyarakat India"},
    "pribumi": {"en": "Indigenous Rights", "ms": "Hak Pribumi"},
    "orang": {"en": "Orang Asli Affairs", "ms": "Hal Orang Asli"},
    "kaum": {"en": "Ethnic Relations", "ms": "Hubungan Kaum"},
    "perpaduan": {"en": "National Unity", "ms": "Perpaduan Negara"},
    
    # Development Plans (Rancangan Malaysia)
    "rancangan": {"en": "Development Plan", "ms": "Rancangan Pembangunan"},
    "ranchangan": {"en": "Development Plan", "ms": "Rancangan Pembangunan"},
    "rancangan pertama": {"en": "First Malaysia Plan", "ms": "Rancangan Malaysia Pertama"},
    "rancangan kedua": {"en": "Second Malaysia Plan", "ms": "Rancangan Malaysia Kedua"},
    "rancangan ketiga": {"en": "Third Malaysia Plan", "ms": "Rancangan Malaysia Ketiga"},
    "rancangan keempat": {"en": "Fourth Malaysia Plan", "ms": "Rancangan Malaysia Keempat"},
    "rancangan kelima": {"en": "Fifth Malaysia Plan", "ms": "Rancangan Malaysia Kelima"},
    "rancangan keenam": {"en": "Sixth Malaysia Plan", "ms": "Rancangan Malaysia Keenam"},
    "rancangan ketujuh": {"en": "Seventh Malaysia Plan", "ms": "Rancangan Malaysia Ketujuh"},
    "rancangan kelapan": {"en": "Eighth Malaysia Plan", "ms": "Rancangan Malaysia Kelapan"},
    "rancangan kesembilan": {"en": "Ninth Malaysia Plan", "ms": "Rancangan Malaysia Kesembilan"},
    "rancangan kesepuluh": {"en": "Tenth Malaysia Plan", "ms": "Rancangan Malaysia Kesepuluh"},
    "rancangan kesebelas": {"en": "Eleventh Malaysia Plan", "ms": "Rancangan Malaysia Kesebelas"},
    "rancangan keduabelas": {"en": "Twelfth Malaysia Plan", "ms": "Rancangan Malaysia Keduabelas"},
    
    # Financial Crisis & Reform
    "kegawatan": {"en": "Economic Crisis", "ms": "Kegawatan Ekonomi"},
    "krisis": {"en": "Crisis Management", "ms": "Pengurusan Krisis"},
    "danaharta": {"en": "Asset Recovery", "ms": "Pemulihan Aset"},
    "danamodal": {"en": "Capital Recapitalization", "ms": "Permodalan Semula"},
    "pemulihan": {"en": "Economic Recovery", "ms": "Pemulihan Ekonomi"},
    "bailout": {"en": "Financial Bailout", "ms": "Penyelamatan Kewangan"},
    
    # Common Parliamentary Terms
    "sepert": {"en": "Parliamentary Procedures", "ms": "Prosedur Parlimen"},
    "ingin": {"en": "Parliamentary Questions", "ms": "Soalan Parlimen"},
    "jadi": {"en": "Legislative Process", "ms": "Proses Perundangan"},
    "mencadang": {"en": "Parliamentary Motion", "ms": "Usul Parlimen"},
    "dicadang": {"en": "Proposed Motion", "ms": "Usul Dicadang"},
    "hendaklah": {"en": "Legislative Requirement", "ms": "Keperluan Undang-undang"},
    "berkuatkuasa": {"en": "Legal Enforcement", "ms": "Penguatkuasaan Undang-undang"},
    "pengecualian": {"en": "Legal Exemption", "ms": "Pengecualian"},
    "peruntukan": {"en": "Legislative Provision", "ms": "Peruntukan Undang-undang"},
    "peruntu": {"en": "Allocation", "ms": "Peruntukan"},
    "lampiran": {"en": "Schedule", "ms": "Lampiran"},
    "circulated": {"en": "Bill Circulation", "ms": "Edaran Rang Undang-undang"},
    
    # Customs & Trade
    "perintah": {"en": "Order", "ms": "Perintah"},
    "tarif": {"en": "Tariff", "ms": "Tarif"},
    "import": {"en": "Import", "ms": "Import"},
    "eksport": {"en": "Export", "ms": "Eksport"},
    "galakan": {"en": "Tax Incentives", "ms": "Galakan Cukai"},
    
    # Infrastructure Terms
    "jalanraya": {"en": "Highway", "ms": "Lebuh Raya"},
    "lebuh": {"en": "Highway", "ms": "Lebuh Raya"},
    "pelabuhan": {"en": "Port", "ms": "Pelabuhan"},
    "lapangan": {"en": "Airport", "ms": "Lapangan Terbang"},
    "jambatan": {"en": "Bridge", "ms": "Jambatan"},
    "terowong": {"en": "Tunnel", "ms": "Terowong"},
    "rel": {"en": "Railway", "ms": "Kereta Api"},
    "ktm": {"en": "Railway System", "ms": "Sistem Keretapi"},
    "lrt": {"en": "Light Rail Transit", "ms": "Transit Aliran Ringan"},
    "mrt": {"en": "Mass Rapid Transit", "ms": "Transit Aliran Massa"},
    
    # Education Institutions
    "kolej": {"en": "College", "ms": "Kolej"},
    "institut": {"en": "Institute", "ms": "Institut"},
    "pusat": {"en": "Centre", "ms": "Pusat"},
    "politeknik": {"en": "Polytechnic", "ms": "Politeknik"},
    "maktab": {"en": "College", "ms": "Maktab"},
    
    # Economic Institutions
    "syarikat": {"en": "Company Affairs", "ms": "Hal Syarikat"},
    "korporat": {"en": "Corporate Affairs", "ms": "Hal Korporat"},
    "perbankan": {"en": "Banking Affairs", "ms": "Hal Perbankan"},
    "insurans": {"en": "Insurance", "ms": "Insurans"},
    "broker": {"en": "Brokerage", "ms": "Broker"},
    "saham": {"en": "Stock Market", "ms": "Pasaran Saham"},
    "bon": {"en": "Bond Market", "ms": "Pasaran Bon"},
    "sekuriti": {"en": "Securities", "ms": "Sekuriti"},
    
    # Social Programs
    "subsidi": {"en": "Subsidy Program", "ms": "Program Subsidi"},
    "br1m": {"en": "Cash Assistance", "ms": "Bantuan Tunai"},
    "bsh": {"en": "Living Aid", "ms": "Bantuan Sara Hidup"},
    "zakat": {"en": "Zakat", "ms": "Zakat"},
    "wakaf": {"en": "Waqf", "ms": "Wakaf"},
    "derma": {"en": "Donation", "ms": "Derma"},
    
    # Labor & Employment
    "kwsp": {"en": "EPF", "ms": "KWSP"},
    "epf": {"en": "Employees Provident Fund", "ms": "Kumpulan Wang Simpanan Pekerja"},
    "perkeso": {"en": "SOCSO", "ms": "PERKESO"},
    "socso": {"en": "Social Security", "ms": "Keselamatan Sosial"},
    "upah": {"en": "Minimum Wage", "ms": "Gaji Minimum"},
    "pencarum": {"en": "Contributors", "ms": "Pencarum"},
    "pesara": {"en": "Pension", "ms": "Pencen"},
    "pencen": {"en": "Pension", "ms": "Pencen"},
    
    # Media & Communication
    "penyiaran": {"en": "Broadcasting", "ms": "Penyiaran"},
    "media": {"en": "Media", "ms": "Media"},
    "akhbar": {"en": "Press", "ms": "Akhbar"},
    "suratkhabar": {"en": "Newspaper", "ms": "Surat Khabar"},
    "televisyen": {"en": "Television", "ms": "Televisyen"},
    "radio": {"en": "Radio", "ms": "Radio"},
    
    # Religious Affairs
    "syariah": {"en": "Syariah Law", "ms": "Undang-undang Syariah"},
    "fatwa": {"en": "Fatwa", "ms": "Fatwa"},
    "mufti": {"en": "Mufti", "ms": "Mufti"},
    "imam": {"en": "Imam", "ms": "Imam"},
    "masjid": {"en": "Mosque", "ms": "Masjid"},
    "surau": {"en": "Surau", "ms": "Surau"},
    "haji": {"en": "Hajj", "ms": "Haji"},
    "umrah": {"en": "Umrah", "ms": "Umrah"},
    "tabung": {"en": "Pilgrimage Fund", "ms": "Tabung Haji"},
    
    # Security & Defense
    "pdrm": {"en": "Police Force", "ms": "Polis Diraja Malaysia"},
    "atm": {"en": "Armed Forces", "ms": "Angkatan Tentera Malaysia"},
    "tldm": {"en": "Royal Navy", "ms": "Tentera Laut Diraja Malaysia"},
    "tudm": {"en": "Air Force", "ms": "Tentera Udara Diraja Malaysia"},
    "rejimen": {"en": "Regiment", "ms": "Rejimen"},
    
    # Other Common Terms
    "sebab": {"en": "Reasoning", "ms": "Sebab"},
    "bawah": {"en": "Under Authority", "ms": "Di Bawah"},
    "atas": {"en": "Over", "ms": "Atas"},
    "mengikut": {"en": "According To", "ms": "Mengikut"},
    "melalui": {"en": "Through", "ms": "Melalui"},
    "berkaitan": {"en": "Related Affairs", "ms": "Berkaitan"},
    "mengenai": {"en": "Regarding", "ms": "Mengenai"},
    "tentang": {"en": "About", "ms": "Tentang"},
    "kawasan": {"en": "Constituency", "ms": "Kawasan"},
    "daerah": {"en": "District", "ms": "Daerah"},
    "wilayah": {"en": "Territory", "ms": "Wilayah"},
    
    # Labuan & Offshore Finance
    "pesisir": {"en": "Labuan Offshore", "ms": "Pesisir Labuan"},
    "labuan": {"en": "Labuan", "ms": "Labuan"},
    "lofsa": {"en": "Labuan Financial Services", "ms": "LOFSA"},
    "iofc": {"en": "International Offshore Finance", "ms": "IOFC"},
    "bskl": {"en": "Labuan IBFC", "ms": "BSKL"},
    
    # Publications & Reports
    "terbitan": {"en": "Publications & Reports", "ms": "Terbitan"},
    "malaysian investment": {"en": "Malaysian Investment Report", "ms": "Laporan Pelaburan Malaysia"},
    "issue": {"en": "Report Issue", "ms": "Isu Laporan"},
    
    # Valuation & Assessment
    "pentaksir": {"en": "Valuers & Assessors", "ms": "Pentaksir"},
    "penilai": {"en": "Valuation", "ms": "Penilaian"},
    "penilai pentaksir": {"en": "Valuers & Assessors Board", "ms": "Lembaga Penilai dan Pentaksir"},
    
    # International Treaties & Conventions
    "paris convention": {"en": "Paris Convention", "ms": "Konvensyen Paris"},
    "paris": {"en": "International Convention", "ms": "Konvensyen Antarabangsa"},
    "nafta": {"en": "Trade Agreement", "ms": "Perjanjian Perdagangan"},
    "convention": {"en": "International Convention", "ms": "Konvensyen"},
    "terms act": {"en": "Treaty Terms", "ms": "Syarat Perjanjian"},
    
    # ICT / Digital (for tmnet, prolink, homepage clusters)
    "tmnet": {"en": "Telecommunications", "ms": "Telekomunikasi"},
    "prolink": {"en": "Network Services", "ms": "Perkhidmatan Rangkaian"},
    "homepage": {"en": "Digital Services", "ms": "Perkhidmatan Digital"},
    
    # Other recurring low-quality terms
    "titah": {"en": "Royal Address", "ms": "Titah"},
    "depositor": {"en": "Depositor Protection", "ms": "Perlindungan Pen deposit"},
    "pembetung": {"en": "Sewerage", "ms": "Pembetungan"},
    "banluan": {"en": "Export Rubber", "ms": "Eksport Getah"},
    "briged": {"en": "Youth Corps", "ms": "Briged"},
    "karisma": {"en": "Youth Programme", "ms": "Program Belia"},
    "prejudicial": {"en": "Company Law", "ms": "Undang-undang Syarikat"},
    "incompatible": {"en": "Corporate Governance", "ms": "Tadbir Urus Korporat"},

    # --- From Topic collection (dummy) ---
    # Cost of Living
    "kos sara hidup": {"en": "Cost of Living", "ms": "Kos Sara Hidup"},
    "cola": {"en": "Cost of Living Allowance", "ms": "COLA"},
    "rahmah": {"en": "Rahmah Initiative", "ms": "Payung Rahmah"},
    "harga barang": {"en": "Price of Goods", "ms": "Harga Barang"},
    "kenaikan harga": {"en": "Price Increase", "ms": "Kenaikan Harga"},
    # 1MDB & Debt Resolution
    "1mdb": {"en": "1MDB Debt Resolution", "ms": "Penyelesaian Hutang 1MDB"},
    "pampasan": {"en": "Compensation", "ms": "Pampasan"},
    "penyelesaian hutang": {"en": "Debt Resolution", "ms": "Penyelesaian Hutang"},
    # Education Reform (PPPM, TVET, digital learning)
    "pppm": {"en": "Education Development Plan", "ms": "Pelan Pembangunan Pendidikan"},
    "tvet": {"en": "Technical & Vocational Education", "ms": "TVET"},
    "pembelajaran digital": {"en": "Digital Learning", "ms": "Pembelajaran Digital"},
    "kurikulum": {"en": "Curriculum", "ms": "Kurikulum"},
    "kemahiran teknikal": {"en": "Technical Skills", "ms": "Kemahiran Teknikal"},
    # Unity & Integration
    "integrasi": {"en": "Integration", "ms": "Integrasi"},
    "etnik": {"en": "Ethnic Affairs", "ms": "Hal Etnik"},
    "toleransi": {"en": "Tolerance", "ms": "Toleransi"},
    "harmoni": {"en": "Harmony", "ms": "Harmoni"},
    "kepercayaan": {"en": "Belief & Faith", "ms": "Kepercayaan"},
    # Culture and Arts
    "kebudayaan": {"en": "Culture and Arts", "ms": "Kebudayaan dan Kesenian"},
    "kesenian": {"en": "Arts", "ms": "Kesenian"},
    "warisan": {"en": "Heritage", "ms": "Warisan"},
    "tradisi": {"en": "Tradition", "ms": "Tradisi"},
    "motac": {"en": "Ministry of Tourism & Culture", "ms": "Kementerian Pelancongan dan Kebudayaan"},
    "muzium": {"en": "Museum", "ms": "Muzium"},
    "galeri": {"en": "Gallery", "ms": "Galeri"},
    # Palestine-Gaza & Humanitarian
    "palestin": {"en": "Palestine", "ms": "Palestin"},
    "gaza": {"en": "Gaza", "ms": "Gaza"},
    "hamas": {"en": "Hamas", "ms": "Hamas"},
    "israel": {"en": "Israel", "ms": "Israel"},
    "zionis": {"en": "Zionist", "ms": "Zionis"},
    "kemanusiaan": {"en": "Humanitarian", "ms": "Kemanusiaan"},
    "unrwa": {"en": "UNRWA", "ms": "UNRWA"},
    "pbb": {"en": "United Nations", "ms": "PBB"},
    # Foreign Relations
    "diplomasi": {"en": "Diplomacy", "ms": "Diplomasi"},
    "asean": {"en": "ASEAN", "ms": "ASEAN"},
    "wisma putra": {"en": "Ministry of Foreign Affairs", "ms": "Wisma Putra"},
    "mofa": {"en": "Ministry of Foreign Affairs", "ms": "Kementerian Luar Negeri"},
    "kedutaan": {"en": "Embassy", "ms": "Kedutaan"},
    "konsulat": {"en": "Consulate", "ms": "Konsulat"},
    "bilateral": {"en": "Bilateral Relations", "ms": "Hubungan Bilateral"},
    "hubungan luar": {"en": "Foreign Relations", "ms": "Hubungan Luar"},
    # Transportation (extend existing)
    "komuter": {"en": "Commuter", "ms": "Komuter"},
    "e-hailing": {"en": "E-Hailing", "ms": "E-Hailing"},
    "bas": {"en": "Bus", "ms": "Bas"},
    "teksi": {"en": "Taxi", "ms": "Teksi"},
    # Social Welfare (OKU, elderly)
    "jkm": {"en": "Social Welfare Department", "ms": "Jabatan Kebajikan Masyarakat"},
    "dsw": {"en": "Department of Social Welfare", "ms": "Jabatan Kebajikan"},
    "oku": {"en": "Persons with Disabilities", "ms": "Orang Kurang Upaya"},
    "warga emas": {"en": "Elderly", "ms": "Warga Emas"},
    "kurang upaya": {"en": "Disability", "ms": "Kurang Upaya"},
    # Digital & Technology
    "5g": {"en": "5G", "ms": "5G"},
    "4g": {"en": "4G", "ms": "4G"},
    "mdec": {"en": "Digital Economy Corporation", "ms": "MDEC"},
    "msc": {"en": "Multimedia Super Corridor", "ms": "MSC"},
    "cyberjaya": {"en": "Cyberjaya", "ms": "Cyberjaya"},
    "broadband": {"en": "Broadband", "ms": "Broadband"},
    "ict": {"en": "ICT", "ms": "ICT"},
    # Parliamentary Reform
    "reformasi parlimen": {"en": "Parliamentary Reform", "ms": "Reformasi Parlimen"},
    "jpc": {"en": "Joint Parliamentary Committee", "ms": "Jawatankuasa Bersama Parlimen"},
    "pac": {"en": "Public Accounts Committee", "ms": "Jawatankuasa Kira-kira"},
    "jawatankuasa kira-kira": {"en": "Public Accounts Committee", "ms": "Jawatankuasa Kira-kira"},
    "jawatankuasa pilihan": {"en": "Select Committee", "ms": "Jawatankuasa Pilihan"},
    # Digital Economy
    "ekonomi digital": {"en": "Digital Economy", "ms": "Ekonomi Digital"},
    "e-dagang": {"en": "E-Commerce", "ms": "E-Dagang"},
    "e-commerce": {"en": "E-Commerce", "ms": "E-Dagang"},
    "fintech": {"en": "Fintech", "ms": "Teknologi Kewangan"},
    "dnb": {"en": "Digital Nasional Berhad", "ms": "DNB"},
    "digital banking": {"en": "Digital Banking", "ms": "Perbankan Digital"},
    "pembayaran digital": {"en": "Digital Payments", "ms": "Pembayaran Digital"},
    # Energy (extend)
    "tnb": {"en": "Tenaga Nasional", "ms": "TNB"},
    "tenaga boleh baharu": {"en": "Renewable Energy", "ms": "Tenaga Boleh Baharu"},
    "solar": {"en": "Solar Energy", "ms": "Tenaga Solar"},
    "grid": {"en": "Power Grid", "ms": "Grid Kuasa"},
    # Foreign Investment
    "fdi": {"en": "Foreign Direct Investment", "ms": "Pelaburan Langsung Asing"},
    "mida": {"en": "MIDA", "ms": "MIDA"},
    "investkl": {"en": "InvestKL", "ms": "InvestKL"},
    "trade mission": {"en": "Trade Mission", "ms": "Misi Perdagangan"},
    "misi perdagangan": {"en": "Trade Mission", "ms": "Misi Perdagangan"},
    "pelaburan asing": {"en": "Foreign Investment", "ms": "Pelaburan Asing"},
}


# Keyword combinations that indicate specific political topics
TOPIC_PATTERNS = [
    # Format: (pattern_keywords, en_name, ms_name, description)
    
    # Constitutional & Legal Reform
    (["perlembagaan", "pindaan"], "Constitutional Amendment", "Pindaan Perlembagaan",
     "Debates on constitutional amendments and reforms"),
    (["perlembagaan", "sultan"], "Royal Institution Reform", "Reformasi Institusi Raja",
     "Constitutional issues related to royal institutions"),
    (["akta", "355"], "Act 355 Amendment", "Pindaan Akta 355",
     "Debates on Act 355 (Syariah Courts) amendment"),
    (["undang", "syariah"], "Islamic Law Reform", "Reformasi Undang-undang Islam",
     "Islamic law and Syariah court matters"),
    (["kehakiman", "hakim"], "Judiciary Reform", "Reformasi Kehakiman",
     "Judicial system and judge appointment reforms"),
    (["undang", "pindaan"], "Legal Reform", "Reformasi Undang-undang",
     "Legal amendments and law reform initiatives"),
    (["rang", "undang"], "Legislative Bill", "Rang Undang-undang",
     "Parliamentary bills and legislative proposals"),
    
    # Economic Reform
    (["ekonomi", "digital"], "Digital Economy", "Ekonomi Digital", 
     "Digital economy transformation and e-commerce policies"),
    (["perdagangan", "antarabangsa"], "International Trade", "Perdagangan Antarabangsa",
     "International trade agreements and export-import policies"),
    (["cukai", "pendapatan"], "Income Tax Reform", "Reformasi Cukai Pendapatan",
     "Income tax policies and tax reforms"),
    (["belanjawan", "negara"], "National Budget", "Belanjawan Negara",
     "National budget and fiscal policy debates"),
    (["danaharta", "danamodal"], "Financial Crisis Management", "Pengurusan Krisis Kewangan",
     "Financial crisis response and economic recovery"),
    (["ekonomi", "pemulihan"], "Economic Recovery", "Pemulihan Ekonomi",
     "Economic recovery plans and stimulus packages"),
    (["gst", "cukai"], "GST Policy", "Dasar GST",
     "Goods and Services Tax policy debates"),
    (["subsidi", "rakyat"], "Subsidy Policy", "Dasar Subsidi",
     "Government subsidy programs and reforms"),
    
    # Education Reform
    (["pendidikan", "teknikal"], "Technical Education", "Pendidikan Teknikal",
     "Technical and vocational education policies"),
    (["pelajar", "universiti"], "Higher Education Reform", "Reformasi Pendidikan Tinggi",
     "University and higher education policy reforms"),
    (["ptptn", "pinjaman"], "Education Loan Reform", "Reformasi Pinjaman Pendidikan",
     "PTPTN and education financing reforms"),
    (["biasiswa", "pelajar"], "Scholarship Policy", "Dasar Biasiswa",
     "Scholarship programs and student financial aid"),
    
    # Healthcare Policy
    (["kesihatan", "mental"], "Mental Health Policy", "Dasar Kesihatan Mental",
     "Mental health services and policy reforms"),
    (["hospital", "swasta"], "Private Healthcare", "Penjagaan Kesihatan Swasta",
     "Private healthcare sector regulations"),
    (["covid", "wabak"], "Pandemic Response", "Tindakan Wabak",
     "COVID-19 and pandemic management policies"),
    (["hospital", "pesakit"], "Healthcare Services", "Perkhidmatan Kesihatan",
     "Hospital services and patient care reforms"),
    
    # Infrastructure & Development
    (["jalan", "raya"], "Highway Development", "Pembangunan Jalan Raya",
     "Highway and road infrastructure projects"),
    (["pengangkutan", "awam"], "Public Transport", "Pengangkutan Awam",
     "Public transportation systems and policies"),
    (["pembangunan", "infrastruktur"], "Infrastructure Development", "Pembangunan Infrastruktur",
     "National infrastructure development programs"),
    
    # Social Policy
    (["rakyat", "miskin"], "Poverty Alleviation", "Pembasmian Kemiskinan",
     "Poverty reduction programs and welfare"),
    (["bantuan", "rakyat"], "People's Aid", "Bantuan Rakyat",
     "Social welfare and aid programs for citizens"),
    (["perumahan", "rakyat"], "Affordable Housing", "Perumahan Mampu Milik",
     "Public housing and affordable housing policies"),
    (["kebajikan", "rakyat"], "Social Welfare", "Kebajikan Rakyat",
     "Social welfare programs and citizen wellbeing"),
    
    # Ethnic & Unity
    (["bumiputra", "dasar"], "Bumiputera Policy", "Dasar Bumiputera",
     "Bumiputera affirmative action policies"),
    (["perpaduan", "kaum"], "National Unity", "Perpaduan Kaum",
     "Ethnic unity and racial harmony initiatives"),
    
    # Environment
    (["alam", "sekitar"], "Environmental Policy", "Dasar Alam Sekitar",
     "Environmental protection and conservation"),
    (["hutan", "balak"], "Forestry Reform", "Reformasi Perhutanan",
     "Forestry management and logging policies"),
    
    # Security & Defense
    (["pertahanan", "negara"], "National Defense", "Pertahanan Negara",
     "Defense policy and national security"),
    (["keselamatan", "dalam"], "Internal Security", "Keselamatan Dalam Negeri",
     "Internal security and public safety"),
    
    # Elections & Democracy
    (["pilihan", "raya"], "Electoral Reform", "Reformasi Pilihan Raya",
     "Election system and electoral reforms"),
    (["spr", "persempadanan"], "Constituency Redelineation", "Persempadanan Semula",
     "Electoral boundary redelineation debates"),
    
    # Labor & Employment
    (["pekerja", "gaji"], "Labor Rights", "Hak Pekerja",
     "Workers' rights and wage policies"),
    (["pekerjaan", "pengangguran"], "Employment Policy", "Dasar Pekerjaan",
     "Employment creation and unemployment solutions"),
    
    # Labuan & Offshore Finance
    (["labuan", "iofc"], "Labuan International Offshore Financial Centre", "Pusat Kewangan Antarabangsa Labuan",
     "Labuan IOFC and offshore financial services"),
    (["lofsa", "labuan"], "Labuan Financial Services", "Perkhidmatan Kewangan Labuan",
     "LOFSA and Labuan financial sector"),
    (["pesisir", "labuan"], "Labuan Offshore", "Pesisir Labuan",
     "Labuan offshore and international business"),
    
    # Valuers & Assessors
    (["pentaksir", "penilai"], "Valuers and Assessors Board", "Lembaga Penilai dan Pentaksir",
     "Valuation and property assessors regulation"),
    
    # International Treaties
    (["paris", "convention"], "Paris Convention", "Konvensyen Paris",
     "International intellectual property and treaties"),
    (["nafta", "convention"], "Trade Agreements", "Perjanjian Perdagangan",
     "International trade agreements and conventions"),
    
    # Publications
    (["terbitan", "malaysian"], "Malaysian Investment Publications", "Terbitan Pelaburan Malaysia",
     "Malaysian investment reports and publications"),

    # --- From Topic collection (dummy) ---
    # Cost of Living
    (["kos", "sara", "hidup"], "Cost of Living", "Kos Sara Hidup",
     "Parliamentary debates on cost of living and inflation"),
    (["subsidi", "rahmah"], "Rahmah & Subsidy", "Payung Rahmah dan Subsidi",
     "Subsidy and Rahmah initiative debates"),
    # 1MDB & Debt
    (["1mdb", "hutang"], "1MDB Debt Resolution", "Penyelesaian Hutang 1MDB",
     "1MDB debt settlement and related payments"),
    (["hutang", "pampasan"], "Debt & Compensation", "Hutang dan Pampasan",
     "Debt resolution and compensation matters"),
    # Palestine-Gaza
    (["palestin", "gaza"], "Palestine-Gaza Conflict", "Konflik Palestin-Gaza",
     "Parliamentary debates on Palestine and Gaza conflict"),
    (["israel", "palestin"], "Israel-Palestine", "Israel-Palestin",
     "Israel-Palestine and humanitarian issues"),
    (["kemanusiaan", "gaza"], "Gaza Humanitarian", "Kemanusiaan Gaza",
     "Humanitarian aid and Gaza crisis"),
    # Culture & Heritage
    (["kebudayaan", "warisan"], "Culture and Heritage", "Kebudayaan dan Warisan",
     "Cultural policy and heritage conservation"),
    (["kesenian", "muzium"], "Arts and Museum", "Kesenian dan Muzium",
     "Arts policy and museum affairs"),
    # Parliamentary Reform
    (["reformasi", "parlimen"], "Parliamentary Reform", "Reformasi Parlimen",
     "Parliamentary reform and select committees"),
    (["pac", "jawatankuasa"], "Public Accounts Committee", "Jawatankuasa Kira-kira",
     "PAC and parliamentary committees"),
    # Digital Economy
    (["ekonomi", "digital"], "Digital Economy", "Ekonomi Digital",
     "Digital economy and e-commerce policies"),
    (["fintech", "digital"], "Fintech & Digital", "Fintech dan Digital",
     "Fintech and digital payments"),
    # Foreign Relations
    (["hubungan", "luar"], "Foreign Relations", "Hubungan Luar",
     "Foreign relations and diplomacy"),
    (["asean", "diplomasi"], "ASEAN & Diplomacy", "ASEAN dan Diplomasi",
     "ASEAN and diplomatic relations"),
    # Education Reform
    (["pendidikan", "tvet"], "TVET & Technical Education", "TVET dan Pendidikan Teknikal",
     "Technical and vocational education"),
    (["pppm", "pendidikan"], "Education Development Plan", "Pelan Pembangunan Pendidikan",
     "Education development and curriculum"),
    # Unity & Integration
    (["perpaduan", "kaum"], "National Unity", "Perpaduan Kaum",
     "National unity and ethnic relations"),
    (["integrasi", "harmoni"], "Integration & Harmony", "Integrasi dan Harmoni",
     "Social integration and harmony"),
    # Transport
    (["mrt", "lrt"], "MRT & LRT", "MRT dan LRT",
     "Mass rapid transit and light rail"),
    (["pengangkutan", "awam"], "Public Transport", "Pengangkutan Awam",
     "Public transportation systems"),
    # Social Welfare
    (["kebajikan", "oku"], "Social Welfare & OKU", "Kebajikan dan OKU",
     "Social welfare and persons with disabilities"),
    (["warga emas", "kebajikan"], "Elderly Welfare", "Kebajikan Warga Emas",
     "Elderly and senior citizen welfare"),
    # Energy
    (["tenaga", "boleh baharu"], "Renewable Energy", "Tenaga Boleh Baharu",
     "Renewable energy and solar policy"),
    (["tnb", "elektrik"], "Electricity & TNB", "Elektrik dan TNB",
     "Electricity supply and TNB matters"),
    # Foreign Investment
    (["fdi", "pelaburan"], "Foreign Investment", "Pelaburan Asing",
     "Foreign direct investment and MIDA"),
]


def normalize_keyword(keyword: str) -> str:
    """
    Normalize keyword by removing special characters and converting to lowercase.
    """
    keyword = keyword.lower().strip()
    # Remove punctuation but keep Malay characters
    keyword = re.sub(r'[^\w\s-]', '', keyword)
    return keyword


def match_pattern(keywords: List[str]) -> Tuple[str, str, str]:
    """
    Match keywords against predefined patterns.
    
    Returns:
        Tuple of (name_en, name_ms, description) or None if no match
    """
    normalized = [normalize_keyword(kw) for kw in keywords[:10]]
    
    for pattern_keywords, name_en, name_ms, description in TOPIC_PATTERNS:
        # Check if all pattern keywords are in the top keywords
        matches = sum(1 for pk in pattern_keywords if any(pk in nk for nk in normalized))
        if matches >= len(pattern_keywords):
            return name_en, name_ms, description
    
    return None, None, None


def match_category(keyword: str) -> Dict[str, str]:
    """
    Match a single keyword to a predefined category.
    
    Returns:
        Dictionary with 'en' and 'ms' keys, or None if no match
    """
    normalized = normalize_keyword(keyword)
    
    for cat_keyword, names in TOPIC_CATEGORIES.items():
        if cat_keyword in normalized or normalized in cat_keyword:
            return names
    
    return None


def generate_topic_name_simple(keywords: List[str]) -> Dict[str, str]:
    """
    Generate topic name using simple keyword-based approach.
    Provides fallback when no categories match.
    
    Returns dict with name_en, name_ms, description, label_quality ("low").
    """
    if not keywords or len(keywords) == 0:
        return {
            "name_en": "Parliamentary Affairs",
            "name_ms": "Hal Parlimen",
            "description": "General parliamentary discussions",
            "label_quality": "low",
        }
    
    top_keywords = [kw.title() for kw in keywords[:3] if kw]
    
    if len(top_keywords) == 0:
        return {
            "name_en": "Parliamentary Affairs",
            "name_ms": "Hal Parlimen",
            "description": "General parliamentary discussions",
            "label_quality": "low",
        }
    elif len(top_keywords) == 1:
        name_en = f"{top_keywords[0]} Policy"
        name_ms = f"Dasar {top_keywords[0]}"
    else:
        name_en = f"{top_keywords[0]} Affairs"
        name_ms = f"Hal {top_keywords[0]}"
    
    description = f"Parliamentary debates on {', '.join(keywords[:3]).lower()}"
    
    return {
        "name_en": name_en,
        "name_ms": name_ms,
        "description": description,
        "label_quality": "low",
    }


def generate_topic_name_rule_based(keywords: List[str]) -> Dict[str, str]:
    """
    Generate topic name using rule-based approach with predefined categories.
    
    This is the main function to use for topic generation.
    Filters out years, dates, and person names to focus on political topics.
    
    Args:
        keywords: List of top keywords for this topic cluster (from TF-IDF or similar)
    
    Returns:
        Dictionary with:
            - name_en: English topic name (3-5 words)
            - name_ms: Malay topic name
            - description: One sentence description
    
    Examples:
        >>> generate_topic_name_rule_based(["ekonomi", "perdagangan", "pasaran", "2020"])
        {
            'name_en': 'Economic Policy & Trade',
            'name_ms': 'Dasar Ekonomi & Perdagangan',
            'description': 'Parliamentary debates on economic policy and trade'
        }
    """
    if not keywords or len(keywords) == 0:
        return generate_topic_name_simple(["parliamentary", "affairs"])
    
    # Clean keywords: remove years, dates, person names
    cleaned = clean_keywords(keywords, max_keywords=15)
    
    # If too few cleaned keywords, use fallback
    if len(cleaned) < 2:
        if cleaned:
            return generate_topic_name_simple(cleaned)
        else:
            return {
                "name_en": "Parliamentary Debates",
                "name_ms": "Perbahasan Parlimen",
                "description": "General parliamentary discussions",
                "label_quality": "low",
            }
    
    # Step 1: Try to match against predefined patterns (use cleaned keywords)
    pattern_en, pattern_ms, pattern_desc = match_pattern(cleaned)
    if pattern_en:
        return {
            "name_en": pattern_en,
            "name_ms": pattern_ms,
            "description": pattern_desc,
            "label_quality": "high",
        }
    
    # Step 2: Try to match top cleaned keywords against categories
    matched_categories = []
    for keyword in cleaned[:10]:
        category = match_category(keyword)
        if category and category not in matched_categories:
            matched_categories.append(category)
    
    # Step 3: Generate name from matched categories
    if len(matched_categories) >= 2:
        name_en = " & ".join([cat["en"] for cat in matched_categories[:2]])
        name_ms = " & ".join([cat["ms"] for cat in matched_categories[:2]])
        description = f"Parliamentary debates on {matched_categories[0]['en'].lower()}"
        if len(matched_categories) > 1:
            description += f" and {matched_categories[1]['en'].lower()}"
        return {
            "name_en": name_en,
            "name_ms": name_ms,
            "description": description,
            "label_quality": "high",
        }
    
    elif len(matched_categories) == 1:
        cat = matched_categories[0]
        name_en = cat['en']
        name_ms = cat['ms']
        description = f"Parliamentary debates on {cat['en'].lower()}"
        return {
            "name_en": name_en,
            "name_ms": name_ms,
            "description": description,
            "label_quality": "medium",
        }
    
    # Step 4: Fallback to simple keyword-based naming (use cleaned keywords)
    return generate_topic_name_simple(cleaned)


def batch_generate_topic_names(cluster_topics: Dict[str, List[str]]) -> Dict[str, Dict[str, str]]:
    """
    Generate topic names for multiple clusters.
    
    Args:
        cluster_topics: Dictionary mapping cluster_id to list of keywords
    
    Returns:
        Dictionary mapping cluster_id to topic label (name_en, name_ms, description)
    
    Example:
        >>> cluster_topics = {
        ...     "0": ["ekonomi", "perdagangan", "pasaran"],
        ...     "1": ["pendidikan", "universiti", "pelajar"]
        ... }
        >>> labels = batch_generate_topic_names(cluster_topics)
    """
    topic_labels = {}
    
    for cluster_id, keywords in cluster_topics.items():
        if keywords and len(keywords) > 0:
            topic_labels[cluster_id] = generate_topic_name_rule_based(keywords)
        else:
            # Empty cluster (no keywords from inference)
            topic_labels[cluster_id] = {
                "name_en": f"Cluster {cluster_id}",
                "name_ms": f"Kluster {cluster_id}",
                "description": "Miscellaneous parliamentary debates",
                "label_quality": "low",
            }
    
    return topic_labels


if __name__ == "__main__":
    # Test examples
    test_cases = [
        ["ekonomi", "perdagangan", "pasaran", "bajet"],
        ["pendidikan", "universiti", "pelajar", "sekolah"],
        ["kesihatan", "hospital", "doktor", "ubat"],
        ["infrastruktur", "jalan", "pembangunan", "projek"],
        ["ekonomi", "digital", "teknologi", "internet"],
        ["undang", "undang", "mahkamah", "hakim"],
        ["alam", "sekitar", "hutan", "air"],
        ["kerajaan", "menteri", "dasar", "parlimen"],
        ["random", "words", "not", "in", "dictionary"],
    ]
    
    print("Rule-based Topic Generation Test\n")
    print("=" * 80)
    
    for i, keywords in enumerate(test_cases, 1):
        result = generate_topic_name_rule_based(keywords)
        print(f"\nTest {i}: {', '.join(keywords[:3])}")
        print(f"  English: {result['name_en']}")
        print(f"  Malay:   {result['name_ms']}")
        print(f"  Desc:    {result['description']}")
