require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const ForumTopic = require('../models/ForumTopic');
const ForumPost = require('../models/ForumPost');

const MONGO_URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  'mongodb://localhost:27017/myparliament';

const REPLIES_PER_TOPIC = 5;

const REPLY_POOL = [
  'I strongly agree with this point. The current system clearly lacks the checks and balances needed to hold our elected representatives accountable.',
  'Interesting perspective, but I think we need to be careful not to over-regulate. Too many restrictions can paralyse the very institutions we are trying to reform.',
  'This is exactly the kind of civic discussion Malaysia needs. More Malaysians should be aware of how Parliament actually functions.',
  'I have written to my MP about this several times but never received a meaningful response. Structural reform is long overdue.',
  'Comparing Malaysia to the UK or Australia is useful but we should also look at models from ASEAN neighbours like Indonesia and the Philippines.',
  'The root problem is party loyalty over constituent loyalty. Until that culture changes, procedural reforms will only go so far.',
  'Fully agree. Without genuine transparency, it is impossible for ordinary citizens to hold their representatives accountable between elections.',
  'My concern is implementation — who watches the watchmen? Any new oversight body must itself be independent and properly resourced.',
  'Thank you for raising this. Young Malaysians are increasingly engaged with politics and discussions like this are exactly what we need in the public sphere.',
  'The political will simply does not exist right now. Ruling parties have little incentive to reform systems that benefit them.',
  'I think civil society organisations play a crucial role here. Parliament alone cannot drive this change without external pressure.',
  'We should look at this from both sides. Reform is necessary but sudden, sweeping changes can create instability that ultimately hurts the rakyat.',
  'Spot on. The lack of public awareness is itself a systemic problem — media coverage of Parliament is shockingly thin for a democracy.',
  'This reminds me of a debate we had in my local community recently. People are hungry for change but feel their voices do not reach Parliament.',
  'Agreed, but let us also acknowledge the progress that has been made. It is easy to focus only on shortcomings and forget how far we have come.',
  'The international comparisons are helpful. Malaysia should study what has worked in similarly diverse democracies and adapt accordingly.',
  'What worries me most is that reforms proposed by the opposition are automatically opposed by the government, and vice versa. We need bipartisan commitment.',
  'Any meaningful reform must include public consultation. Top-down changes without rakyat input will lack legitimacy and staying power.',
  'I work in the public sector and I can tell you that the problem runs deeper than Parliament. Bureaucratic resistance to change is enormous.',
  'This is a great topic. Sharing this with my friends who think politics has nothing to do with their daily lives.',
  'The media has a role too — investigative journalism on parliamentary proceedings is virtually non-existent in mainstream outlets.',
  'Honestly, this should be taught in schools. Civic education in Malaysia is woefully inadequate and that is reflected in low public engagement.',
  'I hope our MPs are reading discussions like this. Citizens are clearly more thoughtful about governance than many politicians give us credit for.',
  'Reform without enforcement is meaningless. We have seen many well-intentioned policies die because there was no mechanism to ensure compliance.',
  'The economic angle is often overlooked. Good governance directly affects investor confidence and ultimately the livelihoods of ordinary Malaysians.',
];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickRandom(arr, n) {
  return shuffle(arr).slice(0, n);
}

function pickReply() {
  return REPLY_POOL[Math.floor(Math.random() * REPLY_POOL.length)];
}

function randomAfterDate(baseDate, maxExtraMs = 3 * 24 * 60 * 60 * 1000) {
  return new Date(baseDate.getTime() + Math.floor(Math.random() * maxExtraMs) + 60000);
}

async function run() {
  console.log('Connecting to MongoDB…');
  await mongoose.connect(MONGO_URI);
  console.log('Connected.\n');

  try {
    const allUsers = await User.find({}).select('_id').lean();
    if (allUsers.length < 5) {
      console.error('Not enough users in the DB. Run seedUserAdd.js first.');
      process.exit(1);
    }

    const topics = await ForumTopic.find({ status: { $in: ['active', 'flagged'] } })
      .select('_id author posts createdAt')
      .lean();

    if (topics.length === 0) {
      console.error('No forum topics found. Run seedForumDiscussions.js first.');
      process.exit(1);
    }

    console.log(`Found ${topics.length} topic(s).\n`);

    let totalAdded = 0;
    let totalSkipped = 0;

    for (const topic of topics) {
      const existingReplyCount = (topic.posts?.length || 1) - 1;

      if (existingReplyCount >= REPLIES_PER_TOPIC) {
        console.log(`  SKIP  topic ${topic._id} already has ${existingReplyCount} replies`);
        totalSkipped++;
        continue;
      }

      const repliesNeeded = REPLIES_PER_TOPIC - existingReplyCount;
      const otherUsers = allUsers.filter((u) => String(u._id) !== String(topic.author));
      const replyUsers = pickRandom(otherUsers, repliesNeeded);

      const createdReplies = [];
      let lastDate = new Date(topic.createdAt);

      for (let i = 0; i < repliesNeeded; i++) {
        const replyUser = replyUsers[i % replyUsers.length];
        const replyDate = randomAfterDate(lastDate);

        let parentPostId = null;
        let isNested = false;

        if (createdReplies.length >= 2 && Math.random() < 0.5) {
          const parentIdx = Math.floor(Math.random() * createdReplies.length);
          parentPostId = createdReplies[parentIdx]._id;
          isNested = true;
        }

        const reply = await ForumPost.create({
          content: pickReply(),
          author: replyUser._id,
          topic: topic._id,
          parentPost: parentPostId,
          status: 'active',
          createdAt: replyDate,
          updatedAt: replyDate,
        });

        if (isNested) {
          await ForumPost.updateOne(
            { _id: parentPostId },
            { $push: { replies: reply._id } }
          );
        }

        createdReplies.push(reply);
        lastDate = replyDate;
        totalAdded++;
      }

      const replyIds = createdReplies.map((r) => r._id);
      const lastActivity = createdReplies[createdReplies.length - 1].createdAt;

      await ForumTopic.updateOne(
        { _id: topic._id },
        {
          $push: { posts: { $each: replyIds } },
          $set: { lastActivity },
        }
      );

      console.log(`  OK    topic ${topic._id} — added ${repliesNeeded} replies`);
    }

    console.log(`\nDone!`);
    console.log(`  Topics processed : ${topics.length}`);
    console.log(`  Replies added    : ${totalAdded}`);
    console.log(`  Already had 5    : ${totalSkipped}`);
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
