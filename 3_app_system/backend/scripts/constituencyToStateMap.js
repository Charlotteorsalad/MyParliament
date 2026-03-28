/**
 * Malaysian federal constituency name -> state (Negeri).
 * Keys: normalized (no P-code, lowercase). Used by fixInactiveMPStates.js and can be synced with frontend mpUtils.
 * Also exports STATE_TO_CONSTITUENCIES (state -> list of constituency keys) and getConstituenciesForState(state).
 */
function normalizeForLookup(str) {
  if (!str || typeof str !== 'string') return '';
  return str.replace(/^P\.?\d+\s*/i, '').trim().toLowerCase();
}

const CONSTITUENCY_TO_STATE = {
  // Negeri Sembilan
  'port dickson': 'Negeri Sembilan',
  'telok kemang': 'Negeri Sembilan',
  'seremban': 'Negeri Sembilan',
  'rasah': 'Negeri Sembilan',
  'rembau': 'Negeri Sembilan',
  'tampin': 'Negeri Sembilan',
  'jelebu': 'Negeri Sembilan',
  'jempol': 'Negeri Sembilan',
  'kuala pilah': 'Negeri Sembilan',
  'simpang empat': 'Negeri Sembilan',
  'gemas': 'Negeri Sembilan',
  // Sabah
  'kimanis': 'Sabah',
  'bandau': 'Sabah',
  'kota kinabalu': 'Sabah',
  'penampang': 'Sabah',
  'tuaran': 'Sabah',
  'kota marudu': 'Sabah',
  'kudat': 'Sabah',
  'pitas': 'Sabah',
  'sandakan': 'Sabah',
  'libaran': 'Sabah',
  'batu sapi': 'Sabah',
  'sepanggar': 'Sabah',
  'ranau': 'Sabah',
  'keningau': 'Sabah',
  'tenom': 'Sabah',
  'pensiangan': 'Sabah',
  'beluran': 'Sabah',
  'libaran': 'Sabah',
  'batu sapi': 'Sabah',
  'lahad datu': 'Sabah',
  'semporna': 'Sabah',
  'tawau': 'Sabah',
  'kalabakan': 'Sabah',
  // Kelantan
  'ketereh': 'Kelantan',
  'pengkalan chepa': 'Kelantan',
  'kota bharu': 'Kelantan',
  'pasir mas': 'Kelantan',
  'pasir puteh': 'Kelantan',
  'bachok': 'Kelantan',
  'tanah merah': 'Kelantan',
  'machang': 'Kelantan',
  'jeli': 'Kelantan',
  'kuala krai': 'Kelantan',
  'gu musang': 'Kelantan',
  'tumpat': 'Kelantan',
  'kubang kerian': 'Kelantan',
  'rantau panjang': 'Kelantan',
  // Johor
  'sri gading': 'Johor',
  'paloh': 'Johor',
  'johor bahru': 'Johor',
  'pasir gudang': 'Johor',
  'tebrau': 'Johor',
  'pulai': 'Johor',
  'iskandar puteri': 'Johor',
  'kulai': 'Johor',
  'pontian': 'Johor',
  'tanjung piai': 'Johor',
  'gelang patah': 'Johor',
  'kota tinggi': 'Johor',
  'pengerang': 'Johor',
  'tebrau': 'Johor',
  'segamat': 'Johor',
  'sekijang': 'Johor',
  'labis': 'Johor',
  'pagoh': 'Johor',
  'ledang': 'Johor',
  'bakri': 'Johor',
  'muar': 'Johor',
  'parit sulong': 'Johor',
  'ayer hitam': 'Johor',
  'simpang renggam': 'Johor',
  'kluang': 'Johor',
  'sembrong': 'Johor',
  'mersing': 'Johor',
  'tenggara': 'Johor',
  // Sarawak
  'kuala rajang': 'Sarawak',
  'kanowit': 'Sarawak',
  'sarawak': 'Sarawak',
  'mas gading': 'Sarawak',
  'santubong': 'Sarawak',
  'petra jaya': 'Sarawak',
  'bandar kuching': 'Sarawak',
  'stampin': 'Sarawak',
  'kota samarahan': 'Sarawak',
  'puncak borneo': 'Sarawak',
  'serian': 'Sarawak',
  'batang sadong': 'Sarawak',
  'batang lupar': 'Sarawak',
  'sri aman': 'Sarawak',
  'lubok antu': 'Sarawak',
  'betong': 'Sarawak',
  'saratok': 'Sarawak',
  'tanjong manis': 'Sarawak',
  'igan': 'Sarawak',
  'sarikei': 'Sarawak',
  'julau': 'Sarawak',
  'lanang': 'Sarawak',
  'sibu': 'Sarawak',
  'mukah': 'Sarawak',
  'dalat': 'Sarawak',
  'bintulu': 'Sarawak',
  'sibuti': 'Sarawak',
  'miri': 'Sarawak',
  'baram': 'Sarawak',
  'limbang': 'Sarawak',
  'lawas': 'Sarawak',
  // Perlis
  'arau': 'Perlis',
  'kangar': 'Perlis',
  // Kedah
  'jerlun': 'Kedah',
  'alor setar': 'Kedah',
  'kubang pasu': 'Kedah',
  'padang terap': 'Kedah',
  'pokok sena': 'Kedah',
  'langkawi': 'Kedah',
  'jerai': 'Kedah',
  'sungai petani': 'Kedah',
  'baling': 'Kedah',
  'padang serai': 'Kedah',
  'kulim-bandar baharu': 'Kedah',
  'merbok': 'Kedah',
  'sik': 'Kedah',
  // Pulau Pinang
  'kepala batas': 'Pulau Pinang',
  'tasek gelugor': 'Pulau Pinang',
  'bagan': 'Pulau Pinang',
  'permatang pauh': 'Pulau Pinang',
  'bukit mertajam': 'Pulau Pinang',
  'batu kawan': 'Pulau Pinang',
  'nibong tebal': 'Pulau Pinang',
  'bukit bendera': 'Pulau Pinang',
  'tanjong': 'Pulau Pinang',
  'jelutong': 'Pulau Pinang',
  'bukit gelugor': 'Pulau Pinang',
  'bayan barat': 'Pulau Pinang',
  'balik pulau': 'Pulau Pinang',
  // Perak
  'gerik': 'Perak',
  'lenggong': 'Perak',
  'larut': 'Perak',
  'parit buntar': 'Perak',
  'bagan serai': 'Perak',
  'bukit gantang': 'Perak',
  'taiping': 'Perak',
  'padang rengas': 'Perak',
  'sungai siput': 'Perak',
  'tambun': 'Perak',
  'ipoh timur': 'Perak',
  'ipoh barat': 'Perak',
  'batu gajah': 'Perak',
  'kuala kangsar': 'Perak',
  'beruas': 'Perak',
  'parit': 'Perak',
  'kampar': 'Perak',
  'gopeng': 'Perak',
  'tapah': 'Perak',
  'pasir salak': 'Perak',
  'lumut': 'Perak',
  'bagan datuk': 'Perak',
  'teluk intan': 'Perak',
  'tanjong malim': 'Perak',
  // Pahang
  'cameron highlands': 'Pahang',
  'lipis': 'Pahang',
  'raub': 'Pahang',
  'jerantut': 'Pahang',
  'indera mahkota': 'Pahang',
  'kuantan': 'Pahang',
  'paya besar': 'Pahang',
  'pekan': 'Pahang',
  'rompin': 'Pahang',
  'bentong': 'Pahang',
  'bera': 'Pahang',
  'temerloh': 'Pahang',
  'maran': 'Pahang',
  'kuala krau': 'Pahang',
  // Terengganu
  'besut': 'Terengganu',
  'setiu': 'Terengganu',
  'kuala nerus': 'Terengganu',
  'kuala terengganu': 'Terengganu',
  'marang': 'Terengganu',
  'hulu terengganu': 'Terengganu',
  'dungun': 'Terengganu',
  'kemaman': 'Terengganu',
  // Selangor
  'sabak bernam': 'Selangor',
  'sungai besar': 'Selangor',
  'hulu selangor': 'Selangor',
  'tanjong karang': 'Selangor',
  'kuala selangor': 'Selangor',
  'selayang': 'Selangor',
  'gombak': 'Selangor',
  'ampang': 'Selangor',
  'pandan': 'Selangor',
  'hulu langat': 'Selangor',
  'bangi': 'Selangor',
  'puchong': 'Selangor',
  'subang': 'Selangor',
  'petaling jaya': 'Selangor',
  'damansara': 'Selangor',
  'sungai buloh': 'Selangor',
  'shah alam': 'Selangor',
  'kapar': 'Selangor',
  'klang': 'Selangor',
  'kota raja': 'Selangor',
  'kuala langat': 'Selangor',
  'sepang': 'Selangor',
  // WP Kuala Lumpur (state label: Kuala Lumpur)
  'kepong': 'Kuala Lumpur',
  'batu': 'Kuala Lumpur',
  'wangsa maju': 'Kuala Lumpur',
  'segambut': 'Kuala Lumpur',
  'setiawangsa': 'Kuala Lumpur',
  'titiwangsa': 'Kuala Lumpur',
  'bukit bintang': 'Kuala Lumpur',
  'lembah pantai': 'Kuala Lumpur',
  'seputeh': 'Kuala Lumpur',
  'cheras': 'Kuala Lumpur',
  'bandar tun razak': 'Kuala Lumpur',
  // WP Putrajaya
  'putrajaya': 'Putrajaya',
  // WP Labuan
  'labuan': 'Labuan',
  // Melaka
  'masjid tanah': 'Melaka',
  'alor gajah': 'Melaka',
  'tangga batu': 'Melaka',
  'hang tuah jaya': 'Melaka',
  'kota melaka': 'Melaka',
  'jasin': 'Melaka',
  'melaka utara': 'Melaka',
  'melaka tengah': 'Melaka',
  'melaka selatan': 'Melaka',
};

function getStateFromConstituency(constituency) {
  const key = normalizeForLookup(constituency);
  return key ? (CONSTITUENCY_TO_STATE[key] || null) : null;
}

function isStateActuallyConstituency(stateStr) {
  const key = normalizeForLookup(stateStr);
  return key ? !!CONSTITUENCY_TO_STATE[key] : false;
}

/** State -> list of normalized constituency keys (derived from CONSTITUENCY_TO_STATE). */
function buildStateToConstituencies() {
  const byState = {};
  for (const [constituency, state] of Object.entries(CONSTITUENCY_TO_STATE)) {
    if (!byState[state]) byState[state] = [];
    byState[state].push(constituency);
  }
  return byState;
}

const STATE_TO_CONSTITUENCIES = buildStateToConstituencies();

/**
 * @param {string} state - State name (e.g. 'Pulau Pinang', 'Wilayah Persekutuan').
 * @returns {string[]} Normalized constituency keys in that state, or [] if unknown.
 */
function getConstituenciesForState(state) {
  if (!state || typeof state !== 'string') return [];
  const key = state.trim();
  return STATE_TO_CONSTITUENCIES[key] || [];
}

module.exports = {
  normalizeForLookup,
  CONSTITUENCY_TO_STATE,
  STATE_TO_CONSTITUENCIES,
  getStateFromConstituency,
  isStateActuallyConstituency,
  getConstituenciesForState,
};
