// Utility function to remove Malaysian honorifics from names
export const removeHonorifics = (name) => {
  if (!name) return name;
  
  // Common Malaysian honorifics and titles
  const malaysianHonorifics = [
    // Royal titles
    'Yang di-Pertuan Agong', 'Yang Dipertuan Agong', 'YDPA',
    'Sultan', 'Tengku', 'Tunku', 'Raja', 'Dato\' Seri', 'Dato Seri',
    
    // Federal titles
    'Tun', 'Tan Sri', 'Dato\'', 'Dato', 'Datuk', 'Datuk Seri', 'Dato\' Sri', 'Dato Sri',
    
    // Professional titles
    'Dr\\.', 'Dr', 'Prof\\.', 'Prof', 'Professor',
    
    // Religious titles
    'Haji', 'Hajjah', 'Ustaz', 'Ustazah',
    
    // Common titles
    'Mr\\.', 'Mr', 'Mrs\\.', 'Mrs', 'Ms\\.', 'Ms', 'Miss',
    'Sir', 'Madam', 'YB', 'Y\\.B\\.', 'YBhg', 'Y\\.Bhg\\.',
    
    // Military titles
    'Gen\\.', 'General', 'Col\\.', 'Colonel', 'Maj\\.', 'Major',
    'Capt\\.', 'Captain', 'Lt\\.', 'Lieutenant', 'Sgt\\.', 'Sergeant',
    
    // Suffixes
    'Jr\\.', 'Jr', 'Sr\\.', 'Sr', 'III', 'IV', 'V'
  ];
  
  // Create regex pattern that matches honorifics at the beginning or end
  const pattern = new RegExp(
    `^(${malaysianHonorifics.join('|')})\\s+|\\s+(${malaysianHonorifics.join('|')})$|\\b(${malaysianHonorifics.join('|')})\\s+`,
    'gi'
  );
  
  return name.replace(pattern, '').replace(/\s+/g, ' ').trim();
};

// Utility function to format MP display name
export const getMpDisplayName = (mp) => {
  return removeHonorifics(mp.full_name_with_titles || mp.name || 'Unknown MP');
};

/** True if party is historical (unknown); treats HISTORICAL_PARTY / historical_party case-insensitively. */
export const isHistoricalParty = (party) =>
  party != null && String(party).toLowerCase() === 'historical_party';

// Utility function to get MP party information
export const getMpPartyInfo = (mp) => {
  if (isHistoricalParty(mp?.party)) return 'Unknown';
  return mp.party_full_name || mp.party || 'Independent';
};

// Utility function to format constituency name (remove codes)
export const getConstituencyName = (constituency) => {
  if (!constituency) return 'Unknown Constituency';
  return constituency.replace(/^P\d+\s*/, '');
};

/**
 * Display string for constituency on MP cards: includes code (e.g. P020) when available.
 * e.g. "P020 - Kota Bharu" or fallback to raw constituency.
 */
export const getConstituencyDisplay = (mp) => {
  if (!mp) return '';
  const code = mp.constituency_code && String(mp.constituency_code).trim();
  const name = (mp.constituency_name && String(mp.constituency_name).trim()) ||
    (mp.constituency && String(mp.constituency).replace(/^P\d+\s*/, '').trim());
  if (code && name) return `${code} - ${name}`;
  if (code && mp.constituency) return `${code} - ${String(mp.constituency).replace(/^P\d+\s*/, '').trim()}`;
  if (code) return code;
  return (mp.constituency && String(mp.constituency).trim()) || '';
};

/**
 * Display state for an MP. State is stored correctly in DB (use fixInactiveMPStates.js to correct historical data).
 */
export const getDisplayState = (mp) => {
  const raw = mp?.state && String(mp.state).trim();
  return raw || null;
};

/**
 * Standard format for constituency/place name: title case, full stop at end.
 */
export const formatConstituency = (constituency) => {
  if (!constituency || typeof constituency !== 'string') return '';
  const cleaned = constituency.replace(/^[A-Z]?\d+\s*/, '').trim();
  if (!cleaned) return '';
  const toTitleCase = (s) =>
    s
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .replace(/\s+/g, ' ')
      .trim();
  return toTitleCase(cleaned);
};

/**
 * Format address with standard punctuation and capitalization.
 * - Splits on commas/newlines, trims, joins with ", "
 * - Title case per segment (no ALL CAPS): first letter of each word uppercase, rest lowercase
 */
export const formatAddress = (address) => {
  if (!address || typeof address !== 'string') return '';
  const parts = address
    .split(/[\n,;]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return '';
  const toTitleCase = (s) =>
    s
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .replace(/\s+/g, ' ')
      .trim();
  const joined = parts.map(toTitleCase).join(', ');
  return joined ? (joined.endsWith('.') ? joined : `${joined}.`) : '';
};

// Utility function to calculate years of service
export const calculateYearsOfService = (mp) => {
  if (mp.service) return mp.service;
  
  // Try to calculate from parliament term or other data
  const currentYear = new Date().getFullYear();
  const termNumber = parseInt(mp.parliament_term, 10);
  
  if (termNumber) {
    // Approximate calculation (each term is ~5 years, starting from 1955)
    const estimatedStartYear = 1955 + (termNumber - 1) * 5;
    const yearsServed = currentYear - estimatedStartYear;
    return `~${yearsServed} years`;
  }
  
  return 'Unknown';
};
