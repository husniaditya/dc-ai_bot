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

  // IMPORTANT: More specific routes must come BEFORE general routes
  // Get war attack history for a specific war
  router.get('/war/:clanTag/attacks', async (req, res) => {
    try {
      const { clanTag } = req.params;
      const { warId } = req.query;

      if (!clanTag || !isValidClanTag(clanTag)) {
        return res.status(400).json({ error: 'invalid_clan_tag' });
      }

      const cleanTag = clanTag.trim().replace(/^#/, '').toUpperCase();
      const guildId = req.query.guildId || (req.user.type === 'discord' ? 
        (await store.getUser(req.user.userId))?.selected_guild_id : null);

      if (!guildId) {
        return res.status(400).json({ error: 'guild_required' });
      }

      // Build query
      let query = `
        SELECT war_id, player_tag, player_name, townhall_level, 
               map_position, attacks_used, opponent_attacks_received,
               attack_1_defender_tag, attack_1_stars, attack_1_destruction_percentage,
               attack_2_defender_tag, attack_2_stars, attack_2_destruction_percentage,
               total_stars_earned, average_destruction, war_result,
               war_start_time, war_end_time, war_state
        FROM war_performance 
        WHERE guild_id = ?
      `;
      const params = [guildId];

      if (warId) {
        query += ' AND war_id = ?';
        params.push(warId);
      } else {
        // Get latest war if no warId specified
        query += ' ORDER BY war_start_time DESC LIMIT 50';
      }

      const [attackRows] = await store.sqlPool.query(query, params);

      const attacks = attackRows.map(row => ({
        warId: row.war_id,
        playerTag: row.player_tag,
        playerName: row.player_name,
        townHallLevel: row.townhall_level,
        mapPosition: row.map_position,
        attacksUsed: row.attacks_used,
        opponentAttacksReceived: row.opponent_attacks_received,
        attacks: [
          row.attack_1_defender_tag ? {
            defenderTag: row.attack_1_defender_tag,
            stars: row.attack_1_stars,
            destructionPercentage: parseFloat(row.attack_1_destruction_percentage)
          } : null,
          row.attack_2_defender_tag ? {
            defenderTag: row.attack_2_defender_tag,
            stars: row.attack_2_stars,
            destructionPercentage: parseFloat(row.attack_2_destruction_percentage)
          } : null
        ].filter(a => a !== null),
        totalStars: row.total_stars_earned,
        avgDestruction: parseFloat(row.average_destruction),
        warResult: row.war_result,
        warStartTime: row.war_start_time,
        warEndTime: row.war_end_time,
        warState: row.war_state
      }));

      res.json({
        clanTag: `#${cleanTag}`,
        warId: warId || 'latest',
        attacks
      });
    } catch(e) {
      console.error('War attacks fetch error:', e);
      res.status(500).json({ error: 'fetch_failed' });
    }
  });

  // Get current war status for a clan
  router.get('/war/:clanTag', async (req, res) => {
    try {
      const { clanTag } = req.params;
      if (!clanTag || !isValidClanTag(clanTag)) {
        return res.status(400).json({ error: 'invalid_clan_tag' });
      }

      const cleanTag = clanTag.trim().replace(/^#/, '').toUpperCase();
      const guildId = req.query.guildId || (req.user.type === 'discord' ? 
        (await store.getUser(req.user.userId))?.selected_guild_id : null);

      if (!guildId) {
        return res.status(400).json({ error: 'guild_required' });
      }

      // Get war state from database
      const [warRows] = await store.sqlPool.query(`
        SELECT war_current_state, war_state_data, war_last_state_change,
               war_preparing_message_id, war_active_message_id
        FROM guild_clashofclans_watch 
        WHERE guild_id = ? AND clan_tag = ?
        LIMIT 1
      `, [guildId, cleanTag]);

      if (warRows.length === 0) {
        return res.status(404).json({ error: 'clan_not_configured' });
      }

      const warData = warRows[0];
      let warStateData = null;
      
      try {
        warStateData = warData.war_state_data ? JSON.parse(warData.war_state_data) : null;
      } catch (e) {
        console.warn('Failed to parse war state data:', e.message);
      }

      res.json({
        clanTag: `#${cleanTag}`,
        currentState: warData.war_current_state,
        lastStateChange: warData.war_last_state_change,
        warData: warStateData,
        messageIds: {
          preparing: warData.war_preparing_message_id,
          active: warData.war_active_message_id
        }
      });
    } catch(e) {
      console.error('War status error:', e);
      res.status(500).json({ error: 'fetch_failed' });
    }
  });

  // Get CWL (Clan War League) status for a clan
  router.get('/cwl/:clanTag', async (req, res) => {
    try {
      const { clanTag } = req.params;
      if (!clanTag || !isValidClanTag(clanTag)) {
        return res.status(400).json({ error: 'invalid_clan_tag' });
      }

      const cleanTag = clanTag.trim().replace(/^#/, '').toUpperCase();
      const guildId = req.query.guildId || (req.user.type === 'discord' ? 
        (await store.getUser(req.user.userId))?.selected_guild_id : null);

      if (!guildId) {
        return res.status(400).json({ error: 'guild_required' });
      }

      // Get CWL tracking status from database
      const [cwlRows] = await store.sqlPool.query(`
        SELECT track_cwl, cwl_state_data, cwl_last_update, 
               cwl_finalized_rounds, cwl_last_reminder_time
        FROM guild_clashofclans_watch 
        WHERE guild_id = ? AND clan_tag = ?
        LIMIT 1
      `, [guildId, cleanTag]);

      if (cwlRows.length === 0) {
        return res.status(404).json({ error: 'clan_not_configured' });
      }

      const cwlData = cwlRows[0];
      let cwlStateData = null;

      try {
        cwlStateData = cwlData.cwl_state_data ? JSON.parse(cwlData.cwl_state_data) : null;
      } catch (e) {
        console.warn('Failed to parse CWL state data:', e.message);
      }

      // Get CWL player performance data
      const [performanceRows] = await store.sqlPool.query(`
        SELECT player_tag, player_name, total_wars_participated,
               total_stars_earned, total_destruction, average_stars_per_attack
        FROM cwl_player_performance 
        WHERE guild_id = ? AND clan_tag = ?
        ORDER BY total_stars_earned DESC
        LIMIT 50
      `, [guildId, cleanTag]);

      res.json({
        clanTag: `#${cleanTag}`,
        trackingEnabled: !!cwlData.track_cwl,
        lastUpdate: cwlData.cwl_last_update,
        finalizedRounds: cwlData.cwl_finalized_rounds || 0,
        lastReminderTime: cwlData.cwl_last_reminder_time,
        cwlData: cwlStateData,
        playerPerformance: performanceRows.map(row => ({
          playerTag: row.player_tag,
          playerName: row.player_name,
          warsParticipated: row.total_wars_participated,
          starsEarned: row.total_stars_earned,
          destruction: parseFloat(row.total_destruction),
          avgStars: parseFloat(row.average_stars_per_attack)
        }))
      });
    } catch(e) {
      console.error('CWL status error:', e);
      res.status(500).json({ error: 'fetch_failed' });
    }
  });

  // Get donation leaderboard for a clan
  router.get('/leaderboard/donations/:clanTag', async (req, res) => {
    try {
      const { clanTag } = req.params;
      if (!clanTag || !isValidClanTag(clanTag)) {
        return res.status(400).json({ error: 'invalid_clan_tag' });
      }

      const cleanTag = clanTag.trim().replace(/^#/, '').toUpperCase();
      const guildId = req.query.guildId || (req.user.type === 'discord' ? 
        (await store.getUser(req.user.userId))?.selected_guild_id : null);

      if (!guildId) {
        return res.status(400).json({ error: 'guild_required' });
      }

      // Get donation leaderboard configuration
      const [configRows] = await store.sqlPool.query(`
        SELECT track_donation_leaderboard, donation_leaderboard_channel_id,
               donation_message_id, donation_threshold, 
               donation_leaderboard_schedule, donation_leaderboard_time,
               donation_leaderboard_template
        FROM guild_clashofclans_watch 
        WHERE guild_id = ? AND clan_tag = ?
        LIMIT 1
      `, [guildId, cleanTag]);

      if (configRows.length === 0) {
        return res.status(404).json({ error: 'clan_not_configured' });
      }

      const config = configRows[0];

      // Try to fetch live data from Clash of Clans API
      let leaderboardData = [];
      try {
        const apiKey = process.env.COC_API_TOKEN;
        if (apiKey) {
          const response = await fetch(`https://api.clashofclans.com/v1/clans/%23${cleanTag}/members`, {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Accept': 'application/json'
            }
          });

          if (response.ok) {
            const data = await response.json();
            leaderboardData = data.items
              .filter(member => member.donations >= (config.donation_threshold || 0))
              .map(member => ({
                playerTag: member.tag,
                playerName: member.name,
                donations: member.donations,
                donationsReceived: member.donationsReceived,
                townHallLevel: member.townHallLevel,
                role: member.role
              }))
              .sort((a, b) => b.donations - a.donations)
              .slice(0, 50);
          }
        }
      } catch (e) {
        console.warn('Failed to fetch donation data from CoC API:', e.message);
      }

      res.json({
        clanTag: `#${cleanTag}`,
        trackingEnabled: !!config.track_donation_leaderboard,
        channelId: config.donation_leaderboard_channel_id,
        messageId: config.donation_message_id,
        threshold: config.donation_threshold,
        schedule: config.donation_leaderboard_schedule,
        scheduledTime: config.donation_leaderboard_time,
        template: config.donation_leaderboard_template,
        leaderboard: leaderboardData
      });
    } catch(e) {
      console.error('Donation leaderboard error:', e);
      res.status(500).json({ error: 'fetch_failed' });
    }
  });

  // Get war performance leaderboard for a clan
  router.get('/leaderboard/war/:clanTag', async (req, res) => {
    try {
      const { clanTag } = req.params;
      if (!clanTag || !isValidClanTag(clanTag)) {
        return res.status(400).json({ error: 'invalid_clan_tag' });
      }

      const cleanTag = clanTag.trim().replace(/^#/, '').toUpperCase();
      const guildId = req.query.guildId || (req.user.type === 'discord' ? 
        (await store.getUser(req.user.userId))?.selected_guild_id : null);

      if (!guildId) {
        return res.status(400).json({ error: 'guild_required' });
      }

      // Get war leaderboard configuration
      const [configRows] = await store.sqlPool.query(`
        SELECT track_war_leaderboard, war_leaderboard_channel_id,
               war_preparing_message_id, war_active_message_id
        FROM guild_clashofclans_watch 
        WHERE guild_id = ? AND clan_tag = ?
        LIMIT 1
      `, [guildId, cleanTag]);

      if (configRows.length === 0) {
        return res.status(404).json({ error: 'clan_not_configured' });
      }

      const config = configRows[0];

      // Get war performance statistics from database
      const [statsRows] = await store.sqlPool.query(`
        SELECT player_tag, player_name, total_wars_participated, 
               total_wars_won, total_wars_lost, total_wars_tied,
               total_attacks_made, total_stars_earned, 
               win_rate, average_stars_per_attack, 
               average_destruction_per_attack, last_war_date
        FROM war_statistics_summary 
        WHERE guild_id = ?
        ORDER BY total_stars_earned DESC, win_rate DESC
        LIMIT 50
      `, [guildId]);

      res.json({
        clanTag: `#${cleanTag}`,
        trackingEnabled: !!config.track_war_leaderboard,
        channelId: config.war_leaderboard_channel_id,
        messageIds: {
          preparing: config.war_preparing_message_id,
          active: config.war_active_message_id
        },
        leaderboard: statsRows.map(row => ({
          playerTag: row.player_tag,
          playerName: row.player_name,
          warsParticipated: row.total_wars_participated,
          warsWon: row.total_wars_won,
          warsLost: row.total_wars_lost,
          warsTied: row.total_wars_tied,
          attacksMade: row.total_attacks_made,
          starsEarned: row.total_stars_earned,
          winRate: parseFloat(row.win_rate),
          avgStars: parseFloat(row.average_stars_per_attack),
          avgDestruction: parseFloat(row.average_destruction_per_attack),
          lastWarDate: row.last_war_date
        }))
      });
    } catch(e) {
      console.error('War leaderboard error:', e);
      res.status(500).json({ error: 'fetch_failed' });
    }
  });

  // Get active Clash of Clans events
  router.get('/events', async (req, res) => {
    try {
      const guildId = req.query.guildId || (req.user.type === 'discord' ? 
        (await store.getUser(req.user.userId))?.selected_guild_id : null);

      if (!guildId) {
        return res.status(400).json({ error: 'guild_required' });
      }

      // Get events tracking configuration
      const [configRows] = await store.sqlPool.query(`
        SELECT track_events, events_channel_id, events_message_id,
               events_state_data, events_last_update
        FROM guild_clashofclans_watch 
        WHERE guild_id = ? AND clan_order = 0
        LIMIT 1
      `, [guildId]);

      if (configRows.length === 0) {
        return res.status(404).json({ error: 'events_not_configured' });
      }

      const config = configRows[0];
      let eventsData = null;

      try {
        eventsData = config.events_state_data ? JSON.parse(config.events_state_data) : null;
      } catch (e) {
        console.warn('Failed to parse events state data:', e.message);
      }

      res.json({
        trackingEnabled: !!config.track_events,
        channelId: config.events_channel_id,
        messageId: config.events_message_id,
        lastUpdate: config.events_last_update,
        events: eventsData
      });
    } catch(e) {
      console.error('Events fetch error:', e);
      res.status(500).json({ error: 'fetch_failed' });
    }
  });

  // Get clan members with their stats
  router.get('/members/:clanTag', async (req, res) => {
    try {
      const { clanTag } = req.params;
      if (!clanTag || !isValidClanTag(clanTag)) {
        return res.status(400).json({ error: 'invalid_clan_tag' });
      }

      const cleanTag = clanTag.trim().replace(/^#/, '').toUpperCase();

      // Fetch live data from Clash of Clans API
      try {
        const apiKey = process.env.COC_API_TOKEN;
        if (!apiKey) {
          return res.status(503).json({ error: 'api_token_missing' });
        }

        const response = await fetch(`https://api.clashofclans.com/v1/clans/%23${cleanTag}/members`, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Accept': 'application/json'
          }
        });

        if (response.status === 404) {
          return res.status(404).json({ error: 'clan_not_found' });
        }

        if (!response.ok) {
          return res.status(response.status).json({ error: 'api_request_failed' });
        }

        const data = await response.json();
        
        const members = data.items.map(member => ({
          playerTag: member.tag,
          playerName: member.name,
          role: member.role,
          expLevel: member.expLevel,
          league: member.league,
          trophies: member.trophies,
          versusTrophies: member.versusTrophies,
          clanRank: member.clanRank,
          previousClanRank: member.previousClanRank,
          donations: member.donations,
          donationsReceived: member.donationsReceived,
          townHallLevel: member.townHallLevel,
          builderHallLevel: member.builderHallLevel
        }));

        res.json({
          clanTag: `#${cleanTag}`,
          memberCount: data.items.length,
          members
        });
      } catch (e) {
        console.error('Failed to fetch members from CoC API:', e.message);
        res.status(500).json({ error: 'api_fetch_failed' });
      }
    } catch(e) {
      console.error('Members fetch error:', e);
      res.status(500).json({ error: 'fetch_failed' });
    }
  });

  return router;
}

module.exports = createClashOfClansRoutes;
