/**
 * LLM Excerpt Cleaner for Issue Portal
 * ─────────────────────────────────────────────────────────────────────────────
 * Reads existing precomputed Topic documents and uses GPT-4o-mini to:
 *   1. Fix OCR spelling errors  (deng→dengan, sebaga→sebagai …)
 *   2. Remove stray symbols     (} @ $ # ^ …)
 *   3. Trim cut-off sentences   (text ending mid-thought → trimmed)
 *   4. Drop unreadable excerpts (replaces with a clean fallback or removes turn)
 *
 * Run AFTER precomputeIssuePortal.js:
 *   node scripts/precomputeIssuePortal.js --pipeline pipeline5 --force
 *   node scripts/cleanExcerptsWithLlm.js  --pipeline pipeline5
 *
 * Options:
 *   --pipeline pipeline5   which pipeline to clean (required)
 *   --batch 10             excerpts per GPT call (default 10)
 *   --limit 20             max Topic docs to process (default: all)
 *   --dry-run              print changes without writing to DB
 *   --verbose              print every fix and drop
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

// Force LLM mode regardless of .env setting
process.env.EXCERPT_VALIDATOR_MODE = 'llm';

const { MongoClient }        = require('mongodb');
const { fixAndFilterTurns }  = require('../services/excerptQualityValidator');

// ─── CLI args ───────────────────────────────────────────────────────────────
const args = process.argv.slice(2);

const pipelineArg =
  args.find(a => a.startsWith('--pipeline='))?.split('=')[1] ||
  (args.includes('--pipeline') ? args[args.indexOf('--pipeline') + 1] : null);

const batchArg = parseInt(
  args.find(a => a.startsWith('--batch='))?.split('=')[1] ||
  (args.includes('--batch') ? args[args.indexOf('--batch') + 1] : '10'),
  10
);

const limitArg = parseInt(
  args.find(a => a.startsWith('--limit='))?.split('=')[1] ||
  (args.includes('--limit') ? args[args.indexOf('--limit') + 1] : '0'),
  10
);

const dryRun  = args.includes('--dry-run');
const verbose = args.includes('--verbose');

if (!pipelineArg) {
  console.error('Usage: node cleanExcerptsWithLlm.js --pipeline pipeline5 [--batch 10] [--limit N] [--dry-run] [--verbose]');
  process.exit(1);
}

if (!process.env.OPENAI_API_KEY) {
  console.error('ERROR: OPENAI_API_KEY not set in .env');
  process.exit(1);
}

// Honour --batch flag (override env)
process.env.EXCERPT_LLM_BATCH = String(Math.min(30, Math.max(3, batchArg)));

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME   = 'MyParliament';
const COLL      = 'Topic';

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmt(n) { return String(n).padStart(4); }

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('='.repeat(60));
  console.log('LLM Excerpt Cleaner');
  console.log('='.repeat(60));
  console.log('Pipeline  :', pipelineArg);
  console.log('Batch size:', process.env.EXCERPT_LLM_BATCH, 'excerpts/call');
  console.log('Limit     :', limitArg || 'all');
  console.log('Mode      :', dryRun ? 'DRY RUN (no writes)' : 'LIVE');
  console.log('='.repeat(60));

  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db   = client.db(DB_NAME);
  const coll = db.collection(COLL);

  // Fetch Topic documents for this pipeline (sorted oldest first so we can resume)
  const query  = { pipeline_id: pipelineArg };
  const cursor = coll
    .find(query, { projection: { _id: 1, title: 1, keywords: 1, timeline: 1, llm_cleaned: 1 } })
    .sort({ _id: 1 });

  if (limitArg > 0) cursor.limit(limitArg);

  const docs = await cursor.toArray();
  console.log(`Found ${docs.length} Topic documents to process\n`);

  let docsUpdated = 0, docsSkipped = 0;
  let totalFixed = 0, totalDropped = 0, totalTurns = 0;

  for (let docIdx = 0; docIdx < docs.length; docIdx++) {
    const doc = docs[docIdx];
    const title   = (doc.title || `doc#${docIdx}`).slice(0, 60);
    const turns   = Array.isArray(doc.timeline) ? doc.timeline : [];
    const keywords = Array.isArray(doc.keywords) ? doc.keywords : [];

    if (turns.length === 0) {
      docsSkipped++;
      continue;
    }

    process.stdout.write(`[${fmt(docIdx + 1)}/${fmt(docs.length)}] "${title}" (${turns.length} turns) … `);

    // Run fix+filter — returns turns with fixed text_excerpt, drops unclean ones
    const fixedTurns = await fixAndFilterTurns(turns, keywords, { verbose });

    const dropped = turns.length - fixedTurns.length;
    const fixed   = fixedTurns.filter((t, i) => {
      const orig = turns.find(o => o.doc_id === t.doc_id && o.mp_name === t.mp_name && o.date?.getTime?.() === t.date?.getTime?.());
      return orig && orig.text_excerpt !== t.text_excerpt;
    }).length;

    totalTurns   += turns.length;
    totalFixed   += fixed;
    totalDropped += dropped;

    process.stdout.write(`fixed=${fixed} dropped=${dropped}\n`);

    if (!dryRun && (fixed > 0 || dropped > 0)) {
      await coll.updateOne(
        { _id: doc._id },
        {
          $set: {
            timeline:         fixedTurns,
            statement_count:  fixedTurns.length,
            llm_cleaned:      true,
            llm_cleaned_at:   new Date(),
          },
        }
      );
      docsUpdated++;
    } else if (dryRun && (fixed > 0 || dropped > 0)) {
      docsUpdated++;
    }
  }

  await client.close();

  console.log('\n' + '='.repeat(60));
  console.log('DONE');
  console.log('='.repeat(60));
  console.log(`Documents processed : ${docs.length}`);
  console.log(`Documents updated   : ${docsUpdated}`);
  console.log(`Documents unchanged : ${docsSkipped + (docs.length - docsUpdated - docsSkipped)}`);
  console.log(`Total turns checked : ${totalTurns}`);
  console.log(`Excerpts repaired   : ${totalFixed}`);
  console.log(`Turns dropped       : ${totalDropped}`);
  if (dryRun) console.log('\n(dry-run: no changes written)');
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
