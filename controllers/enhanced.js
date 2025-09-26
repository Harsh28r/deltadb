
// Service Integration Guide for Controllers
// Replace existing controller logic with service calls

const userService = require('../services/userService');
const leadService = require('../services/leadService');
const notificationService = require('../services/notificationService');
const reminderService = require('../services/reminderService');

// Example: Enhanced User Controller with Service Integration
const enhancedUserController = {

  // Create user using service
  async createUser(req, res) {
    try {
      const { user, token } = await userService.registerUser(req.body);
      res.status(201).json({
        success: true,
        message: 'User created successfully',
        data: { user, token }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  },

  // Get users with advanced filtering
  async getUsers(req, res) {
    try {
      const result = await userService.getUsers(req.query);
      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
};

// Example: Enhanced Lead Controller with Service Integration
const enhancedLeadController = {

  // Create lead using service
  async createLead(req, res) {
    try {
      const lead = await leadService.createLead(req.body, req.user.id);
      res.status(201).json({
        success: true,
        message: 'Lead created successfully',
        data: lead
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  },

  // Get leads with advanced filtering and caching
  async getLeads(req, res) {
    try {
      const result = await leadService.getLeads(req.query, req.user.id);
      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
};

module.exports = {
  enhancedUserController,
  enhancedLeadController
};
