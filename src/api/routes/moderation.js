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

  // Update welcome configuration (PUT)
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

  // Update welcome configuration (POST - for compatibility)
  router.post('/welcome/config', async (req, res) => {
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

  // Get XP leaderboard
  router.get('/xp/leaderboard', async (req, res) => {
    try {
      const guildId = req.headers['x-guild-id'];
      const limit = parseInt(req.query.limit) || 10;
      const offset = parseInt(req.query.offset) || 0;
      
      if (!guildId) {
        return res.status(400).json({ error: 'Guild ID required' });
      }

      const leaderboard = await store.getGuildLeaderboard(guildId, limit, offset);
      res.json({ leaderboard });
    } catch (error) {
      console.error('Error fetching XP leaderboard:', error);
      res.status(500).json({ error: 'Failed to fetch XP leaderboard' });
    }
  });

  // Get user XP
  router.get('/xp/user/:userId', async (req, res) => {
    try {
      const guildId = req.headers['x-guild-id'];
      const { userId } = req.params;
      
      if (!guildId || !userId) {
        return res.status(400).json({ error: 'Guild ID and User ID required' });
      }

      const userXp = await store.getUserXp(guildId, userId);
      res.json(userXp);
    } catch (error) {
      console.error('Error fetching user XP:', error);
      res.status(500).json({ error: 'Failed to fetch user XP' });
    }
  });

  // Add XP to user (admin only)
  router.post('/xp/user/:userId/add', async (req, res) => {
    try {
      const guildId = req.headers['x-guild-id'];
      const { userId } = req.params;
      const { amount, source = 'manual' } = req.body;
      
      if (!guildId || !userId || typeof amount !== 'number') {
        return res.status(400).json({ error: 'Guild ID, User ID, and amount required' });
      }

      if (amount <= 0 || amount > 10000) {
        return res.status(400).json({ error: 'Amount must be between 1 and 10000' });
      }

      const result = await store.addUserXp(guildId, userId, amount, source);
      res.json(result);
    } catch (error) {
      console.error('Error adding user XP:', error);
      res.status(500).json({ error: 'Failed to add user XP' });
    }
  });

  // Reset user XP (admin only)
  router.delete('/xp/user/:userId', async (req, res) => {
    try {
      const guildId = req.headers['x-guild-id'];
      const { userId } = req.params;
      
      if (!guildId || !userId) {
        return res.status(400).json({ error: 'Guild ID and User ID required' });
      }

      await store.resetUserXp(guildId, userId);
      res.json({ success: true, message: 'User XP reset successfully' });
    } catch (error) {
      console.error('Error resetting user XP:', error);
      res.status(500).json({ error: 'Failed to reset user XP' });
    }
  });

  // Get level rewards
  router.get('/xp/rewards', async (req, res) => {
    try {
      const guildId = req.headers['x-guild-id'];
      
      if (!guildId) {
        return res.status(400).json({ error: 'Guild ID required' });
      }

      const rewards = await store.getGuildLevelRewards(guildId);
      res.json({ rewards });
    } catch (error) {
      console.error('Error fetching level rewards:', error);
      res.status(500).json({ error: 'Failed to fetch level rewards' });
    }
  });

  // Add level reward
  router.post('/xp/rewards', async (req, res) => {
    try {
      const guildId = req.headers['x-guild-id'];
      const { level, roleId, removePrevious = false } = req.body;
      
      if (!guildId || !level || !roleId) {
        return res.status(400).json({ error: 'Guild ID, level, and role ID required' });
      }

      if (level < 1 || level > 1000) {
        return res.status(400).json({ error: 'Level must be between 1 and 1000' });
      }

      const result = await store.addGuildLevelReward(guildId, level, roleId, removePrevious);
      res.json({ success: true, id: result });
    } catch (error) {
      console.error('Error adding level reward:', error);
      res.status(500).json({ error: 'Failed to add level reward' });
    }
  });

  // Remove level reward
  router.delete('/xp/rewards/:level', async (req, res) => {
    try {
      const guildId = req.headers['x-guild-id'];
      const { level } = req.params;
      
      if (!guildId || !level) {
        return res.status(400).json({ error: 'Guild ID and level required' });
      }

      await store.removeGuildLevelReward(guildId, parseInt(level));
      res.json({ success: true, message: 'Level reward removed successfully' });
    } catch (error) {
      console.error('Error removing level reward:', error);
      res.status(500).json({ error: 'Failed to remove level reward' });
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

  // Get scheduler configuration (for compatibility with other features)
  router.get('/scheduler/config', async (req, res) => {
    try {
      const guildId = req.headers['x-guild-id'];
      if (!guildId) {
        return res.status(400).json({ error: 'Guild ID required' });
      }

      const messages = await store.getGuildScheduledMessages(guildId);
      res.json({ messages });
    } catch (error) {
      console.error('Error fetching scheduler config:', error);
      res.status(500).json({ error: 'Failed to fetch scheduler config' });
    }
  });

  // Update scheduler configuration (for compatibility with moderation features)
  router.put('/scheduler/config', async (req, res) => {
    try {
      const guildId = req.headers['x-guild-id'];
      if (!guildId) {
        return res.status(400).json({ error: 'Guild ID required' });
      }

      // If messages array is provided, we need to handle CRUD operations
      if (req.body.messages) {
        const existingMessages = await store.getGuildScheduledMessages(guildId);
        const newMessages = req.body.messages;

        // Process updates, creates, and deletes
        for (const message of newMessages) {
          if (message.id && !isNaN(parseInt(message.id))) {
            // Update existing message
            const messageData = {
              title: message.title,
              channelId: message.channelId,
              messageContent: message.message || message.messageContent,
              scheduleValue: message.cronExpression || message.scheduleValue,
              enabled: message.enabled
            };
            await store.updateGuildScheduledMessage(guildId, message.id, messageData);
          } else {
            // Create new message
            const messageData = {
              title: message.title,
              channelId: message.channelId,
              messageContent: message.message || message.messageContent,
              scheduleValue: message.cronExpression || message.scheduleValue,
              scheduleType: 'cron',
              enabled: message.enabled !== false
            };
            await store.createGuildScheduledMessage(guildId, messageData);
          }
        }

        // Delete messages that are no longer in the array
        const newMessageIds = newMessages.filter(m => m.id && !isNaN(parseInt(m.id))).map(m => parseInt(m.id));
        for (const existingMessage of existingMessages) {
          if (!newMessageIds.includes(existingMessage.id)) {
            await store.deleteGuildScheduledMessage(guildId, existingMessage.id);
          }
        }
      }

      // Return updated messages
      const messages = await store.getGuildScheduledMessages(guildId);
      res.json({ success: true, messages });
    } catch (error) {
      console.error('Error updating scheduler config:', error);
      res.status(500).json({ error: 'Failed to update scheduler config' });
    }
  });

  // Create scheduled message
  router.post('/scheduler/messages', async (req, res) => {
    try {
      const guildId = req.headers['x-guild-id'];
      if (!guildId) {
        return res.status(400).json({ error: 'Guild ID required' });
      }

      const { title, channelId, message, scheduleType, scheduleValue, embedData } = req.body;
      
      if (!title || !channelId || !message || !scheduleValue) {
        return res.status(400).json({ error: 'Missing required fields: title, channelId, message, scheduleValue' });
      }

      const messageData = {
        title,
        channelId,
        messageContent: message,
        scheduleType: scheduleType || 'cron',
        scheduleValue,
        embedData: embedData || null
      };

      const createdMessage = await store.createGuildScheduledMessage(guildId, messageData, req.user?.id || 'system');
      res.json({ success: true, message: createdMessage });
    } catch (error) {
      console.error('Error creating scheduled message:', error);
      res.status(500).json({ error: 'Failed to create scheduled message' });
    }
  });

  // Update scheduled message
  router.put('/scheduler/messages/:messageId', async (req, res) => {
    try {
      const guildId = req.headers['x-guild-id'];
      const { messageId } = req.params;
      
      if (!guildId) {
        return res.status(400).json({ error: 'Guild ID required' });
      }

      const messageData = {};
      if (req.body.title !== undefined) messageData.title = req.body.title;
      if (req.body.channelId !== undefined) messageData.channelId = req.body.channelId;
      if (req.body.message !== undefined) messageData.messageContent = req.body.message;
      if (req.body.scheduleType !== undefined) messageData.scheduleType = req.body.scheduleType;
      if (req.body.scheduleValue !== undefined) messageData.scheduleValue = req.body.scheduleValue;
      if (req.body.embedData !== undefined) messageData.embedData = req.body.embedData;

      const updatedMessage = await store.updateGuildScheduledMessage(guildId, messageId, messageData);
      res.json({ success: true, message: updatedMessage });
    } catch (error) {
      console.error('Error updating scheduled message:', error);
      if (error.message.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to update scheduled message' });
    }
  });

  // Delete scheduled message
  router.delete('/scheduler/messages/:messageId', async (req, res) => {
    try {
      const guildId = req.headers['x-guild-id'];
      const { messageId } = req.params;
      
      if (!guildId) {
        return res.status(400).json({ error: 'Guild ID required' });
      }

      await store.deleteGuildScheduledMessage(guildId, messageId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting scheduled message:', error);
      if (error.message.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to delete scheduled message' });
    }
  });

  // Get audit log settings (both endpoints for compatibility)
  router.get('/logging/config', async (req, res) => {
    try {
      const guildId = req.headers['x-guild-id'];
      if (!guildId) {
        return res.status(400).json({ error: 'Guild ID required' });
      }

      const config = await store.getGuildAuditLogConfig(guildId);
      res.json(config);
    } catch (error) {
      console.error('Error fetching audit log config:', error);
      res.status(500).json({ error: 'Failed to fetch audit log config' });
    }
  });

  // Get audit log configuration (alternative endpoint)
  router.get('/audit-logs/config', async (req, res) => {
    try {
      const guildId = req.headers['x-guild-id'];
      if (!guildId) {
        return res.status(400).json({ error: 'Guild ID required' });
      }

      const config = await store.getGuildAuditLogConfig(guildId);
      res.json(config);
    } catch (error) {
      console.error('Error fetching audit log config:', error);
      res.status(500).json({ error: 'Failed to fetch audit log config' });
    }
  });

  // Update audit log settings (both endpoints for compatibility)
  router.put('/logging/config', async (req, res) => {
    try {
      const guildId = req.headers['x-guild-id'];
      if (!guildId) {
        return res.status(400).json({ error: 'Guild ID required' });
      }

      const config = await store.updateGuildAuditLogConfig(guildId, req.body);
      res.json({ success: true, config });
    } catch (error) {
      console.error('Error updating audit log config:', error);
      res.status(500).json({ error: 'Failed to update audit log config' });
    }
  });

  // Update audit log configuration (alternative endpoint)
  router.put('/audit-logs/config', async (req, res) => {
    try {
      const guildId = req.headers['x-guild-id'];
      if (!guildId) {
        return res.status(400).json({ error: 'Guild ID required' });
      }

      const config = await store.updateGuildAuditLogConfig(guildId, req.body);
      res.json({ success: true, config });
    } catch (error) {
      console.error('Error updating audit log config:', error);
      res.status(500).json({ error: 'Failed to update audit log config' });
    }
  });

  // Get audit logs with pagination and filtering
  router.get('/logging/logs', async (req, res) => {
    try {
      const guildId = req.headers['x-guild-id'];
      if (!guildId) {
        return res.status(400).json({ error: 'Guild ID required' });
      }

      const options = {
        actionType: req.query.actionType || null,
        userId: req.query.userId || null,
        channelId: req.query.channelId || null,
        limit: parseInt(req.query.limit) || 50,
        offset: parseInt(req.query.offset) || 0,
        orderBy: req.query.orderBy || 'created_at DESC'
      };

      const result = await store.getGuildAuditLogs(guildId, options);
      res.json(result);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
  });

  // Create audit log entry
  router.post('/logging/logs', async (req, res) => {
    try {
      const guildId = req.headers['x-guild-id'];
      if (!guildId) {
        return res.status(400).json({ error: 'Guild ID required' });
      }

      const logId = await store.createAuditLogEntry(guildId, req.body);
      res.json({ success: true, logId });
    } catch (error) {
      console.error('Error creating audit log entry:', error);
      res.status(500).json({ error: 'Failed to create audit log entry' });
    }
  });

  // Delete audit log entry
  router.delete('/logging/logs/:logId', async (req, res) => {
    try {
      const guildId = req.headers['x-guild-id'];
      if (!guildId) {
        return res.status(400).json({ error: 'Guild ID required' });
      }

      const success = await store.deleteAuditLogEntry(guildId, req.params.logId);
      if (success) {
        res.json({ success: true });
      } else {
        res.status(404).json({ error: 'Audit log entry not found' });
      }
    } catch (error) {
      console.error('Error deleting audit log entry:', error);
      res.status(500).json({ error: 'Failed to delete audit log entry' });
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
