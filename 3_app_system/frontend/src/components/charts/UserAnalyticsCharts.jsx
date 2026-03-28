import React from 'react';
import { ComposableMap, Geographies, Geography } from 'react-simple-maps';
import malaysiaStates from '../../assets/malaysia.state.geojson';
import malaysiaParlimen from '../../assets/malaysia.parlimen.geojson';

// User Engagement Score Chart
export const UserEngagementChart = ({ users, title = "Top Engaged Users" }) => {
  if (!users || users.length === 0) {
    return (
      <div className="bg-gray-50 p-4 sm:p-6 rounded-lg border border-gray-200 min-h-0">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
        <div className="text-center py-8 sm:py-12 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg bg-white">
          <p>No user engagement data available</p>
        </div>
      </div>
    );
  }

  const maxScore = Math.max(...users.map(user => user.engagementScore || 0), 1);
  const displayUsers = users.slice(0, 10);

  return (
    <div className="bg-white p-4 sm:p-6 rounded-lg border border-gray-200 min-h-0 flex flex-col">
      <h3 className="text-lg font-semibold text-gray-900 mb-3 sm:mb-4">{title}</h3>
      <div className="space-y-2 sm:space-y-3 flex-1 min-h-0">
        {displayUsers.map((user, index) => (
          <div
            key={user.userId || index}
            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2 p-2 sm:p-0 rounded-lg sm:rounded-none hover:bg-gray-50 sm:hover:bg-transparent border border-transparent sm:border-0"
          >
            <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
              <div className="w-7 h-7 sm:w-8 sm:h-8 flex-shrink-0 bg-blue-100 rounded-full flex items-center justify-center text-xs sm:text-sm font-medium text-blue-600">
                {index + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate" title={user.displayName || user.username || user.email || 'Unknown'}>
                  {user.displayName || user.username || user.email || 'Anonymous User'}
                </p>
                <div className="flex flex-wrap items-center gap-x-2 sm:gap-x-3 gap-y-0 text-xs text-gray-500">
                  <span>{user.totalViews ?? 0} views</span>
                  <span>{user.totalSearches ?? 0} searches</span>
                  <span>{user.totalBookmarks ?? 0} bookmarks</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 pl-9 sm:pl-0">
              <div className="flex-1 sm:flex-none sm:w-20 h-1.5 sm:h-2 bg-gray-200 rounded-full overflow-hidden min-w-0">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-300"
                  style={{
                    width: `${maxScore > 0 ? ((user.engagementScore || 0) / maxScore) * 100 : 0}%`
                  }}
                />
              </div>
              <span className="text-xs sm:text-sm font-medium text-gray-700 w-8 sm:w-8 text-right flex-shrink-0">
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
      <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
        <div className="text-center py-12 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg bg-white">
          <div className="text-2xl mb-2"></div>
          <p>No segmentation data available</p>
        </div>
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
      <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
        <div className="text-center py-12 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg bg-white">
          <div className="text-2xl mb-2"></div>
          <p>No funnel data available</p>
        </div>
      </div>
    );
  }

  const steps = [
    { name: 'Total Users', value: funnel.totalUsers, icon: '' },
    { name: 'Login Users', value: funnel.loginUsers, icon: '' },
    { name: 'Content Viewers', value: funnel.contentViewUsers, icon: '' },
    { name: 'Search Users', value: funnel.searchUsers, icon: '' },
    { name: 'Bookmark Users', value: funnel.bookmarkUsers, icon: '' },
    { name: 'Follow Users', value: funnel.followUsers, icon: '' }
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

// User by Region Distribution — two tabs: State, Constituency
const toSortedEntries = (data) => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return [];
  return Object.entries(data)
    .map(([name, count]) => ({ name: name || 'Unknown', count: Number(count) || 0 }))
    .sort((a, b) => b.count - a.count);
};

const RegionList = ({ entries, maxCount, compact = false }) => {
  if (entries.length === 0) {
    return (
      <div className="text-center py-3 text-gray-500 text-xs">
        No data available
      </div>
    );
  }
  const itemClass = compact ? 'py-1 px-2' : 'p-4';
  const nameClass = compact ? 'text-xs' : 'text-sm';
  const countClass = compact ? 'text-xs' : 'text-sm';
  const barHeight = compact ? 'h-1.5' : 'h-2';

  return (
    <div className={compact ? 'space-y-1.5' : 'space-y-4'}>
      {entries.slice(0, 10).map(({ name, count }, index) => (
        <div key={index} className={`border border-gray-200 rounded-lg bg-white ${itemClass}`}>
          <div className="flex items-center justify-between mb-1">
            <h4 className={`font-medium text-gray-900 truncate ${nameClass}`}>{name}</h4>
            <span className={`font-medium text-gray-700 ${countClass}`}>{count}</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className={`flex-1 bg-gray-200 rounded-full overflow-hidden ${barHeight}`}>
              <div
                className="h-full bg-emerald-500 rounded-full"
                style={{ width: `${(count / maxCount) * 100}%` }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export const UserByRegionChart = ({
  stateData = {},
  constituencyData = {},
  title = "User by Region Distribution"
}) => {
  const [activeTab, setActiveTab] = React.useState('state');
  const [showList, setShowList] = React.useState(false);
  const stateEntries = toSortedEntries(stateData);
  const constituencyEntries = toSortedEntries(constituencyData);
  const stateMax = Math.max(...stateEntries.map(({ count }) => count), 1);
  const constituencyMax = Math.max(...constituencyEntries.map(({ count }) => count), 1);
  const hasAny = stateEntries.length > 0 || constituencyEntries.length > 0;

  if (!hasAny) {
    return (
      <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
        <div className="text-center py-12 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg bg-white">
          <div className="text-2xl mb-2">🌍</div>
          <p>No user region data available</p>
        </div>
      </div>
    );
  }

  const currentEntries = activeTab === 'state' ? stateEntries : constituencyEntries;
  const currentMax = activeTab === 'state' ? stateMax : constituencyMax;
  const currentGeography = activeTab === 'state' ? malaysiaStates : malaysiaParlimen;
  const mapLegend = [
    { label: 'Strong', color: '#047857' },
    { label: 'Mid', color: '#f59e0b' },
    { label: 'Low', color: '#60a5fa' },
    { label: 'No data', color: '#e5e7eb' }
  ];

  const normalizeName = (value) => {
    if (!value) return '';
    return String(value).toLowerCase().trim();
  };

  // Canonical state name map – handles WP abbreviations, language variants, etc.
  const canonicalState = (name) => {
    const n = normalizeName(name);
    if (['wp k lumpur', 'kuala lumpur', 'federal territory of kuala lumpur', 'wilayah persekutuan kuala lumpur'].includes(n)) return 'kuala lumpur';
    if (['wp putrajaya', 'putrajaya', 'federal territory of putrajaya', 'wilayah persekutuan putrajaya'].includes(n)) return 'putrajaya';
    if (['wp labuan', 'labuan', 'federal territory of labuan', 'wilayah persekutuan labuan'].includes(n)) return 'labuan';
    if (['pulau pinang', 'penang'].includes(n)) return 'penang';
    if (['melaka', 'malacca'].includes(n)) return 'melaka';
    return n;
  };

  const stripParlimenPrefix = (value) => {
    if (!value) return '';
    // Remove prefixes like "P.001 " from "P.001 Padang Besar"
    return String(value).replace(/^p\.\d+\s+/i, '').trim();
  };

  const getFillColor = (count, maxCountForMap) => {
    if (!count || maxCountForMap <= 0) return '#e5e7eb';

    const intensity = count / maxCountForMap;
    if (intensity >= 0.67) return '#047857'; // Strong
    if (intensity >= 0.34) return '#f59e0b'; // Mid
    return '#60a5fa'; // Low
  };

  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200 relative overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <div className="flex border border-gray-200 rounded-lg overflow-hidden text-xs">
          <button
            type="button"
            onClick={() => { setActiveTab('state'); setShowList(false); }}
            className={`px-3 py-1.5 font-medium transition-colors ${
              activeTab === 'state'
                ? 'bg-blue-50 text-blue-700'
                : 'bg-white text-gray-500 hover:bg-gray-50'
            }`}
          >
            State
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('constituency'); setShowList(false); }}
            className={`px-3 py-1.5 font-medium border-l border-gray-200 transition-colors ${
              activeTab === 'constituency'
                ? 'bg-blue-50 text-blue-700'
                : 'bg-white text-gray-500 hover:bg-gray-50'
            }`}
          >
            Constituency
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs sm:text-sm">
        {mapLegend.map((item) => (
          <div key={item.label} className="flex items-center gap-2 text-gray-600">
            <span
              className="inline-block h-3 w-3 rounded-sm border border-gray-200"
              style={{ backgroundColor: item.color }}
            />
            <span>{item.label}</span>
          </div>
        ))}
      </div>

      {/* Map + heat coloring */}
      <div className="relative">
        <div className="w-full h-[20rem] sm:h-[24rem] lg:h-[28rem] xl:h-[32rem]">
          <ComposableMap
            projection="geoMercator"
            projectionConfig={{
              scale: activeTab === 'state' ? 2350 : 2450,
              center: [110, 4] // roughly center of Malaysia
            }}
            style={{ width: '100%', height: '100%' }}
            viewBox="0 0 900 500"
            preserveAspectRatio="xMidYMid meet"
          >
            <Geographies geography={currentGeography}>
              {({ geographies }) => {
                const maxCountForMap = Math.max(...currentEntries.map(e => e.count), 1);
                return geographies.map((geo) => {
                  let entry = { count: 0 };

                  if (activeTab === 'state') {
                    const stateName = geo.properties?.name || geo.properties?.state || '';
                    const stateKeyNorm = canonicalState(stateName);

                    entry =
                      currentEntries.find((e) => canonicalState(e.name) === stateKeyNorm) ||
                      { count: 0 };
                  } else {
                    const parlimenName = geo.properties?.parlimen || geo.properties?.id || '';
                    const parlimenCode = geo.properties?.code_parlimen || '';

                    // Also add known geojson ↔ user-data name variants
                    const constituencyAliases = {
                      'gua musang': 'gu musang',
                      'gu musang': 'gua musang',
                      'bayan baru': 'bayan barat',
                      'bayan barat': 'bayan baru',
                    };

                    const stripped = normalizeName(stripParlimenPrefix(parlimenName));
                    const candidates = [
                      normalizeName(parlimenName),
                      normalizeName(parlimenCode),
                      stripped,
                      constituencyAliases[stripped] || null,
                    ].filter(Boolean);

                    entry =
                      currentEntries.find((e) => {
                        const n = normalizeName(e.name);
                        return n && candidates.includes(n);
                      }) || { count: 0 };
                  }
                  const fill = getFillColor(entry.count, maxCountForMap);
                  // Constituency borders need visible stroke so divisions are clear
                  const strokeColor = activeTab === 'constituency' ? '#9ca3af' : '#ffffff';
                  const strokeW = activeTab === 'constituency' ? 0.4 : 0.7;
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={fill}
                      stroke={strokeColor}
                      strokeWidth={strokeW}
                    />
                  );
                });
              }}
            </Geographies>
          </ComposableMap>
        </div>

        {/* Collapsible compact list in top-right */}
        <div className="absolute top-2 right-2 w-40 sm:w-52 lg:w-60 max-w-[calc(100%-1rem)]">
          <button
            type="button"
            onClick={() => setShowList(v => !v)}
            className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-medium bg-white/90 border border-gray-200 rounded-lg shadow-sm hover:bg-white"
          >
            <span className="truncate">
              {activeTab === 'state' ? 'Top states' : 'Top constituencies'}
            </span>
            <span className="text-gray-400">{showList ? 'Collapse' : 'Expand'}</span>
          </button>
          <div
            className={`overflow-hidden transition-all duration-300 ${showList ? 'max-h-72 mt-2' : 'max-h-0'}`}
          >
            <div className="bg-white/95 border border-gray-200 rounded-lg shadow-sm p-2 max-h-72 overflow-y-auto">
              <RegionList entries={currentEntries} maxCount={currentMax} compact />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Content Performance by Demographics (kept for backward compatibility if used elsewhere)
export const ContentDemographicsChart = ({ data, title = "Content Performance by Region" }) => {
  if (!data || data.length === 0) {
    return (
      <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
        <div className="text-center py-12 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg bg-white">
          <div className="text-2xl mb-2">🌍</div>
          <p>No demographic data available</p>
        </div>
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
      <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
        <div className="text-center py-12 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg bg-white">
          <div className="text-2xl mb-2"></div>
          <p>No activity pattern data available</p>
        </div>
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

const CATEGORY_STYLES = {
  Education:   { bg: 'bg-purple-100', text: 'text-purple-700', bar: '#8B5CF6', dot: 'bg-purple-500' },
  'MP Profile':{ bg: 'bg-green-100',  text: 'text-green-700',  bar: '#10B981', dot: 'bg-green-500'  },
  Issue:       { bg: 'bg-amber-100',  text: 'text-amber-700',  bar: '#F59E0B', dot: 'bg-amber-500'  },
  Forum:       { bg: 'bg-blue-100',   text: 'text-blue-700',   bar: '#3B82F6', dot: 'bg-blue-500'   },
  Content:     { bg: 'bg-gray-100',   text: 'text-gray-700',   bar: '#6B7280', dot: 'bg-gray-500'   },
};

export const TrendingContentChart = ({ items = [], title = 'Trending Topics & Issues' }) => {
  const validItems = (items || []).filter(i => i.views > 0);

  if (validItems.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg">🔥</span>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        </div>
        <div className="text-center py-10 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
          No trending content yet — views will appear here once users start browsing.
        </div>
      </div>
    );
  }

  const maxViews = Math.max(...validItems.map(i => i.views), 1);
  const top = validItems.slice(0, 10);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">🔥</span>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        </div>
        {/* Legend */}
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {Object.entries(CATEGORY_STYLES).filter(([cat]) => top.some(i => i.category === cat)).map(([cat, s]) => (
            <span key={cat} className="flex items-center gap-1 text-xs text-gray-500">
              <span className={`w-2 h-2 rounded-full ${s.dot}`}></span>{cat}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {top.map((item, idx) => {
          const style = CATEGORY_STYLES[item.category] || CATEGORY_STYLES.Content;
          const pct = (item.views / maxViews) * 100;
          return (
            <div key={idx} className="group">
              <div className="flex items-center justify-between mb-1 gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="text-xs font-bold text-gray-400 w-5 text-right flex-shrink-0">{idx + 1}</span>
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded flex-shrink-0 ${style.bg} ${style.text}`}>
                    {item.category}
                  </span>
                  <span className="text-sm text-gray-800 truncate" title={item.title}>{item.title}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-sm font-semibold text-gray-700">{item.views.toLocaleString()}</span>
                  <span className="text-xs text-gray-400">views</span>
                </div>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden ml-7">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, backgroundColor: style.bar }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
