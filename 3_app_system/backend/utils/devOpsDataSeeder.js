const { PipelineExecution, ModelTrainingJob, ScheduledJobExecution, SystemAlert } = require('../models/DevOpsMetrics');

// Seed sample DevOps data for demonstration
const seedDevOpsData = async () => {
  try {
    console.log('🌱 Seeding DevOps data...');

    // Clear existing data
    await Promise.all([
      PipelineExecution.deleteMany({}),
      ModelTrainingJob.deleteMany({}),
      ScheduledJobExecution.deleteMany({}),
      SystemAlert.deleteMany({})
    ]);

    // Seed Pipeline Executions (last 30 days)
    const pipelineExecutions = [];
    const pipelines = [
      { id: 'frontend-deploy', name: 'Frontend Deployment', environments: ['production', 'staging'] },
      { id: 'backend-deploy', name: 'Backend Deployment', environments: ['production', 'staging'] },
      { id: 'ml-model-deploy', name: 'ML Model Deployment', environments: ['production'] },
      { id: 'database-migration', name: 'Database Migration', environments: ['production', 'staging'] }
    ];

    for (let i = 0; i < 200; i++) {
      const pipeline = pipelines[Math.floor(Math.random() * pipelines.length)];
      const environment = pipeline.environments[Math.floor(Math.random() * pipeline.environments.length)];
      const daysAgo = Math.floor(Math.random() * 30);
      const startTime = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000 - Math.random() * 24 * 60 * 60 * 1000);
      const duration = Math.floor(Math.random() * 600) + 60; // 1-10 minutes
      const endTime = new Date(startTime.getTime() + duration * 1000);
      const success = Math.random() > 0.1; // 90% success rate

      pipelineExecutions.push({
        pipelineId: pipeline.id,
        pipelineName: pipeline.name,
        status: success ? 'success' : 'failed',
        branch: Math.random() > 0.8 ? 'develop' : 'main',
        environment: environment,
        startTime: startTime,
        endTime: endTime,
        duration: duration,
        buildNumber: 1000 + i,
        commitHash: Math.random().toString(36).substring(2, 10),
        triggeredBy: ['webhook', 'manual', 'schedule'][Math.floor(Math.random() * 3)],
        createdAt: startTime
      });
    }

    await PipelineExecution.insertMany(pipelineExecutions);
    console.log(`✅ Created ${pipelineExecutions.length} pipeline executions`);

    // Seed Model Training Jobs (last 60 days)
    const trainingJobs = [];
    const models = [
      { id: 'hansard-classifier', name: 'Hansard Document Classifier' },
      { id: 'sentiment-analyzer', name: 'Parliamentary Sentiment Analyzer' },
      { id: 'topic-extractor', name: 'Topic Extraction Model' },
      { id: 'entity-recognizer', name: 'Named Entity Recognition' }
    ];

    for (let i = 0; i < 50; i++) {
      const model = models[Math.floor(Math.random() * models.length)];
      const daysAgo = Math.floor(Math.random() * 60);
      const startTime = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000 - Math.random() * 24 * 60 * 60 * 1000);
      const duration = Math.floor(Math.random() * 7200) + 1800; // 30 minutes to 2 hours
      const endTime = new Date(startTime.getTime() + duration * 1000);
      const success = Math.random() > 0.15; // 85% success rate
      const previousAccuracy = 0.8 + Math.random() * 0.15;
      const newAccuracy = success ? previousAccuracy + (Math.random() * 0.05 - 0.02) : null;

      trainingJobs.push({
        jobId: `${model.id}-retrain-${Date.now()}-${i}`,
        modelName: model.name,
        modelId: model.id,
        status: success ? 'completed' : 'failed',
        trigger: ['scheduled', 'performance_degradation', 'new_data_threshold', 'manual'][Math.floor(Math.random() * 4)],
        startTime: startTime,
        endTime: endTime,
        duration: duration,
        dataPoints: Math.floor(Math.random() * 20000) + 5000,
        previousAccuracy: previousAccuracy,
        newAccuracy: newAccuracy,
        improvement: newAccuracy ? newAccuracy - previousAccuracy : null,
        metrics: success ? {
          precision: 0.8 + Math.random() * 0.15,
          recall: 0.8 + Math.random() * 0.15,
          f1Score: 0.8 + Math.random() * 0.15,
          loss: Math.random() * 0.3
        } : null,
        createdAt: startTime
      });
    }

    await ModelTrainingJob.insertMany(trainingJobs);
    console.log(`✅ Created ${trainingJobs.length} model training jobs`);

    // Seed Scheduled Job Executions (last 30 days)
    const jobExecutions = [];
    const scheduledJobs = [
      { id: 'data-backup', name: 'Database Backup', schedule: '0 2 * * *', category: 'backup' },
      { id: 'log-cleanup', name: 'Log File Cleanup', schedule: '0 1 * * 0', category: 'maintenance' },
      { id: 'model-validation', name: 'Model Performance Validation', schedule: '0 */6 * * *', category: 'monitoring' },
      { id: 'data-sync', name: 'External Data Synchronization', schedule: '0 */2 * * *', category: 'data_processing' },
      { id: 'cache-refresh', name: 'Cache Refresh', schedule: '*/15 * * * *', category: 'maintenance' }
    ];

    for (let i = 0; i < 500; i++) {
      const job = scheduledJobs[Math.floor(Math.random() * scheduledJobs.length)];
      const daysAgo = Math.floor(Math.random() * 30);
      const startTime = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000 - Math.random() * 24 * 60 * 60 * 1000);
      const duration = Math.floor(Math.random() * 1800) + 30; // 30 seconds to 30 minutes
      const endTime = new Date(startTime.getTime() + duration * 1000);
      const success = Math.random() > 0.05; // 95% success rate

      jobExecutions.push({
        jobId: job.id,
        jobName: job.name,
        schedule: job.schedule,
        status: success ? 'success' : 'failed',
        startTime: startTime,
        endTime: endTime,
        duration: duration,
        category: job.category,
        description: `Automated ${job.name.toLowerCase()}`,
        resourceUsage: {
          cpu: Math.floor(Math.random() * 80) + 10,
          memory: Math.floor(Math.random() * 70) + 20,
          disk: Math.floor(Math.random() * 50) + 10
        },
        createdAt: startTime
      });
    }

    await ScheduledJobExecution.insertMany(jobExecutions);
    console.log(`✅ Created ${jobExecutions.length} scheduled job executions`);

    // Seed System Alerts (last 7 days)
    const alerts = [];
    const alertTypes = [
      { type: 'error', severity: 'critical', title: 'Pipeline Failure', source: 'pipeline' },
      { type: 'warning', severity: 'medium', title: 'Model Performance Degradation', source: 'model_training' },
      { type: 'error', severity: 'high', title: 'Scheduled Job Failed', source: 'scheduled_job' },
      { type: 'warning', severity: 'low', title: 'High Resource Usage', source: 'system' },
      { type: 'info', severity: 'low', title: 'Deployment Completed', source: 'pipeline' }
    ];

    for (let i = 0; i < 25; i++) {
      const alert = alertTypes[Math.floor(Math.random() * alertTypes.length)];
      const daysAgo = Math.floor(Math.random() * 7);
      const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000 - Math.random() * 24 * 60 * 60 * 1000);
      const isResolved = Math.random() > 0.3; // 70% resolved

      alerts.push({
        alertId: `alert-${Date.now()}-${i}`,
        type: alert.type,
        severity: alert.severity,
        title: alert.title,
        message: `${alert.title} occurred in the system. Please investigate.`,
        source: alert.source,
        sourceId: Math.random().toString(36).substring(2, 10),
        status: isResolved ? 'resolved' : (Math.random() > 0.5 ? 'acknowledged' : 'active'),
        resolvedAt: isResolved ? new Date(createdAt.getTime() + Math.random() * 24 * 60 * 60 * 1000) : null,
        createdAt: createdAt
      });
    }

    await SystemAlert.insertMany(alerts);
    console.log(`✅ Created ${alerts.length} system alerts`);

    console.log('🎉 DevOps data seeding completed successfully!');
    return true;
  } catch (error) {
    console.error('❌ Error seeding DevOps data:', error);
    throw error;
  }
};

// Function to create a new pipeline execution (for real-time tracking)
const createPipelineExecution = async (pipelineData) => {
  try {
    const execution = new PipelineExecution({
      ...pipelineData,
      createdAt: new Date()
    });
    await execution.save();
    return execution;
  } catch (error) {
    console.error('Error creating pipeline execution:', error);
    throw error;
  }
};

// Function to create a new model training job (for real-time tracking)
const createModelTrainingJob = async (jobData) => {
  try {
    const job = new ModelTrainingJob({
      ...jobData,
      createdAt: new Date()
    });
    await job.save();
    return job;
  } catch (error) {
    console.error('Error creating model training job:', error);
    throw error;
  }
};

// Function to create a new scheduled job execution (for real-time tracking)
const createScheduledJobExecution = async (jobData) => {
  try {
    const execution = new ScheduledJobExecution({
      ...jobData,
      createdAt: new Date()
    });
    await execution.save();
    return execution;
  } catch (error) {
    console.error('Error creating scheduled job execution:', error);
    throw error;
  }
};

// Function to create a new system alert (for real-time tracking)
const createSystemAlert = async (alertData) => {
  try {
    const alert = new SystemAlert({
      ...alertData,
      alertId: `alert-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date()
    });
    await alert.save();
    return alert;
  } catch (error) {
    console.error('Error creating system alert:', error);
    throw error;
  }
};

module.exports = {
  seedDevOpsData,
  createPipelineExecution,
  createModelTrainingJob,
  createScheduledJobExecution,
  createSystemAlert
};
