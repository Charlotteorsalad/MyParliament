/**
 * Seed survey responses: assign each user 10 randomly chosen surveys with
 * randomly generated answers appropriate for each question type.
 *
 * Prerequisites:
 *   - At least 10 Active surveys must exist in the DB.
 *   - Users must already exist (run seedUserAdd.js first).
 *
 * Run from backend directory:
 *   node scripts/seedSurveyResponses.js
 *
 * Safe to re-run — skips (user, survey) pairs that already have a response.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Survey = require('../models/Survey');

const MONGO_URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  'mongodb://localhost:27017/myparliament';

const SURVEYS_PER_USER = 10;

// ---------------------------------------------------------------------------
// Random answer generators per question type
// ---------------------------------------------------------------------------

const RANDOM_TEXT_POOL = [
  'I think this is an important topic for Malaysia.',
  'More transparency is needed from elected representatives.',
  'The current policies need serious review and improvement.',
  'Overall I am satisfied but there is room for improvement.',
  'Citizens should be more involved in the decision-making process.',
  'I would like to see better infrastructure in my constituency.',
  'The government should prioritise education and healthcare.',
  'I strongly support digital transformation in public services.',
  'Community engagement programs should be expanded nationwide.',
  'There needs to be stricter accountability for public spending.',
  'I believe inter-ethnic harmony is the foundation of progress.',
  'Local authorities must be more responsive to residents.',
  'Environmental policies should align with sustainable development goals.',
  'Youth participation in politics should be actively encouraged.',
  'Public transport connectivity in rural areas requires urgent attention.',
];

function randomText() {
  return RANDOM_TEXT_POOL[Math.floor(Math.random() * RANDOM_TEXT_POOL.length)];
}

function randomRating() {
  return Math.floor(Math.random() * 5) + 1; // 1–5
}

function randomMultipleChoice(options) {
  if (!options || options.length === 0) return null;
  return options[Math.floor(Math.random() * options.length)];
}

function randomYesNo() {
  return Math.random() < 0.5 ? 'Yes' : 'No';
}

function generateAnswer(question) {
  switch (question.type) {
    case 'text':
      return randomText();
    case 'rating':
      return randomRating();
    case 'multiple_choice':
      return randomMultipleChoice(question.options);
    case 'yes_no':
      return randomYesNo();
    default:
      return randomText();
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Fisher-Yates shuffle — returns a new shuffled array.
 */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Pick `n` random items from array without repetition.
 */
function pickRandom(arr, n) {
  return shuffle(arr).slice(0, n);
}

/**
 * Spread submitted timestamps over the past 60 days so the data looks
 * realistic rather than all being created at seeding time.
 */
function randomPastDate(maxDaysAgo = 60) {
  const msAgo = Math.floor(Math.random() * maxDaysAgo * 24 * 60 * 60 * 1000);
  return new Date(Date.now() - msAgo);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function run() {
  console.log('Connecting to MongoDB…');
  await mongoose.connect(MONGO_URI);
  console.log('Connected.\n');

  try {
    // Fetch all users (completed registration preferred, but include all)
    const users = await User.find({}).select('_id profile.firstName profile.lastName username').lean();
    if (users.length === 0) {
      console.error('No users found. Run seedUserAdd.js first.');
      process.exit(1);
    }
    console.log(`Found ${users.length} users.`);

    // Fetch surveys — prefer Active ones, fall back to all statuses
    let surveys = await Survey.find({ status: 'Active' }).lean();
    if (surveys.length < SURVEYS_PER_USER) {
      console.warn(
        `Only ${surveys.length} Active surveys found (need ${SURVEYS_PER_USER}). ` +
          'Including Draft and Closed surveys as well…'
      );
      surveys = await Survey.find({}).lean();
    }
    if (surveys.length < SURVEYS_PER_USER) {
      console.error(
        `Not enough surveys in the DB (found ${surveys.length}, need at least ${SURVEYS_PER_USER}). Aborting.`
      );
      process.exit(1);
    }
    console.log(`Found ${surveys.length} surveys.\n`);

    // Build a Map for fast lookup and mutation: surveyId → survey document
    const surveyMap = new Map(surveys.map((s) => [String(s._id), s]));

    let totalAdded = 0;
    let totalSkipped = 0;

    for (const user of users) {
      const displayName =
        user.profile?.firstName && user.profile?.lastName
          ? `${user.profile.firstName} ${user.profile.lastName}`
          : user.username || String(user._id);

      // Pick SURVEYS_PER_USER surveys at random for this user
      const chosenSurveys = pickRandom(surveys, SURVEYS_PER_USER);

      for (const survey of chosenSurveys) {
        const sid = String(survey._id);
        const liveSurvey = surveyMap.get(sid);

        // Check if the user already responded
        const alreadyResponded = liveSurvey.responses.some(
          (r) => r.respondentId && String(r.respondentId) === String(user._id)
        );
        if (alreadyResponded) {
          totalSkipped++;
          continue;
        }

        // Build answers for every question in this survey
        const answers = (survey.questions || []).map((q) => ({
          questionId: q.id,
          answer: generateAnswer(q),
        }));

        const newResponse = {
          _id: new mongoose.Types.ObjectId(),
          respondentId: user._id,
          respondentName: displayName,
          answers,
          submittedAt: randomPastDate(),
        };

        liveSurvey.responses.push(newResponse);
        totalAdded++;
      }
    }

    // Persist all modified surveys in bulk
    console.log('Saving responses to DB…');
    const saveOps = [...surveyMap.values()].map((s) =>
      Survey.updateOne(
        { _id: s._id },
        { $set: { responses: s.responses } }
      )
    );
    await Promise.all(saveOps);

    console.log(`\nDone!`);
    console.log(`  Responses added : ${totalAdded}`);
    console.log(`  Already existed : ${totalSkipped}`);
    console.log(`  Users processed : ${users.length}`);
    console.log(`  Surveys used    : ${surveys.length}`);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\nMongoDB disconnected.');
    process.exit(0);
  }
}

run();
