import React from 'react';
import PropTypes from 'prop-types';
import { Button } from '../ui';

const DashboardHeader = ({ 
  user, 
  isAuthenticated, 
  language, 
  toggleLanguage, 
  onSettingsClick 
}) => {
  return (
    <div className="bg-indigo-600 shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          <div className="flex items-center space-x-4">
            <div className="h-12 w-12 bg-white/20 rounded-lg flex items-center justify-center">
              <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">User Dashboard</h1>
              <p className="text-indigo-100">
                {isAuthenticated && user ? (
                  <>Welcome back, <span className="font-semibold text-white">{user.username}</span></>
                ) : (
                  <>Welcome to MyParliament - <span className="font-semibold text-white">Login to access personalized features</span></>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {/* Language Toggle */}
            <div className="flex items-center space-x-2">
              <span className={`text-sm font-medium transition-colors duration-300 ${
                language === 'en' ? 'text-indigo-100 font-semibold' : 'text-indigo-200'
              }`}>
                EN
              </span>
              <button
                onClick={toggleLanguage}
                className={`relative w-12 h-6 rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:ring-offset-2 ${
                  language === 'bm' 
                    ? 'bg-white/30' 
                    : 'bg-white/20'
                }`}
              >
                <div
                  className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-lg transition-transform duration-300 ${
                    language === 'bm' ? 'translate-x-6' : 'translate-x-0.5'
                  }`}
                />
              </button>
              <span className={`text-sm font-medium transition-colors duration-300 ${
                language === 'bm' ? 'text-indigo-100 font-semibold' : 'text-indigo-200'
              }`}>
                BM
              </span>
            </div>
            <Button
              onClick={onSettingsClick}
              variant="outline"
              className="bg-white/20 text-white border-white/30 hover:bg-white/30"
            >
              <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {isAuthenticated ? 'Settings' : 'Login'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

DashboardHeader.propTypes = {
  user: PropTypes.object,
  isAuthenticated: PropTypes.bool.isRequired,
  language: PropTypes.string.isRequired,
  toggleLanguage: PropTypes.func.isRequired,
  onSettingsClick: PropTypes.func.isRequired
};

export default DashboardHeader;




