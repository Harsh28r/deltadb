import React from 'react';
import TimelineButton from './TimelineButton';

const UserCardWithTimeline = ({ user }) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
            <span className="text-lg font-bold text-white">
              {user.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{user.name}</h3>
            <p className="text-sm text-gray-600">{user.email}</p>
          </div>
        </div>
        <div className="text-right">
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            {user.role} (Level {user.level})
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
        <div>
          <span className="text-gray-500">Mobile:</span>
          <span className="ml-2 text-gray-900">{user.mobile || 'N/A'}</span>
        </div>
        <div>
          <span className="text-gray-500">Company:</span>
          <span className="ml-2 text-gray-900">{user.companyName || 'N/A'}</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between">
        <div className="flex space-x-2">
          <button className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2">
            Edit
          </button>
          <button className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2">
            View Details
          </button>
        </div>
        
        {/* Timeline Button */}
        <TimelineButton 
          userId={user._id} 
          userName={user.name}
          className="ml-auto"
        />
      </div>
    </div>
  );
};

export default UserCardWithTimeline;
