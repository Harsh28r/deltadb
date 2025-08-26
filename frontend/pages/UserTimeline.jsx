import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeftIcon, 
  UserIcon, 
  CalendarIcon, 
  MapPinIcon,
  BuildingOfficeIcon,
  ShieldCheckIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';
import { 
  CheckCircleIcon as CheckCircleSolid,
  ExclamationTriangleIcon as ExclamationTriangleSolid,
  InformationCircleIcon as InformationCircleSolid
} from '@heroicons/react/24/solid';

const UserTimeline = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [timelineData, setTimelineData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchTimelineData();
  }, [userId]);

  const fetchTimelineData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      if (!token) {
        setError('Authentication required');
        setLoading(false);
        return;
      }

      const response = await fetch(`/api/superadmin/users/${userId}/timeline`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setTimelineData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getEventIcon = (event) => {
    switch (event.type) {
      case 'account_created':
        return <UserIcon className="w-6 h-6 text-green-500" />;
      case 'role_assigned':
        return <ShieldCheckIcon className="w-6 h-6 text-blue-500" />;
      case 'project_assignment':
        if (event.details.roleInProject === 'owner') {
          return <BuildingOfficeIcon className="w-6 h-6 text-orange-500" />;
        } else if (event.details.roleInProject === 'manager') {
          return <CheckCircleIcon className="w-6 h-6 text-yellow-500" />;
        } else {
          return <MapPinIcon className="w-6 h-6 text-purple-500" />;
        }
      case 'current_status':
        return <CheckCircleIcon className="w-6 h-6 text-green-500" />;
      default:
        return <InformationCircleIcon className="w-6 h-6 text-gray-500" />;
    }
  };

  const getEventColor = (event) => {
    switch (event.type) {
      case 'account_created':
        return 'border-green-500 bg-green-50';
      case 'role_assigned':
        return 'border-blue-500 bg-blue-50';
      case 'project_assignment':
        if (event.details.roleInProject === 'owner') {
          return 'border-orange-500 bg-orange-50';
        } else if (event.details.roleInProject === 'manager') {
          return 'border-yellow-500 bg-yellow-50';
        } else {
          return 'border-purple-500 bg-purple-50';
        }
      case 'current_status':
        return 'border-green-500 bg-green-50';
      default:
        return 'border-gray-500 bg-gray-50';
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircleSolid className="w-5 h-5 text-green-500" />;
      case 'active':
        return <CheckCircleSolid className="w-5 h-5 text-blue-500" />;
      case 'pending':
        return <ExclamationTriangleSolid className="w-5 h-5 text-yellow-500" />;
      default:
        return <InformationCircleSolid className="w-5 h-5 text-gray-500" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading timeline...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <ExclamationTriangleIcon className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Timeline</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <ArrowLeftIcon className="w-4 h-4 mr-2" />
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!timelineData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <InformationCircleIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No Timeline Data</h2>
          <p className="text-gray-600 mb-4">Unable to load timeline information</p>
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <ArrowLeftIcon className="w-4 h-4 mr-2" />
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <button
                onClick={() => navigate(-1)}
                className="mr-4 p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {timelineData.user.name}'s Timeline
                </h1>
                <p className="text-sm text-gray-600">
                  Complete journey from registration to current status
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="flex items-center text-sm text-gray-500">
                <ClockIcon className="w-4 h-4 mr-1" />
                {timelineData.timeline.stats.accountAge} days
              </div>
              <div className="flex items-center text-sm text-gray-500">
                <MapPinIcon className="w-4 h-4 mr-1" />
                {timelineData.timeline.stats.totalProjects} projects
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* User Summary Card */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                <span className="text-2xl font-bold text-white">
                  {timelineData.user.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{timelineData.user.name}</h2>
                <p className="text-gray-600">{timelineData.user.email}</p>
                <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                  <span className="flex items-center">
                    <CalendarIcon className="w-4 h-4 mr-1" />
                    Joined {formatDate(timelineData.user.accountCreated)}
                  </span>
                  {timelineData.user.mobile && (
                    <span className="flex items-center">
                      <MapPinIcon className="w-4 h-4 mr-1" />
                      {timelineData.user.mobile}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                <ShieldCheckIcon className="w-4 h-4 mr-1" />
                {timelineData.currentRole.name} (Level {timelineData.currentRole.level})
              </div>
              <p className="text-sm text-gray-600 mt-1">
                {timelineData.currentRole.permissions.length} permissions
              </p>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Activity Timeline</h3>
            <p className="text-gray-600">{timelineData.timeline.summary.journey}</p>
          </div>

          <div className="relative">
            {/* Timeline Line */}
            <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-200"></div>

            {/* Timeline Events */}
            <div className="space-y-8">
              {timelineData.timeline.events.map((event, index) => (
                <div key={event.id} className="relative flex items-start space-x-4">
                  {/* Event Icon */}
                  <div className="relative z-10 flex-shrink-0">
                    <div className={`w-16 h-16 rounded-full border-4 bg-white flex items-center justify-center ${getEventColor(event)}`}>
                      {getEventIcon(event)}
                    </div>
                  </div>

                  {/* Event Content */}
                  <div className="flex-1 min-w-0">
                    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-lg font-semibold text-gray-900">{event.title}</h4>
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(event.status)}
                          <span className="text-xs text-gray-500">
                            {formatDate(event.timestamp)}
                          </span>
                        </div>
                      </div>
                      
                      <p className="text-gray-600 mb-3">{event.description}</p>

                      {/* Event Details */}
                      {event.details && (
                        <div className="bg-gray-50 rounded-lg p-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                            {Object.entries(event.details).map(([key, value]) => (
                              <div key={key} className="flex justify-between">
                                <span className="font-medium text-gray-700 capitalize">
                                  {key.replace(/([A-Z])/g, ' $1').trim()}:
                                </span>
                                <span className="text-gray-600">
                                  {Array.isArray(value) ? value.join(', ') : String(value)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Project Summary */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mt-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{timelineData.projectSummary.total}</div>
              <div className="text-sm text-blue-600">Total Projects</div>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">{timelineData.projectSummary.owned}</div>
              <div className="text-sm text-orange-600">Owned</div>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">{timelineData.projectSummary.managed}</div>
              <div className="text-sm text-yellow-600">Managed</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{timelineData.projectSummary.member}</div>
              <div className="text-sm text-purple-600">Member</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserTimeline;
