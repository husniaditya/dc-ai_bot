const express = require('express');
const { PermissionsBitField } = require('discord.js');
const { audit } = require('../middleware/audit');

function createGenshinRoutes(client, store) {
  const router = express.Router();

  // Get Genshin Impact config
  router.get('/config', async (req, res) => {
    try {
      const guildId = req.query.guildId || (req.user.type === 'discord' ? 
        (await store.getUser(req.user.userId))?.selected_guild_id : null);
      
      if (!guildId) return res.status(400).json({ error: 'guild_required' });
      
      const cfg = await store.getGuildGenshinConfig(guildId);
      res.json(cfg);
    } catch(e) { 
      console.error('Genshin config get error:', e);
      res.status(500).json({ error: 'load_failed' }); 
    }
  });

  // Update Genshin Impact config
  router.put('/config', async (req, res) => {
    try {
      const guildId = req.query.guildId || (req.user.type === 'discord' ? 
        (await store.getUser(req.user.userId))?.selected_guild_id : null);
      
      if (!guildId) return res.status(400).json({ error: 'guild_required' });

      // Permissions: require Manage Guild if discord user
      if (req.user.type === 'discord') {
        try {
          const guild = client.guilds.cache.get(guildId);
          if (!guild) return res.status(400).json({ error: 'bot_not_in_guild' });
          
          const member = await guild.members.fetch(req.user.userId).catch(() => null);
          if (!member) return res.status(403).json({ error: 'not_in_guild' });
          
          if (!member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return res.status(403).json({ error: 'insufficient_permissions' });
          }
        } catch { 
          return res.status(403).json({ error: 'permission_check_failed' }); 
        }
      }

      const partial = {
        players: Array.isArray(req.body.players) ? req.body.players : undefined,
        playerNames: req.body.playerNames,
        playerMessages: req.body.playerMessages,
        enabled: typeof req.body.enabled === 'boolean' ? req.body.enabled : undefined,
        intervalSec: typeof req.body.intervalSec === 'number' ? Math.max(300, Math.min(86400, req.body.intervalSec)) : undefined,
        embedEnabled: typeof req.body.embedEnabled === 'boolean' ? req.body.embedEnabled : undefined,
        mentionTargets: Array.isArray(req.body.mentionTargets) ? req.body.mentionTargets : undefined,
        profileUpdateTemplate: typeof req.body.profileUpdateTemplate === 'string' ? req.body.profileUpdateTemplate : undefined,
        achievementTemplate: typeof req.body.achievementTemplate === 'string' ? req.body.achievementTemplate : undefined,
        spiralAbyssTemplate: typeof req.body.spiralAbyssTemplate === 'string' ? req.body.spiralAbyssTemplate : undefined,
        profileAnnounceChannelId: req.body.profileAnnounceChannelId || null,
        achievementAnnounceChannelId: req.body.achievementAnnounceChannelId || null,
        spiralAbyssAnnounceChannelId: req.body.spiralAbyssAnnounceChannelId || null,
        trackProfileUpdates: typeof req.body.trackProfileUpdates === 'boolean' ? req.body.trackProfileUpdates : undefined,
        trackAchievements: typeof req.body.trackAchievements === 'boolean' ? req.body.trackAchievements : undefined,
        trackSpiralAbyss: typeof req.body.trackSpiralAbyss === 'boolean' ? req.body.trackSpiralAbyss : undefined,
        minAchievementThreshold: typeof req.body.minAchievementThreshold === 'number' ? Math.max(1, Math.min(100, req.body.minAchievementThreshold)) : undefined
      };

      // Filter out undefined values
      Object.keys(partial).forEach(key => partial[key] === undefined && delete partial[key]);

      await store.updateGuildGenshinConfig(guildId, partial);
      
      // Add audit log entry
      audit('genshin_config_updated', req.user.userId, req.user.type, guildId, {
        changes: Object.keys(partial)
      });
      
      const updated = await store.getGuildGenshinConfig(guildId);
      res.json(updated);
    } catch(e) { 
      console.error('Genshin config update error:', e);
      res.status(500).json({ error: 'update_failed' }); 
    }
  });

  // Resolve player information from Enka.Network
  router.post('/resolve-player', async (req, res) => {
    try {
      const { uid } = req.body;
      
      if (!uid || !/^[1-9]\d{8}$/.test(uid)) {
        return res.status(400).json({ error: 'invalid_uid' });
      }

      // Make request to Enka.Network API
      const response = await fetch(`https://enka.network/api/uid/${uid}`, {
        headers: {
          'User-Agent': 'Discord Bot - Genshin Impact Integration'
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          return res.status(404).json({ error: 'player_not_found' });
        } else if (response.status === 424) {
          return res.status(424).json({ error: 'player_data_refreshing' });
        } else if (response.status === 429) {
          return res.status(429).json({ error: 'rate_limited' });
        } else {
          return res.status(500).json({ error: 'api_error' });
        }
      }

      const playerData = await response.json();
      
      if (!playerData.playerInfo) {
        return res.status(404).json({ error: 'no_player_info' });
      }

      // Return simplified player info
      res.json({
        uid: uid,
        playerInfo: {
          nickname: playerData.playerInfo.nickname || null,
          level: playerData.playerInfo.level || 0,
          worldLevel: playerData.playerInfo.worldLevel || 0,
          signature: playerData.playerInfo.signature || null,
          finishAchievementNum: playerData.playerInfo.finishAchievementNum || 0,
          towerFloorIndex: playerData.playerInfo.towerFloorIndex || 0,
          towerLevelIndex: playerData.playerInfo.towerLevelIndex || 0,
          profilePicture: playerData.playerInfo.profilePicture || null
        },
        characterCount: playerData.avatarInfoList ? playerData.avatarInfoList.length : 0
      });
    } catch (error) {
      console.error('Genshin resolve player error:', error);
      if (error.message.includes('fetch')) {
        return res.status(500).json({ error: 'network_error' });
      }
      res.status(500).json({ error: 'resolve_failed' });
    }
  });

  // Get player detailed information for debugging/testing
  router.get('/player/:uid', async (req, res) => {
    try {
      const { uid } = req.params;
      
      if (!uid || !/^[1-9]\d{8}$/.test(uid)) {
        return res.status(400).json({ error: 'invalid_uid' });
      }

      // Make request to Enka.Network API
      const response = await fetch(`https://enka.network/api/uid/${uid}`, {
        headers: {
          'User-Agent': 'Discord Bot - Genshin Impact Integration'
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          return res.status(404).json({ error: 'player_not_found' });
        } else if (response.status === 424) {
          return res.status(424).json({ error: 'player_data_refreshing' });
        } else if (response.status === 429) {
          return res.status(429).json({ error: 'rate_limited' });
        } else {
          return res.status(500).json({ error: 'api_error' });
        }
      }

      const playerData = await response.json();
      res.json(playerData);
    } catch (error) {
      console.error('Genshin get player error:', error);
      if (error.message.includes('fetch')) {
        return res.status(500).json({ error: 'network_error' });
      }
      res.status(500).json({ error: 'fetch_failed' });
    }
  });

  return router;
}

module.exports = createGenshinRoutes;