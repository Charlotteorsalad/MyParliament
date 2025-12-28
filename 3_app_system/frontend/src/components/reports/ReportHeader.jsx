import React from 'react';
import PropTypes from 'prop-types';
import { useLanguage } from '../../contexts/LanguageContext';

const ReportHeader = ({ isAuthenticated }) => {
  const { t } = useLanguage();
  
  return (
    <div className="bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 border border-slate-200 p-8 rounded-2xl mb-8 shadow-sm">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl mb-4 shadow-lg">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <h1 className="text-4xl font-bold text-slate-800 mb-3">
          {isAuthenticated ? t('myReports') : t('reports')}
        </h1>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto">
          {isAuthenticated 
            ? t('trackYourParliamentaryEngagement')
            : t('explorePublicAnalytics')
          }
        </p>
      </div>
    </div>
  );
};

ReportHeader.propTypes = {
  isAuthenticated: PropTypes.bool.isRequired
};

export default ReportHeader;

