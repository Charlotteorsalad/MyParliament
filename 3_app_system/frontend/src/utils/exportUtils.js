// Export utilities for analytics data
// Note: This is a simple implementation without external libraries
// For production, you would use libraries like jsPDF, xlsx, etc.

export const exportToPDF = (data, filename = 'analytics_report') => {
  // Simple text-based PDF export simulation
  // In production, you would use jsPDF
  const content = generateReportContent(data);
  
  // Create a simple text file for now
  const blob = new Blob([content], { type: 'text/plain' });
  downloadFile(blob, `${filename}.txt`);
  
  // Show success message
  alert('Report exported as text file (PDF export requires additional libraries)');
};

export const exportToCSV = (data, filename = 'analytics_report') => {
  const csvContent = generateCSVContent(data);
  const blob = new Blob([csvContent], { type: 'text/csv' });
  downloadFile(blob, `${filename}.csv`);
};

export const exportToExcel = (data, filename = 'analytics_report') => {
  // Simple CSV export (Excel can open CSV files)
  // In production, you would use xlsx library
  const csvContent = generateCSVContent(data);
  const blob = new Blob([csvContent], { type: 'application/vnd.ms-excel' });
  downloadFile(blob, `${filename}.xls`);
  
  alert('Report exported as Excel-compatible file');
};

const generateReportContent = (data) => {
  const timestamp = new Date().toLocaleString();
  
  let content = `MYPARLIAMENT ANALYTICS REPORT\n`;
  content += `Generated on: ${timestamp}\n\n`;
  
  // System Health Section
  if (data.systemHealth) {
    content += `SYSTEM HEALTH METRICS\n`;
    content += `====================\n`;
    content += `Server Uptime: ${data.systemHealth.serverUptime}\n`;
    content += `Response Time: ${data.systemHealth.responseTime}\n`;
    content += `Error Rate: ${data.systemHealth.errorRate}\n`;
    content += `Active Users: ${data.systemHealth.activeUsers}\n`;
    content += `CPU Usage: ${data.systemHealth.cpuUsage}\n`;
    content += `Memory Usage: ${data.systemHealth.memoryUsage}\n`;
    content += `Disk Usage: ${data.systemHealth.diskUsage}\n`;
    content += `Network Status: ${data.systemHealth.networkStatus}\n\n`;
  }
  
  // Model Performance Section
  if (data.modelPerformance) {
    content += `MODEL PERFORMANCE METRICS\n`;
    content += `========================\n`;
    content += `Accuracy: ${data.modelPerformance.accuracy}\n`;
    content += `Precision: ${data.modelPerformance.precision}\n`;
    content += `Recall: ${data.modelPerformance.recall}\n`;
    content += `F1 Score: ${data.modelPerformance.f1Score}\n`;
    content += `Inference Time: ${data.modelPerformance.inferenceTime}\n`;
    content += `Models Deployed: ${data.modelPerformance.modelsDeployed}\n`;
    content += `Total Predictions: ${data.modelPerformance.totalPredictions}\n`;
    content += `Successful Predictions: ${data.modelPerformance.successfulPredictions}\n\n`;
  }
  
  // Content Engagement Section
  if (data.contentEngagement) {
    content += `CONTENT ENGAGEMENT METRICS\n`;
    content += `=========================\n`;
    content += `Total Views: ${data.contentEngagement.totalViews}\n`;
    content += `Unique Visitors: ${data.contentEngagement.uniqueVisitors}\n`;
    content += `Average Session Time: ${data.contentEngagement.averageSessionTime}\n`;
    content += `Bounce Rate: ${data.contentEngagement.bounceRate}\n`;
    content += `Total Content: ${data.contentEngagement.totalContent}\n\n`;
    
    if (data.contentEngagement.topContent) {
      content += `TOP PERFORMING CONTENT:\n`;
      data.contentEngagement.topContent.forEach((item, index) => {
        content += `${index + 1}. ${item.title} - ${item.views} views (${item.engagement} engagement)\n`;
      });
      content += `\n`;
    }
    
    if (data.contentEngagement.contentByCategory) {
      content += `CONTENT BY CATEGORY:\n`;
      Object.entries(data.contentEngagement.contentByCategory).forEach(([category, count]) => {
        content += `${category}: ${count}\n`;
      });
      content += `\n`;
    }
  }
  
  // User Behaviour Section
  if (data.userBehaviour) {
    content += `USER BEHAVIOUR METRICS\n`;
    content += `=====================\n`;
    content += `Total Users: ${data.userBehaviour.totalUsers}\n`;
    content += `Daily Active Users: ${data.userBehaviour.dailyActiveUsers}\n`;
    content += `Weekly Active Users: ${data.userBehaviour.weeklyActiveUsers}\n`;
    content += `Monthly Active Users: ${data.userBehaviour.monthlyActiveUsers}\n`;
    content += `User Retention: ${data.userBehaviour.userRetention}\n`;
    content += `New Registrations: ${data.userBehaviour.newRegistrations}\n\n`;
    
    if (data.userBehaviour.usersByRegion) {
      content += `USERS BY REGION:\n`;
      Object.entries(data.userBehaviour.usersByRegion).forEach(([region, count]) => {
        content += `${region}: ${count}\n`;
      });
      content += `\n`;
    }
  }
  
  return content;
};

const generateCSVContent = (data) => {
  let csvContent = 'Metric Category,Metric Name,Value,Timestamp\n';
  const timestamp = new Date().toISOString();
  
  // System Health
  if (data.systemHealth) {
    csvContent += `System Health,Server Uptime,${data.systemHealth.serverUptime},${timestamp}\n`;
    csvContent += `System Health,Response Time,${data.systemHealth.responseTime},${timestamp}\n`;
    csvContent += `System Health,Error Rate,${data.systemHealth.errorRate},${timestamp}\n`;
    csvContent += `System Health,Active Users,${data.systemHealth.activeUsers},${timestamp}\n`;
    csvContent += `System Health,CPU Usage,${data.systemHealth.cpuUsage},${timestamp}\n`;
    csvContent += `System Health,Memory Usage,${data.systemHealth.memoryUsage},${timestamp}\n`;
    csvContent += `System Health,Disk Usage,${data.systemHealth.diskUsage},${timestamp}\n`;
    csvContent += `System Health,Network Status,${data.systemHealth.networkStatus},${timestamp}\n`;
  }
  
  // Model Performance
  if (data.modelPerformance) {
    csvContent += `Model Performance,Accuracy,${data.modelPerformance.accuracy},${timestamp}\n`;
    csvContent += `Model Performance,Precision,${data.modelPerformance.precision},${timestamp}\n`;
    csvContent += `Model Performance,Recall,${data.modelPerformance.recall},${timestamp}\n`;
    csvContent += `Model Performance,F1 Score,${data.modelPerformance.f1Score},${timestamp}\n`;
    csvContent += `Model Performance,Inference Time,${data.modelPerformance.inferenceTime},${timestamp}\n`;
    csvContent += `Model Performance,Models Deployed,${data.modelPerformance.modelsDeployed},${timestamp}\n`;
    csvContent += `Model Performance,Total Predictions,${data.modelPerformance.totalPredictions},${timestamp}\n`;
    csvContent += `Model Performance,Successful Predictions,${data.modelPerformance.successfulPredictions},${timestamp}\n`;
  }
  
  // Content Engagement
  if (data.contentEngagement) {
    csvContent += `Content Engagement,Total Views,${data.contentEngagement.totalViews},${timestamp}\n`;
    csvContent += `Content Engagement,Unique Visitors,${data.contentEngagement.uniqueVisitors},${timestamp}\n`;
    csvContent += `Content Engagement,Average Session Time,${data.contentEngagement.averageSessionTime},${timestamp}\n`;
    csvContent += `Content Engagement,Bounce Rate,${data.contentEngagement.bounceRate},${timestamp}\n`;
    csvContent += `Content Engagement,Total Content,${data.contentEngagement.totalContent || 0},${timestamp}\n`;
  }
  
  // User Behaviour
  if (data.userBehaviour) {
    csvContent += `User Behaviour,Total Users,${data.userBehaviour.totalUsers},${timestamp}\n`;
    csvContent += `User Behaviour,Daily Active Users,${data.userBehaviour.dailyActiveUsers},${timestamp}\n`;
    csvContent += `User Behaviour,Weekly Active Users,${data.userBehaviour.weeklyActiveUsers},${timestamp}\n`;
    csvContent += `User Behaviour,Monthly Active Users,${data.userBehaviour.monthlyActiveUsers},${timestamp}\n`;
    csvContent += `User Behaviour,User Retention,${data.userBehaviour.userRetention},${timestamp}\n`;
    csvContent += `User Behaviour,New Registrations,${data.userBehaviour.newRegistrations},${timestamp}\n`;
  }
  
  return csvContent;
};

const downloadFile = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
};

export const formatNumber = (num) => {
  if (typeof num !== 'number') return num;
  return num.toLocaleString();
};

export const formatPercentage = (value) => {
  if (typeof value === 'string' && value.includes('%')) return value;
  if (typeof value === 'number') return `${value.toFixed(1)}%`;
  return value;
};

export const formatBytes = (bytes) => {
  if (typeof bytes !== 'number') return bytes;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 Byte';
  const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
};
