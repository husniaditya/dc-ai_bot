const express = require('express');
const { PermissionsBitField } = require('discord.js');
const { audit } = require('../middleware/audit');

/**
 * Validates if a clan tag has the correct format
 * @param {string} tag - Clan tag to validate (with or without #)
 * @returns {boolean} Whether the tag is valid
 */
function isValidClanTag(tag) {
  if (!tag) return false;
  const cleanTag = tag.replace('#', '').trim();
  // Valid CoC clan tag characters: 0289PYLQGRJCUV, Length: 3-9 characters
  return /^[0289PYLQGRJCUV]{3,9}$/i.test(cleanTag);
}

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
        // Per-clan configurations (NEW)
        clanConfigs: req.body.clanConfigs,
        warAnnounceChannelId: req.body.warAnnounceChannelId,
        memberAnnounceChannelId: req.body.memberAnnounceChannelId,
        donationAnnounceChannelId: req.body.donationAnnounceChannelId,
        donationLeaderboardChannelId: req.body.donationLeaderboardChannelId,
        // War leaderboard fields (CRITICAL: these were missing!)
        warLeaderboardChannelId: req.body.warLeaderboardChannelId || req.body.war_leaderboard_channel_id,
        warPreparingMessageId: req.body.warPreparingMessageId || req.body.war_preparing_message_id,
        warActiveMessageId: req.body.warActiveMessageId || req.body.war_active_message_id,
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
        // War leaderboard tracking (also missing!)
        trackWarLeaderboard: req.body.trackWarLeaderboard || req.body.track_war_leaderboard,
        // CWL tracking
        trackCWL: req.body.trackCWL || req.body.track_cwl,
        // Events tracking
        trackEvents: req.body.trackEvents || req.body.track_events,
        eventsChannelId: req.body.eventsChannelId || req.body.events_channel_id,
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

      // Trigger immediate leaderboard posting after configuration save
      try {
        const LeaderboardEvents = require('../../bot/handlers/LeaderboardEvents');
        
        const guild = client.guilds.cache.get(guildId);
        if (guild) {
          const leaderboardEvents = new LeaderboardEvents(guild.client, store.sqlPool);
          
          // Get all clan configurations and create leaderboard messages for each clan
          if (cfg.clanConfigs && typeof cfg.clanConfigs === 'object') {
            // Process each clan individually
            for (const [clanTag, clanConfig] of Object.entries(cfg.clanConfigs)) {
              // Validate clan tag before processing
              if (!isValidClanTag(clanTag)) {
                console.warn(`[API] Skipping invalid clan tag "${clanTag}" during leaderboard creation`);
                continue;
              }

              try {
                // Create donation leaderboard message if tracking is enabled and channel is configured
                if (partial.trackDonationLeaderboard && clanConfig.donationAnnounceChannelId) {
                  const donationResult = await leaderboardEvents.postLeaderboard(
                    guild.id, 
                    clanConfig.donationAnnounceChannelId, 
                    clanConfig.donationMessageId || null,
                    'donations',
                    clanTag  // Pass clan tag to update specific clan row
                  );
                  
                  if (donationResult && donationResult.success) {
                    console.log(`[API] Created/updated donation leaderboard for clan ${clanTag} in guild ${guild.id}`);
                  } else {
                    console.error(`[API] Failed to create donation leaderboard for clan ${clanTag} in guild ${guild.id}:`, donationResult?.error);
                  }
                }
                
                // Create war leaderboard message if tracking is enabled and channel is configured
                if (partial.trackWarLeaderboard && clanConfig.warAnnounceChannelId) {
                  const warResult = await leaderboardEvents.postLeaderboard(
                    guild.id, 
                    clanConfig.warAnnounceChannelId, 
                    clanConfig.warPreparingMessageId || null,
                    'war',  // type parameter
                    clanTag  // clan tag parameter
                  );
                  
                  if (warResult && warResult.success) {
                    console.log(`[API] Created/updated war leaderboard for clan ${clanTag} in guild ${guild.id}`);
                  } else {
                    console.error(`[API] Failed to create war leaderboard for clan ${clanTag} in guild ${guild.id}:`, warResult?.error);
                  }
                }
                
                // Add delay between clans to avoid rate limits
                await new Promise(resolve => setTimeout(resolve, 500));
                
              } catch (clanError) {
                console.error(`[API] Error processing leaderboards for clan ${clanTag}:`, clanError.message);
              }
            }
            
            // Create guild-wide events message (once per guild, outside clan loop)
            // Events are global to CoC, not clan-specific
            if (partial.trackEvents && cfg.eventsChannelId) {
              try {
                const EventsTracker = require('../../utils/coc/EventsTracker');
                const { EmbedBuilder } = require('discord.js');
                
                // Get existing events message ID from primary clan (clan_order = 0)
                let eventsMessageId = null;
                try {
                  const [rows] = await store.sqlPool.execute(
                    'SELECT events_message_id FROM guild_clashofclans_watch WHERE guild_id = ? AND clan_order = 0 LIMIT 1',
                    [guild.id]
                  );
                  if (rows.length > 0) {
                    eventsMessageId = rows[0].events_message_id;
                  }
                } catch (dbErr) {
                  console.warn(`[API] Error fetching events_message_id for guild ${guild.id}:`, dbErr.message);
                }
                
                const eventsTracker = new EventsTracker();
                const eventStates = eventsTracker.getEventStates();
                const description = eventsTracker.generateEmbedDescription();
                
                const channel = await guild.channels.fetch(cfg.eventsChannelId).catch(() => null);
                if (channel) {
                  const embed = new EmbedBuilder()
                    .setColor('#FFA500')
                    .setTitle('🗓️ Clash of Clans Events')
                    .setDescription(description)
                    .setFooter({ text: `Guild-wide • Updates every 5 minutes` })
                    .setTimestamp();
                  
                  // Try to update existing message or create new one
                  if (eventsMessageId) {
                    const existingMessage = await channel.messages.fetch(eventsMessageId).catch(() => null);
                    if (existingMessage) {
                      await existingMessage.edit({ embeds: [embed] });
                      await store.sqlPool.execute(
                        'UPDATE guild_clashofclans_watch SET events_state_data = ?, events_last_update = NOW() WHERE guild_id = ? AND clan_order = 0',
                        [JSON.stringify(eventStates), guild.id]
                      );
                      console.log(`[API] Updated events message for guild ${guild.id}`);
                    } else {
                      // Message deleted, create new one
                      const newMessage = await channel.send({ embeds: [embed] });
                      await store.sqlPool.execute(
                        'UPDATE guild_clashofclans_watch SET events_message_id = ?, events_state_data = ?, events_last_update = NOW() WHERE guild_id = ? AND clan_order = 0',
                        [newMessage.id, JSON.stringify(eventStates), guild.id]
                      );
                      console.log(`[API] Created new events message for guild ${guild.id}`);
                    }
                  } else {
                    // No existing message, create new one
                    const newMessage = await channel.send({ embeds: [embed] });
                    await store.sqlPool.execute(
                      'UPDATE guild_clashofclans_watch SET events_message_id = ?, events_state_data = ?, events_last_update = NOW() WHERE guild_id = ? AND clan_order = 0',
                      [newMessage.id, JSON.stringify(eventStates), guild.id]
                    );
                    console.log(`[API] Created initial events message for guild ${guild.id}`);
                  }
                }
              } catch (eventsError) {
                console.error(`[API] Error creating events message for guild ${guild.id}:`, eventsError.message);
              }
            }
          } else {
            // Fallback: handle legacy single-clan configuration
            if (partial.trackDonationLeaderboard && cfg.donationLeaderboardChannelId) {
              const firstClanTag = cfg.clans && cfg.clans.length > 0 ? cfg.clans[0] : null;
              
              // Validate clan tag before processing
              if (firstClanTag && isValidClanTag(firstClanTag)) {
                const donationResult = await leaderboardEvents.postLeaderboard(
                  guild.id, 
                  cfg.donationLeaderboardChannelId, 
                  cfg.donationMessageId || null,
                  'donations',
                  firstClanTag
                );
                
                if (donationResult && donationResult.success) {
                  console.log(`[API] Created/updated donation leaderboard (legacy) for guild ${guild.id}`);
                } else {
                  console.error(`[API] Failed to create donation leaderboard (legacy) for guild ${guild.id}:`, donationResult?.error);
                }
              } else {
                console.warn(`[API] Skipping donation leaderboard - invalid clan tag: "${firstClanTag}"`);
              }
            }
            
            if (partial.trackWarLeaderboard && cfg.warLeaderboardChannelId) {
              const firstClanTag = cfg.clans && cfg.clans.length > 0 ? cfg.clans[0] : null;
              
              // Validate clan tag before processing
              if (firstClanTag && isValidClanTag(firstClanTag)) {
                const warResult = await leaderboardEvents.postLeaderboard(
                  guild.id, 
                  cfg.warLeaderboardChannelId, 
                  cfg.warPreparingMessageId || null,
                  'war',  // type parameter
                  firstClanTag  // clan tag parameter
                );
                
                if (warResult && warResult.success) {
                  console.log(`[API] Created/updated war leaderboard (legacy) for guild ${guild.id}`);
                } else {
                  console.error(`[API] Failed to create war leaderboard (legacy) for guild ${guild.id}:`, warResult?.error);
                }
              } else {
                console.warn(`[API] Skipping war leaderboard - invalid clan tag: "${firstClanTag}"`);
              }
            }
          }
        }
      } catch (error) {
        console.error(`[API] Error triggering leaderboard posting:`, error.message);
        // Don't fail the API request if leaderboard posting fails
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
