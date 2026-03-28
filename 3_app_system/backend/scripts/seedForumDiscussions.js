require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const ForumTopic = require('../models/ForumTopic');
const ForumPost = require('../models/ForumPost');

const MONGO_URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  'mongodb://localhost:27017/myparliament';

const DISCUSSION_TEMPLATES = [
  {
    title: 'Should Malaysia adopt a two-term limit for the Prime Minister?',
    description:
      'Many democratic nations impose term limits on their head of government to prevent excessive concentration of power. Malaysia has seen long tenures from several Prime Ministers, which raises the question: should Dewan Rakyat legislate a two-term maximum? A fixed limit could encourage fresh leadership and reduce patronage networks, but critics argue it may destabilise policy continuity. What are your thoughts on introducing this constitutional amendment?',
    category: 'debate',
    tags: ['prime minister', 'term limit', 'constitutional reform', 'democracy'],
    linkedTopic: 'Constitutional Reform',
  },
  {
    title: 'Transparency in Parliament: are Hansard records accessible enough?',
    description:
      'Hansard — the official verbatim record of parliamentary debates — is technically available online, but many Malaysians are unaware of its existence or find it difficult to navigate. Should the Parliament of Malaysia invest in a modern, searchable, multilingual portal so that ordinary citizens can easily track what their MPs say and vote for? Digital transparency could strengthen accountability and civic participation.',
    category: 'policy',
    tags: ['hansard', 'transparency', 'open data', 'civic tech'],
    linkedTopic: 'Parliamentary Transparency',
  },
  {
    title: 'Lowering the voting age to 18 — how has it changed Malaysian politics?',
    description:
      'Undi18 came into force in 2021, automatically registering all Malaysians aged 18 and above as voters. Now that several election cycles have passed, what tangible impact has the youth vote had on parliamentary composition? Have parties meaningfully shifted their platforms to address youth concerns such as housing affordability, graduate unemployment, and climate action?',
    category: 'debate',
    tags: ['undi18', 'youth vote', 'GE', 'election reform'],
    linkedTopic: 'Electoral Reform',
  },
  {
    title: 'MP attendance and the need for stricter parliamentary quorum rules',
    description:
      'Reports of near-empty Dewan Rakyat sessions during important votes have frustrated many Malaysians. Under current Standing Orders, a quorum of only 26 members (out of 222) is required. Should stricter attendance requirements be enforced, with salary deductions or public disclosure for habitual absentees? How does this compare to practices in the UK, Australia, or Singapore?',
    category: 'policy',
    tags: ['MP attendance', 'quorum', 'accountability', 'standing orders'],
    linkedTopic: 'Parliamentary Reform',
  },
  {
    title: 'Budget 2025: did Parliament give enough scrutiny to fiscal proposals?',
    description:
      'The annual budget is one of the most consequential pieces of legislation Parliament passes. This year, debate time was again criticised as insufficient relative to the scale of spending. Should Malaysia adopt a dedicated budget committee with pre-budget public hearings, similar to the UK Treasury Select Committee? Longer, more rigorous debate could surface fiscal risks before they become crises.',
    category: 'policy',
    tags: ['budget', 'fiscal policy', 'select committee', 'public finance'],
    linkedTopic: 'Economic Policy',
  },
  {
    title: 'Are Malaysian MPs truly representing their constituents or party interests?',
    description:
      'The tension between following the party whip and reflecting constituent opinions is universal in parliamentary democracies. In Malaysia, crossing the party line can end a political career. Should anti-hopping laws be reviewed to include provisions that allow conscience votes on certain issues? Or does strict party discipline keep governments stable and prevent legislative gridlock?',
    category: 'debate',
    tags: ['party whip', 'anti-hopping', 'conscience vote', 'representation'],
    linkedTopic: 'Parliamentary Reform',
  },
  {
    title: 'Women in Parliament: progress and remaining barriers in Malaysia',
    description:
      'Malaysia currently has around 14% female representation in Dewan Rakyat, well below the 30% minimum recommended by the UN. Despite pledges from successive governments, no gender quota legislation has been passed. What structural barriers — from party candidate selection to campaign financing — continue to limit women\'s participation, and what policies have worked in comparable countries?',
    category: 'policy',
    tags: ['gender equality', 'women MPs', 'quota', 'representation'],
    linkedTopic: 'Political Participation',
  },
  {
    title: 'Dewan Negara reform: is the Senate still relevant in modern Malaysia?',
    description:
      'The Senate (Dewan Negara) is often described as a rubber-stamp chamber since it cannot override Dewan Rakyat and is largely appointive. Some political scientists argue it should be directly elected to provide genuine federal representation for states. Others suggest abolishing it entirely to reduce bureaucracy. Should Malaysia undertake a comprehensive review of the upper house\'s role and composition?',
    category: 'debate',
    tags: ['Dewan Negara', 'senate', 'bicameralism', 'federalism'],
    linkedTopic: 'Constitutional Reform',
  },
  {
    title: 'Parliamentary select committees — are they doing enough oversight work?',
    description:
      'Select committees are powerful tools for legislative scrutiny, allowing MPs to investigate issues in depth and call witnesses from government agencies. Malaysia has several standing select committees but they are widely seen as understaffed and under-resourced. Should Parliament significantly increase the budget and independence of these committees to strengthen executive oversight?',
    category: 'policy',
    tags: ['select committee', 'oversight', 'accountability', 'parliament'],
    linkedTopic: 'Parliamentary Reform',
  },
  {
    title: 'Should Question Time in Dewan Rakyat be extended and reformed?',
    description:
      'Question Time is a daily opportunity for MPs to hold ministers directly accountable. However, the current format allows ministers to give long, evasive answers, and oral questions are pre-submitted days in advance. A supplementary "Prime Minister\'s Questions" session similar to Westminster, with more spontaneous follow-up questions, could sharpen ministerial accountability considerably.',
    category: 'debate',
    tags: ['question time', 'PMQs', 'accountability', 'Dewan Rakyat'],
    linkedTopic: 'Parliamentary Reform',
  },
  {
    title: 'Environmental legislation: is Parliament keeping pace with climate commitments?',
    description:
      'Malaysia ratified the Paris Agreement and pledged to reduce carbon intensity by 45% by 2030. Yet environmental NGOs consistently point out that parliamentary debate on climate-related bills is thin, and environmental impact assessments for major projects receive little scrutiny on the floor. Should there be a dedicated Parliamentary Climate Committee to review all legislation for environmental implications?',
    category: 'policy',
    tags: ['climate change', 'environment', 'Paris Agreement', 'green policy'],
    linkedTopic: 'Environment & Sustainability',
  },
  {
    title: 'Live-streaming Parliament: how technology is changing civic engagement',
    description:
      'Parliament TV and online streaming of Dewan Rakyat sessions have made it easier than ever to watch debates live. Coupled with social media commentary, younger Malaysians are more aware of parliamentary proceedings than any previous generation. But are these tools translating into deeper civic engagement, or is it mostly entertainment? How can Parliament leverage technology to go beyond passive viewership?',
    category: 'general',
    tags: ['civic tech', 'parliament TV', 'digital democracy', 'engagement'],
    linkedTopic: 'Parliamentary Transparency',
  },
  {
    title: 'Anti-corruption measures: what more can Parliament do beyond MACC oversight?',
    description:
      'The Malaysian Anti-Corruption Commission (MACC) operates under parliamentary oversight but is widely considered to lack full operational independence. High-profile cases have stalled or resulted in acquittals, eroding public trust. Should Parliament enact stronger whistleblower protections, asset declaration requirements for all public officials, and an independent prosecution office separate from the Attorney General\'s Chambers?',
    category: 'policy',
    tags: ['MACC', 'anti-corruption', 'integrity', 'governance'],
    linkedTopic: 'Anti-Corruption',
  },
  {
    title: 'Constituency development funds: fair distribution or political patronage?',
    description:
      'Each MP receives a constituency development allocation that varies significantly between government and opposition members. Critics argue this creates an uneven playing field where opposition constituencies receive fewer resources, effectively punishing voters. Should constituency development funds be administered by an independent body using transparent, needs-based criteria rather than through the PM\'s Department?',
    category: 'debate',
    tags: ['constituency fund', 'patronage', 'opposition', 'budget allocation'],
    linkedTopic: 'Economic Policy',
  },
  {
    title: 'The role of the Yang di-Pertuan Agong in a modern parliamentary democracy',
    description:
      'The constitutional monarchy plays a vital ceremonial and advisory role, but recent events — including the appointment and dismissal of Prime Ministers during periods of parliamentary instability — have brought the discretionary powers of the Agong into sharper focus. How should constitutional conventions evolve to ensure royal prerogative is exercised in ways that reinforce, rather than substitute for, democratic processes?',
    category: 'debate',
    tags: ['Yang di-Pertuan Agong', 'constitutional monarchy', 'royal prerogative'],
    linkedTopic: 'Constitutional Reform',
  },
  {
    title: 'Minimum wage legislation: should Parliament set a higher national floor?',
    description:
      'Malaysia\'s minimum wage has been progressively raised, but labour advocacy groups argue it still falls short of a genuine living wage in urban areas. Parliament debates minimum wage amendments infrequently, and the process lacks regular statutory review. Should the law require an independent wage commission to conduct annual reviews with mandatory parliamentary debate and a binding vote?',
    category: 'policy',
    tags: ['minimum wage', 'living wage', 'labour rights', 'economic policy'],
    linkedTopic: 'Labour & Employment',
  },
  {
    title: 'Education policy in Parliament: too centralised, too slow to change?',
    description:
      'The Ministry of Education has long been one of the largest budget recipients, yet Malaysia\'s education outcomes have remained mixed across PISA rankings. Parliamentary debate on education tends to focus on infrastructure spending rather than curriculum reform or teacher quality. Should there be a bipartisan parliamentary commission on education to develop a long-term, non-partisan national education strategy?',
    category: 'policy',
    tags: ['education', 'PISA', 'curriculum reform', 'bipartisan'],
    linkedTopic: 'Education',
  },
  {
    title: 'Healthcare funding: time for Parliament to debate universal health coverage?',
    description:
      'Malaysia operates a dual public-private healthcare system, but public hospitals are increasingly strained. The question of moving toward universal health coverage (UHC) — potentially through a national health insurance scheme — has been discussed in policy circles but rarely receives sustained parliamentary attention. Should a dedicated parliamentary task force be formed to draft a UHC roadmap?',
    category: 'policy',
    tags: ['healthcare', 'UHC', 'public health', 'insurance'],
    linkedTopic: 'Healthcare',
  },
  {
    title: 'Press freedom and Parliament: are journalists able to report freely from Dewan Rakyat?',
    description:
      'Malaysia\'s press freedom ranking has improved in recent years but remains a concern for media organisations. Parliamentary reporters sometimes face restrictions on publishing certain proceedings. A free press that can fully report parliamentary debates without fear of legal repercussions is fundamental to an informed electorate. What reforms would most meaningfully improve press freedom in the parliamentary context?',
    category: 'debate',
    tags: ['press freedom', 'media', 'parliament reporting', 'democracy'],
    linkedTopic: 'Media & Communications',
  },
  {
    title: 'Inter-ethnic dialogue: how Parliament can lead national unity conversations',
    description:
      'Malaysia\'s multi-ethnic society remains one of its greatest strengths but also a source of periodic political tension. Parliament should ideally be a forum where representatives from all communities engage in principled debate across ethnic and religious lines. Are current parliamentary norms and seating arrangements conducive to cross-ethnic dialogue, and what procedural changes could make it more so?',
    category: 'general',
    tags: ['national unity', 'ethnicity', 'social harmony', 'parliament'],
    linkedTopic: 'Social Policy',
  },
];

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

function randomAfterDate(baseDate, maxExtraMs = 7 * 24 * 60 * 60 * 1000) {
  return new Date(baseDate.getTime() + Math.floor(Math.random() * maxExtraMs) + 60000);
}

function randomViewCount() {
  return Math.floor(Math.random() * 300) + 10;
}

function randomPastDate(maxDaysAgo = 90) {
  const msAgo = Math.floor(Math.random() * maxDaysAgo * 24 * 60 * 60 * 1000);
  return new Date(Date.now() - msAgo);
}

function pickReply() {
  return REPLY_POOL[Math.floor(Math.random() * REPLY_POOL.length)];
}

async function seedReplies(topic, topicPostId, allUsers, topicAuthorId, topicDate) {
  const otherUsers = allUsers.filter((u) => String(u._id) !== String(topicAuthorId));
  const replyUsers = pickRandom(otherUsers, 5);

  const createdReplies = [];

  for (let i = 0; i < 5; i++) {
    const replyUser = replyUsers[i];
    const replyDate = randomAfterDate(
      i === 0 ? topicDate : createdReplies[i - 1].createdAt,
      3 * 24 * 60 * 60 * 1000
    );

    let parentPostId = null;
    let isNested = false;

    if (i >= 2 && createdReplies.length > 0 && Math.random() < 0.5) {
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
}

async function run() {
  console.log('Connecting to MongoDB…');
  await mongoose.connect(MONGO_URI);
  console.log('Connected.\n');

  try {
    const allUsers = await User.find({}).select('_id').lean();
    if (allUsers.length < 25) {
      console.error(`Only ${allUsers.length} users found — need at least 25. Run seedUserAdd.js first.`);
      process.exit(1);
    }

    const selectedUsers = shuffle(allUsers).slice(0, 20);
    console.log(`Selected ${selectedUsers.length} random users for topic authorship.\n`);

    const existingTitles = new Set(
      (
        await ForumTopic.find({ title: { $in: DISCUSSION_TEMPLATES.map((d) => d.title) } })
          .select('title')
          .lean()
      ).map((t) => t.title)
    );

    if (existingTitles.size > 0) {
      console.log(`Skipping ${existingTitles.size} topic(s) that already exist.\n`);
    }

    let created = 0;
    let skipped = 0;

    for (let i = 0; i < DISCUSSION_TEMPLATES.length; i++) {
      const template = DISCUSSION_TEMPLATES[i];
      const user = selectedUsers[i];

      if (existingTitles.has(template.title)) {
        console.log(`  SKIP  "${template.title.slice(0, 60)}…"`);
        skipped++;
        continue;
      }

      const postDate = randomPastDate();

      const post = await ForumPost.create({
        content: template.description,
        author: user._id,
        topic: new mongoose.Types.ObjectId(),
        parentPost: null,
        status: 'active',
        createdAt: postDate,
        updatedAt: postDate,
      });

      const topic = await ForumTopic.create({
        title: template.title,
        description: template.description,
        category: template.category,
        author: user._id,
        posts: [post._id],
        tags: template.tags,
        linkedTopic: template.linkedTopic,
        status: 'active',
        viewCount: randomViewCount(),
        lastActivity: postDate,
        createdAt: postDate,
        updatedAt: postDate,
      });

      await ForumPost.updateOne({ _id: post._id }, { $set: { topic: topic._id } });

      await seedReplies(topic, post._id, allUsers, user._id, postDate);

      console.log(`  OK    [${template.category.padEnd(12)}] "${template.title.slice(0, 60)}" (+5 replies)`);
      created++;
    }

    console.log(`\nDone!`);
    console.log(`  Discussions created : ${created}`);
    console.log(`  Already existed     : ${skipped}`);
    console.log(`  Replies added       : ${created * 5}`);
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
