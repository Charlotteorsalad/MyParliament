const { EduResource, Quiz } = require('../models/EduResource');
const asyncHandler = require('../middleware/asyncHandler');
const { parseQuizQuestionsPayload } = require('../utils/quizNormalize');
const multer = require('multer');
const { broadcast } = require('../services/sseService');
const path = require('path');
const fs = require('fs');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/edu-content';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow all file types for content and quiz attachments
    cb(null, true);
  }
});

// Get all educational content with pagination and filtering
const getAllEduContent = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  
  const { status, category, search, hasQuiz, attachmentsCount, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
  
  // Build filter object
  const filter = {};
  if (status) filter.status = status;
  if (category) filter.category = category;
  if (hasQuiz !== undefined) {
    if (hasQuiz === 'true') {
      filter.quiz = { $exists: true, $ne: null };
    } else {
      filter.$or = [
        { quiz: { $exists: false } },
        { quiz: null }
      ];
    }
  }
  if (attachmentsCount !== undefined) {
    if (attachmentsCount === 'has') {
      // Has at least one attachment (content, quiz, or legacy)
      filter.$expr = {
        $gte: [
          { $add: [
            { $size: { $ifNull: ['$contentAttachments', []] } },
            { $size: { $ifNull: ['$quizAttachments', []] } },
            { $size: { $ifNull: ['$attachments', []] } }
          ]},
          1
        ]
      };
    } else {
      const count = parseInt(attachmentsCount, 10);
      if (count === 0) {
        filter.$and = [
          { contentAttachments: { $size: 0 } },
          { quizAttachments: { $size: 0 } },
          { attachments: { $size: 0 } }
        ];
      } else if (count >= 1) {
        filter.$expr = {
          $eq: [
            { $add: [
              { $size: { $ifNull: ['$contentAttachments', []] } },
              { $size: { $ifNull: ['$quizAttachments', []] } },
              { $size: { $ifNull: ['$attachments', []] } }
            ]},
            count
          ]
        };
      }
    }
  }
  if (search) {
    filter.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { content: { $regex: search, $options: 'i' } }
    ];
  }
  
  // Build sort object
  let sort = {};
  
  // Handle special sort fields
  if (sortBy === 'hasQuiz') {
    // Sort by quiz existence: items with quiz come first (desc) or last (asc)
    sort = sortOrder === 'desc' 
      ? { quiz: -1 } // Has quiz first
      : { quiz: 1 }; // No quiz first (null/undefined come first)
  } else if (sortBy === 'attachmentsCount') {
    // For attachments count, we'll use aggregation pipeline
    // For now, use a simple approach: sort by contentAttachments length
    sort = sortOrder === 'desc'
      ? { 'contentAttachments': -1 }
      : { 'contentAttachments': 1 };
  } else {
    // Standard field sorting
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
  }
  
  let content;
  
  // Use aggregation for attachmentsCount sorting to calculate total attachments
  if (sortBy === 'attachmentsCount') {
    const pipeline = [
      { $match: filter },
      {
        $addFields: {
          totalAttachments: {
            $add: [
              { $size: { $ifNull: ['$contentAttachments', []] } },
              { $size: { $ifNull: ['$quizAttachments', []] } },
              { $size: { $ifNull: ['$attachments', []] } }
            ]
          }
        }
      },
      { $sort: { totalAttachments: sortOrder === 'desc' ? -1 : 1 } },
      { $skip: skip },
      { $limit: limit }
    ];
    
    const results = await EduResource.aggregate(pipeline);
    const ids = results.map(r => r._id);
    
    // Fetch full documents with population
    content = await EduResource.find({ _id: { $in: ids } })
      .populate('createdBy', 'username email')
      .populate('updatedBy', 'username email')
      .populate('quiz', 'title questions');
    
    // Maintain sort order from aggregation
    const contentMap = new Map(content.map(c => [c._id.toString(), c]));
    content = ids.map(id => contentMap.get(id.toString())).filter(Boolean);
  } else {
    content = await EduResource.find(filter)
      .populate('createdBy', 'username email')
      .populate('updatedBy', 'username email')
      .populate('quiz', 'title questions')
      .sort(sort)
      .skip(skip)
      .limit(limit);
  }
  
  const total = await EduResource.countDocuments(filter);
  
  res.json({
    content,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  });
});

// Get single educational content by ID
const getEduContentById = asyncHandler(async (req, res) => {
  const content = await EduResource.findById(req.params.id)
    .populate('createdBy', 'username email')
    .populate('updatedBy', 'username email')
    .populate('quiz', 'title questions timeLimit passingScore');
  
  if (!content) {
    return res.status(404).json({ message: 'Educational content not found' });
  }
  
  res.json(content);
});

// Create new educational content
const createEduContent = asyncHandler(async (req, res) => {
  const {
    title,
    description,
    content,
    category,
    tags,
    themes,
    timeToRead,
    difficulty,
    featured,
    imageData,
    imageContentType,
    imageSize,
    imageOriginalName,
    hasQuiz,
    quizTitle,
    quizDescription,
    quizTimeLimit,
    quizPassingScore,
    quizMaxAttempts,
    quizQuestions,
    status
  } = req.body;
  
  const isDraft = status === 'draft';
  const eduContent = new EduResource({
    name: title, // Set name field (required) to match title
    title,
    description,
    content,
    category,
    tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
    themes: themes ? themes.split(',').map(theme => theme.trim()) : [],
    timeToRead: parseInt(timeToRead) || 5,
    difficulty: difficulty || 'beginner',
    featured: featured === 'true',
    image: imageData ? {
      data: imageData,
      contentType: imageContentType,
      size: parseInt(imageSize) || 0,
      originalName: imageOriginalName || 'image'
    } : undefined,
    quiz: (() => {
      
      if (hasQuiz && quizTitle) {
        // Parse quiz questions (string or array) and filter out those without correct answers
        const parsedQuestions = parseQuizQuestionsPayload(quizQuestions);
        const validQuestions = parsedQuestions.filter(q => 
          q.question && q.question.trim() && 
          q.correctAnswer !== null && q.correctAnswer !== undefined
        );
        
        const quizObj = {
          title: quizTitle,
          description: quizDescription || '',
          questions: validQuestions,
          timeLimit: parseInt(quizTimeLimit) || 30,
          passingScore: parseInt(quizPassingScore) || 70,
          maxAttempts: parseInt(quizMaxAttempts) || 3,
          isActive: true
        };
        return quizObj;
      } else {
        return undefined;
      }
    })(),
    createdBy: req.admin._id,
    status: isDraft ? 'draft' : (status || 'published'),
    ...(isDraft ? {} : { publishedAt: new Date() })
  });
  
  await eduContent.save();
  broadcast('edu_updated', { action: 'create', id: String(eduContent._id) });
  res.status(201).json({
    message: 'Educational content created successfully',
    content: eduContent
  });
});

// Update educational content
const updateEduContent = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = { ...req.body };
  
  // Handle tags array
  if (updateData.tags && typeof updateData.tags === 'string') {
    updateData.tags = updateData.tags.split(',').map(tag => tag.trim());
  }
  
  // Handle themes array
  if (updateData.themes && typeof updateData.themes === 'string') {
    updateData.themes = updateData.themes.split(',').map(theme => theme.trim());
  }
  
  // Convert string booleans
  if (updateData.featured === 'true') updateData.featured = true;
  if (updateData.featured === 'false') updateData.featured = false;
  
  // Handle image data
  if (updateData.imageData) {
    updateData.image = {
      data: updateData.imageData,
      contentType: updateData.imageContentType,
      size: parseInt(updateData.imageSize) || 0,
      originalName: updateData.imageOriginalName || 'image'
    };
    // Remove the individual image fields from updateData
    delete updateData.imageData;
    delete updateData.imageContentType;
    delete updateData.imageSize;
    delete updateData.imageOriginalName;
  }
  
  // Sync name field with title for consistency
  if (updateData.title) {
    updateData.name = updateData.title;
  }
  
  updateData.updatedBy = req.admin._id;
  
  const content = await EduResource.findByIdAndUpdate(
    id,
    updateData,
    { new: true, runValidators: true }
  ).populate('createdBy', 'username email')
   .populate('updatedBy', 'username email');
  
  if (!content) {
    return res.status(404).json({ message: 'Educational content not found' });
  }
  broadcast('edu_updated', { action: 'update', id: String(content._id) });
  res.json({
    message: 'Educational content updated successfully',
    content
  });
});

// Publish educational content
const publishEduContent = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const content = await EduResource.findByIdAndUpdate(
    id,
    { 
      status: 'published',
      publishedAt: new Date(),
      updatedBy: req.admin._id
    },
    { new: true, runValidators: true }
  );
  
  if (!content) {
    return res.status(404).json({ message: 'Educational content not found' });
  }
  broadcast('edu_updated', { action: 'publish', id: String(content._id) });
  res.json({
    message: 'Educational content published successfully',
    content
  });
});

// Archive educational content
const archiveEduContent = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const content = await EduResource.findByIdAndUpdate(
    id,
    { 
      status: 'archived',
      updatedBy: req.admin._id
    },
    { new: true, runValidators: true }
  );
  
  if (!content) {
    return res.status(404).json({ message: 'Educational content not found' });
  }
  broadcast('edu_updated', { action: 'archive', id: String(content._id) });
  res.json({
    message: 'Educational content archived successfully',
    content
  });
});

// Delete educational content
const deleteEduContent = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const content = await EduResource.findByIdAndDelete(id);
  if (!content) {
    return res.status(404).json({ message: 'Educational content not found' });
  }
  
  // Delete associated files
  if (content.attachments && content.attachments.length > 0) {
    content.attachments.forEach(attachment => {
      const filePath = path.join('uploads/edu-content', attachment.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });
  }
  
  broadcast('edu_updated', { action: 'delete', id });
  res.json({ message: 'Educational content deleted successfully' });
});

// Upload file attachment
const uploadAttachment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const attachmentType = req.body.attachmentType || 'content';
  
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }
  
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
  
  const attachment = {
    filename: req.file.filename,
    originalName: req.file.originalname,
    mimeType: req.file.mimetype,
    size: req.file.size,
    url: `${backendUrl}/uploads/edu-content/${req.file.filename}`
  };
  
  const updateField = attachmentType === 'quiz' ? 'quizAttachments' : 'contentAttachments';
  
  const content = await EduResource.findByIdAndUpdate(
    id,
    { $push: { [updateField]: attachment } },
    { new: true, runValidators: true }
  );
  
  if (!content) {
    return res.status(404).json({ message: 'Educational content not found' });
  }
  
  res.json({
    message: 'File uploaded successfully',
    attachment,
    attachmentType
  });
});

// Upload featured image
const uploadImage = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  if (!req.file) {
    return res.status(400).json({ message: 'No image uploaded' });
  }
  
  // Validate image type
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
  if (!allowedTypes.includes(req.file.mimetype)) {
    return res.status(400).json({ message: 'Invalid image type. Only JPG, PNG, and GIF are allowed.' });
  }
  
  const image = {
    filename: req.file.filename,
    originalName: req.file.originalname,
    mimeType: req.file.mimetype,
    size: req.file.size,
    url: `/uploads/edu-content/${req.file.filename}`
  };
  
  const content = await EduResource.findByIdAndUpdate(
    id,
    { image: image },
    { new: true, runValidators: true }
  );
  
  if (!content) {
    return res.status(404).json({ message: 'Educational content not found' });
  }
  
  res.json({
    message: 'Image uploaded successfully',
    image
  });
});

// Remove file attachment
const removeAttachment = asyncHandler(async (req, res) => {
  const { id, attachmentId } = req.params;
  
  const content = await EduResource.findById(id);
  if (!content) {
    return res.status(404).json({ message: 'Educational content not found' });
  }
  
  const attachment = content.attachments.id(attachmentId);
  if (!attachment) {
    return res.status(404).json({ message: 'Attachment not found' });
  }
  
  // Delete file from filesystem
  const filePath = path.join('uploads/edu-content', attachment.filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  
  // Remove from database
  content.attachments.pull(attachmentId);
  await content.save();
  
  res.json({ message: 'Attachment removed successfully' });
});

// Quiz Management
// Create quiz
const createQuiz = asyncHandler(async (req, res) => {
  const { title, description, questions, timeLimit, passingScore, maxAttempts } = req.body;
  
  const quiz = new Quiz({
    title,
    description,
    questions,
    timeLimit: parseInt(timeLimit) || 30,
    passingScore: parseInt(passingScore) || 70,
    maxAttempts: parseInt(maxAttempts) || 3,
    createdBy: req.admin._id
  });
  
  await quiz.save();
  
  res.status(201).json({
    message: 'Quiz created successfully',
    quiz
  });
});

// Get all quizzes
const getAllQuizzes = asyncHandler(async (req, res) => {
  const quizzes = await Quiz.find({})
    .populate('createdBy', 'username email')
    .sort({ createdAt: -1 });
  
  res.json(quizzes);
});

// Update quiz
const updateQuiz = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = { ...req.body };
  
  const quiz = await Quiz.findByIdAndUpdate(
    id,
    updateData,
    { new: true, runValidators: true }
  );
  
  if (!quiz) {
    return res.status(404).json({ message: 'Quiz not found' });
  }
  
  res.json({
    message: 'Quiz updated successfully',
    quiz
  });
});

// Delete quiz
const deleteQuiz = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const quiz = await Quiz.findByIdAndDelete(id);
  if (!quiz) {
    return res.status(404).json({ message: 'Quiz not found' });
  }
  
  res.json({ message: 'Quiz deleted successfully' });
});

// Assign quiz to educational content
const assignQuiz = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { quizId } = req.body;
  
  const content = await EduResource.findByIdAndUpdate(
    id,
    { quiz: quizId, updatedBy: req.admin._id },
    { new: true, runValidators: true }
  );
  
  if (!content) {
    return res.status(404).json({ message: 'Educational content not found' });
  }
  
  res.json({
    message: 'Quiz assigned successfully',
    content
  });
});

// Get educational content statistics
const getEduContentStats = asyncHandler(async (req, res) => {
  const totalContent = await EduResource.countDocuments({});
  const publishedContent = await EduResource.countDocuments({ status: 'published' });
  const draftContent = await EduResource.countDocuments({ status: 'draft' });
  const archivedContent = await EduResource.countDocuments({ status: 'archived' });
  
  const categoryStats = await EduResource.aggregate([
    { $group: { _id: '$category', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);
  
  const recentContent = await EduResource.find({})
    .populate('createdBy', 'username')
    .sort({ createdAt: -1 })
    .limit(5)
    .select('title status createdAt createdBy');
  
  res.json({
    totalContent,
    publishedContent,
    draftContent,
    archivedContent,
    categoryStats,
    recentContent
  });
});

// Migration function to remove old Cloudinary image data
const migrateImages = asyncHandler(async (req, res) => {
  try {
    const resourcesWithOldImages = await EduResource.find({
      'image.public_id': { $exists: true }
    });
    
    const result = await EduResource.updateMany(
      { 'image.public_id': { $exists: true } },
      { $unset: { image: 1 } }
    );
    
    res.json({
      message: 'Image migration completed successfully',
      resourcesFound: resourcesWithOldImages.length,
      resourcesUpdated: result.modifiedCount
    });
  } catch (error) {
    console.error('Migration error:', error);
    res.status(500).json({
      message: 'Migration failed',
      error: error.message
    });
  }
});

module.exports = {
  getAllEduContent,
  getEduContentById,
  createEduContent,
  updateEduContent,
  publishEduContent,
  archiveEduContent,
  deleteEduContent,
  uploadAttachment,
  uploadImage,
  removeAttachment,
  createQuiz,
  getAllQuizzes,
  updateQuiz,
  deleteQuiz,
  assignQuiz,
  getEduContentStats,
  upload, // Export multer upload middleware
  migrateImages
};
