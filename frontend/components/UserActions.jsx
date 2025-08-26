import React from 'react';
import TimelineButton from './TimelineButton';

const UserActions = ({ user, onEdit, onDelete, onViewDetails }) => {
  return (
    <div className="flex items-center space-x-2">
      {/* Existing Action Buttons */}
      {onViewDetails && (
        <button
          onClick={() => onViewDetails(user)}
          className="inline-flex items-center px-3 py-2 text-sm font-medium text-blue-700 bg-blue-100 rounded-lg hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          View
        </button>
      )}
      
      {onEdit && (
        <button
          onClick={() => onEdit(user)}
          className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
        >
          Edit
        </button>
      )}
      
      {onDelete && (
        <button
          onClick={() => onDelete(user)}
          className="inline-flex items-center px-3 py-2 text-sm font-medium text-red-700 bg-red-100 rounded-lg hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
        >
          Delete
        </button>
      )}
      
      {/* Timeline Button - Always visible */}
      <TimelineButton 
        userId={user._id} 
        userName={user.name}
      />
    </div>
  );
};

export default UserActions;
