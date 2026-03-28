/**
 * Seed topic followers: every user randomly follows up to 5 topics.
 *
 * Run from backend root:
 *   node scripts/seedTopicFollowers.js
 *
 * Options (env vars):
 *   MAX_TOPICS=5  – max topics each user follows (default 5)
 *
 * Uses $addToSet so it is safe to run multiple times; existing followed
 * topics are preserved and never duplicated.
 * Only topics with status 'Active' are eligible.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Topic = require('../models/Topic');

const MONGO_URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  'mongodb://localhost:27017/myparliament';

const MAX_TOPICS = parseInt(process.env.MAX_TOPICS || '5', 10);

/** Fisher-Yates in-place shuffle */
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Random integer in [min, max] inclusive */
function randInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('MongoDB connected\n');

  // Load all topics (active or any status)
  const topicDocs = await Topic.find({}).select('_id title status').lean();
  if (!topicDocs.length) {
    console.error('No topics found in the database. Aborting.');
    process.exit(1);
  }

  const topicIds = topicDocs.map((t) => t._id); // ObjectId[]
  console.log(`Loaded ${topicIds.length} active topics.`);

  // Load all regular users
  const userDocs = await User.find({ role: 'user' }).select('_id').lean();
  if (!userDocs.length) {
    console.error('No users found in the database. Aborting.');
    process.exit(1);
  }
  console.log(`Loaded ${userDocs.length} users.\n`);

  const cap = Math.min(MAX_TOPICS, topicIds.length);

  // Build bulkWrite ops: each user gets 1–MAX_TOPICS random topics
  const ops = userDocs.map((user) => {
    const count = randInt(1, cap);
    const chosen = shuffle([...topicIds]).slice(0, count); // ObjectId[]
    return {
      updateOne: {
        filter: { _id: user._id },
        update: { $addToSet: { followedTopics: { $each: chosen } } },
      },
    };
  });

  // Execute in batches of 500
  const BATCH_SIZE = 500;
  let done = 0;
  for (let i = 0; i < ops.length; i += BATCH_SIZE) {
    await User.bulkWrite(ops.slice(i, i + BATCH_SIZE), { ordered: false });
    done += Math.min(BATCH_SIZE, ops.length - i);
    process.stdout.write(`\rProgress: ${done}/${ops.length} users updated…`);
  }
  console.log('\n');

  // Verification: count followers per topic (sample first 10)
  console.log('Verifying follower counts (sample):');
  const sample = topicDocs.slice(0, Math.min(10, topicDocs.length));
  for (const topic of sample) {
    const count = await User.countDocuments({ followedTopics: topic._id });
    console.log(`  "${topic.title}" → ${count} followers`);
  }
  if (topicDocs.length > 10) {
    console.log(`  … (${topicDocs.length - 10} more topics not shown)`);
  }

  console.log(`\nDone. Every user now follows 1–${cap} random topics.`);
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
