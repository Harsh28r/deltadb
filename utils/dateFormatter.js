/**
 * Date formatting utilities for better user experience
 */

/**
 * Format date in readable format: "Mon, Sep 27, 2025"
 * @param {Date|string} date - Date to format
 * @returns {string} Formatted date
 */
const formatDate = (date) => {
  const dateObj = new Date(date);
  return dateObj.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

/**
 * Format time in readable format: "06:00 PM"
 * @param {Date|string} date - Date to format
 * @returns {string} Formatted time
 */
const formatTime = (date) => {
  const dateObj = new Date(date);
  return dateObj.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};

/**
 * Format date and time in readable format: "Mon, Sep 27, 2025 at 06:00 PM"
 * @param {Date|string} date - Date to format
 * @returns {string} Formatted date and time
 */
const formatDateTime = (date) => {
  return `${formatDate(date)} at ${formatTime(date)}`;
};

/**
 * Format date in short format: "Sep 27, 2025"
 * @param {Date|string} date - Date to format
 * @returns {string} Formatted date
 */
const formatDateShort = (date) => {
  const dateObj = new Date(date);
  return dateObj.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

/**
 * Format date for display in lists: "Sep 27"
 * @param {Date|string} date - Date to format
 * @returns {string} Formatted date
 */
const formatDateCompact = (date) => {
  const dateObj = new Date(date);
  return dateObj.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });
};

/**
 * Get relative time string: "in 2 hours", "2 days ago"
 * @param {Date|string} date - Date to compare
 * @returns {string} Relative time string
 */
const getRelativeTime = (date) => {
  const dateObj = new Date(date);
  const now = new Date();
  const diffMs = dateObj - now;
  const diffMins = Math.round(diffMs / 60000);
  const diffHours = Math.round(diffMs / 3600000);
  const diffDays = Math.round(diffMs / 86400000);

  if (Math.abs(diffMins) < 1) {
    return 'now';
  } else if (Math.abs(diffMins) < 60) {
    return diffMins > 0 ? `in ${diffMins} minute${diffMins !== 1 ? 's' : ''}` : `${Math.abs(diffMins)} minute${Math.abs(diffMins) !== 1 ? 's' : ''} ago`;
  } else if (Math.abs(diffHours) < 24) {
    return diffHours > 0 ? `in ${diffHours} hour${diffHours !== 1 ? 's' : ''}` : `${Math.abs(diffHours)} hour${Math.abs(diffHours) !== 1 ? 's' : ''} ago`;
  } else {
    return diffDays > 0 ? `in ${diffDays} day${diffDays !== 1 ? 's' : ''}` : `${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? 's' : ''} ago`;
  }
};

/**
 * Format date for API response with multiple formats
 * @param {Date|string} date - Date to format
 * @returns {Object} Object with different date formats
 */
const formatDateForAPI = (date) => {
  const dateObj = new Date(date);
  return {
    iso: dateObj.toISOString(),
    formatted: formatDateTime(date),
    date: formatDate(date),
    time: formatTime(date),
    relative: getRelativeTime(date),
    timestamp: dateObj.getTime()
  };
};

/**
 * Check if date is today
 * @param {Date|string} date - Date to check
 * @returns {boolean}
 */
const isToday = (date) => {
  const dateObj = new Date(date);
  const today = new Date();
  return dateObj.toDateString() === today.toDateString();
};

/**
 * Check if date is tomorrow
 * @param {Date|string} date - Date to check
 * @returns {boolean}
 */
const isTomorrow = (date) => {
  const dateObj = new Date(date);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return dateObj.toDateString() === tomorrow.toDateString();
};

/**
 * Format date with smart logic (today/tomorrow or formatted date)
 * @param {Date|string} date - Date to format
 * @returns {string}
 */
const formatDateSmart = (date) => {
  if (isToday(date)) {
    return `Today at ${formatTime(date)}`;
  } else if (isTomorrow(date)) {
    return `Tomorrow at ${formatTime(date)}`;
  } else {
    return formatDateTime(date);
  }
};

module.exports = {
  formatDate,
  formatTime,
  formatDateTime,
  formatDateShort,
  formatDateCompact,
  getRelativeTime,
  formatDateForAPI,
  isToday,
  isTomorrow,
  formatDateSmart
};
