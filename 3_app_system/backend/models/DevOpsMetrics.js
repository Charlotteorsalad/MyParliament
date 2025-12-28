const mongoose = require('mongoose');

// CI/CD Pipeline Execution Schema
const PipelineExecutionSchema = new mongoose.Schema({
  pipelineId: {
    type: String,
    required: true,
    index: true
  },
  pipelineName: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['success', 'failed', 'running', 'queued', 'cancelled'],
    required: true
  },
  branch: {
    type: String,
    required: true
  },
  environment: {
    type: String,
    enum: ['development', 'staging', 'production'],
    required: true
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date
  },
  duration: {
    type: Number, // in seconds
    default: 0
  },
  buildNumber: {
    type: Number,
    required: true
  },
  commitHash: {
    type: String
  },
  triggeredBy: {
    type: String,
    enum: ['manual', 'webhook', 'schedule', 'api'],
    default: 'manual'
  },
  logs: {
    type: String
  },
  artifacts: [{
    name: String,
    size: Number,
    url: String
  }],
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// ML Model Training Job Schema
const ModelTrainingJobSchema = new mongoose.Schema({
  jobId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  modelName: {
    type: String,
    required: true
  },
  modelId: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['queued', 'running', 'completed', 'failed', 'cancelled'],
    required: true
  },
  trigger: {
    type: String,
    enum: ['scheduled', 'performance_degradation', 'new_data_threshold', 'manual'],
    required: true
  },
  startTime: {
    type: Date
  },
  endTime: {
    type: Date
  },
  duration: {
    type: Number, // in seconds
    default: 0
  },
  dataPoints: {
    type: Number,
    required: true
  },
  previousAccuracy: {
    type: Number
  },
  newAccuracy: {
    type: Number
  },
  improvement: {
    type: Number
  },
  hyperparameters: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  metrics: {
    precision: Number,
    recall: Number,
    f1Score: Number,
    loss: Number
  },
  errorMessage: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Scheduled Job Execution Schema
const ScheduledJobExecutionSchema = new mongoose.Schema({
  jobId: {
    type: String,
    required: true,
    index: true
  },
  jobName: {
    type: String,
    required: true
  },
  schedule: {
    type: String, // cron expression
    required: true
  },
  status: {
    type: String,
    enum: ['success', 'failed', 'running', 'skipped'],
    required: true
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date
  },
  duration: {
    type: Number, // in seconds
    default: 0
  },
  output: {
    type: String
  },
  errorMessage: {
    type: String
  },
  category: {
    type: String,
    enum: ['maintenance', 'data_processing', 'monitoring', 'backup'],
    required: true
  },
  description: {
    type: String
  },
  resourceUsage: {
    cpu: Number,
    memory: Number,
    disk: Number
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// System Alert Schema
const SystemAlertSchema = new mongoose.Schema({
  alertId: {
    type: String,
    required: true,
    unique: true
  },
  type: {
    type: String,
    enum: ['error', 'warning', 'info'],
    required: true
  },
  severity: {
    type: String,
    enum: ['critical', 'high', 'medium', 'low'],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  source: {
    type: String,
    enum: ['pipeline', 'model_training', 'scheduled_job', 'system'],
    required: true
  },
  sourceId: {
    type: String // Reference to the source (pipeline, job, etc.)
  },
  status: {
    type: String,
    enum: ['active', 'acknowledged', 'resolved'],
    default: 'active'
  },
  acknowledgedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  acknowledgedAt: {
    type: Date
  },
  resolvedAt: {
    type: Date
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Add indexes for better query performance
PipelineExecutionSchema.index({ pipelineId: 1, createdAt: -1 });
PipelineExecutionSchema.index({ status: 1, createdAt: -1 });
PipelineExecutionSchema.index({ environment: 1, createdAt: -1 });

ModelTrainingJobSchema.index({ modelId: 1, createdAt: -1 });
ModelTrainingJobSchema.index({ status: 1, createdAt: -1 });

ScheduledJobExecutionSchema.index({ jobId: 1, createdAt: -1 });
ScheduledJobExecutionSchema.index({ status: 1, createdAt: -1 });
ScheduledJobExecutionSchema.index({ category: 1, createdAt: -1 });

SystemAlertSchema.index({ status: 1, createdAt: -1 });
SystemAlertSchema.index({ severity: 1, createdAt: -1 });
SystemAlertSchema.index({ source: 1, createdAt: -1 });

const PipelineExecution = mongoose.model('PipelineExecution', PipelineExecutionSchema);
const ModelTrainingJob = mongoose.model('ModelTrainingJob', ModelTrainingJobSchema);
const ScheduledJobExecution = mongoose.model('ScheduledJobExecution', ScheduledJobExecutionSchema);
const SystemAlert = mongoose.model('SystemAlert', SystemAlertSchema);

module.exports = {
  PipelineExecution,
  ModelTrainingJob,
  ScheduledJobExecution,
  SystemAlert
};
