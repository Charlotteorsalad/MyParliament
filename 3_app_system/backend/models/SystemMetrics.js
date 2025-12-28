const mongoose = require('mongoose');

const systemMetricsSchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    required: true,
    index: true
  },
  date: {
    type: String, // Format: YYYY-MM-DD
    required: true,
    index: true
  },
  hour: {
    type: Number, // 0-23
    required: true
  },
  dayOfWeek: {
    type: Number, // 0-6 (Sunday-Saturday)
    required: true
  },
  month: {
    type: Number, // 1-12
    required: true
  },
  year: {
    type: Number,
    required: true,
    index: true
  },
  
  // Performance Metrics
  cpuUsage: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  memoryUsage: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  diskUsage: {
    type: Number,
    min: 0,
    max: 100
  },
  systemLoad: {
    type: Number,
    min: 0
  },
  responseTime: {
    type: Number,
    min: 0
  },
  activeConnections: {
    type: Number,
    min: 0,
    default: 0
  },
  
  // System Information
  totalMemory: {
    type: Number // GB
  },
  freeMemory: {
    type: Number // GB
  },
  uptime: {
    type: Number // seconds
  },
  
  // User Activity
  activeUsers: {
    type: Number,
    min: 0,
    default: 0
  },
  totalUsers: {
    type: Number,
    min: 0,
    default: 0
  },
  
  // Error Tracking
  errorRate: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  errorCount: {
    type: Number,
    min: 0,
    default: 0
  }
}, {
  timestamps: true,
  collection: 'system_metrics'
});

// Compound indexes for efficient querying
systemMetricsSchema.index({ year: 1, month: 1, date: 1 });
systemMetricsSchema.index({ timestamp: -1 });
systemMetricsSchema.index({ date: 1, hour: 1 });

// Static methods for data aggregation
systemMetricsSchema.statics.getHourlyData = function(startDate, endDate) {
  return this.find({
    timestamp: { $gte: startDate, $lte: endDate }
  }).sort({ timestamp: 1 });
};

systemMetricsSchema.statics.getDailyAggregated = function(startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        timestamp: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: "$date",
        avgCpuUsage: { $avg: "$cpuUsage" },
        maxCpuUsage: { $max: "$cpuUsage" },
        minCpuUsage: { $min: "$cpuUsage" },
        avgMemoryUsage: { $avg: "$memoryUsage" },
        maxMemoryUsage: { $max: "$memoryUsage" },
        minMemoryUsage: { $min: "$memoryUsage" },
        avgSystemLoad: { $avg: "$systemLoad" },
        avgResponseTime: { $avg: "$responseTime" },
        totalActiveConnections: { $sum: "$activeConnections" },
        avgActiveUsers: { $avg: "$activeUsers" },
        maxActiveUsers: { $max: "$activeUsers" },
        errorRate: { $avg: "$errorRate" },
        dataPoints: { $sum: 1 },
        date: { $first: "$date" },
        year: { $first: "$year" },
        month: { $first: "$month" }
      }
    },
    {
      $sort: { "_id": 1 }
    }
  ]);
};

systemMetricsSchema.statics.getMonthlyAggregated = function(startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        timestamp: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: { year: "$year", month: "$month" },
        avgCpuUsage: { $avg: "$cpuUsage" },
        maxCpuUsage: { $max: "$cpuUsage" },
        minCpuUsage: { $min: "$cpuUsage" },
        avgMemoryUsage: { $avg: "$memoryUsage" },
        maxMemoryUsage: { $max: "$memoryUsage" },
        minMemoryUsage: { $min: "$memoryUsage" },
        avgSystemLoad: { $avg: "$systemLoad" },
        avgResponseTime: { $avg: "$responseTime" },
        totalActiveConnections: { $sum: "$activeConnections" },
        avgActiveUsers: { $avg: "$activeUsers" },
        maxActiveUsers: { $max: "$activeUsers" },
        errorRate: { $avg: "$errorRate" },
        dataPoints: { $sum: 1 },
        year: { $first: "$year" },
        month: { $first: "$month" }
      }
    },
    {
      $sort: { "_id.year": 1, "_id.month": 1 }
    }
  ]);
};

systemMetricsSchema.statics.getYearlyAggregated = function(startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        timestamp: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: "$year",
        avgCpuUsage: { $avg: "$cpuUsage" },
        maxCpuUsage: { $max: "$cpuUsage" },
        minCpuUsage: { $min: "$cpuUsage" },
        avgMemoryUsage: { $avg: "$memoryUsage" },
        maxMemoryUsage: { $max: "$memoryUsage" },
        minMemoryUsage: { $min: "$memoryUsage" },
        avgSystemLoad: { $avg: "$systemLoad" },
        avgResponseTime: { $avg: "$responseTime" },
        totalActiveConnections: { $sum: "$activeConnections" },
        avgActiveUsers: { $avg: "$activeUsers" },
        maxActiveUsers: { $max: "$activeUsers" },
        errorRate: { $avg: "$errorRate" },
        dataPoints: { $sum: 1 },
        year: { $first: "$year" }
      }
    },
    {
      $sort: { "_id": 1 }
    }
  ]);
};

module.exports = mongoose.model('SystemMetrics', systemMetricsSchema);
