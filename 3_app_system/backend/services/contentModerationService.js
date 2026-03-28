/**
 * Calls Python zero-shot XLM-RoBERTa moderation service (EN + Malay).
 * On flag: updates ForumPost/ForumTopic moderationFlags and creates AdminNotification.
 *
 * Keyword blocklist runs first as a deterministic safety net for phrases the ML model
 * may miss (especially Malay slang, threats, and death-wish content).
 */
const ForumPost = require('../models/ForumPost');
const ForumTopic = require('../models/ForumTopic');
const AdminNotification = require('../models/AdminNotification');

const MODERATION_SERVICE_URL = process.env.MODERATION_SERVICE_URL || 'http://127.0.0.1:5001';
const timeout = parseInt(process.env.MODERATION_TIMEOUT_MS, 10) || 5000;

// ---------------------------------------------------------------------------
// Keyword / phrase blocklist (EN + Malay)
// Each entry is lowercased; the check normalises input to lowercase before matching.
// ---------------------------------------------------------------------------
const KEYWORD_BLOCKLIST = [

  // ════════════════════════════════════════════════════════════════════════
  // MALAY — DEATH THREATS & DEATH WISHES
  // ════════════════════════════════════════════════════════════════════════
  'pergi mati', 'pegi mati', 'gi mati', 'g mati', 'p mati',
  'mati kau', 'mati la kau', 'mati lah', 'mati je la', 'mati jelah',
  'mati la bodoh', 'mati la babi', 'mati la sial', 'mati kau sial',
  'harap kau mati', 'semoga kau mati', 'diharap kau mati',
  'cepat mati', 'baik kau mati', 'baik mati', 'elok kau mati',
  'patut mati', 'padan muka mati', 'sepatutnya mati',
  'elok mati je', 'mati jelah kau', 'kau baik mati',
  'hidup pun tak guna baik mati', 'lebih baik mati',
  'mati la weii', 'mati la wei', 'mati la weh',
  'harap mati', 'doakan kau mati', 'aku doakan kau mati',
  'semoga cepat mati', 'berharap kau mati', 'mati cepat',
  'mati la kepala hotak', 'mati la bodoh sial',

  // ════════════════════════════════════════════════════════════════════════
  // MALAY — MAMPOS / MAMPUS VARIANTS
  // ════════════════════════════════════════════════════════════════════════
  'pegi mampos', 'pergi mampos', 'gi mampos', 'mampos kau',
  'mampos la', 'mampos je', 'mampos lah', 'mampos weii', 'mampos weh',
  'cepat mampos', 'baik mampos', 'elok mampos',
  'pi mampus', 'pergi mampus', 'mampus kau', 'mampus la', 'mampus lah',
  'cepat mampus', 'baik mampus', 'harap mampus', 'semoga mampus',
  'mampus je la kau', 'mampus la bodoh',

  // ════════════════════════════════════════════════════════════════════════
  // MALAY — JAHANAM / NERAKA
  // ════════════════════════════════════════════════════════════════════════
  'pergi jahanam', 'pegi jahanam', 'jahanam kau', 'jahanam la',
  'jahanam betul', 'celaka jahanam', 'pergi ke jahanam',
  'masuk neraka', 'masuk neraka kau', 'kau akan masuk neraka',
  'pergi neraka', 'neraka kau', 'baik masuk neraka',
  'neraka la kau', 'kau punya tempat neraka',
  'laknat kau', 'dilaknat', 'kau dilaknat', 'terkutuk',
  'kau terkutuk', 'dasar terkutuk', 'kepala terkutuk',

  // ════════════════════════════════════════════════════════════════════════
  // MALAY — VIOLENCE / PHYSICAL THREATS
  // ════════════════════════════════════════════════════════════════════════
  'bunuh diri', 'bunuh kau', 'aku bunuh', 'akan bunuh', 'nak bunuh',
  'mau bunuh', 'akan ku bunuh', 'aku akan bunuh kau',
  'nak tikam', 'akan tikam', 'aku tikam', 'kau kena tikam',
  'nak tembak', 'akan tembak', 'aku tembak', 'kena tembak',
  'nak penggal', 'nak libas', 'nak tetak', 'nak cincang',
  'nak tampar', 'nak belasah', 'nak hentam', 'nak blasah',
  'nak pukul', 'pukul sampai mati', 'nak pukul sampai mati',
  'nak lanyak', 'nak penampar', 'nak sepak',
  'aku nak habiskan kau', 'aku akan habiskan kau', 'nak habiskan kau',
  'tunggu aku jumpa kau', 'aku carik kau', 'aku akan cari kau',
  'aku tahu rumah kau', 'aku tahu mana kau tinggal',
  'tunggu la kau', 'aku tunggu kau', 'kau tunggu je',
  'bakar rumah', 'nak bakar', 'akan bakar', 'aku bakar',
  'bakar je', 'bakar rumah kau', 'nak bakar rumah',
  'nak rompak', 'nak rogol', 'akan rogol', 'aku rogol',
  'nak kacau keluarga kau', 'aku ganggu keluarga kau',

  // ════════════════════════════════════════════════════════════════════════
  // MALAY — SEXUAL PROFANITY
  // ════════════════════════════════════════════════════════════════════════
  'pukimak', 'puki mak', 'pukimak kau', 'pukimak hang', 'pukimak dia',
  'pukimak betul', 'pukimak sial', 'pukimak celaka',
  'puki', 'puki kau', 'puki hang', 'puki betul',
  'buto', 'butoh', 'butoh kau', 'butoh hang', 'kepala butoh',
  'lancau', 'lancau kau', 'lancau hang', 'lancau betul',
  'kepala lancau', 'dasar lancau', 'muka lancau',
  'kontol', 'kontol kau', 'pantat', 'pantat kau', 'pantat hang',
  'jubur', 'jubur kau', 'cipap', 'cipap kau',
  'hisap lancau', 'hisap butoh', 'hisap puki',
  'meliwat', 'liwat kau', 'liwat dia', 'akan liwat',
  'setubuh', 'berzina', 'pelacur jalang', 'sundal jalang',
  'perempuan sundal', 'perempuan jalang', 'perempuan murahan',

  // ════════════════════════════════════════════════════════════════════════
  // MALAY — GENERAL SEVERE INSULTS
  // ════════════════════════════════════════════════════════════════════════
  // celaka
  'celaka', 'celaka kau', 'celaka punya', 'celaka betul', 'celaka la',
  'celake', 'celake kau', 'celake betul', 'dasar celaka', 'memang celaka',
  // sial
  'sial', 'sial kau', 'sial betul', 'memang sial', 'dasar sial',
  'sial punye', 'sial punya', 'muka sial', 'hidup sial',
  // babi
  'babi', 'babi kau', 'babi betul', 'babi punya', 'babi punye',
  'muka babi', 'dasar babi', 'memang babi', 'otak babi',
  'macam babi', 'perangai babi', 'kerja macam babi',
  // anjing
  'anjing', 'anjing kau', 'anjing betul', 'anjing punya', 'anjing punye',
  'muka anjing', 'dasar anjing', 'memang anjing', 'otak anjing',
  'macam anjing', 'perangai anjing', 'anak anjing',
  // bangsat / bajingan
  'bangsat', 'bangsat kau', 'bangsat betul', 'dasar bangsat',
  'bajingan', 'bajingan kau', 'dasar bajingan',
  // kurang ajar
  'kurang ajar', 'tak tahu ajar', 'tak tau ajar', 'memang kurang ajar',
  'kurang ajar betul', 'dasar kurang ajar',
  // haram jadah / anak haram
  'haram jadah', 'anak haram', 'anak sundal', 'anak pelacur',
  'anak babi', 'anak anjing', 'anak celaka', 'anak sial',
  'anak haram jadah', 'dasar anak haram',
  // kepala
  'kepala bapak', 'kepala bapak kau', 'kepala hotak kau',
  'kepala sial', 'kepala butoh', 'kepala lancau', 'kepala babi',
  'kepala anjing', 'kepala puki', 'kepala otak',
  // bodoh variants
  'bodoh', 'bodoh kau', 'bodoh sial', 'bodoh gila', 'bodoh bangsat',
  'bodoh piang', 'bodoh betul', 'memang bodoh', 'dasar bodoh',
  'bodoh la kau', 'kau memang bodoh', 'otak bodoh',
  // bangang / dungu
  'bangang', 'bangang betul', 'bangang kau', 'dasar bangang',
  'dungu', 'dungu kau', 'dungu betul', 'dasar dungu',
  'bongok', 'bongok kau', 'bongok betul',
  'bebal', 'bengap', 'bengong', 'bahlul', 'bahlul kau',
  // gila
  'gila babi', 'gila sial', 'gila celaka', 'gila anjing',
  'gila betul', 'gila kau', 'memang gila', 'otak gila',
  // hampeh / hampas
  'hampeh', 'hampeh kau', 'hampeh betul', 'memang hampeh',
  'hampas', 'hampas betul', 'dasar hampas',
  // samseng / keldai
  'samseng', 'keldai', 'keldai kau', 'macam keldai',
  // pengecut / bacul
  'pengecut', 'pengecut kau', 'bacul', 'bacul kau', 'pondan',
  'pondan kau', 'bapok', 'bapok kau', 'pondan sial',
  // pelacur / sundal
  'pelacur', 'sundal', 'murahan', 'jalang',
  'laki jalang', 'perempuan jalang',
  // lain-lain
  'pemalas', 'sampah masyarakat', 'sampah', 'taik', 'taik kau',
  'taik ayam', 'makan taik', 'makan taik kau', 'pergi makan taik',
  'ludah kau', 'aku ludah', 'tak guna', 'tak guna langsung',
  'memang tak guna', 'tiada nilai', 'takde guna',

  // ════════════════════════════════════════════════════════════════════════
  // MALAY — RACIAL HATE SPEECH
  // ════════════════════════════════════════════════════════════════════════
  'cina babi', 'cina celaka', 'cina sial', 'cina balik cina',
  'cina pendatang', 'cina haram', 'cina anjing', 'cina bangsat',
  'usir cina', 'halau cina', 'cina balik tongsan',
  'india babi', 'india celaka', 'india sial', 'india hitam',
  'india anjing', 'india bangsat', 'keling', 'keling babi',
  'keling celaka', 'keling sial', 'keling anjing',
  'melayu bodoh', 'melayu malas', 'melayu babi', 'melayu celaka',
  'melayu sial', 'melayu anjing', 'melayu tak guna',
  'bumiputera babi', 'bumiputera celaka', 'bumiputera bodoh',
  'pendatang haram', 'halau pendatang', 'usir pendatang',
  'orang asing celaka', 'bangsa rendah', 'ras rendah',
  'bangsa hina', 'keturunan hina', 'darah kotor',

  // ════════════════════════════════════════════════════════════════════════
  // MALAY — RELIGIOUS HATE SPEECH
  // ════════════════════════════════════════════════════════════════════════
  'kafir celaka', 'kafir laknat', 'bunuh kafir', 'orang kafir',
  'anjing kafir', 'darah kafir', 'kafir babi', 'kafir sial',
  'kafir haram', 'usir kafir', 'halau kafir',
  'kristian celaka', 'kristian babi', 'kristian sial',
  'buddha celaka', 'hindu celaka', 'hindu babi',
  'islam celaka', 'islam babi', 'hina islam', 'islam sesat',
  'hina agama', 'agama syaitan', 'agama babi', 'agama celaka',
  'tuhan palsu', 'sembah syaitan', 'agama palsu',
  'murtad celaka', 'murtad babi', 'murtad sial',
  'bunuh murtad', 'penista agama',

  // ════════════════════════════════════════════════════════════════════════
  // MALAY — POLITICAL HATE / DEATH WISHES TO PUBLIC FIGURES
  // ════════════════════════════════════════════════════════════════════════
  'pergi mati perdana menteri', 'mati la pm', 'pm bodoh',
  'menteri celaka', 'menteri babi', 'menteri bangsat',
  'pemimpin celaka', 'pemimpin babi', 'pemimpin bangsat',
  'politikus celaka', 'ahli parlimen celaka', 'ahli parlimen babi',
  'kerajaan celaka', 'kerajaan babi', 'kerajaan bangsat',
  'bunuh pemimpin', 'bunuh menteri', 'bunuh pm',

  // ════════════════════════════════════════════════════════════════════════
  // MALAY — CYBERBULLYING / HUMILIATION
  // ════════════════════════════════════════════════════════════════════════
  'kau tak layak hidup', 'tak layak hidup', 'tak guna langsung',
  'tiada guna kau', 'kau memang tak berguna', 'hidup pun tak guna',
  'semua orang benci kau', 'tak ada orang suka kau',
  'tiada siapa sayang kau', 'tak ada orang nak kau',
  'kau patut dihina', 'kau memang hina', 'hidup hina',
  'muka kau menjijikkan', 'kau menjijikkan', 'kau meluat',
  'kau patut malu', 'kau aib', 'kau memalukan',
  'bodoh macam keldai', 'otak kosong', 'otak letak tepi',
  'otak letak kat lutut', 'perangai macam binatang',
  'kau bukan manusia', 'macam haiwan', 'kelakuan macam haiwan',
  'kau paling bodoh', 'kau paling hina', 'kau paling sial',
  'kau tak perlu ada', 'dunia tak perlukan kau',
  'hilang je la kau', 'lesap je la kau',

  // ════════════════════════════════════════════════════════════════════════
  // MANGLISH / INTERNET SLANG VARIANTS
  // ════════════════════════════════════════════════════════════════════════
  'wtf la', 'wtf kau', 'bodoh la kau', 'stupid la kau',
  'sial la kau', 'babi la kau', 'anjing la kau',
  'f kau', 'f u la', 'bodoh sgt', 'bodo gile', 'bodo sial',
  'mmg sial', 'mmg babi', 'mmg bodoh', 'mmg celaka',
  'mmg bangang', 'mmg anjing', 'mmg bangsat',
  'ko ni bodoh', 'ko ni babi', 'ko ni sial', 'ko ni celaka',
  'hang ni bodoh', 'hang ni babi', 'hang ni sial',
  'lu bodoh', 'lu sial', 'lu babi', 'lu celaka', 'lu bangang',
  'gua bunuh lu', 'gua nak bunuh lu',

  // ════════════════════════════════════════════════════════════════════════
  // ENGLISH — DEATH THREATS / WISHES
  // ════════════════════════════════════════════════════════════════════════
  'go die', 'go kill yourself', 'kill yourself', 'kys',
  'i will kill you', "i'll kill you", 'gonna kill you', 'im gonna kill',
  'hope you die', 'you should die', 'drop dead', 'die already', 'just die',
  'i want you dead', 'you deserve to die', 'should be dead',
  'end your life', 'take your own life', 'nobody would miss you',
  'the world is better without you', 'do everyone a favour and die',

  // ════════════════════════════════════════════════════════════════════════
  // ENGLISH — SEVERE PROFANITY / HATE
  // ════════════════════════════════════════════════════════════════════════
  'stupid bitch', 'dumb bitch', 'fucking idiot', 'piece of shit',
  'worthless piece', 'go to hell', 'burn in hell',
  'you are worthless', 'nobody wants you', 'everyone hates you',
  'you are nothing', 'you are garbage', 'you are trash',
  'rot in hell', 'get lost and die',
];

/**
 * Fast deterministic keyword check — runs before the ML model.
 * Returns a moderation result object if a blocked phrase is found, else null.
 */
function checkKeywords(text) {
  if (!text || typeof text !== 'string') return null;
  const normalised = text.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
  for (const phrase of KEYWORD_BLOCKLIST) {
    if (normalised.includes(phrase)) {
      return {
        flagged: true,
        label: 'hate_speech',
        score: 1.0,
        reason: `Auto-flagged: blocked phrase detected — "${phrase}"`
      };
    }
  }
  return null;
}

async function checkContent(text) {
  console.log('[checkContent] Starting check, text length:', text?.length);
  if (!text || typeof text !== 'string') {
    console.log('[checkContent] No valid text provided');
    return { flagged: false };
  }

  // Keyword blocklist check (fast, deterministic, runs before ML model)
  const keywordResult = checkKeywords(text);
  if (keywordResult) {
    console.log('[checkContent] Keyword blocklist matched:', keywordResult.reason);
    return keywordResult;
  }

  try {
    console.log('[checkContent] Calling Python service at:', MODERATION_SERVICE_URL, 'timeout:', timeout);
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    const res = await fetch(`${MODERATION_SERVICE_URL}/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text.trim().slice(0, 5000) }),
      signal: controller.signal
    });
    clearTimeout(id);
    console.log('[checkContent] Response status:', res.status);
    const data = await res.json().catch(() => ({}));
    console.log('[checkContent] Response data:', JSON.stringify(data));
    const result = {
      flagged: !!data.flagged,
      label: data.label || 'other',
      score: typeof data.score === 'number' ? data.score : 0,
      reason: data.reason || ''
    };
    console.log('[checkContent] Final result:', JSON.stringify(result));
    return result;
  } catch (err) {
    console.error('[checkContent] ERROR calling moderation service:', err.message);
    console.error('[checkContent] Error type:', err.name);
    console.error('[checkContent] Full error:', err);
    return { flagged: false };
  }
}

function mapLabelToSensitiveType(label) {
  const m = {
    profanity: 'profanity',
    hate_speech: 'hate_speech',
    inappropriate: 'inappropriate',
    offensive: 'inappropriate',
    toxic: 'profanity',
    spam: 'spam'
  };
  return m[label] || 'other';
}

/**
 * Check text with moderation service; if flagged, update post and notify admin.
 * Call this asynchronously after createPost/replyToPost (do not await in request path).
 */
async function checkAndFlagPost(postId, content) {
  const result = await checkContent(content);
  if (!result.flagged) return;

  const post = await ForumPost.findById(postId).populate('topic', 'title').populate('author', 'username');
  if (!post) return;

  // Post is already active, mark it as flagged for bad content
  // Post stays active but gets flagged marker for admin review
  post.moderationFlags.isFlagged = true;
  post.moderationFlags.hasSensitiveContent = true;
  post.moderationFlags.sensitiveContentType = mapLabelToSensitiveType(result.label);
  post.moderationFlags.flaggedBy.push({
    user: null,
    reason: result.reason || `Auto-flagged: ${result.label}`,
    flaggedAt: new Date()
  });
  // Keep status as active (post remains visible, but flagged for admin review)
  // Admin will see it's flagged and can approve (review ok) or restrict
  await post.save();

  const isReply = !!post.parentPost;
  const title = isReply ? 'Forum reply auto-flagged' : 'Forum post auto-flagged';
  const message = isReply
    ? `A reply was auto-flagged (${result.label}). Author: ${(post.author && post.author.username) || 'Unknown'}. Reason: ${result.reason}`
    : `A post was auto-flagged (${result.label}). Topic: ${(post.topic && post.topic.title) || 'Unknown'}. Author: ${(post.author && post.author.username) || 'Unknown'}. Reason: ${result.reason}`;

  await AdminNotification.create({
    type: isReply ? 'forum_flagged_reply' : 'forum_flagged',
    title,
    message,
    link: `/admin/forum-moderation#flagged`,
    meta: {
      postId: post._id,
      topicId: post.topic && post.topic._id,
      authorId: post.author && post.author._id,
      reason: result.reason,
      label: result.label
    }
  });
}

/**
 * Check topic (title + description) and flag if bad content detected.
 */
async function checkAndFlagTopic(topicId, textToCheck) {
  console.log('[checkAndFlagTopic] Starting check for topic:', topicId);
  const result = await checkContent(textToCheck);
  console.log('[checkAndFlagTopic] Moderation result:', JSON.stringify(result));
  
  if (!result.flagged) {
    console.log('[checkAndFlagTopic] Content NOT flagged, skipping');
    return;
  }

  console.log('[checkAndFlagTopic] Content IS FLAGGED, updating topic...');
  const topic = await ForumTopic.findById(topicId).populate('author', 'username');
  if (!topic) {
    console.log('[checkAndFlagTopic] Topic not found:', topicId);
    return;
  }

  topic.moderationFlags.isFlagged = true;
  topic.moderationFlags.hasSensitiveContent = true;
  topic.moderationFlags.sensitiveContentType = mapLabelToSensitiveType(result.label);
  topic.moderationFlags.flaggedBy.push({
    user: null,
    reason: result.reason || `Auto-flagged: ${result.label}`,
    flaggedAt: new Date()
  });
  topic.status = 'flagged';
  await topic.save();
  console.log('[checkAndFlagTopic] Topic updated and saved');

  const title = 'Forum topic auto-flagged';
  const message = `A topic was auto-flagged (${result.label}). Topic: "${topic.title}". Author: ${(topic.author && topic.author.username) || 'Unknown'}. Reason: ${result.reason}`;

  await AdminNotification.create({
    type: 'forum_flagged',
    title,
    message,
    link: `/admin/forum-moderation#flagged`,
    meta: {
      topicId: topic._id,
      authorId: topic.author && topic.author._id,
      reason: result.reason,
      label: result.label
    }
  });
  console.log('[checkAndFlagTopic] Admin notification created');
}

module.exports = {
  checkContent,
  checkKeywords,
  checkAndFlagPost,
  checkAndFlagTopic
};
