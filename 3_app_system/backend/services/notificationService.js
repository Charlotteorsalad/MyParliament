const User = require('../models/User');
const nodemailer = require('nodemailer');
const webpush = require('web-push');
const { sendToUser } = require('./sseService');

const FRONTEND_URL = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');

// VAPID keys for Web Push (set in .env or generate with: npx web-push generate-vapid-keys)
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY?.trim();
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY?.trim();
if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(
    'mailto:support@myparliament.example.com',
    VAPID_PUBLIC,
    VAPID_PRIVATE
  );
}

function getTransporter() {
  const emailUser = process.env.EMAIL_USER?.trim();
  const emailPass = (process.env.EMAIL_PASS || '').replace(/\s/g, '').trim();
  if (!emailUser || !emailPass) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: emailUser, pass: emailPass },
    tls: { rejectUnauthorized: false }
  });
}

/**
 * Send a single notification email (subject, body, link).
 * Returns true if sent, false if email not configured or send failed (logged).
 */
async function sendNotificationEmail(toEmail, { subject, title, message, link }) {
  const transporter = getTransporter();
  if (!transporter || !toEmail) return false;
  const fullUrl = link ? (link.startsWith('http') ? link : `${FRONTEND_URL}${link.startsWith('/') ? link : '/' + link}`) : FRONTEND_URL;
  const mailOptions = {
    from: process.env.EMAIL_USER?.trim(),
    to: toEmail,
    subject: subject || title || 'MY Parliament – Notification',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4F46E5;">${title || 'Notification'}</h2>
        <p>${(message || '').replace(/\n/g, '<br>')}</p>
        ${fullUrl ? `<p><a href="${fullUrl}" style="display: inline-block; background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">View</a></p>` : ''}
        <p style="color: #6B7280; font-size: 12px;">MY Parliament</p>
      </div>
    `
  };
  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (err) {
    console.error('[notificationService] sendNotificationEmail failed:', err.message);
    return false;
  }
}

/**
 * Add one in-app notification to a user (User.notifications).
 */
async function addInAppNotification(userId, { type = 'system', title, message, link }) {
  if (!userId) return;
  await User.findByIdAndUpdate(userId, {
    $push: {
      notifications: {
        type,
        title: title || '',
        message: message || '',
        link: link || '',
        read: false,
        createdAt: new Date()
      }
    }
  });
  // Real-time: push notification event to user's SSE connection(s)
  sendToUser(userId, 'notification', { type, title, message, link });
}

/**
 * Load user and return { user, prefs } or null. prefs = preferences.notificationPreferences with defaults.
 */
async function getUserAndPrefs(userId) {
  const user = await User.findById(userId).select('email preferences pushSubscriptions').lean();
  if (!user) return null;
  const np = user.preferences?.notificationPreferences || {};
  const prefs = {
    emailNotifications: np.emailNotifications !== false,
    pushNotifications: np.pushNotifications !== false,
    mpActivities: np.mpActivities !== false,
    discussionUpdates: np.discussionUpdates !== false,
    educationalContent: !!np.educationalContent,
    moderationNotices: np.moderationNotices !== false
  };
  return { user, prefs };
}

/**
 * Send Web Push to all of user's subscriptions. No-op if VAPID not set or no subscriptions.
 */
async function sendPushToUser(userId, { title, body, link }) {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return;
  const user = await User.findById(userId).select('pushSubscriptions').lean();
  if (!user || !user.pushSubscriptions || !user.pushSubscriptions.length) return;
  const fullUrl = link ? (link.startsWith('http') ? link : `${FRONTEND_URL}${link.startsWith('/') ? link : '/' + link}`) : FRONTEND_URL;
  const payload = JSON.stringify({
    title: title || 'MY Parliament',
    body: body || '',
    url: fullUrl
  });
  for (const sub of user.pushSubscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth }
        },
        payload,
        { TTL: 86400 }
      );
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        await User.updateOne(
          { _id: userId },
          { $pull: { pushSubscriptions: { endpoint: sub.endpoint } } }
        ).catch(() => {});
      } else {
        console.error('[notificationService] push failed:', err.message);
      }
    }
  }
}

/**
 * Notify user for moderation (email + push if enabled). In-app is done by caller.
 * Respects moderationNotices preference.
 */
async function sendModerationNotificationEmailIfEnabled(userId, { title, message, link }) {
  const data = await getUserAndPrefs(userId);
  if (!data || !data.prefs.moderationNotices) return;
  const { user, prefs } = data;
  if (prefs.emailNotifications && user.email) {
    await sendNotificationEmail(user.email, {
      subject: title || 'MY Parliament – Forum update',
      title,
      message,
      link
    });
  }
  if (prefs.pushNotifications) {
    sendPushToUser(userId, { title: title || 'Forum update', body: message || '', link }).catch((err) =>
      console.error('[notificationService] moderation push failed:', err.message)
    );
  }
}

/**
 * Full flow: add in-app notification, then email and push respecting preferences.
 * contentPreferenceKey: 'discussionUpdates' | 'mpActivities' | 'educationalContent'
 */
async function notifyUser(userId, { type = 'system', title, message, link }, contentPreferenceKey = null) {
  if (!userId) return;
  await addInAppNotification(userId, { type, title, message, link });
  const data = await getUserAndPrefs(userId);
  if (!data) return;
  const { user, prefs } = data;
  const allowContent = !contentPreferenceKey || prefs[contentPreferenceKey];
  if (allowContent && prefs.emailNotifications && user.email) {
    await sendNotificationEmail(user.email, {
      subject: title || 'MY Parliament – Notification',
      title,
      message,
      link
    });
  }
  if (allowContent && prefs.pushNotifications) {
    sendPushToUser(userId, { title: title || 'Notification', body: message || '', link }).catch((err) =>
      console.error('[notificationService] push failed:', err.message)
    );
  }
}

module.exports = {
  getTransporter,
  sendNotificationEmail,
  addInAppNotification,
  getUserAndPrefs,
  sendModerationNotificationEmailIfEnabled,
  notifyUser,
  sendPushToUser,
  FRONTEND_URL,
  getVapidPublicKey: () => VAPID_PUBLIC || null
};
