const mongoose = require('mongoose');

const maintenanceTaskSchema = new mongoose.Schema({
  number: {
    type: String,
    required: true,
    unique: true
  },
  title: {
    type: String,
    required: true,
    maxlength: 200
  },
  description: {
    type: String,
    required: true,
    maxlength: 2000
  },
  type: {
    type: String,
    enum: ['Scheduled', 'Emergency', 'Preventive', 'Corrective', 'Upgrade', 'Security'],
    required: true
  },
  priority: {
    type: String,
    enum: ['1 - Critical', '2 - High', '3 - Medium', '4 - Low'],
    default: '3 - Medium'
  },
  status: {
    type: String,
    enum: ['Scheduled', 'In Progress', 'Completed', 'Cancelled', 'Failed'],
    default: 'Scheduled'
  },
  category: {
    type: String,
    enum: ['System', 'Database', 'Network', 'Security', 'Application', 'Infrastructure', 'Other'],
    required: true
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
    enum: ['Application Development', 'IT Support', 'Infrastructure', 'Security', 'Network', 'Database', 'Other'],
    required: true
  },
  scheduledDate: {
    type: Date,
    required: true
  },
  scheduledStartTime: {
    type: String,
    required: true
  },
  scheduledEndTime: {
    type: String,
    required: true
  },
  estimatedDuration: {
    type: String,
    required: true
  },
  actualStartTime: {
    type: Date
  },
  actualEndTime: {
    type: Date
  },
  actualDuration: {
    type: String
  },
  isRecurring: {
    type: Boolean,
    default: false
  },
  recurrencePattern: {
    type: String,
    enum: ['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Yearly'],
    required: function() {
      return this.isRecurring;
    }
  },
  recurrenceInterval: {
    type: Number,
    default: 1,
    min: 1
  },
  nextScheduledDate: {
    type: Date
  },
  businessService: {
    type: String,
    maxlength: 200
  },
  configurationItems: [{
    type: String,
    maxlength: 100
  }],
  dependencies: [{
    type: String,
    maxlength: 200
  }],
  prerequisites: {
    type: String,
    maxlength: 1000
  },
  rollbackPlan: {
    type: String,
    maxlength: 1000
  },
  testingNotes: {
    type: String,
    maxlength: 1000
  },
  implementationNotes: {
    type: String,
    maxlength: 1000
  },
  completionNotes: {
    type: String,
    maxlength: 1000
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AdminUser',
    required: true
  },
  createdByName: {
    type: String,
    required: true
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AdminUser',
    default: null
  },
  approvedByName: {
    type: String,
    default: null
  },
  approvedAt: {
    type: Date
  },
  approvalStatus: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected'],
    default: 'Pending'
  },
  rejectionReason: {
    type: String,
    maxlength: 500
  },
  impactLevel: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Critical'],
    default: 'Medium'
  },
  riskLevel: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Critical'],
    default: 'Medium'
  },
  affectedSystems: [{
    type: String,
    maxlength: 100
  }],
  communicationPlan: {
    type: String,
    maxlength: 1000
  },
  stakeholders: [{
    name: String,
    email: String,
    role: String
  }],
  workNotes: [{
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
      maxlength: 1000
    },
    isPublic: {
      type: Boolean,
      default: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  attachments: [{
    filename: String,
    originalName: String,
    mimeType: String,
    size: Number,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  tags: [{
    type: String,
    maxlength: 50
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field before saving
maintenanceTaskSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Generate maintenance task number
maintenanceTaskSchema.pre('save', async function(next) {
  if (this.isNew && !this.number) {
    const count = await this.constructor.countDocuments();
    this.number = `MNT${String(count + 1).padStart(6, '0')}`;
  }
  next();
});

// Calculate actual duration
maintenanceTaskSchema.methods.calculateActualDuration = function() {
  if (this.actualStartTime && this.actualEndTime) {
    const start = new Date(this.actualStartTime);
    const end = new Date(this.actualEndTime);
    const diffMs = end - start;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    this.actualDuration = `${diffHours}h ${diffMinutes}m`;
  }
};

// Calculate next scheduled date for recurring tasks
maintenanceTaskSchema.methods.calculateNextScheduledDate = function() {
  if (!this.isRecurring || !this.scheduledDate) return;

  const currentDate = new Date(this.scheduledDate);
  let nextDate = new Date(currentDate);

  switch (this.recurrencePattern) {
    case 'Daily':
      nextDate.setDate(currentDate.getDate() + this.recurrenceInterval);
      break;
    case 'Weekly':
      nextDate.setDate(currentDate.getDate() + (7 * this.recurrenceInterval));
      break;
    case 'Monthly':
      nextDate.setMonth(currentDate.getMonth() + this.recurrenceInterval);
      break;
    case 'Quarterly':
      nextDate.setMonth(currentDate.getMonth() + (3 * this.recurrenceInterval));
      break;
    case 'Yearly':
      nextDate.setFullYear(currentDate.getFullYear() + this.recurrenceInterval);
      break;
  }

  this.nextScheduledDate = nextDate;
};

// Index for better query performance
maintenanceTaskSchema.index({ scheduledDate: 1 });
maintenanceTaskSchema.index({ status: 1 });
maintenanceTaskSchema.index({ assignedTo: 1 });
maintenanceTaskSchema.index({ type: 1 });
maintenanceTaskSchema.index({ category: 1 });
maintenanceTaskSchema.index({ createdAt: -1 });

module.exports = mongoose.model('MaintenanceTask', maintenanceTaskSchema);
