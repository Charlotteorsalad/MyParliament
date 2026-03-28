/**
 * One-time script: fix state field for all MPs (active and inactive).
 * - If state is empty: set state from constituency using constituencyToStateMap.
 * - If state is actually a constituency name (e.g. "Port Dickson"): replace with correct state (e.g. "Negeri Sembilan").
 *
 * Run from backend folder:
 *   node scripts/fixInactiveMPStates.js
 *   node scripts/fixInactiveMPStates.js --dry-run   (preview only, no DB updates; works on Windows too)
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Mp = require('../models/Mp');
const {
  getStateFromConstituency,
  isStateActuallyConstituency,
  normalizeForLookup,
  CONSTITUENCY_TO_STATE,
} = require('./constituencyToStateMap');

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/myparliament';
const DRY_RUN =
  process.env.DRY_RUN === '1' ||
  process.env.DRY_RUN === 'true' ||
  process.argv.includes('--dry-run');

function computeCorrectState(mp) {
  const rawState = mp.state && String(mp.state).trim();
  const fromConstituency = getStateFromConstituency(mp.constituency);

  // Prefer state derived from constituency (most reliable when constituency is correct)
  if (fromConstituency) return fromConstituency;
  // If current state is actually a constituency name, replace with mapped state
  if (rawState && isStateActuallyConstituency(rawState)) {
    const key = normalizeForLookup(rawState);
    return CONSTITUENCY_TO_STATE[key];
  }
  // Keep existing state if it looks like a real state (not in constituency map)
  if (rawState) return rawState;
  return null;
}

async function run() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  }

  // All MPs (active and inactive)
  const mps = await Mp.find({})
    .select('_id name constituency state status parliament_term')
    .lean();

  console.log('MPs to process:', mps.length);
  if (DRY_RUN) console.log('DRY RUN – no updates will be written\n');

  let updated = 0;
  let skipped = 0;
  const changes = [];

  for (const mp of mps) {
    const correctState = computeCorrectState(mp);
    const currentState = (mp.state && String(mp.state).trim()) || null;

    if (correctState === null) {
      skipped++;
      continue;
    }

    // Update if state is wrong or missing
    if (currentState !== correctState) {
      changes.push({
        name: mp.name,
        id: mp._id,
        old: currentState || '(empty)',
        new: correctState,
        constituency: mp.constituency || '(none)',
      });
      if (!DRY_RUN) {
        await Mp.updateOne({ _id: mp._id }, { $set: { state: correctState } });
      }
      updated++;
    }
  }

  console.log('\nUpdates:', updated);
  console.log('Skipped (no mapping):', skipped);
  if (changes.length > 0) {
    console.log('\nSample changes (first 20):');
    changes.slice(0, 20).forEach((c) => {
      console.log(`  ${c.name}: state "${c.old}" -> "${c.new}" (constituency: ${c.constituency})`);
    });
  }

  await mongoose.disconnect();
  console.log('\nDone.');
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
