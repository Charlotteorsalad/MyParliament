const mongoose = require('mongoose');

const workNoteSchema = new mongoose.Schema({
  author: {
    type: String,
    required: true
  },
  authorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AdminUser',
    required: true
  },
  content: {
    type: String,
    required: true,
    maxlength: 2000
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  isPublic: {
    type: Boolean,
    default: true
  }
});

const incidentSchema = new mongoose.Schema({
  number: {
    type: String,
    required: true,
    unique: true
  },
  shortDescription: {
    type: String,
    required: true,
    maxlength: 200
  },
  description: {
    type: String,
    required: true,
    maxlength: 5000
  },
  state: {
    type: String,
    enum: ['New', 'In Progress', 'Resolved', 'Closed', 'Cancelled'],
    default: 'New'
  },
  priority: {
    type: String,
    enum: ['1 - Critical', '2 - High', '3 - Medium', '4 - Low'],
    default: '3 - Medium'
  },
  urgency: {
    type: String,
    enum: ['1 - Critical', '2 - High', '3 - Medium', '4 - Low'],
    default: '3 - Medium'
  },
  impact: {
    type: String,
    enum: ['1 - Critical', '2 - High', '3 - Medium', '4 - Low'],
    default: '3 - Medium'
  },
  category: {
    type: String,
    enum: ['Software', 'Hardware', 'Infrastructure', 'Security', 'Network', 'Other'],
    required: true
  },
  subcategory: {
    type: String,
    required: true
  },
  caller: {
    type: String,
    required: true
  },
  callerEmail: {
    type: String,
    required: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AdminUser',
    default: null
  },
  assignedToName: {
    type: String,
    default: 'Unassigned'
  },
  assignmentGroup: {
    type: String,
    enum: ['Application Development', 'IT Support', 'Infrastructure', 'Security', 'Network', 'Other'],
    required: true
  },
  openedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AdminUser',
    required: true
  },
  openedByName: {
    type: String,
    required: true
  },
  workNotes: [workNoteSchema],
  resolutionNotes: {
    type: String,
    maxlength: 2000
  },
  businessService: {
    type: String,
    required: true
  },
  configurationItem: {
    type: String,
    required: true
  },
  slaDue: {
    type: Date
  },
  escalationLevel: {
    type: Number,
    default: 0
  },
  isEscalated: {
    type: Boolean,
    default: false
  },
  resolvedAt: {
    type: Date
  },
  closedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes for better query performance
// Note: number field already has unique index from schema definition
incidentSchema.index({ state: 1 });
incidentSchema.index({ priority: 1 });
incidentSchema.index({ assignedTo: 1 });
incidentSchema.index({ assignmentGroup: 1 });
incidentSchema.index({ category: 1 });
incidentSchema.index({ createdAt: -1 });
incidentSchema.index({ slaDue: 1 });

// Pre-save middleware to generate incident number
incidentSchema.pre('save', async function(next) {
  if (this.isNew && !this.number) {
    const count = await this.constructor.countDocuments();
    this.number = `INC${String(count + 1).padStart(7, '0')}`;
  }
  next();
});

// Pre-save middleware to update SLA due date based on priority
incidentSchema.pre('save', function(next) {
  if (this.isNew || this.isModified('priority')) {
    const now = new Date();
    let slaHours = 24; // Default 24 hours
    
    switch (this.priority) {
      case '1 - Critical':
        slaHours = 4;
        break;
      case '2 - High':
        slaHours = 8;
        break;
      case '3 - Medium':
        slaHours = 24;
        break;
      case '4 - Low':
        slaHours = 72;
        break;
    }
    
    this.slaDue = new Date(now.getTime() + slaHours * 60 * 60 * 1000);
  }
  next();
});

module.exports = mongoose.model('Incident', incidentSchema);
