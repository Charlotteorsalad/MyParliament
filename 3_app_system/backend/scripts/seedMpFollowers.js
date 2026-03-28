/**
 * Seed MP followers: assigns random users to follow each MP so that
 * every MP ends up with 80–180+ followers (randomly chosen per MP).
 *
 * Run from backend root:
 *   node scripts/seedMpFollowers.js
 *
 * Options (env vars):
 *   MIN_FOLLOWERS=80   – minimum followers per MP  (default 80)
 *   MAX_FOLLOWERS=180  – maximum followers per MP  (default 180)
 *
 * The script uses $addToSet so it is safe to run multiple times and will
 * not duplicate entries.  Existing followed MPs are preserved.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Mp = require('../models/Mp');

const MONGO_URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  'mongodb://localhost:27017/myparliament';

const MIN_FOLLOWERS = parseInt(process.env.MIN_FOLLOWERS || '80', 10);
const MAX_FOLLOWERS = parseInt(process.env.MAX_FOLLOWERS || '180', 10);

/** Fisher-Yates in-place shuffle – returns the same array */
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Random integer in [min, max] (inclusive) */
function randInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('MongoDB connected\n');

  // ── Load all MPs and Users ──────────────────────────────────────────────
  const mpDocs = await Mp.find({}).select('_id name').lean();
  if (!mpDocs.length) {
    console.error('No MPs found in the database. Aborting.');
    process.exit(1);
  }

  const userDocs = await User.find({ role: 'user' }).select('_id').lean();
  if (!userDocs.length) {
    console.error('No users found in the database. Aborting.');
    process.exit(1);
  }

  const userIds = userDocs.map((u) => u._id); // ObjectId[]
  console.log(`Loaded ${mpDocs.length} MPs and ${userIds.length} users.\n`);

  if (userIds.length < MIN_FOLLOWERS) {
    console.warn(
      `Warning: only ${userIds.length} users exist – target minimum of ${MIN_FOLLOWERS} ` +
        `followers will be capped at ${userIds.length}.`
    );
  }

  // ── Build: userId (string) → Set<mpId (string)> to add ─────────────────
  // This lets us collect all the MP IDs each user should follow, then
  // issue one bulkWrite update per user at the end.
  const userFollowMap = new Map(); // userId string → Set<mpId string>

  for (const mp of mpDocs) {
    const mpIdStr = String(mp._id);
    const target = Math.min(randInt(MIN_FOLLOWERS, MAX_FOLLOWERS), userIds.length);

    // Shuffle a copy of userIds and pick the first `target` entries
    const chosen = shuffle([...userIds]).slice(0, target);

    for (const uid of chosen) {
      const uidStr = String(uid);
      if (!userFollowMap.has(uidStr)) {
        userFollowMap.set(uidStr, new Set());
      }
      userFollowMap.get(uidStr).add(mpIdStr);
    }
  }

  console.log(`Users that will receive new follows: ${userFollowMap.size}`);

  // ── BulkWrite: $addToSet for each user ─────────────────────────────────
  const BATCH_SIZE = 500;
  const entries = [...userFollowMap.entries()];
  let totalOps = 0;

  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    const ops = batch.map(([uidStr, mpSet]) => ({
      updateOne: {
        filter: { _id: new mongoose.Types.ObjectId(uidStr) },
        update: { $addToSet: { followedMPs: { $each: [...mpSet] } } },
      },
    }));

    await User.bulkWrite(ops, { ordered: false });
    totalOps += ops.length;
    process.stdout.write(`\rBulkWrite progress: ${totalOps}/${entries.length} users updated…`);
  }

  console.log('\n');

  // ── Summary: verify follower counts per MP ──────────────────────────────
  console.log('Verifying follower counts (sampling)…');
  const sample = mpDocs.slice(0, Math.min(10, mpDocs.length));
  for (const mp of sample) {
    const count = await User.countDocuments({ followedMPs: String(mp._id) });
    console.log(`  ${mp.name || mp._id} → ${count} followers`);
  }

  if (mpDocs.length > 10) {
    console.log(`  … (${mpDocs.length - 10} more MPs not shown)`);
  }

  console.log('\nDone. Every MP now has 80–180+ followers.');
}

run()
  .catch((err) => {
    console.error('\nError:', err.message);
    process.exit(1);
  })
  .finally(async () => {
    await mongoose.disconnect();
    console.log('MongoDB disconnected.');
    process.exit(0);
  });
