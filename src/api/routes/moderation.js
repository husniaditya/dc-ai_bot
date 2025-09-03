const express = require('express');

function createModerationRoutes(client, store) {
  const router = express.Router();

  // Get moderation feature states for a guild
  router.get('/features', async (req, res) => {
    try {
      const guildId = req.headers['x-guild-id'];
      if (!guildId) {
        return res.status(400).json({ error: 'Guild ID required' });
      }

      // Get feature states from database or return defaults
      const features = await store.getModerationFeatures(guildId);
      res.json(features);
    } catch (error) {
      console.error('Error fetching moderation features:', error);
      res.status(500).json({ error: 'Failed to fetch features' });
    }
  });

  // Update feature configuration
  router.post('/features/:featureKey/config', async (req, res) => {
    try {
      const guildId = req.headers['x-guild-id'];
      const { featureKey } = req.params;
      const config = req.body;

      if (!guildId) {
        return res.status(400).json({ error: 'Guild ID required' });
      }

      const validFeatures = ['automod', 'welcome', 'roles', 'xp', 'scheduler', 'logging', 'antiraid'];
      if (!validFeatures.includes(featureKey)) {
        return res.status(400).json({ error: 'Invalid feature key' });
      }

      // Update feature configuration in database
      const updatedFeature = await store.updateModerationFeatureConfig(guildId, featureKey, config);
      
      res.json({ 
        success: true, 
        feature: featureKey, 
        config: updatedFeature.config
      });
    } catch (error) {
      console.error('Error updating feature configuration:', error);
      res.status(500).json({ error: 'Failed to update feature configuration' });
    }
  });

  // Get feature configuration
  router.get('/features/:featureKey/config', async (req, res) => {
    try {
      const guildId = req.headers['x-guild-id'];
      const { featureKey } = req.params;

      if (!guildId) {
        return res.status(400).json({ error: 'Guild ID required' });
      }

      const validFeatures = ['automod', 'welcome', 'roles', 'xp', 'scheduler', 'logging', 'antiraid'];
      if (!validFeatures.includes(featureKey)) {
        return res.status(400).json({ error: 'Invalid feature key' });
      }

      // Get all features and extract the specific one
      const allFeatures = await store.getModerationFeatures(guildId);
      const feature = allFeatures[featureKey] || { enabled: false, config: {} };
      
      res.json({ 
        success: true, 
        feature: featureKey, 
        config: feature.config || {}
      });
    } catch (error) {
      console.error('Error fetching feature configuration:', error);
      res.status(500).json({ error: 'Failed to fetch feature configuration' });
    }
  });

  // Toggle a specific moderation feature
  router.post('/features/:featureKey/toggle', async (req, res) => {
    try {
      const guildId = req.headers['x-guild-id'];
      const { featureKey } = req.params;
      const { enabled } = req.body;

      if (!guildId) {
        return res.status(400).json({ error: 'Guild ID required' });
      }

      const validFeatures = ['automod', 'warnings', 'welcome', 'roles', 'xp', 'scheduler', 'logging', 'antiraid'];
      if (!validFeatures.includes(featureKey)) {
        return res.status(400).json({ error: 'Invalid feature key' });
      }

      // Update feature state in database
      await store.toggleModerationFeature(guildId, featureKey, enabled);
      
      // Get updated features
      const features = await store.getModerationFeatures(guildId);
      
      res.json({ 
        success: true, 
        feature: featureKey, 
        enabled,
        features 
      });
    } catch (error) {
      console.error('Error toggling moderation feature:', error);
      res.status(500).json({ error: 'Failed to toggle feature' });
    }
  });

  // Get automod rules for a guild
  router.get('/automod/rules', async (req, res) => {
    try {
      const guildId = req.headers['x-guild-id'];
      if (!guildId) {
        return res.status(400).json({ error: 'Guild ID required' });
      }

      const rules = await store.getGuildAutoModRules(guildId);
      res.json({ rules });
    } catch (error) {
      console.error('Error fetching automod rules:', error);
      res.status(500).json({ error: 'Failed to fetch automod rules' });
    }
  });

  // Create or update automod rule
  router.post('/automod/rules', async (req, res) => {
    try {
      const guildId = req.headers['x-guild-id'];
      if (!guildId) {
        return res.status(400).json({ error: 'Guild ID required' });
      }

      const ruleData = req.body;
      
      // Validate required fields
      if (!ruleData.name || !ruleData.triggerType || !ruleData.actionType) {
        return res.status(400).json({ error: 'Missing required fields: name, triggerType, actionType' });
      }

      const rule = await store.createGuildAutoModRule(guildId, ruleData);
      res.json({ success: true, rule });
    } catch (error) {
      console.error('Error creating automod rule:', error);
      res.status(500).json({ error: 'Failed to create automod rule' });
    }
  });

  // Update automod rule
  router.put('/automod/rules/:ruleId', async (req, res) => {
    try {
      const guildId = req.headers['x-guild-id'];
      const { ruleId } = req.params;
      
      if (!guildId) {
        return res.status(400).json({ error: 'Guild ID required' });
      }

      const ruleData = req.body;
      const rule = await store.updateGuildAutoModRule(guildId, ruleId, ruleData);
      
      if (!rule) {
        return res.status(404).json({ error: 'Rule not found' });
      }

      res.json({ success: true, rule });
    } catch (error) {
      console.error('Error updating automod rule:', error);
      res.status(500).json({ error: 'Failed to update automod rule' });
    }
  });

  // Delete automod rule
  router.delete('/automod/rules/:ruleId', async (req, res) => {
    try {
      const guildId = req.headers['x-guild-id'];
      const { ruleId } = req.params;
      
      if (!guildId) {
        return res.status(400).json({ error: 'Guild ID required' });
      }

      const success = await store.deleteGuildAutoModRule(guildId, ruleId);
      
      if (!success) {
        return res.status(404).json({ error: 'Rule not found' });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting automod rule:', error);
      res.status(500).json({ error: 'Failed to delete automod rule' });
    }
  });

  // Toggle automod rule status
  router.post('/automod/rules/:ruleId/toggle', async (req, res) => {
    try {
      const guildId = req.headers['x-guild-id'];
      const { ruleId } = req.params;
      const { enabled } = req.body;
      
      if (!guildId) {
        return res.status(400).json({ error: 'Guild ID required' });
      }

      const rule = await store.toggleGuildAutoModRule(guildId, ruleId, enabled);
      
      if (!rule) {
        return res.status(404).json({ error: 'Rule not found' });
      }

      res.json({ success: true, rule });
    } catch (error) {
      console.error('Error toggling automod rule:', error);
      res.status(500).json({ error: 'Failed to toggle automod rule' });
    }
  });

  // Get warning system configuration (placeholder - not implemented yet)
  router.get('/warnings/config', async (req, res) => {
    try {
      const guildId = req.headers['x-guild-id'];
      if (!guildId) {
        return res.status(400).json({ error: 'Guild ID required' });
      }

      // Return default warning config for now
      const config = {
        enabled: false,
        maxWarnings: 3,
        muteAfterWarnings: false,
        kickAfterWarnings: false,
        banAfterWarnings: false
      };
      res.json(config);
    } catch (error) {
      console.error('Error fetching warning config:', error);
      res.status(500).json({ error: 'Failed to fetch warning config' });
    }
  });

  // Update warning system configuration (placeholder - not implemented yet)
  router.put('/warnings/config', async (req, res) => {
    try {
      const guildId = req.headers['x-guild-id'];
      if (!guildId) {
        return res.status(400).json({ error: 'Guild ID required' });
      }

      // For now, just return success
      res.json({ success: true, config: req.body });
    } catch (error) {
      console.error('Error updating warning config:', error);
      res.status(500).json({ error: 'Failed to update warning config' });
    }
  });

  // Get user warnings (placeholder - not implemented yet)
  router.get('/warnings/user/:userId', async (req, res) => {
    try {
      const guildId = req.headers['x-guild-id'];
      const { userId } = req.params;
      
      if (!guildId) {
        return res.status(400).json({ error: 'Guild ID required' });
      }

      // Return empty warnings array for now
      const warnings = [];
      res.json({ warnings });
    } catch (error) {
      console.error('Error fetching user warnings:', error);
      res.status(500).json({ error: 'Failed to fetch user warnings' });
    }
  });

  // Issue a warning (placeholder - not implemented yet)
  router.post('/warnings', async (req, res) => {
    try {
      const guildId = req.headers['x-guild-id'];
      if (!guildId) {
        return res.status(400).json({ error: 'Guild ID required' });
      }

      // Return success for now
      const warning = { id: Date.now(), ...req.body };
      res.json({ success: true, warning });
    } catch (error) {
      console.error('Error creating warning:', error);
      res.status(500).json({ error: 'Failed to create warning' });
    }
  });

  // Get welcome configuration
  router.get('/welcome/config', async (req, res) => {
    try {
      const guildId = req.headers['x-guild-id'];
      if (!guildId) {
        return res.status(400).json({ error: 'Guild ID required' });
      }

      const config = await store.getGuildWelcome(guildId);
      res.json(config);
    } catch (error) {
      console.error('Error fetching welcome config:', error);
      res.status(500).json({ error: 'Failed to fetch welcome config' });
    }
  });

  // Update welcome configuration
  router.put('/welcome/config', async (req, res) => {
    try {
      const guildId = req.headers['x-guild-id'];
      if (!guildId) {
        return res.status(400).json({ error: 'Guild ID required' });
      }

      await store.setGuildWelcome(guildId, req.body);
      const config = await store.getGuildWelcome(guildId);
      res.json({ success: true, config });
    } catch (error) {
      console.error('Error updating welcome config:', error);
      res.status(500).json({ error: 'Failed to update welcome config' });
    }
  });

  // Get reaction roles
  router.get('/roles/reaction', async (req, res) => {
    try {
      const guildId = req.headers['x-guild-id'];
      if (!guildId) {
        return res.status(400).json({ error: 'Guild ID required' });
      }

      const reactionRoles = await store.getGuildReactionRoles(guildId);
      res.json({ reactionRoles });
    } catch (error) {
      console.error('Error fetching reaction roles:', error);
      res.status(500).json({ error: 'Failed to fetch reaction roles' });
    }
  });

  // Create reaction role (placeholder)
  router.post('/roles/reaction', async (req, res) => {
    try {
      const guildId = req.headers['x-guild-id'];
      if (!guildId) {
        return res.status(400).json({ error: 'Guild ID required' });
      }

      // For now, just return success - this would need a proper implementation
      const reactionRole = { id: Date.now(), guildId, ...req.body };
      res.json({ success: true, reactionRole });
    } catch (error) {
      console.error('Error creating reaction role:', error);
      res.status(500).json({ error: 'Failed to create reaction role' });
    }
  });

  // Get XP settings
  router.get('/xp/config', async (req, res) => {
    try {
      const guildId = req.headers['x-guild-id'];
      if (!guildId) {
        return res.status(400).json({ error: 'Guild ID required' });
      }

      const config = await store.getGuildXpSettings(guildId);
      res.json(config);
    } catch (error) {
      console.error('Error fetching XP config:', error);
      res.status(500).json({ error: 'Failed to fetch XP config' });
    }
  });

  // Update XP settings
  router.put('/xp/config', async (req, res) => {
    try {
      const guildId = req.headers['x-guild-id'];
      if (!guildId) {
        return res.status(400).json({ error: 'Guild ID required' });
      }

      const config = await store.updateGuildXpSettings(guildId, req.body);
      res.json({ success: true, config });
    } catch (error) {
      console.error('Error updating XP config:', error);
      res.status(500).json({ error: 'Failed to update XP config' });
    }
  });

  // Get XP leaderboard (placeholder)
  router.get('/xp/leaderboard', async (req, res) => {
    try {
      const guildId = req.headers['x-guild-id'];
      const limit = parseInt(req.query.limit) || 10;
      const offset = parseInt(req.query.offset) || 0;
      
      if (!guildId) {
        return res.status(400).json({ error: 'Guild ID required' });
      }

      // Return empty leaderboard for now
      const leaderboard = [];
      res.json({ leaderboard });
    } catch (error) {
      console.error('Error fetching XP leaderboard:', error);
      res.status(500).json({ error: 'Failed to fetch XP leaderboard' });
    }
  });

  // Get scheduled messages
  router.get('/scheduler/messages', async (req, res) => {
    try {
      const guildId = req.headers['x-guild-id'];
      if (!guildId) {
        return res.status(400).json({ error: 'Guild ID required' });
      }

      const messages = await store.getGuildScheduledMessages(guildId);
      res.json({ messages });
    } catch (error) {
      console.error('Error fetching scheduled messages:', error);
      res.status(500).json({ error: 'Failed to fetch scheduled messages' });
    }
  });

  // Create scheduled message (placeholder)
  router.post('/scheduler/messages', async (req, res) => {
    try {
      const guildId = req.headers['x-guild-id'];
      if (!guildId) {
        return res.status(400).json({ error: 'Guild ID required' });
      }

      // For now, just return success - this would need a proper implementation
      const message = { id: Date.now(), guildId, ...req.body };
      res.json({ success: true, message });
    } catch (error) {
      console.error('Error creating scheduled message:', error);
      res.status(500).json({ error: 'Failed to create scheduled message' });
    }
  });

  // Get audit log settings (placeholder)
  router.get('/logging/config', async (req, res) => {
    try {
      const guildId = req.headers['x-guild-id'];
      if (!guildId) {
        return res.status(400).json({ error: 'Guild ID required' });
      }

      // Return default audit log config for now
      const config = {
        enabled: false,
        logChannelId: null,
        logMessages: false,
        logMembers: false,
        logChannels: false,
        logRoles: false,
        logModerationActions: false
      };
      res.json(config);
    } catch (error) {
      console.error('Error fetching audit log config:', error);
      res.status(500).json({ error: 'Failed to fetch audit log config' });
    }
  });

  // Update audit log settings (placeholder)
  router.put('/logging/config', async (req, res) => {
    try {
      const guildId = req.headers['x-guild-id'];
      if (!guildId) {
        return res.status(400).json({ error: 'Guild ID required' });
      }

      // For now, just return success
      res.json({ success: true, config: req.body });
    } catch (error) {
      console.error('Error updating audit log config:', error);
      res.status(500).json({ error: 'Failed to update audit log config' });
    }
  });

  // Get anti-raid settings
  router.get('/antiraid/config', async (req, res) => {
    try {
      const guildId = req.headers['x-guild-id'];
      if (!guildId) {
        return res.status(400).json({ error: 'Guild ID required' });
      }

      const config = await store.getGuildAntiRaidSettings(guildId);
      res.json(config);
    } catch (error) {
      console.error('Error fetching anti-raid config:', error);
      res.status(500).json({ error: 'Failed to fetch anti-raid config' });
    }
  });

  // Update anti-raid settings
  router.put('/antiraid/config', async (req, res) => {
    try {
      const guildId = req.headers['x-guild-id'];
      if (!guildId) {
        return res.status(400).json({ error: 'Guild ID required' });
      }

      const config = await store.updateGuildAntiRaidSettings(guildId, req.body);
      res.json({ success: true, config });
    } catch (error) {
      console.error('Error updating anti-raid config:', error);
      res.status(500).json({ error: 'Failed to update anti-raid config' });
    }
  });

  // PROFANITY MANAGEMENT ENDPOINTS

  // Get profanity words for a guild
  router.get('/profanity/words', async (req, res) => {
    try {
      const guildId = req.headers['x-guild-id'];
      if (!guildId) {
        return res.status(400).json({ error: 'Guild ID required' });
      }

      const words = await store.getGuildProfanityWords(guildId);
      res.json({ words });
    } catch (error) {
      console.error('Error fetching profanity words:', error);
      res.status(500).json({ error: 'Failed to fetch profanity words' });
    }
  });

  // Add profanity word
  router.post('/profanity/words', async (req, res) => {
    try {
      const guildId = req.headers['x-guild-id'];
      if (!guildId) {
        return res.status(400).json({ error: 'Guild ID required' });
      }

      const { word, severity, language, caseSensitive, wholeWordOnly, enabled } = req.body;
      
      if (!word || !word.trim()) {
        return res.status(400).json({ error: 'Word is required' });
      }

      const wordData = {
        word: word.trim().toLowerCase(),
        severity: severity || 'medium',
        language: language || 'en',
        caseSensitive: caseSensitive || false,
        wholeWordOnly: wholeWordOnly !== false,
        enabled: enabled !== false
      };

      const userId = req.user?.id || 'system';
      const words = await store.addGuildProfanityWord(guildId, wordData, userId);
      res.json({ success: true, words });
    } catch (error) {
      console.error('Error adding profanity word:', error);
      if (error.message.includes('already exists')) {
        return res.status(409).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to add profanity word' });
    }
  });

  // Update profanity word
  router.put('/profanity/words/:wordId', async (req, res) => {
    try {
      const guildId = req.headers['x-guild-id'];
      const { wordId } = req.params;
      
      if (!guildId) {
        return res.status(400).json({ error: 'Guild ID required' });
      }

      const userId = req.user?.id || 'system';
      const words = await store.updateGuildProfanityWord(guildId, wordId, req.body, userId);
      res.json({ success: true, words });
    } catch (error) {
      console.error('Error updating profanity word:', error);
      if (error.message.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to update profanity word' });
    }
  });

  // Delete profanity word
  router.delete('/profanity/words/:wordId', async (req, res) => {
    try {
      const guildId = req.headers['x-guild-id'];
      const { wordId } = req.params;
      
      if (!guildId) {
        return res.status(400).json({ error: 'Guild ID required' });
      }

      const words = await store.deleteGuildProfanityWord(guildId, wordId);
      res.json({ success: true, words });
    } catch (error) {
      console.error('Error deleting profanity word:', error);
      if (error.message.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to delete profanity word' });
    }
  });

  // Get profanity patterns for a guild
  router.get('/profanity/patterns', async (req, res) => {
    try {
      const guildId = req.headers['x-guild-id'];
      if (!guildId) {
        return res.status(400).json({ error: 'Guild ID required' });
      }

      const patterns = await store.getGuildProfanityPatterns(guildId);
      res.json({ patterns });
    } catch (error) {
      console.error('Error fetching profanity patterns:', error);
      res.status(500).json({ error: 'Failed to fetch profanity patterns' });
    }
  });

  // Add profanity pattern
  router.post('/profanity/patterns', async (req, res) => {
    try {
      const guildId = req.headers['x-guild-id'];
      if (!guildId) {
        return res.status(400).json({ error: 'Guild ID required' });
      }

      const { pattern, description, severity, flags, enabled } = req.body;
      
      if (!pattern || !pattern.trim()) {
        return res.status(400).json({ error: 'Pattern is required' });
      }

      // Test if the regex pattern is valid
      try {
        new RegExp(pattern, flags || 'gi');
      } catch (regexError) {
        return res.status(400).json({ error: 'Invalid regex pattern: ' + regexError.message });
      }

      const patternData = {
        pattern: pattern.trim(),
        description: description || '',
        severity: severity || 'medium',
        flags: flags || 'gi',
        enabled: enabled !== false
      };

      const userId = req.user?.id || 'system';
      const patterns = await store.addGuildProfanityPattern(guildId, patternData, userId);
      res.json({ success: true, patterns });
    } catch (error) {
      console.error('Error adding profanity pattern:', error);
      res.status(500).json({ error: 'Failed to add profanity pattern' });
    }
  });

  // Update profanity pattern
  router.put('/profanity/patterns/:patternId', async (req, res) => {
    try {
      const guildId = req.headers['x-guild-id'];
      const { patternId } = req.params;
      
      if (!guildId) {
        return res.status(400).json({ error: 'Guild ID required' });
      }

      // Validate regex if pattern is being updated
      if (req.body.pattern) {
        try {
          new RegExp(req.body.pattern, req.body.flags || 'gi');
        } catch (regexError) {
          return res.status(400).json({ error: 'Invalid regex pattern: ' + regexError.message });
        }
      }

      const patterns = await store.updateGuildProfanityPattern(guildId, patternId, req.body);
      res.json({ success: true, patterns });
    } catch (error) {
      console.error('Error updating profanity pattern:', error);
      if (error.message.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to update profanity pattern' });
    }
  });

  // Delete profanity pattern
  router.delete('/profanity/patterns/:patternId', async (req, res) => {
    try {
      const guildId = req.headers['x-guild-id'];
      const { patternId } = req.params;
      
      if (!guildId) {
        return res.status(400).json({ error: 'Guild ID required' });
      }

      const patterns = await store.deleteGuildProfanityPattern(guildId, patternId);
      res.json({ success: true, patterns });
    } catch (error) {
      console.error('Error deleting profanity pattern:', error);
      if (error.message.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to delete profanity pattern' });
    }
  });

  return router;
}

module.exports = createModerationRoutes;
