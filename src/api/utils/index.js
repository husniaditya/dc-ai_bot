/**
 * API utilities index
 * Centralizes all API utility exports for easy importing
 */

const validation = require('./validation');
const responses = require('./responses');
const errors = require('./errors');
const helpers = require('./helpers');

module.exports = {
  // Validation utilities
  ...validation,
  
  // Response formatting utilities
  ...responses,
  
  // Error handling utilities
  ...errors,
  
  // Helper utilities
  ...helpers,
  
  // Grouped exports for specific use cases
  validation,
  responses,
  errors,
  helpers
};
