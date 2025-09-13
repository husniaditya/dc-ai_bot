const express = require('express');
const { PermissionsBitField } = require('discord.js');
const { audit } = require('../middleware/audit');

function createClashOfClansRoutes(client, store) {
  const router = express.Router();

  // Get Clash of Clans config
  router.get('/config', async (req, res) => {
    try {
      const guildId = req.query.guildId || (req.user.type === 'discord' ? 
        (await store.getUser(req.user.userId))?.selected_guild_id : null);
      
      if (!guildId) return res.status(400).json({ error: 'guild_required' });
      
      const cfg = await store.getGuildClashOfClansConfig(guildId);
      res.json(cfg);
    } catch(e) { 
      console.error('Clash of Clans config get error:', e);
      res.status(500).json({ error: 'load_failed' }); 
    }
  });

  // Update Clash of Clans config
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
        clans: Array.isArray(req.body.clans) ? req.body.clans : undefined,
        clanNames: req.body.clanNames,
        clanName: req.body.clanName,
        warAnnounceChannelId: req.body.warAnnounceChannelId,
        memberAnnounceChannelId: req.body.memberAnnounceChannelId,
        donationAnnounceChannelId: req.body.donationAnnounceChannelId,
        donationLeaderboardChannelId: req.body.donationLeaderboardChannelId,
        // Global mention targets (primary)
        mentionTargets: Array.isArray(req.body.mentionTargets) ? req.body.mentionTargets : undefined,
        // Individual mention targets (for compatibility)
        warMentionTarget: req.body.warMentionTarget,
        memberMentionTarget: req.body.memberMentionTarget,
        donationMentionTarget: req.body.donationMentionTarget,
        // Legacy support for old field names
        warChannelId: req.body.warChannelId || req.body.warAnnounceChannelId,
        memberChannelId: req.body.memberChannelId || req.body.memberAnnounceChannelId,
        donationChannelId: req.body.donationChannelId || req.body.donationAnnounceChannelId,
        enabled: req.body.enabled,
        intervalSec: req.body.intervalSec,
        trackWars: req.body.trackWars,
        trackMembers: req.body.trackMembers,
        trackDonations: req.body.trackDonations,
        trackDonationLeaderboard: req.body.trackDonationLeaderboard,
        // Map frontend tracking fields to backend
        trackWarEvents: req.body.trackWarEvents,
        trackMemberEvents: req.body.trackMemberEvents,
        trackDonationEvents: req.body.trackDonationEvents,
        donationThreshold: req.body.donationThreshold,
        minDonationThreshold: req.body.minDonationThreshold, // Map frontend field name
        donationLeaderboardSchedule: req.body.donationLeaderboardSchedule,
        donationLeaderboardTime: req.body.donationLeaderboardTime,
        donationLeaderboardTemplate: req.body.donationLeaderboardTemplate,
        warStartTemplate: req.body.warStartTemplate,
        warEndTemplate: req.body.warEndTemplate,
        memberJoinTemplate: req.body.memberJoinTemplate,
        donationTemplate: req.body.donationTemplate,
        embedEnabled: req.body.embedEnabled
      };

      const cfg = await store.setGuildClashOfClansConfig(guildId, partial);
      
      audit(req, { action: 'update-clashofclans-config', guildId });

      // Trigger immediate leaderboard posting whenever donation leaderboard is enabled
      // Note: Watcher also handles automatic scheduled updates based on donationLeaderboardSchedule
      if (partial.trackDonationLeaderboard) {
        try {
          // Use the new LeaderboardEvents system (moved to handlers directory)
          const LeaderboardEvents = require('../../bot/handlers/LeaderboardEvents');
          
          const guild = client.guilds.cache.get(guildId);
          if (guild) {
            const leaderboardEvents = new LeaderboardEvents(guild.client, store.sqlPool);
            
            // Get existing message ID for updating
            const existingMessageId = cfg.donationMessageId || null;
            
            // Post/update leaderboard using new system
            const result = await leaderboardEvents.postLeaderboard(
              guild.id, 
              cfg.donationLeaderboardChannelId, 
              existingMessageId
            );
            
            if (result && result.success) {
              console.log(`[API] Updated leaderboard using new canvas system for guild ${guild.id}`);
            } else {
              console.error(`[API] Failed to update leaderboard for guild ${guild.id}:`, result?.error);
            }
          }
        } catch (error) {
          console.error(`[API] Error triggering leaderboard posting:`, error.message);
          // Don't fail the API request if leaderboard posting fails
        }
      }

      // Re-fetch to ensure values reflect DB authoritative columns
      const fresh = await store.getGuildClashOfClansConfig(guildId);
      res.json(fresh);
    } catch(e) { 
      console.error('Clash of Clans config update error:', e);
      res.status(500).json({ error: 'persist_failed' }); 
    }
  });

  // Get clan information by tag
  router.get('/clan/:clanTag', async (req, res) => {
    try {
      const { clanTag } = req.params;
      if (!clanTag) {
        return res.status(400).json({ error: 'clan_tag_required' });
      }

      const cleanTag = clanTag.trim().replace(/^#/, '').toUpperCase();
      
      // Validate clan tag format (Clash of Clans specific character set)
      if (!cleanTag || !/^[0289PYLQGRJCUV]{3,9}$/.test(cleanTag)) {
        return res.status(400).json({ error: 'invalid_clan_tag' });
      }
      
      try {
        const apiKey = process.env.COC_API_TOKEN;
        
        if (!apiKey) {
          return res.json({ 
            tag: `#${cleanTag}`,
            name: `Clan #${cleanTag}`,
            source: 'fallback',
            reason: 'missing_api_token'
          });
        }
        
        const response = await fetch(`https://api.clashofclans.com/v1/clans/%23${cleanTag}`, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Accept': 'application/json'
          }
        });
        
        if (response.ok) {
          const clanData = await response.json();
          return res.json({ 
            tag: `#${cleanTag}`,
            name: clanData.name,
            level: clanData.clanLevel,
            memberCount: clanData.members,
            badgeUrls: clanData.badgeUrls,
            source: 'api' 
          });
        } else if (response.status === 404) {
          return res.status(404).json({ error: 'clan_not_found' });
        } else {
          // Continue to fallback
        }
      } catch(e) {
        // Continue to fallback
      }
      
      // Fallback if API fails
      res.json({ 
        tag: `#${cleanTag}`,
        name: `Clan #${cleanTag}`,
        source: 'fallback'
      });
    } catch(e) { 
      console.error('Clan fetch error:', e);
      res.status(500).json({ error: 'fetch_failed' }); 
    }
  });

  // Validate Clash of Clans clan tag
  router.post('/validate-clan', async (req, res) => {
    try {
      const { clanTag } = req.body || {};
      if (!clanTag || typeof clanTag !== 'string') {
        return res.status(400).json({ error: 'clan_tag_required' });
      }

      const cleanTag = clanTag.trim().replace(/^#/, '').toUpperCase();
      
      // Validate clan tag format (Clash of Clans clan tags: 3-9 chars, specific character set)
      if (!cleanTag || !/^[0289PYLQGRJCUV]{3,9}$/.test(cleanTag)) {
        return res.status(400).json({ error: 'invalid_clan_tag' });
      }
      
      // Try to get clan info from Clash of Clans API
      let clanName = null;
      let clanLevel = null;
      let memberCount = null;
      
      try {
        const apiKey = process.env.COC_API_TOKEN;
        
        if (apiKey) {
          const response = await fetch(`https://api.clashofclans.com/v1/clans/%23${cleanTag}`, {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Accept': 'application/json'
            }
          });
          
          if (response.ok) {
            const clanData = await response.json();
            clanName = clanData.name;
            clanLevel = clanData.clanLevel;
            memberCount = clanData.members;
          } else if (response.status === 404) {
            return res.status(404).json({ error: 'clan_not_found' });
          }
        }
      } catch(e) {
        console.warn('Clash of Clans API lookup failed:', e.message);
        // Continue with cleaned tag if API fails
      }
      
      res.json({ 
        clanTag: `#${cleanTag}`,
        clanName,
        clanLevel,
        memberCount,
        source: 'api' 
      });
    } catch(e) { 
      console.error('Clan validation error:', e);
      res.status(500).json({ error: 'validation_failed' }); 
    }
  });

  return router;
}

module.exports = createClashOfClansRoutes;
