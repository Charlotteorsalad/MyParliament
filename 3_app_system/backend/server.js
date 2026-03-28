const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

const authRoutes = require("./routes/auth");
const userRoutes = require('./routes/user');
const eduRoutes = require('./routes/edu');
const mpRoutes = require('./routes/mps');
const adminRoutes = require('./routes/admin');
const adminAuthRoutes = require('./routes/adminAuth');
const adminEduRoutes = require('./routes/adminEdu');
const userMonitoringRoutes = require('./routes/userMonitoring');
const feedbackRoutes = require('./routes/feedback');
const publicFeedbackRoutes = require('./routes/publicFeedback');
const forumModerationRoutes = require('./routes/forumModeration');
const technicalSupportRoutes = require('./routes/technicalSupport');
const topicRoutes = require('./routes/topics');
const forumRoutes = require('./routes/forum');
const bookmarkRoutes = require('./routes/bookmarks');
const quizRoutes = require('./routes/quiz');
const reportRoutes = require('./routes/reports');
const issuePortalRoutes = require('./routes/issuePortal');
const surveyRoutes = require('./routes/survey');
const sseRoutes = require('./routes/sse');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

// Maintenance mode middleware: blocks public API when an approved MaintenanceTask
// is active (current time falls within its scheduled window).
const MaintenanceTask = require('./models/MaintenanceTask');

// Times entered by admin are in Malaysia time (UTC+8).
// We parse them as MYT by appending +08:00 so comparisons against UTC now() are correct.
const buildWindow = (scheduledDate, startStr, endStr) => {
  const dateOnly = new Date(scheduledDate).toISOString().slice(0, 10); // "YYYY-MM-DD"
  const startDt = new Date(`${dateOnly}T${startStr || '00:00'}:00+08:00`);
  let endDt     = new Date(`${dateOnly}T${endStr   || '23:59'}:00+08:00`);
  if (endDt <= startDt) endDt = new Date(endDt.getTime() + 24 * 60 * 60 * 1000);
  return { startDt, endDt };
};

const maintenanceGuard = async (req, res, next) => {
  try {
    const now = new Date();
    const dayAgo = new Date(now); dayAgo.setDate(dayAgo.getDate() - 1);
    const dayFwd = new Date(now); dayFwd.setDate(dayFwd.getDate() + 1);

    const candidates = await MaintenanceTask.find({
      status: { $in: ['Scheduled', 'In Progress'] },
      approvalStatus: 'Approved',
      scheduledDate: { $gte: dayAgo, $lte: dayFwd }
    }).select('title description scheduledDate scheduledStartTime scheduledEndTime');

    for (const task of candidates) {
      const { startDt, endDt } = buildWindow(
        task.scheduledDate,
        task.scheduledStartTime,
        task.scheduledEndTime
      );
      if (now >= startDt && now <= endDt) {
        return res.status(503).json({
          maintenanceMode: true,
          title: `System Maintenance – ${task.title}`,
          message: task.description || 'The system is currently undergoing scheduled maintenance.',
          endTime: endDt
        });
      }
    }
    next();
  } catch {
    next();
  }
};

dotenv.config();

// Set JWT_SECRET if not already set
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'supersecret';
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increase limit for Base64 images
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static files from uploads directory
const path = require('path');
const fs = require('fs');
const uploadsPath = path.join(__dirname, 'uploads');

// Serve edu-content attachments with Content-Disposition: inline so "View" opens in browser instead of downloading
app.get('/uploads/edu-content/:filename', (req, res) => {
  const filename = path.basename(req.params.filename);
  if (!filename) return res.status(400).send('Bad request');
  const filePath = path.join(__dirname, 'uploads', 'edu-content', filename);
  const resolved = path.resolve(filePath);
  const allowedDir = path.resolve(path.join(__dirname, 'uploads', 'edu-content'));
  if (!resolved.startsWith(allowedDir) || !fs.existsSync(filePath)) {
    return res.status(404).send('Not found');
  }
  res.setHeader('Content-Disposition', 'inline');
  res.sendFile(filePath);
});

app.use('/uploads', express.static(uploadsPath));

// Test route to verify file serving
app.get('/test-uploads', (req, res) => {
  const fs = require('fs');
  const path = require('path');
  const uploadDir = path.join(__dirname, 'uploads', 'edu-content');
  
  if (fs.existsSync(uploadDir)) {
    const files = fs.readdirSync(uploadDir);
    res.json({
      message: 'Uploads directory exists',
      uploadDir: uploadDir,
      files: files,
      fileCount: files.length
    });
  } else {
    res.json({
      message: 'Uploads directory does not exist',
      uploadDir: uploadDir
    });
  }
});

// Test route to check specific file
app.get('/test-file/:filename', (req, res) => {
  const fs = require('fs');
  const path = require('path');
  const filePath = path.join(__dirname, 'uploads', 'edu-content', req.params.filename);
  
  if (fs.existsSync(filePath)) {
    res.json({
      message: 'File exists',
      filePath: filePath,
      size: fs.statSync(filePath).size
    });
  } else {
    res.json({
      message: 'File does not exist',
      filePath: filePath
    });
  }
});

// Check attachment URLs
app.get('/check-attachment-urls', async (req, res) => {
  try {
    const { EduResource } = require('./models/EduResource');
    
    // Find all content with attachments
    const contents = await EduResource.find({
      $or: [
        { 'contentAttachments.0': { $exists: true } },
        { 'quizAttachments.0': { $exists: true } },
        { 'attachments.0': { $exists: true } }
      ]
    });

    const urlInfo = contents.map(content => ({
      title: content.title || content.name,
      contentAttachments: content.contentAttachments?.map(att => att.url) || [],
      quizAttachments: content.quizAttachments?.map(att => att.url) || [],
      attachments: content.attachments?.map(att => att.url) || []
    }));

    res.json({
      message: 'Attachment URLs found',
      totalContent: contents.length,
      urlInfo: urlInfo
    });

  } catch (error) {
    console.error('Check failed:', error);
    res.status(500).json({ error: 'Check failed', details: error.message });
  }
});

// Migration route to move legacy attachments to content attachments
app.post('/migrate-legacy-attachments', async (req, res) => {
  try {
    const { EduResource } = require('./models/EduResource');
    
    // Find all content with legacy attachments but no content attachments
    const contents = await EduResource.find({
      'attachments.0': { $exists: true },
      $or: [
        { 'contentAttachments.0': { $exists: false } },
        { 'contentAttachments': { $size: 0 } }
      ]
    });

    let updatedCount = 0;

    for (const content of contents) {
      if (content.attachments && content.attachments.length > 0) {
        await EduResource.findByIdAndUpdate(content._id, {
          $set: { contentAttachments: content.attachments },
          $unset: { attachments: 1 }
        });
        updatedCount++;
      }
    }

    res.json({
      message: 'Legacy attachments migration completed',
      totalContent: contents.length,
      updatedCount: updatedCount
    });

  } catch (error) {
    console.error('Migration failed:', error);
    res.status(500).json({ error: 'Migration failed', details: error.message });
  }
});

// Migration route to update attachment URLs
app.post('/migrate-attachment-urls', async (req, res) => {
  try {
    const { EduResource } = require('./models/EduResource');
    
    // Find all content with attachments
    const contents = await EduResource.find({
      $or: [
        { 'contentAttachments.0': { $exists: true } },
        { 'quizAttachments.0': { $exists: true } },
        { 'attachments.0': { $exists: true } }
      ]
    });

    let updatedCount = 0;

    for (const content of contents) {
      let needsUpdate = false;
      const updateData = {};

      // Update contentAttachments
      if (content.contentAttachments && content.contentAttachments.length > 0) {
        const updatedContentAttachments = content.contentAttachments.map(attachment => {
          if (attachment.url && attachment.url.includes('localhost:5173')) {
            needsUpdate = true;
            return {
              ...attachment,
              url: attachment.url.replace('localhost:5173', 'localhost:5000')
            };
          }
          return attachment;
        });
        if (needsUpdate) {
          updateData.contentAttachments = updatedContentAttachments;
        }
      }

      // Update quizAttachments
      if (content.quizAttachments && content.quizAttachments.length > 0) {
        const updatedQuizAttachments = content.quizAttachments.map(attachment => {
          if (attachment.url && attachment.url.includes('localhost:5173')) {
            needsUpdate = true;
            return {
              ...attachment,
              url: attachment.url.replace('localhost:5173', 'localhost:5000')
            };
          }
          return attachment;
        });
        if (needsUpdate) {
          updateData.quizAttachments = updatedQuizAttachments;
        }
      }

      // Update legacy attachments
      if (content.attachments && content.attachments.length > 0) {
        const updatedAttachments = content.attachments.map(attachment => {
          if (attachment.url && attachment.url.includes('localhost:5173')) {
            needsUpdate = true;
            return {
              ...attachment,
              url: attachment.url.replace('localhost:5173', 'localhost:5000')
            };
          }
          return attachment;
        });
        if (needsUpdate) {
          updateData.attachments = updatedAttachments;
        }
      }

      // Update the document if needed
      if (needsUpdate) {
        await EduResource.findByIdAndUpdate(content._id, updateData);
        updatedCount++;
      }
    }

    res.json({
      message: 'Migration completed',
      totalContent: contents.length,
      updatedCount: updatedCount
    });

  } catch (error) {
    console.error('Migration failed:', error);
    res.status(500).json({ error: 'Migration failed', details: error.message });
  }
});

// SSE real-time push – no maintenance guard, no auth required for connection
app.use('/api/sse', sseRoutes);

// Admin routes – mount specific subroutes before the generic /api/admin router
// so public/admin-specialized paths are not intercepted by the generic guard.
app.use('/api/admin-auth', adminAuthRoutes);
app.use('/api/admin/edu', adminEduRoutes);
app.use('/api/admin/monitoring', userMonitoringRoutes);
app.use('/api/admin/feedback', feedbackRoutes);
app.use('/api/admin/forum-moderation', forumModerationRoutes);
app.use('/api/admin/technical-support', technicalSupportRoutes);
app.use('/api/admin/surveys', surveyRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/surveys', maintenanceGuard, surveyRoutes);

// Apply maintenance guard to all public/user-facing API routes
app.use('/api/auth', maintenanceGuard, authRoutes);
app.use('/api/user', maintenanceGuard, userRoutes);
app.use('/api/edu', maintenanceGuard, eduRoutes);
app.use('/api/mps', maintenanceGuard, mpRoutes);
app.use('/api/forum', maintenanceGuard, forumRoutes);
app.use('/api/bookmarks', maintenanceGuard, bookmarkRoutes);
app.use('/api/quiz', maintenanceGuard, quizRoutes);
app.use('/api/feedback', maintenanceGuard, publicFeedbackRoutes);
app.use('/api/reports', maintenanceGuard, reportRoutes);
app.use('/api/topics', maintenanceGuard, topicRoutes);
app.use('/api/issue-portal', maintenanceGuard, issuePortalRoutes);
app.use(notFound);       
app.use(errorHandler);  

const PORT = process.env.PORT || 5000;
const startPythonServices = require('./utils/startPythonServices');

const { checkHealth: checkSentimentHealth } = require('./services/sentimentService');

async function startServer() {
  try {
    await connectDB();
  } catch (err) {
    console.error('Failed to connect to MongoDB:', err.message);
    console.error('Ensure MONGO_URI is set in .env and MongoDB is running.');
    process.exit(1);
  }
  // Start admin performance data collection only after DB is connected
  const { startPerformanceCollection } = require('./controllers/adminController');
  startPerformanceCollection();
  const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    startPythonServices.startAll();
    setTimeout(() => checkSentimentHealth(), 30000);
  });
  server.on('error', onServerError);
}

function onServerError(error) {
  const PORT = process.env.PORT || 5000;
  if (error.code === 'EADDRINUSE') {
    console.error(`\nPort ${PORT} is already in use!`);
    console.error(`\nTo fix this, you can:`);
    console.error(`1. Kill the process using port ${PORT}:`);
    console.error(`   Windows: netstat -ano | findstr :${PORT}`);
    console.error(`   Then: taskkill /PID <PID> /F`);
    console.error(`2. Or change PORT in .env file to a different port\n`);
    process.exit(1);
  } else {
    throw error;
  }
}

startServer();

