/**
 * Persist which topics/posts the current user has reported (per userId).
 * Merged with backend currentUserHasReported so that after refresh we still show "Reported".
 */
const STORAGE_KEY = 'forum_reported';

function read() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function write(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('forumReportedStorage write failed', e);
  }
}

function getKey(userId) {
  return userId ? String(userId) : null;
}

export function getReportedTopicIds(userId) {
  const key = getKey(userId);
  if (!key) return new Set();
  const data = read();
  const user = data[key];
  return new Set(user?.topics || []);
}

export function getReportedPostIds(userId) {
  const key = getKey(userId);
  if (!key) return new Set();
  const data = read();
  const user = data[key];
  return new Set(user?.posts || []);
}

export function addReportedTopic(userId, topicId) {
  const key = getKey(userId);
  if (!key || !topicId) return;
  const data = read();
  if (!data[key]) data[key] = { topics: [], posts: [] };
  const ids = data[key].topics;
  const idStr = String(topicId);
  if (!ids.includes(idStr)) {
    ids.push(idStr);
    write(data);
  }
}

export function addReportedPost(userId, postId) {
  const key = getKey(userId);
  if (!key || !postId) return;
  const data = read();
  if (!data[key]) data[key] = { topics: [], posts: [] };
  const ids = data[key].posts;
  const idStr = String(postId);
  if (!ids.includes(idStr)) {
    ids.push(idStr);
    write(data);
  }
}
