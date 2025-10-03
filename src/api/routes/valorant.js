const express = require('express');
const { PermissionsBitField } = require('discord.js');
const { audit } = require('../middleware/audit');

function createValorantRoutes(client, store) {
  const router = express.Router();

  // Get Valorant config
  router.get('/config', async (req, res) => {
    try {
      const guildId = req.query.guildId || (req.user.type === 'discord' ? 
        (await store.getUser(req.user.userId))?.selected_guild_id : null);
      
      if (!guildId) return res.status(400).json({ error: 'guild_required' });
      
      const cfg = await store.getGuildValorantConfig(guildId);
      res.json(cfg);
    } catch(e) { 
      console.error('Valorant config get error:', e);
      res.status(500).json({ error: 'load_failed' }); 
    }
  });

  // Update Valorant config
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
        playerRegions: req.body.playerRegions,
        enabled: typeof req.body.enabled === 'boolean' ? req.body.enabled : undefined,
        intervalSec: typeof req.body.intervalSec === 'number' ? Math.max(300, Math.min(86400, req.body.intervalSec)) : undefined,
        embedEnabled: typeof req.body.embedEnabled === 'boolean' ? req.body.embedEnabled : undefined,
        mentionTargets: Array.isArray(req.body.mentionTargets) ? req.body.mentionTargets : undefined,
        matchTemplate: typeof req.body.matchTemplate === 'string' ? req.body.matchTemplate : undefined,
        rankChangeTemplate: typeof req.body.rankChangeTemplate === 'string' ? req.body.rankChangeTemplate : undefined,
        achievementTemplate: typeof req.body.achievementTemplate === 'string' ? req.body.achievementTemplate : undefined,
        matchAnnounceChannelId: req.body.matchAnnounceChannelId || null,
        rankAnnounceChannelId: req.body.rankAnnounceChannelId || null,
        achievementAnnounceChannelId: req.body.achievementAnnounceChannelId || null,
        trackMatches: typeof req.body.trackMatches === 'boolean' ? req.body.trackMatches : undefined,
        trackRankChanges: typeof req.body.trackRankChanges === 'boolean' ? req.body.trackRankChanges : undefined,
        trackAchievements: typeof req.body.trackAchievements === 'boolean' ? req.body.trackAchievements : undefined,
        matchTypes: req.body.matchTypes,
        minKillsThreshold: typeof req.body.minKillsThreshold === 'number' ? Math.max(0, Math.min(100, req.body.minKillsThreshold)) : undefined
      };

      // Filter out undefined values
      Object.keys(partial).forEach(key => partial[key] === undefined && delete partial[key]);

      await store.updateGuildValorantConfig(guildId, partial);
      
      // Add audit log entry
      audit('valorant_config_updated', req.user.userId, req.user.type, guildId, {
        changes: Object.keys(partial)
      });
      
      const updated = await store.getGuildValorantConfig(guildId);
      res.json(updated);
    } catch(e) { 
      console.error('Valorant config update error:', e);
      res.status(500).json({ error: 'update_failed' }); 
    }
  });

  // Get account information from Valorant API
  router.get('/account/:name/:tag', async (req, res) => {
    try {
      const { name, tag } = req.params;
      
      if (!name || !tag) {
        return res.status(400).json({ error: 'invalid_riot_id' });
      }

      const apiKey = process.env.VALORANT_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'api_key_not_configured' });
      }

      // Make request to Henrik Dev Valorant API
      const response = await fetch(`https://api.henrikdev.xyz/valorant/v1/account/${name}/${tag}`, {
        headers: {
          'Authorization': apiKey,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          return res.status(404).json({ error: 'player_not_found' });
        } else if (response.status === 429) {
          return res.status(429).json({ error: 'rate_limited' });
        } else if (response.status === 403) {
          return res.status(403).json({ error: 'access_denied' });
        } else {
          return res.status(500).json({ error: 'api_error' });
        }
      }

      const data = await response.json();
      
      if (!data || data.status !== 200) {
        return res.status(404).json({ error: 'player_not_found' });
      }

      // Return simplified account info
      res.json({
        name: data.data.name,
        tag: data.data.tag,
        puuid: data.data.puuid,
        region: data.data.region,
        account_level: data.data.account_level,
        card: data.data.card
      });
    } catch (error) {
      console.error('Valorant account lookup error:', error);
      if (error.message.includes('fetch')) {
        return res.status(500).json({ error: 'network_error' });
      }
      res.status(500).json({ error: 'lookup_failed' });
    }
  });

  // Get MMR/Rank information
  router.get('/mmr/:region/:name/:tag', async (req, res) => {
    try {
      const { region, name, tag } = req.params;
      
      if (!name || !tag || !region) {
        return res.status(400).json({ error: 'invalid_parameters' });
      }

      const apiKey = process.env.VALORANT_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'api_key_not_configured' });
      }

      const response = await fetch(`https://api.henrikdev.xyz/valorant/v2/mmr/${region}/${name}/${tag}`, {
        headers: {
          'Authorization': apiKey,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          return res.status(404).json({ error: 'player_not_found' });
        } else if (response.status === 429) {
          return res.status(429).json({ error: 'rate_limited' });
        } else if (response.status === 403) {
          return res.status(403).json({ error: 'access_denied' });
        } else {
          return res.status(500).json({ error: 'api_error' });
        }
      }

      const data = await response.json();
      
      if (!data || data.status !== 200) {
        return res.status(404).json({ error: 'mmr_not_found' });
      }

      res.json(data.data);
    } catch (error) {
      console.error('Valorant MMR lookup error:', error);
      if (error.message.includes('fetch')) {
        return res.status(500).json({ error: 'network_error' });
      }
      res.status(500).json({ error: 'lookup_failed' });
    }
  });

  // Get match history
  router.get('/matches/:region/:name/:tag', async (req, res) => {
    try {
      const { region, name, tag } = req.params;
      const { mode, size } = req.query;
      
      if (!name || !tag || !region) {
        return res.status(400).json({ error: 'invalid_parameters' });
      }

      const apiKey = process.env.VALORANT_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'api_key_not_configured' });
      }

      let url = `https://api.henrikdev.xyz/valorant/v3/matches/${region}/${name}/${tag}`;
      const params = new URLSearchParams();
      if (mode) params.append('mode', mode);
      if (size) params.append('size', size);
      if (params.toString()) url += `?${params.toString()}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': apiKey,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          return res.status(404).json({ error: 'matches_not_found' });
        } else if (response.status === 429) {
          return res.status(429).json({ error: 'rate_limited' });
        } else if (response.status === 403) {
          return res.status(403).json({ error: 'access_denied' });
        } else {
          return res.status(500).json({ error: 'api_error' });
        }
      }

      const data = await response.json();
      
      if (!data || data.status !== 200) {
        return res.status(404).json({ error: 'matches_not_found' });
      }

      res.json(data.data);
    } catch (error) {
      console.error('Valorant matches lookup error:', error);
      if (error.message.includes('fetch')) {
        return res.status(500).json({ error: 'network_error' });
      }
      res.status(500).json({ error: 'lookup_failed' });
    }
  });

  return router;
}

module.exports = createValorantRoutes;
