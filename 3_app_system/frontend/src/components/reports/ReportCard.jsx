import React from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { Card } from '../ui';

const ReportCard = ({ report }) => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const handleClick = () => {
    const route = report.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    navigate(`/reports/${route}`);
  };

  return (
    <Card 
      className="hover:shadow-xl transition-shadow cursor-pointer group"
      onClick={handleClick}
    >
      <div className="flex items-start gap-4 mb-4">
        <div className={`w-12 h-12 ${report.bgColor} rounded-lg flex items-center justify-center flex-shrink-0`}>
          <svg className={`w-6 h-6 ${report.color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={report.icon} />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
            {report.title}
          </h3>
          <p className="text-sm text-gray-500 mt-1">{report.description}</p>
        </div>
      </div>
      
      <div className="mb-4">
        <p className="text-xs text-gray-500 mb-2">{t('lastUpdated')}: {report.lastUpdated}</p>
        <div className="flex flex-wrap gap-2">
          {report.dataPoints.map((point, pointIndex) => (
            <span key={pointIndex} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
              {point}
            </span>
          ))}
        </div>
      </div>

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

ReportCard.propTypes = {
  report: PropTypes.shape({
    title: PropTypes.string.isRequired,
    description: PropTypes.string.isRequired,
    icon: PropTypes.string.isRequired,
    color: PropTypes.string.isRequired,
    bgColor: PropTypes.string.isRequired,
    lastUpdated: PropTypes.string.isRequired,
    dataPoints: PropTypes.arrayOf(PropTypes.string).isRequired
  }).isRequired
};

export default ReportCard;

