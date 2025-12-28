import React from 'react';
import PropTypes from 'prop-types';
import { useLanguage } from '../../contexts/LanguageContext';
import { Card } from '../ui';

const QuickStatsCard = ({ 
  title, 
  value, 
  icon, 
  color, 
  bgColor, 
  stats, 
  onClick 
}) => {
  const { t } = useLanguage();
  
  return (
    <Card 
      className="hover:shadow-xl transition-shadow group cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className={`text-3xl font-bold ${color}`}>{value}</p>
        </div>
        <div className={`w-12 h-12 ${bgColor} rounded-lg flex items-center justify-center`}>
          <svg className={`w-6 h-6 ${color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
          </svg>
        </div>
      </div>
      
      {stats && (
        <div className="space-y-2 mb-4">
          {stats.map((stat, index) => (
            <div key={index} className="flex justify-between text-sm">
              <span className="text-gray-600">{stat.label}</span>
              <span className={`font-medium ${stat.color}`}>{stat.value}</span>
            </div>
          ))}
        </div>
      )}
      
      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex items-center justify-center text-indigo-600 text-sm font-medium">
          <span>{t('viewDetails')}</span>
          <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </Card>
  );
};

QuickStatsCard.propTypes = {
  title: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  icon: PropTypes.string.isRequired,
  color: PropTypes.string.isRequired,
  bgColor: PropTypes.string.isRequired,
  stats: PropTypes.arrayOf(PropTypes.shape({
    label: PropTypes.string.isRequired,
    value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    color: PropTypes.string.isRequired
  })),
  onClick: PropTypes.func
};

export default QuickStatsCard;

