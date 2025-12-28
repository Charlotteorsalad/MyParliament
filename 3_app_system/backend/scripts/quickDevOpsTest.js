const { PipelineExecution, ModelTrainingJob, ScheduledJobExecution, SystemAlert } = require('../models/DevOpsMetrics');

// Quick function to create sample DevOps data
const createSampleData = async () => {
  try {
    console.log('🚀 Creating sample DevOps data...');

    // Create a few pipeline executions
    const pipelines = [
      {
        pipelineId: 'frontend-deploy',
        pipelineName: 'Frontend Deployment',
        status: 'success',
        branch: 'main',
        environment: 'production',
        startTime: new Date(Date.now() - 2 * 60 * 60 * 1000),
        endTime: new Date(Date.now() - 2 * 60 * 60 * 1000 + 180000),
        duration: 180,
        buildNumber: 123,
        commitHash: 'abc123',
        triggeredBy: 'webhook'
      },
      {
        pipelineId: 'backend-deploy',
        pipelineName: 'Backend Deployment',
        status: 'success',
        branch: 'main',
        environment: 'production',
        startTime: new Date(Date.now() - 4 * 60 * 60 * 1000),
        endTime: new Date(Date.now() - 4 * 60 * 60 * 1000 + 240000),
        duration: 240,
        buildNumber: 124,
        commitHash: 'def456',
        triggeredBy: 'manual'
      },
      {
        pipelineId: 'ml-model-deploy',
        pipelineName: 'ML Model Deployment',
        status: 'failed',
        branch: 'model-updates',
        environment: 'production',
        startTime: new Date(Date.now() - 1 * 60 * 60 * 1000),
        endTime: new Date(Date.now() - 1 * 60 * 60 * 1000 + 45000),
        duration: 45,
        buildNumber: 125,
        commitHash: 'ghi789',
        triggeredBy: 'schedule'
      }
    ];

    await PipelineExecution.insertMany(pipelines);
    console.log('✅ Created pipeline executions');

    // Create a few model training jobs
    const trainingJobs = [
      {
        jobId: 'hansard-retrain-001',
        modelName: 'Hansard Document Classifier',
        modelId: 'hansard-classifier',
        status: 'completed',
        trigger: 'scheduled',
        startTime: new Date(Date.now() - 8 * 60 * 60 * 1000),
        endTime: new Date(Date.now() - 6 * 60 * 60 * 1000),
        duration: 7200,
        dataPoints: 15000,
        previousAccuracy: 0.942,
        newAccuracy: 0.948,
        improvement: 0.006
      },
      {
        jobId: 'sentiment-retrain-001',
        modelName: 'Parliamentary Sentiment Analyzer',
        modelId: 'sentiment-analyzer',
        status: 'running',
        trigger: 'performance_degradation',
        startTime: new Date(Date.now() - 3 * 60 * 60 * 1000),
        dataPoints: 12500,
        previousAccuracy: 0.875
      }
    ];

    await ModelTrainingJob.insertMany(trainingJobs);
    console.log('✅ Created model training jobs');

    // Create scheduled job executions
    const jobExecutions = [
      {
        jobId: 'data-backup',
        jobName: 'Database Backup',
        schedule: '0 2 * * *',
        status: 'success',
        startTime: new Date(Date.now() - 10 * 60 * 60 * 1000),
        endTime: new Date(Date.now() - 10 * 60 * 60 * 1000 + 1800000),
        duration: 1800,
        category: 'backup',
        description: 'Daily backup of all database collections'
      },
      {
        jobId: 'log-cleanup',
        jobName: 'Log File Cleanup',
        schedule: '0 1 * * 0',
        status: 'success',
        startTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        endTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 300000),
        duration: 300,
        category: 'maintenance',
        description: 'Clean up old log files and compress archives'
      },
      {
        jobId: 'data-sync',
        jobName: 'External Data Synchronization',
        schedule: '0 */2 * * *',
        status: 'failed',
        startTime: new Date(Date.now() - 30 * 60 * 1000),
        endTime: new Date(Date.now() - 30 * 60 * 1000 + 1000),
        duration: 1,
        category: 'data_processing',
        description: 'Sync data from external parliamentary sources'
      }
    ];

    await ScheduledJobExecution.insertMany(jobExecutions);
    console.log('✅ Created scheduled job executions');

    // Create system alerts
    const alerts = [
      {
        alertId: 'alert-ml-deploy-fail',
        type: 'error',
        severity: 'high',
        title: 'ML Model Deployment Failed',
        message: 'ML Model deployment pipeline failed due to validation errors',
        source: 'pipeline',
        sourceId: 'ml-model-deploy',
        status: 'active'
      },
      {
        alertId: 'alert-data-sync-fail',
        type: 'error',
        severity: 'medium',
        title: 'Data Sync Failure',
        message: 'External data synchronization job failed - connection timeout',
        source: 'scheduled_job',
        sourceId: 'data-sync',
        status: 'active'
      }
    ];

    await SystemAlert.insertMany(alerts);
    console.log('✅ Created system alerts');

    console.log('🎉 Sample DevOps data created successfully!');
    
    // Show counts
    const pipelineCount = await PipelineExecution.countDocuments();
    const trainingCount = await ModelTrainingJob.countDocuments();
    const jobCount = await ScheduledJobExecution.countDocuments();
    const alertCount = await SystemAlert.countDocuments();
    
    console.log(`📊 Data Summary:`);
    console.log(`   - Pipeline Executions: ${pipelineCount}`);
    console.log(`   - Model Training Jobs: ${trainingCount}`);
    console.log(`   - Scheduled Jobs: ${jobCount}`);
    console.log(`   - System Alerts: ${alertCount}`);
    
  } catch (error) {
    console.error('❌ Error creating sample data:', error);
  }
};

module.exports = { createSampleData };
