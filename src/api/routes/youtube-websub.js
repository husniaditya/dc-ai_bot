const express = require('express');
const crypto = require('crypto');

function createYouTubeWebSubRoutes(client, store) {
  const router = express.Router();
  
  // Import WebSub service
  const websubService = require('../../bot/services/youtube-websub');

  // Middleware to capture raw body for signature verification
  router.use('/websub', express.raw({ type: '*/*', limit: '10mb' }));

  // WebSub callback endpoint for each channel
  router.all('/websub/:channelId', async (req, res) => {
    const { channelId } = req.params;
    
    try {
      // Validate channel ID format
      if (!/^UC[a-zA-Z0-9_-]{22}$/.test(channelId)) {
        return res.status(400).send('Invalid channel ID format');
      }

      if (req.method === 'GET') {
        // Handle subscription verification
        websubService.handleVerification(req, res, channelId);
      } else if (req.method === 'POST') {
        // Handle content notification
        await websubService.handleNotification(req, res, channelId, client);
      } else {
        res.status(405).send('Method not allowed');
      }
    } catch (error) {
      console.error('WebSub callback error:', error);
      res.status(500).send('Internal server error');
    }
  });

  // Management endpoint to subscribe to a channel
  router.post('/subscribe', async (req, res) => {
    try {
      const guildId = req.query.guildId || (req.user.type === 'discord' ? 
        (await store.getUser(req.user.userId))?.selected_guild_id : null);
      
      if (!guildId) {
        return res.status(400).json({ error: 'guild_required' });
      }

      // Check permissions (same as regular YouTube config)
      if (req.user.type === 'discord') {
        try {
          const guild = client.guilds.cache.get(guildId);
          if (!guild) return res.status(400).json({ error: 'bot_not_in_guild' });
          
          const member = await guild.members.fetch(req.user.userId).catch(() => null);
          if (!member) return res.status(403).json({ error: 'not_in_guild' });
          
          const { PermissionsBitField } = require('discord.js');
          if (!member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return res.status(403).json({ error: 'insufficient_permissions' });
          }
        } catch { 
          return res.status(403).json({ error: 'permission_check_failed' }); 
        }
      }

      const { channelId } = req.body;
      if (!channelId || !/^UC[a-zA-Z0-9_-]{22}$/.test(channelId)) {
        return res.status(400).json({ error: 'invalid_channel_id' });
      }

      const result = await websubService.subscribeToChannel(channelId, guildId);
      res.json(result);

    } catch (error) {
      console.error('WebSub subscribe error:', error);
      res.status(500).json({ error: 'subscription_failed', message: error.message });
    }
  });

  // Management endpoint to unsubscribe from a channel
  router.post('/unsubscribe', async (req, res) => {
    try {
      const guildId = req.query.guildId || (req.user.type === 'discord' ? 
        (await store.getUser(req.user.userId))?.selected_guild_id : null);
      
      if (!guildId) {
        return res.status(400).json({ error: 'guild_required' });
      }

      // Check permissions
      if (req.user.type === 'discord') {
        try {
          const guild = client.guilds.cache.get(guildId);
          if (!guild) return res.status(400).json({ error: 'bot_not_in_guild' });
          
          const member = await guild.members.fetch(req.user.userId).catch(() => null);
          if (!member) return res.status(403).json({ error: 'not_in_guild' });
          
          const { PermissionsBitField } = require('discord.js');
          if (!member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return res.status(403).json({ error: 'insufficient_permissions' });
          }
        } catch { 
          return res.status(403).json({ error: 'permission_check_failed' }); 
        }
      }

      const { channelId } = req.body;
      if (!channelId || !/^UC[a-zA-Z0-9_-]{22}$/.test(channelId)) {
        return res.status(400).json({ error: 'invalid_channel_id' });
      }

      const result = await websubService.unsubscribeFromChannel(channelId, guildId);
      res.json(result);

    } catch (error) {
      console.error('WebSub unsubscribe error:', error);
      res.status(500).json({ error: 'unsubscription_failed', message: error.message });
    }
  });

  // Sync all subscriptions based on current guild configurations
  router.post('/sync', async (req, res) => {
    try {
      const guildId = req.query.guildId || (req.user.type === 'discord' ? 
        (await store.getUser(req.user.userId))?.selected_guild_id : null);
      
      // If guildId specified, only sync for that guild, otherwise sync all
      if (guildId && req.user.type === 'discord') {
        // Check permissions for specific guild sync
        const guild = client.guilds.cache.get(guildId);
        if (!guild) return res.status(400).json({ error: 'bot_not_in_guild' });
        
        const member = await guild.members.fetch(req.user.userId).catch(() => null);
        if (!member) return res.status(403).json({ error: 'not_in_guild' });
        
        const { PermissionsBitField } = require('discord.js');
        if (!member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
          return res.status(403).json({ error: 'insufficient_permissions' });
        }
      }

      await websubService.syncSubscriptions(client);
      res.json({ success: true, message: 'Subscriptions synchronized' });

    } catch (error) {
      console.error('WebSub sync error:', error);
      res.status(500).json({ error: 'sync_failed', message: error.message });
    }
  });

  // Get WebSub statistics and status
  router.get('/stats', async (req, res) => {
    try {
      const stats = websubService.getWebSubStats();
      const isEnabled = !!websubService.WEBSUB_CALLBACK_BASE && 
                       !websubService.WEBSUB_CALLBACK_BASE.includes('chocomaid.xyz');
      
      res.json({
        enabled: isEnabled,
        callbackBase: isEnabled ? websubService.WEBSUB_CALLBACK_BASE : 'Not configured',
        ...stats,
        subscriptionDetails: isEnabled ? Array.from(websubService.subscriptions.entries()).map(([channelId, sub]) => ({
          channelId,
          subscribers: sub.subscribers.size,
          subscribed: sub.subscribed,
          expiresAt: sub.expiresAt,
          lastAttempt: sub.lastAttempt
        })) : []
      });

    } catch (error) {
      console.error('WebSub stats error:', error);
      res.status(500).json({ error: 'stats_failed', message: error.message });
    }
  });

  // Force renewal of subscriptions
  router.post('/renew', async (req, res) => {
    try {
      // This would trigger renewal of subscriptions
      const websubService = require('../../bot/services/youtube-websub');
      await websubService.renewSubscriptions();
      res.json({ success: true, message: 'Subscription renewal triggered' });

    } catch (error) {
      console.error('WebSub renewal error:', error);
      res.status(500).json({ error: 'renewal_failed', message: error.message });
    }
  });

  return router;
}

module.exports = createYouTubeWebSubRoutes;
