/**
 * Example: Enhanced settings route using API utilities
 * This demonstrates how to use the new API utilities
 */

const express = require('express');
const { audit } = require('../middleware/audit');
const { 
  validateGuildSettings, 
  successResponse, 
  errorResponse, 
  validationErrorResponse,
  formatSettings,
  getUserGuildId,
  asyncHandler,
  ValidationError
} = require('../utils');

function createEnhancedSettingsRoutes(store) {
  const router = express.Router();

  // Get settings with enhanced response formatting
  router.get('/', asyncHandler(async (req, res) => {
    const guildId = await getUserGuildId(req, store);
    
    let settings;
    if (guildId) {
      settings = await store.getGuildSettings(guildId);
      settings.guildId = guildId;
    } else {
      settings = store.getSettings();
    }
    
    const formattedSettings = formatSettings(settings);
    res.json(successResponse(formattedSettings));
  }));

  // Update settings with validation
  router.put('/', asyncHandler(async (req, res) => {
    const guildId = await getUserGuildId(req, store);
    
    // Validate the incoming settings
    const validation = validateGuildSettings(req.body);
    if (!validation.valid) {
      return res.status(400).json(validationErrorResponse(validation.errors));
    }
    
    let updated;
    if (guildId) {
      updated = await store.setGuildSettings(guildId, validation.data);
    } else {
      updated = await store.setSettings(validation.data);
    }
    
    audit(req, { 
      action: guildId ? 'update-guild-settings' : 'update-settings', 
      guildId, 
      data: validation.data 
    });
    
    const formattedSettings = formatSettings(updated);
    res.json(successResponse(formattedSettings, 'Settings updated successfully'));
  }));

  return router;
}

module.exports = createEnhancedSettingsRoutes;
