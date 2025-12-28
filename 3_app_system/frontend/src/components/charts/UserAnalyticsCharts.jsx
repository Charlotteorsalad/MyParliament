import React from 'react';

// User Engagement Score Chart
export const UserEngagementChart = ({ users, title = "Top Engaged Users" }) => {
  if (!users || users.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <div className="text-2xl mb-2">📊</div>
        <p>No user engagement data available</p>
      </div>
    );
  }

  const maxScore = users.length > 0 ? Math.max(...users.map(user => user.engagementScore || 0)) : 1;

  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      <div className="space-y-3">
        {users.slice(0, 10).map((user, index) => (
          <div key={user.userId || index} className="flex items-center justify-between">
            <div className="flex items-center space-x-3 flex-1">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-sm font-medium text-blue-600">
                {index + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user.username || 'Anonymous User'}
                </p>
                <div className="flex items-center space-x-2 text-xs text-gray-500">
                  <span>👁️ {user.totalViews || 0}</span>
                  <span>🔍 {user.totalSearches || 0}</span>
                  <span>🔖 {user.totalBookmarks || 0}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 rounded-full transition-all duration-300"
                  style={{ 
                    width: `${maxScore > 0 ? (user.engagementScore / maxScore) * 100 : 0}%` 
                  }}
                ></div>
              </div>
              <span className="text-sm font-medium text-gray-700 w-8 text-right">
                {(user.engagementScore || 0).toLocaleString()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// User Segmentation Pie Chart
export const UserSegmentationChart = ({ segments, title = "User Segmentation" }) => {
  if (!segments || Object.keys(segments).length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <div className="text-2xl mb-2">👥</div>
        <p>No segmentation data available</p>
      </div>
    );
  }

  const data = Object.entries(segments).map(([key, value]) => ({ label: key, value }));
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

  let cumulativePercentage = 0;

  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      <div className="flex items-center justify-center">
        <svg width="200" height="200" viewBox="0 0 200 200">
          {data.map((item, index) => {
            const percentage = (item.value / total) * 100;
            const angle = (percentage / 100) * 360;
            const startAngle = (cumulativePercentage / 100) * 360;
            const endAngle = startAngle + angle;
            
            const startAngleRad = (startAngle - 90) * (Math.PI / 180);
            const endAngleRad = (endAngle - 90) * (Math.PI / 180);
            
            const largeArcFlag = angle > 180 ? 1 : 0;
            
            const x1 = 100 + 80 * Math.cos(startAngleRad);
            const y1 = 100 + 80 * Math.sin(startAngleRad);
            const x2 = 100 + 80 * Math.cos(endAngleRad);
            const y2 = 100 + 80 * Math.sin(endAngleRad);
            
            const pathData = [
              `M 100 100`,
              `L ${x1} ${y1}`,
              `A 80 80 0 ${largeArcFlag} 1 ${x2} ${y2}`,
              'Z'
            ].join(' ');
            
            cumulativePercentage += percentage;
            
            return (
              <path
                key={index}
                d={pathData}
                fill={colors[index % colors.length]}
                className="hover:opacity-80 transition-opacity cursor-pointer"
              >
                <title>{`${item.label}: ${item.value} (${percentage.toFixed(1)}%)`}</title>
              </path>
            );
          })}
        </svg>
      </div>
      <div className="mt-4 space-y-2">
        {data.map((item, index) => (
          <div key={index} className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-2">
              <div 
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: colors[index % colors.length] }}
              ></div>
              <span className="text-gray-700">{item.label}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="font-medium">{item.value}</span>
              <span className="text-gray-500">
                ({((item.value / total) * 100).toFixed(1)}%)
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// User Journey Funnel Chart
export const UserJourneyFunnel = ({ funnel, title = "User Engagement Funnel" }) => {
  if (!funnel) {
    return (
      <div className="text-center py-8 text-gray-500">
        <div className="text-2xl mb-2">🔄</div>
        <p>No funnel data available</p>
      </div>
    );
  }

  const steps = [
    { name: 'Total Users', value: funnel.totalUsers, icon: '👥' },
    { name: 'Login Users', value: funnel.loginUsers, icon: '🔐' },
    { name: 'Content Viewers', value: funnel.contentViewUsers, icon: '👁️' },
    { name: 'Search Users', value: funnel.searchUsers, icon: '🔍' },
    { name: 'Bookmark Users', value: funnel.bookmarkUsers, icon: '🔖' },
    { name: 'Follow Users', value: funnel.followUsers, icon: '❤️' }
  ];

  const maxValue = Math.max(...steps.map(step => step.value || 0));

  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      <div className="space-y-4">
      {steps.map((step, index) => {
        const safeStepValue = step.value || 0;
        const safeMaxValue = maxValue || 1;
        const safeFirstStepValue = steps[0]?.value || 1;
        
        const percentage = safeMaxValue > 0 ? (safeStepValue / safeMaxValue) * 100 : 0;
        const conversionRate = index > 0 ? (safeStepValue / safeFirstStepValue) * 100 : 100;
          
          return (
            <div key={index} className="relative">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center space-x-2">
                  <span className="text-lg">{step.icon}</span>
                  <span className="text-sm font-medium text-gray-700">{step.name}</span>
                </div>
                <div className="flex items-center space-x-2 text-sm">
                  <span className="font-medium">{(safeStepValue).toLocaleString()}</span>
                  <span className="text-gray-500">({(conversionRate || 0).toFixed(1)}%)</span>
                </div>
              </div>
              <div className="relative">
                <div className="w-full h-8 bg-gray-100 rounded-lg overflow-hidden">
                  <div 
                    className={`h-full rounded-lg transition-all duration-500 ${
                      index === 0 ? 'bg-blue-500' :
                      index === 1 ? 'bg-green-500' :
                      index === 2 ? 'bg-yellow-500' :
                      index === 3 ? 'bg-purple-500' :
                      index === 4 ? 'bg-pink-500' :
                      'bg-red-500'
                    }`}
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Content Performance by Demographics
export const ContentDemographicsChart = ({ data, title = "Content Performance by Region" }) => {
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <div className="text-2xl mb-2">🌍</div>
        <p>No demographic data available</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      <div className="space-y-4">
        {data.slice(0, 5).map((content, index) => (
          <div key={index} className="border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-2">
              {content._id || 'Unknown Content'}
            </h4>
            <div className="text-sm text-gray-600 mb-3">
              Total Views: <span className="font-medium">{content.totalViews}</span>
            </div>
            <div className="space-y-2">
              {content.regions && content.regions.slice(0, 5).map((region, regionIndex) => (
                <div key={regionIndex} className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">
                    {region.region || 'Unknown Region'}
                  </span>
                  <div className="flex items-center space-x-2">
                    <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 rounded-full"
                        style={{ 
                          width: `${(region.views / content.totalViews) * 100}%` 
                        }}
                      ></div>
                    </div>
                    <span className="text-sm font-medium w-8 text-right">
                      {region.views}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// User Activity Heatmap
export const UserActivityHeatmap = ({ patterns, title = "Activity Patterns" }) => {
  if (!patterns || patterns.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <div className="text-2xl mb-2">🔥</div>
        <p>No activity pattern data available</p>
      </div>
    );
  }

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const hours = Array.from({ length: 24 }, (_, i) => i);
  
  // Create a map for quick lookup
  const patternMap = {};
  patterns.forEach(pattern => {
    const key = `${pattern._id.dayOfWeek}-${pattern._id.hour}`;
    patternMap[key] = pattern.totalActions;
  });

  const maxActivity = Math.max(...patterns.map(p => p.totalActions));

  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          <div className="grid gap-1 text-xs" style={{ gridTemplateColumns: 'auto repeat(24, 1fr)' }}>
            {/* Header row */}
            <div></div>
            {hours.map(hour => (
              <div key={hour} className="text-center text-gray-500 p-1">
                {hour}
              </div>
            ))}
            
            {/* Data rows */}
            {days.map((day, dayIndex) => (
              <React.Fragment key={dayIndex}>
                <div className="text-gray-700 font-medium p-2 flex items-center">
                  {day}
                </div>
                {hours.map(hour => {
                  const key = `${dayIndex + 1}-${hour}`;
                  const activity = patternMap[key] || 0;
                  const intensity = maxActivity > 0 ? activity / maxActivity : 0;
                  
                  return (
                    <div 
                      key={hour}
                      className="w-6 h-6 rounded cursor-pointer transition-all hover:scale-110"
                      style={{
                        backgroundColor: intensity > 0 
                          ? `rgba(59, 130, 246, ${0.2 + intensity * 0.8})` 
                          : '#f3f4f6'
                      }}
                      title={`${day} ${hour}:00 - ${activity} activities`}
                    ></div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
        <span>Less activity</span>
        <div className="flex items-center space-x-1">
          {[0.2, 0.4, 0.6, 0.8, 1.0].map((intensity, index) => (
            <div 
              key={index}
              className="w-3 h-3 rounded"
              style={{ backgroundColor: `rgba(59, 130, 246, ${intensity})` }}
            ></div>
          ))}
        </div>
        <span>More activity</span>
      </div>
    </div>
  );
};
