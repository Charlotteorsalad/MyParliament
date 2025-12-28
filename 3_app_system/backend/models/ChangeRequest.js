const mongoose = require('mongoose');

const changeRequestSchema = new mongoose.Schema({
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
    enum: ['New', 'Scheduled', 'In Progress', 'Completed', 'Cancelled', 'Failed'],
    default: 'New'
  },
  priority: {
    type: String,
    enum: ['1 - Critical', '2 - High', '3 - Medium', '4 - Low'],
    default: '3 - Medium'
  },
  category: {
    type: String,
    enum: ['Maintenance', 'Security', 'Enhancement', 'Bug Fix', 'Infrastructure', 'Other'],
    required: true
  },
  subcategory: {
    type: String,
    required: true
  },
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AdminUser',
    required: true
  },
  requestedByName: {
    type: String,
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
    enum: ['Application Development', 'IT Support', 'Infrastructure', 'Security', 'Network', 'Other'],
    required: true
  },
  scheduledStart: {
    type: Date,
    required: true
  },
  scheduledEnd: {
    type: Date,
    required: true
  },
  actualStart: {
    type: Date
  },
  actualEnd: {
    type: Date
  },
  estimatedDuration: {
    type: String,
    required: true
  },
  actualDuration: {
    type: String
  },
  businessJustification: {
    type: String,
    required: true,
    maxlength: 1000
  },
  riskAssessment: {
    type: String,
    required: true,
    maxlength: 1000
  },
  implementationPlan: {
    type: String,
    required: true,
    maxlength: 2000
  },
  rollbackPlan: {
    type: String,
    required: true,
    maxlength: 1000
  },
  approvalStatus: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected'],
    default: 'Pending'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AdminUser'
  },
  approvedAt: {
    type: Date
  },
  rejectionReason: {
    type: String,
    maxlength: 500
  },
  dependencies: [{
    type: String,
    maxlength: 200
  }],
  impact: {
    type: String,
    enum: ['None', 'Low', 'Medium', 'High'],
    default: 'Low'
  },
  businessService: {
    type: String,
    required: true
  },
  configurationItems: [{
    type: String
  }],
  testingNotes: {
    type: String,
    maxlength: 1000
  },
  implementationNotes: {
    type: String,
    maxlength: 2000
  },
  completionNotes: {
    type: String,
    maxlength: 1000
  }
}, {
  timestamps: true
});

// Indexes for better query performance
// Note: number field already has unique index from schema definition
changeRequestSchema.index({ state: 1 });
changeRequestSchema.index({ priority: 1 });
changeRequestSchema.index({ assignedTo: 1 });
changeRequestSchema.index({ assignmentGroup: 1 });
changeRequestSchema.index({ category: 1 });
changeRequestSchema.index({ scheduledStart: 1 });
changeRequestSchema.index({ createdAt: -1 });

// Pre-save middleware to generate change request number
changeRequestSchema.pre('save', async function(next) {
  if (this.isNew && !this.number) {
    const count = await this.constructor.countDocuments();
    this.number = `CHG${String(count + 1).padStart(7, '0')}`;
  }
  next();
});

// Virtual for calculating actual duration
changeRequestSchema.virtual('calculatedActualDuration').get(function() {
  if (this.actualStart && this.actualEnd) {
    const diffMs = this.actualEnd - this.actualStart;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${diffHours}h ${diffMinutes}m`;
  }
  return null;
});

// Method to update actual duration
changeRequestSchema.methods.updateActualDuration = function() {
  if (this.actualStart && this.actualEnd) {
    this.actualDuration = this.calculatedActualDuration;
  }
};

module.exports = mongoose.model('ChangeRequest', changeRequestSchema);
