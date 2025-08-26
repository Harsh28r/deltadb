import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ClockIcon } from '@heroicons/react/24/outline';

const TimelineButton = ({ userId, userName, className = "" }) => {
  const navigate = useNavigate();

  const handleTimelineClick = () => {
    navigate(`/users/${userId}/timeline`);
  };

  return (
    <button
      onClick={handleTimelineClick}
      className={`inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 shadow-md hover:shadow-lg ${className}`}
      title={`View ${userName}'s complete timeline`}
    >
      <ClockIcon className="w-4 h-4 mr-2" />
      Timeline
    </button>
  );
};

export default TimelineButton;
