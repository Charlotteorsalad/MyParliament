/**
 * Seed users: 22 named users + 300 random Malaysian-style users.
 * Default password for all: User@12345
 * Run from backend: node scripts/seedUserAdd.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Mp = require('../models/Mp');
const { STATE_TO_CONSTITUENCIES } = require('./constituencyToStateMap');

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/myparliament';
const DEFAULT_PASSWORD = 'User@12345';

function titleCase(str) {
  if (!str) return '';
  return str.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

// Build list of { state, constituency } with title-cased constituency names
function buildStateConstituencyList() {
  const list = [];
  for (const [state, constituencies] of Object.entries(STATE_TO_CONSTITUENCIES)) {
    for (const c of constituencies) {
      list.push({ state, constituency: titleCase(c) });
    }
  }
  return list;
}

const STATE_CONSTITUENCY_LIST = buildStateConstituencyList();

function pickRandomStateConstituency() {
  return STATE_CONSTITUENCY_LIST[Math.floor(Math.random() * STATE_CONSTITUENCY_LIST.length)];
}

// 22 named users: firstName, lastName, emailPrefix (for username and email)
const NAMED_USERS = [
  { firstName: 'Auderey', lastName: 'See', emailPrefix: 'audereysee' },
  { firstName: 'Hee', lastName: 'JingXi', emailPrefix: 'heejingxi' },
  { firstName: 'Janice', lastName: 'Lee', emailPrefix: 'janicelee' },
  { firstName: 'Jeffer', lastName: 'Ooi', emailPrefix: 'jefferooi' },
  { firstName: 'Oh', lastName: 'Beng Yee', emailPrefix: 'ohbengyee' },
  { firstName: 'Teoh', lastName: 'Han Wei', emailPrefix: 'teohhanwei' },
  { firstName: 'Tan', lastName: 'Chee Han', emailPrefix: 'tancheehan' },
  { firstName: 'Tan', lastName: 'Kok Wang', emailPrefix: 'tankokwang' },
  { firstName: 'Khor', lastName: 'Shao Chen', emailPrefix: 'khorshaochen' },
  { firstName: 'Wong', lastName: 'Sau Xuan', emailPrefix: 'wongsauxuan' },
  { firstName: 'Ooi', lastName: 'Yi Xuen', emailPrefix: 'ooiyixuen' },
  { firstName: 'Tan', lastName: 'Hao Yang', emailPrefix: 'tanhaoyang' },
  { firstName: 'Serena', lastName: 'Chan', emailPrefix: 'serenachan' },
  { firstName: 'Yip', lastName: 'Yong', emailPrefix: 'yipyong' },
  { firstName: 'Kuan', lastName: 'Shuven', emailPrefix: 'kuanshuven' },
  { firstName: 'Loh', lastName: 'Zhen Yuan', emailPrefix: 'lohzhenyuan' },
  { firstName: 'Owen', lastName: 'Seah', emailPrefix: 'owenseah' },
  { firstName: 'Zhao', lastName: 'Ji Qing', emailPrefix: 'zhaojiqing' },
  { firstName: 'Wong', lastName: 'Chai Yee', emailPrefix: 'wongchaiyee' },
  { firstName: 'Alex', lastName: 'Lee', emailPrefix: 'alexlee' },
  { firstName: 'Lim', lastName: 'Jia Chuan', emailPrefix: 'limjiachuan' },
  { firstName: 'Toh', lastName: 'Zhi Heen', emailPrefix: 'tohzhiheen' },
];

// Malaysian-style name parts for random users (Chinese, Malay, Indian mix)
const MALAY_FIRST = ['Ahmad', 'Muhammad', 'Siti', 'Nurul', 'Farah', 'Hafiz', 'Nur', 'Amira', 'Syafiq', 'Aina', 'Ibrahim', 'Zainal', 'Rina', 'Firdaus', 'Aisyah'];
const MALAY_LAST = ['Abdullah', 'Ibrahim', 'Hassan', 'Rahman', 'Ali', 'Ismail', 'Ahmad', 'Salleh', 'Yusof', 'Othman', 'Mohamed', 'Sultan', 'Khalid', 'Zainuddin'];
const CHINESE_LAST = ['Tan', 'Lim', 'Lee', 'Wong', 'Chan', 'Ng', 'Teo', 'Ooi', 'Goh', 'Khoo', 'Loh', 'Toh', 'Khor', 'Cheah', 'Yap', 'Chong', 'Lau', 'Sim', 'Kua', 'Pang'];
const CHINESE_FIRST = ['Wei Ming', 'Siew Ling', 'Jia Hui', 'Hao Ran', 'Yee Ling', 'Jun Jie', 'Mei Lin', 'Zhen Wei', 'Xin Yi', 'Jie Min', 'Shu Wen', 'Kai Xin', 'Yong Kang', 'Li Ting', 'Jian Wei'];
const INDIAN_FIRST = ['Raj', 'Priya', 'Kumar', 'Devi', 'Suresh', 'Lakshmi', 'Vijay', 'Anita', 'Murali', 'Shanti', 'Ramesh', 'Kavitha', 'Arjun', 'Deepa'];
const INDIAN_LAST = ['Krishnan', 'Subramaniam', 'Ramasamy', 'Govindasamy', 'Murugan', 'Pillay', 'Nair', 'Menon', 'Sharma', 'Singh', 'Patel'];

function randomMalaysianName() {
  const roll = Math.random();
  if (roll < 0.5) {
    const first = CHINESE_FIRST[Math.floor(Math.random() * CHINESE_FIRST.length)];
    const last = CHINESE_LAST[Math.floor(Math.random() * CHINESE_LAST.length)];
    return { firstName: first, lastName: last };
  }
  if (roll < 0.8) {
    const first = MALAY_FIRST[Math.floor(Math.random() * MALAY_FIRST.length)];
    const last = MALAY_LAST[Math.floor(Math.random() * MALAY_LAST.length)];
    return { firstName: first, lastName: last };
  }
  const first = INDIAN_FIRST[Math.floor(Math.random() * INDIAN_FIRST.length)];
  const last = INDIAN_LAST[Math.floor(Math.random() * INDIAN_LAST.length)];
  return { firstName: first, lastName: last };
}

function emailPrefixFromName(firstName, lastName) {
  return (firstName + lastName).replace(/\s+/g, '').toLowerCase();
}

function randomBOD() {
  const year = 1980 + Math.floor(Math.random() * 35);
  const month = 1 + Math.floor(Math.random() * 12);
  const day = 1 + Math.floor(Math.random() * 28);
  return new Date(Date.UTC(year, month - 1, day));
}

// Random last login within the last 30 days
function randomLastLogin() {
  const now = Date.now();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  return new Date(now - Math.random() * thirtyDaysMs);
}

function pickRandomMPs(mpIds, minCount = 0, maxCount = 4) {
  if (!mpIds.length) return [];
  const want = minCount + Math.floor(Math.random() * (maxCount - minCount + 1));
  const n = Math.min(want, mpIds.length);
  const shuffled = [...mpIds].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

async function run() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('MongoDB connected\n');

    const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);

    const mpDocs = await Mp.find({}).select('_id').lean();
    const mpIds = mpDocs.map((d) => String(d._id));
    console.log(`Loaded ${mpIds.length} MPs for followedMPs.\n`);

    const usersToInsert = [];
    const emailPrefixesUsed = new Set();

    const makeUser = (firstName, lastName, emailPrefixSuggestion, stateConstituency) => {
      let emailPrefix = emailPrefixSuggestion || emailPrefixFromName(firstName, lastName);
      let suffix = 0;
      while (emailPrefixesUsed.has(emailPrefix)) {
        suffix++;
        emailPrefix = (emailPrefixSuggestion || emailPrefixFromName(firstName, lastName)) + String(suffix);
      }
      emailPrefixesUsed.add(emailPrefix);
      const username = emailPrefix;
      const email = `${emailPrefix}@myparliament-seed.com`;
      const { state, constituency } = stateConstituency || pickRandomStateConstituency();
      return {
        username,
        email,
        password: hashedPassword,
        role: 'user',
        registrationStatus: 'completed',
        profile: {
          firstName,
          lastName,
          BOD: randomBOD(),
          state,
          constituency,
        },
        followedMPs: pickRandomMPs(mpIds),
        followedTopics: [],
        bookmarks: [],
        preferences: {
          preferredTopics: [],
          notificationPreferences: {
            emailNotifications: true,
            pushNotifications: true,
            mpActivities: true,
            discussionUpdates: true,
            educationalContent: false,
            moderationNotices: true,
          },
        },
        createdAt: new Date(),
        status: 'active',
        lastLogin: randomLastLogin(),
        isRestricted: false,
        notifications: [],
      };
    };

    // 1) Named users (22) – vary state/constituency, 1–2 can share same
    const sharedLocation = pickRandomStateConstituency();
    for (let i = 0; i < NAMED_USERS.length; i++) {
      const u = NAMED_USERS[i];
      const stateConstituency = i < 2 ? sharedLocation : pickRandomStateConstituency();
      usersToInsert.push(makeUser(u.firstName, u.lastName, u.emailPrefix, stateConstituency));
    }

    // 2) 300 random Malaysian-style users
    for (let i = 0; i < 300; i++) {
      const { firstName, lastName } = randomMalaysianName();
      usersToInsert.push(makeUser(firstName, lastName, null, null));
    }

    const existingEmails = await User.find({ email: { $in: usersToInsert.map((u) => u.email) } }).select('email').lean();
    const existingSet = new Set(existingEmails.map((e) => e.email));
    const toInsert = usersToInsert.filter((u) => !existingSet.has(u.email));

    if (toInsert.length === 0) {
      console.log('All seed users already exist. No inserts.');
      return;
    }

    await User.insertMany(toInsert);
    console.log(`Inserted ${toInsert.length} users (${NAMED_USERS.length} named + ${300} random).`);
    console.log('Default password for all: ' + DEFAULT_PASSWORD);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB disconnected');
    process.exit(0);
  }
}

run();
