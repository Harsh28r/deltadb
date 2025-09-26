const NodeCache = require('node-cache');

class CacheManager {
  constructor() {
    // Initialize multiple cache layers for different data types
    this.userCache = new NodeCache({
      stdTTL: 600, // 10 minutes for user data
      checkperiod: 120,
      maxKeys: 10000
    });

    this.projectCache = new NodeCache({
      stdTTL: 1800, // 30 minutes for project data
      checkperiod: 300,
      maxKeys: 5000
    });

    this.leadCache = new NodeCache({
      stdTTL: 300, // 5 minutes for lead data (more dynamic)
      checkperiod: 60,
      maxKeys: 50000
    });

    this.permissionCache = new NodeCache({
      stdTTL: 3600, // 1 hour for permissions (less frequent changes)
      checkperiod: 600,
      maxKeys: 20000
    });

    this.queryCache = new NodeCache({
      stdTTL: 180, // 3 minutes for query results
      checkperiod: 60,
      maxKeys: 1000
    });
  }

  // User cache methods
  setUser(userId, userData) {
    return this.userCache.set(`user:${userId}`, userData);
  }

  getUser(userId) {
    return this.userCache.get(`user:${userId}`);
  }

  deleteUser(userId) {
    return this.userCache.del(`user:${userId}`);
  }

  // Project cache methods
  setProject(projectId, projectData) {
    return this.projectCache.set(`project:${projectId}`, projectData);
  }

  getProject(projectId) {
    return this.projectCache.get(`project:${projectId}`);
  }

  deleteProject(projectId) {
    return this.projectCache.del(`project:${projectId}`);
  }

  // Lead cache methods
  setLead(leadId, leadData) {
    return this.leadCache.set(`lead:${leadId}`, leadData);
  }

  getLead(leadId) {
    return this.leadCache.get(`lead:${leadId}`);
  }

  deleteLead(leadId) {
    return this.leadCache.del(`lead:${leadId}`);
  }

  // Permission cache methods
  setUserPermissions(userId, permissions) {
    return this.permissionCache.set(`permissions:${userId}`, permissions);
  }

  getUserPermissions(userId) {
    return this.permissionCache.get(`permissions:${userId}`);
  }

  deleteUserPermissions(userId) {
    return this.permissionCache.del(`permissions:${userId}`);
  }

  // Query cache methods
  setQueryResult(queryKey, result) {
    return this.queryCache.set(queryKey, result);
  }

  getQueryResult(queryKey) {
    return this.queryCache.get(queryKey);
  }

  // Bulk operations
  setLeadsBulk(leadsData) {
    const keys = [];
    leadsData.forEach(lead => {
      const key = `lead:${lead._id}`;
      this.leadCache.set(key, lead);
      keys.push(key);
    });
    return keys;
  }

  // Cache invalidation methods
  invalidateUserData(userId) {
    this.deleteUser(userId);
    this.deleteUserPermissions(userId);
    // Also clear related query cache
    this.queryCache.flushAll();
  }

  invalidateProjectData(projectId) {
    this.deleteProject(projectId);
    // Invalidate related leads cache
    const leadKeys = this.leadCache.keys().filter(key =>
      key.includes(`project:${projectId}`)
    );
    this.leadCache.del(leadKeys);
    this.queryCache.flushAll();
  }

  // Statistics and monitoring
  getCacheStats() {
    return {
      user: this.userCache.getStats(),
      project: this.projectCache.getStats(),
      lead: this.leadCache.getStats(),
      permission: this.permissionCache.getStats(),
      query: this.queryCache.getStats()
    };
  }

  // Memory management
  clearExpiredKeys() {
    this.userCache.flushExpired();
    this.projectCache.flushExpired();
    this.leadCache.flushExpired();
    this.permissionCache.flushExpired();
    this.queryCache.flushExpired();
  }

  // Emergency cache clear
  flushAll() {
    this.userCache.flushAll();
    this.projectCache.flushAll();
    this.leadCache.flushAll();
    this.permissionCache.flushAll();
    this.queryCache.flushAll();
  }
}

module.exports = new CacheManager();