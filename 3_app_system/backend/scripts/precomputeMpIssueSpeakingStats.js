/**
 * Precompute MP speaking stats from Issue Portal (Topic) timeline data.
 *
 * Metrics computed per MP (across ALL Topic documents of the default pipeline):
 *
 *   responseRate    — reply / total turns × 100
 *   askRate         — ask   / total turns × 100
 *   escalateRate    — escalate / total turns × 100
 *   interjectionRate— interjection / total turns × 100
 *   sentimentScore  — average of all numeric `sentiment` values in that MP's turns
 *
 * All four rates share the same denominator (total turns = ask + reply + escalate + interjection).
 * The four rates therefore sum to 100 for any MP with at least one turn.
 *
 * Writes to: MP.performance.{responseRate, askRate, escalateRate, interjectionRate, sentimentScore}
 * Also records: MP.performance.speakingStatsComputedAt
 *
 * Usage:
 *   node scripts/precomputeMpIssueSpeakingStats.js                         # default pipeline, skip already done
 *   node scripts/precomputeMpIssueSpeakingStats.js --force                 # overwrite all
 *   node scripts/precomputeMpIssueSpeakingStats.js --pipeline pipeline3    # specific pipeline
 *   node scripts/precomputeMpIssueSpeakingStats.js --limit=5               # first 5 MPs (test)
 *   node scripts/precomputeMpIssueSpeakingStats.js --mp "Steven Sim"       # single MP by name
 *
 * Requires: MONGO_URI in backend/.env
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

const CACHE_COLLECTION = 'Topic';
const MP_COLLECTION    = 'MP';

// ---------------------------------------------------------------------------
// Build name-variant lookup from MP document
// ---------------------------------------------------------------------------
function buildNameVariants(mp) {
  const raw = [
    mp.name,
    mp.full_name_with_titles,
    ...(mp.original_name_variations || []),
  ];
  return [...new Set(raw.map(n => (n || '').trim()).filter(n => n.length >= 2))];
}

// ---------------------------------------------------------------------------
// Normalise a speaker name from timeline (strip "YB", "Tuan", "Puan", etc.)
// ---------------------------------------------------------------------------
function normalise(name) {
  if (!name) return '';
  return name
    .replace(/\b(Yang\s+Berhormat|YB|Tuan|Puan|Dato'?|Datuk|Dr\.?|Tan\s+Sri)\s+/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// ---------------------------------------------------------------------------
// Check whether a timeline turn belongs to this MP using fuzzy name matching
// ---------------------------------------------------------------------------
function belongsToMp(turnMpName, nameVariants, normVariants) {
  if (!turnMpName) return false;
  const normTurn = normalise(turnMpName);
  // Exact / normalised match
  if (normVariants.some(v => normTurn === v || normTurn.includes(v) || v.includes(normTurn))) return true;
  // Raw substring match (fallback)
  const rawTurn = turnMpName.trim().toLowerCase();
  return nameVariants.some(v => rawTurn.includes(v.toLowerCase()) || v.toLowerCase().includes(rawTurn));
}

// ---------------------------------------------------------------------------
// Process one MP — aggregate action_type counts and sentiment from timeline
// ---------------------------------------------------------------------------
async function processOneMp(db, mp, pipelineId, index, total) {
  const label = `[${index + 1}/${total}] ${mp.name || mp._id}`;
  const nameVariants = buildNameVariants(mp);
  if (nameVariants.length === 0) {
    console.log(`${label} → skip (no name)`);
    return { ok: 0, skipped: 1 };
  }

  const normVariants = nameVariants.map(normalise).filter(v => v.length >= 2);

  // Pull timeline entries that match this MP's name from all issues of the pipeline.
  // Include issue-level fields so we can also build recentStatements in the same pass.
  const titleVariants = nameVariants.concat(
    nameVariants.map(v => v.replace(/\b(Yang\s+Berhormat|YB|Tuan|Puan|Dato'?|Datuk|Dr\.?|Tan\s+Sri)\s+/gi, '').trim())
  );
  const pipeline = [
    { $match: { pipeline_id: pipelineId, 'timeline.mp_name': { $in: nameVariants } } },
    { $unwind: '$timeline' },
    {
      $match: {
        'timeline.mp_name': { $in: titleVariants },
      },
    },
    {
      $project: {
        issueId:      { $toString: '$_id' },
        issueTitle:   '$title',
        category:     { $ifNull: ['$category', 'Other'] },
        mp_name:      '$timeline.mp_name',
        action_type:  '$timeline.action_type',
        sentiment:    '$timeline.sentiment',
        date:         '$timeline.date',
        text_excerpt: '$timeline.text_excerpt',
      },
    },
  ];

  const rows = await db.collection(CACHE_COLLECTION).aggregate(pipeline, { allowDiskUse: true }).toArray();

  // Filter to turns that actually belong to this MP (normalised name check)
  const myTurns = rows.filter(r => belongsToMp(r.mp_name, nameVariants, normVariants));

  if (myTurns.length === 0) {
    console.log(`${label} → no turns found in Issue Portal`);
    return { ok: 1, skipped: 0 };
  }

  // Count by action_type and compute sentiment
  let nReply = 0, nAsk = 0, nEscalate = 0, nInterjection = 0;
  let sentSum = 0, sentCount = 0;

  for (const t of myTurns) {
    const at = (t.action_type || 'reply').toLowerCase();
    if (at === 'reply')             nReply++;
    else if (at === 'ask')          nAsk++;
    else if (at === 'escalate')     nEscalate++;
    else if (at === 'interjection') nInterjection++;
    else                            nReply++; // unknown → treat as reply

    if (typeof t.sentiment === 'number' && !Number.isNaN(t.sentiment)) {
      sentSum   += t.sentiment;
      sentCount += 1;
    }
  }

  const total_turns = nReply + nAsk + nEscalate + nInterjection;
  const round1 = v => Math.round(v * 10) / 10;

  const responseRate    = total_turns > 0 ? round1((nReply        / total_turns) * 100) : null;
  const askRate         = total_turns > 0 ? round1((nAsk          / total_turns) * 100) : null;
  const escalateRate    = total_turns > 0 ? round1((nEscalate     / total_turns) * 100) : null;
  const interjectionRate= total_turns > 0 ? round1((nInterjection / total_turns) * 100) : null;
  const sentimentScore  = sentCount   > 0 ? round1(sentSum / sentCount)                 : null;

  // Build top 8 recent statements sorted by date descending.
  // Only keep turns that have a usable text excerpt (non-empty, >= 40 chars).
  const recentStatements = myTurns
    .filter(t => t.text_excerpt && t.text_excerpt.trim().length >= 40)
    .sort((a, b) => {
      const da = a.date ? new Date(a.date).getTime() : 0;
      const db2 = b.date ? new Date(b.date).getTime() : 0;
      return db2 - da;
    })
    .slice(0, 8)
    .map(t => ({
      issueId:     t.issueId   || null,
      issueTitle:  t.issueTitle || 'Parliamentary debate',
      category:    t.category  || 'Other',
      date:        t.date ? (t.date instanceof Date ? t.date.toISOString().slice(0, 10) : String(t.date).slice(0, 10)) : '',
      action_type: t.action_type || 'reply',
      text_excerpt: t.text_excerpt.trim().slice(0, 300),
    }));

  // Write to MP document
  const mpCol = db.collection(MP_COLLECTION);
  await mpCol.updateOne(
    { _id: mp._id },
    {
      $set: {
        'performance.responseRate':          responseRate,
        'performance.askRate':               askRate,
        'performance.escalateRate':          escalateRate,
        'performance.interjectionRate':      interjectionRate,
        'performance.sentimentScore':        sentimentScore,
        'performance.recentStatements':      recentStatements,
        'performance.speakingStatsComputedAt': new Date(),
        'performance.speakingStatsPipeline': pipelineId,
      },
    }
  );

  console.log(
    `${label} → ${total_turns} turns | ` +
    `reply=${responseRate}% ask=${askRate}% esc=${escalateRate}% interj=${interjectionRate}% ` +
    `sentiment=${sentimentScore} | recentStatements=${recentStatements.length}`
  );
  return { ok: 1, skipped: 0 };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI not set in backend/.env');
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const force   = args.includes('--force');

  const pipelineArg = args.find(a => a.startsWith('--pipeline='))?.split('=')[1]
    || (args.includes('--pipeline') ? args[args.indexOf('--pipeline') + 1] : null)
    || 'pipeline5';

  const limitArg = args.find(a => a.startsWith('--limit='))?.split('=')[1]
    || (args.includes('--limit') ? args[args.indexOf('--limit') + 1] : null);
  const limit = limitArg ? Math.max(1, parseInt(limitArg, 10)) : null;

  const mpNameArg = args.find(a => a.startsWith('--mp='))?.split('=').slice(1).join('=')
    || (args.includes('--mp') ? args[args.indexOf('--mp') + 1] : null);

  await mongoose.connect(uri);
  console.log('Connected to MongoDB');
  const db = mongoose.connection.db;

  console.log(`Pipeline: ${pipelineArg}`);

  // Verify pipeline has data
  const issueCount = await db.collection(CACHE_COLLECTION).countDocuments({ pipeline_id: pipelineArg });
  if (issueCount === 0) {
    console.error(`No issues found for pipeline "${pipelineArg}" in ${CACHE_COLLECTION} collection.`);
    console.error('Run precomputeIssuePortal.js first, or pass --pipeline <id>.');
    await mongoose.connection.close();
    process.exit(1);
  }
  console.log(`Found ${issueCount} issue cards for ${pipelineArg}`);

  // Load MPs
  const rawQuery = {};
  if (mpNameArg) rawQuery.name = { $regex: mpNameArg, $options: 'i' };

  let mps = await db.collection(MP_COLLECTION).find(rawQuery, {
    projection: {
      _id: 1, name: 1, full_name_with_titles: 1, original_name_variations: 1,
      'performance.speakingStatsComputedAt': 1,
    },
  }).toArray();

  if (limit) mps = mps.slice(0, limit);

  if (!force) {
    const before = mps.length;
    mps = mps.filter(mp => !mp.performance?.speakingStatsComputedAt);
    const skippedCached = before - mps.length;
    if (skippedCached > 0) {
      console.log(`Skipping ${skippedCached} MP(s) already computed (use --force to recompute).`);
    }
  }

  const total = mps.length;
  console.log(`Processing ${total} MP(s)${force ? ' | FORCE' : ''}`);

  let ok = 0, skipped = 0;
  for (let i = 0; i < mps.length; i++) {
    const r = await processOneMp(db, mps[i], pipelineArg, i, total);
    ok      += r.ok;
    skipped += r.skipped;
  }

  await mongoose.connection.close();
  console.log(`\nDone. OK: ${ok}, Skipped: ${skipped}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
