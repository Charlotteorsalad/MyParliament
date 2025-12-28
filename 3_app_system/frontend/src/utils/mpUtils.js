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

// Utility function to get MP party information
export const getMpPartyInfo = (mp) => {
  if (mp.party === 'historical_party') return 'Unknown Party';
  return mp.party_full_name || mp.party || 'Independent';
};

// Utility function to format constituency name (remove codes)
export const getConstituencyName = (constituency) => {
  if (!constituency) return 'Unknown Constituency';
  return constituency.replace(/^P\d+\s*/, '');
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
