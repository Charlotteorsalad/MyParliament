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
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

dotenv.config();

// Set JWT_SECRET if not already set
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'supersecret';
  console.log('JWT_SECRET set to: supersecret');
}

connectDB();

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increase limit for Base64 images
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static files from uploads directory
const path = require('path');
const uploadsPath = path.join(__dirname, 'uploads');
console.log('Static files serving from:', uploadsPath);
console.log('Uploads directory exists:', require('fs').existsSync(uploadsPath));
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
  
  console.log('Testing file access for:', filePath);
  console.log('File exists:', fs.existsSync(filePath));
  
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

    console.log(`Found ${contents.length} content items with legacy attachments`);

    let updatedCount = 0;

    for (const content of contents) {
      if (content.attachments && content.attachments.length > 0) {
        // Move legacy attachments to content attachments
        await EduResource.findByIdAndUpdate(content._id, {
          $set: { contentAttachments: content.attachments },
          $unset: { attachments: 1 }
        });
        console.log(`Moved legacy attachments to content attachments for: ${content.title || content.name}`);
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

    console.log(`Found ${contents.length} content items with attachments`);

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
        console.log(`Updated content: ${content.title || content.name}`);
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

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/edu', eduRoutes);
app.use('/api/mps', mpRoutes);
app.use('/api/forum', forumRoutes);
app.use('/api/bookmarks', bookmarkRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/feedback', publicFeedbackRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin-auth', adminAuthRoutes);
app.use('/api/admin/edu', adminEduRoutes);
app.use('/api/admin/monitoring', userMonitoringRoutes);
app.use('/api/admin/feedback', feedbackRoutes);
app.use('/api/admin/forum-moderation', forumModerationRoutes);
app.use('/api/admin/technical-support', technicalSupportRoutes);
app.use('/api/topics', topicRoutes);
app.use(notFound);       
app.use(errorHandler);  

app.listen(5000, () => {
  console.log('Server running on port 5000');
});

