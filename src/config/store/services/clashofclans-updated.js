// Updated Clash of Clans service - handles multiple clans as separate rows
const db = require('../database/connection');
const cache = require('../cache/manager');
const { defaultConfigs } = require('../models/defaults');

/**
 * Formats a JavaScript Date object for MySQL datetime storage
 * @param {Date} date - Date to format
 * @returns {string} MySQL-compatible datetime string
 */
function formatDateForMySQL(date = new Date()) {
    return date.toISOString().slice(0, 19).replace('T', ' ');
}

/**
 * Validates if a clan tag has the correct format
 * Valid CoC clan tags: 3-9 characters, only specific characters allowed
 * @param {string} tag - Clan tag to validate (with or without #)
 * @returns {boolean} Whether the tag is valid
 */
function isValidClanTag(tag) {
    if (!tag) return false;
    const cleanTag = tag.replace('#', '').trim();
    // Valid CoC clan tag characters: 0289PYLQGRJCUV
    // Length: 3-9 characters
    return /^[0289PYLQGRJCUV]{3,9}$/i.test(cleanTag);
}

async function getGuildClashOfClansConfig(guildId) {
  if (!guildId) return { ...defaultConfigs.guildClashOfClansConfig };
  
  const cacheData = cache.getCache();
  if (cacheData.guildClashOfClansConfigCache && cacheData.guildClashOfClansConfigCache.has(guildId)) {
    return { ...cacheData.guildClashOfClansConfigCache.get(guildId) };
  }
  
  // Initialize cache if not exists
  if (!cacheData.guildClashOfClansConfigCache) {
    cacheData.guildClashOfClansConfigCache = new Map();
  }
  
  if (db.mariaAvailable && db.sqlPool) {
    try {
      // Get all clan configurations for this guild
      const [rows] = await db.sqlPool.query(`
        SELECT clan_tag, clan_name, clan_order,
               war_announce_channel_id, member_announce_channel_id, donation_announce_channel_id,
               donation_leaderboard_channel_id, war_leaderboard_channel_id, 
               donation_message_id, war_preparing_message_id, war_active_message_id, 
               war_mention_target, member_mention_target, donation_mention_target, 
               enabled, interval_sec, track_wars, track_members, track_donations, track_donation_leaderboard, track_cwl,
               donation_threshold, donation_leaderboard_schedule, donation_leaderboard_time, 
               war_start_template, war_end_template, member_join_template, donation_template, 
               donation_leaderboard_template, embed_enabled, clan_data,
               war_current_state, war_preparing_message_id, war_active_message_id, 
               war_last_state_change, war_state_data
        FROM guild_clashofclans_watch 
        WHERE guild_id = ?
        ORDER BY clan_order ASC, id ASC
      `, [guildId]);
      
      if (rows.length > 0) {
        // Filter out rows with invalid clan tags
        const validRows = rows.filter(row => {
          const isValid = isValidClanTag(row.clan_tag);
          if (!isValid) {
            console.warn(`[Config] Skipping invalid clan tag in database: "${row.clan_tag}" for guild ${guildId}`);
          }
          return isValid;
        });

        if (validRows.length === 0) {
          console.warn(`[Config] No valid clan tags found for guild ${guildId}`);
          const cfg = { ...defaultConfigs.guildClashOfClansConfig };
          cacheData.guildClashOfClansConfigCache.set(guildId, cfg);
          return cfg;
        }

        // Build configuration from multiple clan rows
        const firstRow = validRows[0];
        const clans = validRows.map(row => ({
          tag: row.clan_tag,
          name: row.clan_name || '',
          order: row.clan_order || 0,
          warMentionTarget: row.war_mention_target || '',
          memberMentionTarget: row.member_mention_target || '',
          donationMentionTarget: row.donation_mention_target || '',
          // Per-clan announcement channels
          warAnnounceChannelId: row.war_announce_channel_id,
          memberAnnouncementChannelId: row.member_announce_channel_id,
          donationAnnounceChannelId: row.donation_announce_channel_id
        }));
        
        // Extract clan names mapping
        const clanNames = {};
        validRows.forEach(row => {
          if (row.clan_tag && row.clan_name) {
            clanNames[row.clan_tag] = row.clan_name;
          }
        });
        
        // Build per-clan configurations for frontend
        const clanConfigs = {};
        validRows.forEach(row => {
          if (row.clan_tag) {
            clanConfigs[row.clan_tag] = {
              warMentionTargets: row.war_mention_target ? row.war_mention_target.split(',').filter(Boolean) : [],
              memberMentionTargets: row.member_mention_target ? row.member_mention_target.split(',').filter(Boolean) : [],
              donationMentionTargets: row.donation_mention_target ? row.donation_mention_target.split(',').filter(Boolean) : [],
              warAnnounceChannelId: row.war_announce_channel_id,
              memberAnnouncementChannelId: row.member_announce_channel_id,
              donationAnnounceChannelId: row.donation_announce_channel_id,
              // Preserve per-clan message ids so we don't overwrite them on save
              warPreparingMessageId: row.war_preparing_message_id || null,
              warActiveMessageId: row.war_active_message_id || null,
              donationMessageId: row.donation_message_id || null,
              // Per-clan donation leaderboard settings
              donationLeaderboardChannelId: row.donation_leaderboard_channel_id || null,
              warLeaderboardChannelId: row.war_leaderboard_channel_id || null,
              trackDonationLeaderboard: !!row.track_donation_leaderboard,
              donationLeaderboardSchedule: row.donation_leaderboard_schedule || 'hourly',
              donationLeaderboardTime: row.donation_leaderboard_time || '20:00',
              // War state management fields
              warCurrentState: row.war_current_state || 'notInWar',
              warPreparingMessageId: row.war_preparing_message_id || null,
              warActiveMessageId: row.war_active_message_id || null,
              warLastStateChange: row.war_last_state_change || null,
              warStateData: (() => {
                if (!row.war_state_data) return null;
                
                // Ensure war_state_data is a string before checking for corruption
                const warStateDataStr = typeof row.war_state_data === 'string' ? row.war_state_data : String(row.war_state_data);
                
                // Check for the specific "[object Object]" corruption
                if (warStateDataStr === '[object Object]' || warStateDataStr.includes('[object Object]')) {
                  console.warn(`[Config] Detected corrupted "[object Object]" in war_state_data for clan ${row.clan_tag}, cleaning up...`);
                  
                  // Clean up the corrupted data in the database
                  // Use a safer approach that doesn't rely on matching the exact corrupted data
                  if (db.mariaAvailable && db.sqlPool) {
                    db.sqlPool.query(`
                      UPDATE guild_clashofclans_watch 
                      SET war_state_data = NULL 
                      WHERE clan_tag = ?
                    `, [row.clan_tag]).catch(err => {
                      console.error(`[Config] Error cleaning up corrupted war_state_data for clan ${row.clan_tag}:`, err.message);
                    });
                  }
                  
                  return null;
                }
                
                try {
                  // Handle case where war_state_data might already be an object
                  if (typeof row.war_state_data === 'object') {
                    return row.war_state_data;
                  }
                  
                  return JSON.parse(warStateDataStr);
                } catch (e) {
                  console.warn(`[Config] Invalid JSON in war_state_data for clan ${row.clan_tag}: "${warStateDataStr}" - ${e.message}`);
                  
                  // Clean up any invalid JSON in the database
                  // Use a safer approach that doesn't rely on matching the exact corrupted data
                  if (db.mariaAvailable && db.sqlPool) {
                    db.sqlPool.query(`
                      UPDATE guild_clashofclans_watch 
                      SET war_state_data = NULL 
                      WHERE clan_tag = ?
                    `, [row.clan_tag]).catch(err => {
                      console.error(`[Config] Error cleaning up invalid war_state_data for clan ${row.clan_tag}:`, err.message);
                    });
                  }
                  
                  return null;
                }
              })()
            };
          }
        });
        
        // Load CWL channel configurations from guild_clashofclans_cwl_state table
        if (clans.length > 0 && firstRow.track_cwl) {
          try {
            const [cwlRows] = await db.sqlPool.query(`
              SELECT clan_tag, cwl_announce_channel_id, cwl_leaderboard_channel_id
              FROM guild_clashofclans_cwl_state
              WHERE guild_id = ?
              ORDER BY created_at DESC
            `, [guildId]);
            
            // Merge CWL channel data into clanConfigs
            cwlRows.forEach(cwlRow => {
              if (clanConfigs[cwlRow.clan_tag]) {
                clanConfigs[cwlRow.clan_tag].cwlAnnounceChannelId = cwlRow.cwl_announce_channel_id;
                clanConfigs[cwlRow.clan_tag].cwlLeaderboardChannelId = cwlRow.cwl_leaderboard_channel_id;
              }
            });
          } catch (cwlError) {
            console.warn('[CWL] Error loading CWL channel config:', cwlError.message);
          }
        }
        
        const config = {
          // Guild information
          guildId: guildId, // Add the guild ID to the config
          
          // Clan information
          clans: clans.map(clan => clan.tag),
          clashofclans_clans: clans.map(clan => clan.tag).join(','), // For backward compatibility
          clanTag: clans[0]?.tag || '', // Primary clan for backward compatibility
          clanName: clans[0]?.name || '', // Primary clan name
          clanNames,
          clanConfigs, // Per-clan configurations
          
          // Global channel settings (from first clan for backward compatibility)
          warAnnounceChannelId: clans[0]?.warAnnounceChannelId || null,
          memberAnnounceChannelId: clans[0]?.memberAnnouncementChannelId || null,
          donationAnnounceChannelId: clans[0]?.donationAnnounceChannelId || null,
          donationLeaderboardChannelId: firstRow.donation_leaderboard_channel_id,
          warLeaderboardChannelId: firstRow.war_leaderboard_channel_id,
          donationMessageId: firstRow.donation_message_id,
          warPreparingMessageId: firstRow.war_preparing_message_id,
          warActiveMessageId: firstRow.war_active_message_id,
          
          // Global mention targets (from first row, for backward compatibility)
          warMentionTarget: firstRow.war_mention_target || null,
          memberMentionTarget: firstRow.member_mention_target || null,
          donationMentionTarget: firstRow.donation_mention_target || null,
          mentionTargets: firstRow.war_mention_target ? firstRow.war_mention_target.split(',').filter(Boolean) : [],
          
          // Global settings
          enabled: !!firstRow.enabled,
          intervalSec: firstRow.interval_sec || 3600,
          trackWars: !!firstRow.track_wars,
          trackMembers: !!firstRow.track_members,
          trackDonations: !!firstRow.track_donations,
          trackDonationLeaderboard: !!firstRow.track_donation_leaderboard,
          trackCWL: !!firstRow.track_cwl,
          track_cwl: !!firstRow.track_cwl,
          trackWarLeaderboard: !!firstRow.war_leaderboard_channel_id || (!!firstRow.track_wars && !!firstRow.war_announce_channel_id),
          trackWarEvents: !!firstRow.track_wars,
          trackMemberEvents: !!firstRow.track_members,
          trackDonationEvents: !!firstRow.track_donations,
          donationThreshold: firstRow.donation_threshold || 100,
          minDonationThreshold: firstRow.donation_threshold || 100,
          donationLeaderboardSchedule: firstRow.donation_leaderboard_schedule || 'hourly',
          donationLeaderboardTime: firstRow.donation_leaderboard_time || '20:00',
          
          // Templates
          warStartTemplate: firstRow.war_start_template || defaultConfigs.guildClashOfClansConfig.warStartTemplate,
          warEndTemplate: firstRow.war_end_template || defaultConfigs.guildClashOfClansConfig.warEndTemplate,
          memberJoinTemplate: firstRow.member_join_template || defaultConfigs.guildClashOfClansConfig.memberJoinTemplate,
          donationTemplate: firstRow.donation_template || defaultConfigs.guildClashOfClansConfig.donationTemplate,
          donationLeaderboardTemplate: firstRow.donation_leaderboard_template || '',
          embedEnabled: !!firstRow.embed_enabled,
          
          // Extended data
          clanData: (() => {
            if (!firstRow.clan_data) return {};
            try {
              return JSON.parse(firstRow.clan_data);
            } catch (e) {
              console.warn(`[Config] Invalid JSON in clan_data for guild ${guildId}:`, e.message);
              return {};
            }
          })()
        };
        
        cacheData.guildClashOfClansConfigCache.set(guildId, config);
        return { ...config };
      }
    } catch (e) {
      console.error('Error loading guild Clash of Clans config:', e.message);
    }
  }
  
  return { ...defaultConfigs.guildClashOfClansConfig };
}

async function setGuildClashOfClansConfig(guildId, partial) {
  if (!guildId) throw new Error('guildId required');
  
  const current = await getGuildClashOfClansConfig(guildId);
  const next = { ...current };
  
  // Handle clan configurations
  if (partial.clans !== undefined && Array.isArray(partial.clans)) {
    next.clans = partial.clans;
    next.clashofclans_clans = partial.clans.join(',');
    if (partial.clans.length > 0) {
      next.clanTag = partial.clans[0];
    }
  }
  
  if (partial.clanConfigs !== undefined) {
    next.clanConfigs = partial.clanConfigs;
    // Extract clans array from clanConfigs if it's an object
    if (typeof partial.clanConfigs === 'object' && !Array.isArray(partial.clanConfigs)) {
      next.clans = Object.keys(partial.clanConfigs);
      next.clashofclans_clans = next.clans.join(',');
    }
  }
  
  // Handle other fields...
  if (partial.clanNames !== undefined) next.clanNames = partial.clanNames;
  if (partial.clanName !== undefined) next.clanName = partial.clanName;
  
  // Handle global channel settings
  if (partial.warAnnounceChannelId !== undefined) next.warAnnounceChannelId = partial.warAnnounceChannelId;
  if (partial.memberAnnounceChannelId !== undefined) next.memberAnnounceChannelId = partial.memberAnnounceChannelId;
  if (partial.donationAnnounceChannelId !== undefined) next.donationAnnounceChannelId = partial.donationAnnounceChannelId;
  if (partial.donationLeaderboardChannelId !== undefined) next.donationLeaderboardChannelId = partial.donationLeaderboardChannelId;
  if (partial.warLeaderboardChannelId !== undefined) next.warLeaderboardChannelId = partial.warLeaderboardChannelId;
  // Legacy warLeaderboardMessageId removed - use state-specific fields
  if (partial.donationMessageId !== undefined) next.donationMessageId = partial.donationMessageId;
  if (partial.donation_message_id !== undefined) next.donationMessageId = partial.donation_message_id;
  if (partial.war_preparing_message_id !== undefined) next.warPreparingMessageId = partial.war_preparing_message_id;
  if (partial.war_active_message_id !== undefined) next.warActiveMessageId = partial.war_active_message_id;
  
  // Handle mention targets
  if (partial.mentionTargets !== undefined) {
    const mentionTargetsString = Array.isArray(partial.mentionTargets) ? partial.mentionTargets.join(',') : '';
    next.mentionTargets = partial.mentionTargets;
    next.warMentionTarget = mentionTargetsString;
    next.memberMentionTarget = mentionTargetsString;
    next.donationMentionTarget = mentionTargetsString;
  }
  
  // Handle global settings
  if (partial.enabled !== undefined) next.enabled = partial.enabled;
  if (partial.intervalSec !== undefined) next.intervalSec = partial.intervalSec;
  if (partial.donationThreshold !== undefined) {
    next.donationThreshold = partial.donationThreshold;
    next.minDonationThreshold = partial.donationThreshold;
  }
  if (partial.minDonationThreshold !== undefined) {
    next.donationThreshold = partial.minDonationThreshold;
    next.minDonationThreshold = partial.minDonationThreshold;
  }
  
  // Handle tracking settings
  if (partial.trackDonationLeaderboard !== undefined) next.trackDonationLeaderboard = partial.trackDonationLeaderboard;
  if (partial.trackCWL !== undefined) next.trackCWL = partial.trackCWL;
  if (partial.track_cwl !== undefined) next.trackCWL = partial.track_cwl;
  if (partial.donationLeaderboardSchedule !== undefined) next.donationLeaderboardSchedule = partial.donationLeaderboardSchedule;
  if (partial.donationLeaderboardTime !== undefined) next.donationLeaderboardTime = partial.donationLeaderboardTime;
  if (partial.donationLeaderboardTemplate !== undefined) next.donationLeaderboardTemplate = partial.donationLeaderboardTemplate;
  
  // Handle all tracking field variations
  if (partial.trackWarEvents !== undefined) {
    next.trackWars = partial.trackWarEvents;
    next.trackWarEvents = partial.trackWarEvents;
  }
  if (partial.trackWars !== undefined) {
    next.trackWars = partial.trackWars;
    next.trackWarEvents = partial.trackWars;
  }
  
  if (partial.trackMemberEvents !== undefined) {
    next.trackMembers = partial.trackMemberEvents;
    next.trackMemberEvents = partial.trackMemberEvents;
  }
  if (partial.trackMembers !== undefined) {
    next.trackMembers = partial.trackMembers;
    next.trackMemberEvents = partial.trackMembers;
  }
  
  if (partial.trackDonationEvents !== undefined) {
    next.trackDonations = partial.trackDonationEvents;
    next.trackDonationEvents = partial.trackDonationEvents;
  }
  if (partial.trackDonations !== undefined) {
    next.trackDonations = partial.trackDonations;
    next.trackDonationEvents = partial.trackDonations;
  }
  
  // Handle war leaderboard tracking - maps to track_wars column since war leaderboards depend on war tracking
  if (partial.trackWarLeaderboard !== undefined) {
    next.trackWars = partial.trackWarLeaderboard;
  }
  if (partial.track_war_leaderboard !== undefined) {
    next.trackWars = partial.track_war_leaderboard;
  }
  
  // Handle templates
  if (partial.warStartTemplate !== undefined) next.warStartTemplate = partial.warStartTemplate;
  if (partial.warEndTemplate !== undefined) next.warEndTemplate = partial.warEndTemplate;
  if (partial.memberJoinTemplate !== undefined) next.memberJoinTemplate = partial.memberJoinTemplate;
  if (partial.donationTemplate !== undefined) next.donationTemplate = partial.donationTemplate;
  if (partial.donationLeaderboardTemplate !== undefined) next.donationLeaderboardTemplate = partial.donationLeaderboardTemplate;
  if (partial.embedEnabled !== undefined) next.embedEnabled = partial.embedEnabled;
  if (partial.clanData !== undefined) next.clanData = partial.clanData;
  
  // Clear cache
  const cacheData = cache.getCache();
  if (!cacheData.guildClashOfClansConfigCache) {
    cacheData.guildClashOfClansConfigCache = new Map();
  }
  cacheData.guildClashOfClansConfigCache.set(guildId, next);
  
  if (db.mariaAvailable && db.sqlPool) {
    // Delete existing records for this guild
    await db.sqlPool.query('DELETE FROM guild_clashofclans_watch WHERE guild_id = ?', [guildId]);
    
    // If no clans configured yet, just insert a basic record with guild settings
    const clansToSave = [];
    
    if (next.clanConfigs && typeof next.clanConfigs === 'object') {
      // Check if clanConfigs is an array or object
      if (Array.isArray(next.clanConfigs)) {
        // Handle clanConfigs as array (each element has a 'tag' property)
        next.clanConfigs.forEach((clanConfig, index) => {
          
          // Validate clan tag format
          if (!clanConfig.tag || /^\d+$/.test(clanConfig.tag)) {
            console.error('Invalid or missing clan tag detected:', clanConfig.tag);
            throw new Error(`Invalid clan tag: ${clanConfig.tag}. Please provide actual clan tags like #8P80R0VY.`);
          }
          
          clansToSave.push({
            tag: clanConfig.tag,
            name: clanConfig.name || next.clanNames?.[clanConfig.tag] || '',
            order: clanConfig.order !== undefined ? clanConfig.order : index,
            warMentionTargets: clanConfig.warMentionTargets || clanConfig.warMentionTarget ? [clanConfig.warMentionTarget] : [],
            memberMentionTargets: clanConfig.memberMentionTargets || clanConfig.memberMentionTarget ? [clanConfig.memberMentionTarget] : [],
            donationMentionTargets: clanConfig.donationMentionTargets || clanConfig.donationMentionTarget ? [clanConfig.donationMentionTarget] : [],
            warAnnounceChannelId: clanConfig.warAnnounceChannelId || null,
            memberAnnouncementChannelId: clanConfig.memberAnnouncementChannelId || null,
            donationAnnounceChannelId: clanConfig.donationAnnounceChannelId || null,
            warPreparingMessageId: clanConfig.warPreparingMessageId || clanConfig.war_preparing_message_id || null,
            warActiveMessageId: clanConfig.warActiveMessageId || clanConfig.war_active_message_id || null,
            donationMessageId: clanConfig.donationMessageId || clanConfig.donation_message_id || null,
            // War state management fields (preserve existing values if available)
            warCurrentState: clanConfig.warCurrentState || 'notInWar',
            warPreparingMessageId: clanConfig.warPreparingMessageId || null,
            warActiveMessageId: clanConfig.warActiveMessageId || null,
            warLastStateChange: clanConfig.warLastStateChange || null,
            warStateData: clanConfig.warStateData || null
          });
        });
      } else {
        // Handle clanConfigs as object (per-clan configuration with clan tags as keys)
        for (const [clanTag, clanConfig] of Object.entries(next.clanConfigs)) {
          
          // Validate clan tag format - reject if it's not a valid CoC clan tag
          if (!isValidClanTag(clanTag)) {
            console.warn(`[Config] Skipping invalid clan tag in clanConfigs: "${clanTag}" - not a valid Clash of Clans clan tag`);
            continue; // Skip this invalid entry instead of throwing error
          }
          
          // Validate clan tag format - reject if it looks like an array index
          if (/^\d+$/.test(clanTag)) {
            console.error('Invalid clan tag detected:', clanTag, '- looks like array index, not real clan tag');
            throw new Error(`Invalid clan tag: ${clanTag}. Please provide actual clan tags like #8P80R0VY, not array indices.`);
          }
          
          clansToSave.push({
            tag: clanTag,
            name: next.clanNames?.[clanTag] || clanConfig.clanName || `Clan #${clanTag}`,
            order: clansToSave.length,
            warMentionTargets: clanConfig.warMentionTargets || [],
            memberMentionTargets: clanConfig.memberMentionTargets || [],
            donationMentionTargets: clanConfig.donationMentionTargets || [],
            warAnnounceChannelId: clanConfig.warAnnounceChannelId || null,
            memberAnnouncementChannelId: clanConfig.memberAnnouncementChannelId || null,
            donationAnnounceChannelId: clanConfig.donationAnnounceChannelId || null,
            warPreparingMessageId: clanConfig.warPreparingMessageId || clanConfig.war_preparing_message_id || null,
            warActiveMessageId: clanConfig.warActiveMessageId || clanConfig.war_active_message_id || null,
            donationMessageId: clanConfig.donationMessageId || clanConfig.donation_message_id || null,
            // War state management fields (preserve existing values if available)
            warCurrentState: clanConfig.warCurrentState || 'notInWar',
            warPreparingMessageId: clanConfig.warPreparingMessageId || null,
            warActiveMessageId: clanConfig.warActiveMessageId || null,
            warLastStateChange: clanConfig.warLastStateChange || null,
            warStateData: clanConfig.warStateData || null
          });
        }
      }
    } else if (next.clans?.length > 0) {
      // Handle legacy clans array
      next.clans.forEach((tag, index) => {
        
        // Validate clan tag format - skip if not valid
        if (!isValidClanTag(tag)) {
          console.warn(`[Config] Skipping invalid clan tag in clans array: "${tag}" at index ${index}`);
          return; // Skip this invalid entry
        }
        
        // Validate clan tag format - reject if it looks like an array index
        if (/^\d+$/.test(tag)) {
          console.error('Invalid clan tag detected:', tag, '- looks like array index, not real clan tag');
          throw new Error(`Invalid clan tag: ${tag}. Please provide actual clan tags like #8P80R0VY, not array indices.`);
        }
        
        clansToSave.push({
          tag,
          name: next.clanNames?.[tag] || (index === 0 ? next.clanName : ''),
          order: index,
          warMentionTargets: [],
          memberMentionTargets: [],
          donationMentionTargets: [],
          warAnnounceChannelId: null,
          memberAnnouncementChannelId: null,
          donationAnnounceChannelId: null,
          // For legacy arrays, reuse global message ids only for first clan; others remain null to avoid duplication
          warPreparingMessageId: index === 0 ? (next.warPreparingMessageId || null) : null,
          warActiveMessageId: index === 0 ? (next.warActiveMessageId || null) : null,
          donationMessageId: index === 0 ? (next.donationMessageId || null) : null,
          // War state management fields - set defaults for legacy clans
          warCurrentState: 'notInWar',
          warPreparingMessageId: null,
          warActiveMessageId: null,
          warLastStateChange: null,
          warStateData: null
        });
      });
    }
    
    if (clansToSave.length === 0) {
      // Insert a single record with empty clan data for basic guild settings
      await db.sqlPool.query(`
        INSERT INTO guild_clashofclans_watch(
          guild_id, clan_tag, clan_name, clan_order,
          war_announce_channel_id, member_announce_channel_id, donation_announce_channel_id, 
          donation_leaderboard_channel_id, war_leaderboard_channel_id,
          donation_message_id, war_preparing_message_id, war_active_message_id, 
          war_mention_target, member_mention_target, donation_mention_target,
          enabled, interval_sec, track_wars, track_members, track_donations, track_donation_leaderboard, track_cwl,
          donation_threshold, donation_leaderboard_schedule, donation_leaderboard_time,
          war_start_template, war_end_template, member_join_template, donation_template, 
          donation_leaderboard_template, embed_enabled, clan_data,
          war_current_state, war_last_state_change, war_state_data
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `, [
        guildId, '', '', 0, // Empty clan data
        null, null, null, // No announcement channels
        null, null, // No leaderboard channels
        next.donationMessageId, next.warPreparingMessageId, next.warActiveMessageId,
        next.warMentionTarget || '', next.memberMentionTarget || '', next.donationMentionTarget || '',
        next.enabled ? 1 : 0, next.intervalSec || 3600, 
        next.trackWars ? 1 : 0, next.trackMembers ? 1 : 0, next.trackDonations ? 1 : 0, next.trackDonationLeaderboard ? 1 : 0, next.trackCWL ? 1 : 0,
        next.donationThreshold || 100, next.donationLeaderboardSchedule || 'hourly', next.donationLeaderboardTime || '20:00',
        next.warStartTemplate, next.warEndTemplate, next.memberJoinTemplate, next.donationTemplate,
        next.donationLeaderboardTemplate, next.embedEnabled ? 1 : 0, JSON.stringify(next.clanData || {}),
        'notInWar', formatDateForMySQL(new Date()), null
      ]);
    } else {
      // Insert records for each clan
      for (const clan of clansToSave) {
        // Use the same channel for announcements and leaderboards
        const warLeaderboardChannelId = next.trackWarLeaderboard ? clan.warAnnounceChannelId : null; // War leaderboard uses war announcement channel
        const donationLeaderboardChannelId = next.trackDonationLeaderboard ? clan.donationAnnounceChannelId : null; // Donation leaderboard uses donation announcement channel
        
        await db.sqlPool.query(`
          INSERT INTO guild_clashofclans_watch(
            guild_id, clan_tag, clan_name, clan_order,
            war_announce_channel_id, member_announce_channel_id, donation_announce_channel_id, 
            donation_leaderboard_channel_id, war_leaderboard_channel_id,
            donation_message_id, war_preparing_message_id, war_active_message_id, 
            war_mention_target, member_mention_target, donation_mention_target,
            enabled, interval_sec, track_wars, track_members, track_donations, track_donation_leaderboard, track_cwl,
            donation_threshold, donation_leaderboard_schedule, donation_leaderboard_time,
            war_start_template, war_end_template, member_join_template, donation_template, 
            donation_leaderboard_template, embed_enabled, clan_data,
            war_current_state, war_last_state_change, war_state_data
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `, [
          guildId, clan.tag, clan.name, clan.order,
          clan.warAnnounceChannelId || null, clan.memberAnnouncementChannelId || null, clan.donationAnnounceChannelId || null,
          donationLeaderboardChannelId || null, warLeaderboardChannelId || null,
          // Preserve per-clan message ids. Fall back to global ids only if clan-specific not provided
          (clan.donationMessageId !== undefined ? clan.donationMessageId : (clan.order === 0 ? next.donationMessageId : null)) || null,
          (clan.warPreparingMessageId !== undefined ? clan.warPreparingMessageId : (clan.order === 0 ? next.warPreparingMessageId : null)) || null,
          (clan.warActiveMessageId !== undefined ? clan.warActiveMessageId : (clan.order === 0 ? next.warActiveMessageId : null)) || null,
          Array.isArray(clan.warMentionTargets) ? clan.warMentionTargets.join(',') : '',
          Array.isArray(clan.memberMentionTargets) ? clan.memberMentionTargets.join(',') : '',
          Array.isArray(clan.donationMentionTargets) ? clan.donationMentionTargets.join(',') : '',
          next.enabled ? 1 : 0, next.intervalSec || 3600, 
          next.trackWars ? 1 : 0, next.trackMembers ? 1 : 0, next.trackDonations ? 1 : 0, next.trackDonationLeaderboard ? 1 : 0, next.trackCWL ? 1 : 0,
          next.donationThreshold || 100, next.donationLeaderboardSchedule || 'hourly', next.donationLeaderboardTime || '20:00',
          next.warStartTemplate, next.warEndTemplate, next.memberJoinTemplate, next.donationTemplate,
          next.donationLeaderboardTemplate, next.embedEnabled ? 1 : 0, JSON.stringify(next.clanData || {}),
          // War state management fields - preserve existing values or set defaults
          clan.warCurrentState || 'notInWar',
          clan.warLastStateChange ? formatDateForMySQL(new Date(clan.warLastStateChange)) : formatDateForMySQL(new Date()),
          // Safe stringification for warStateData
          (() => {
            if (!clan.warStateData) return null;
            if (typeof clan.warStateData === 'string') {
              // Check for the specific "[object Object]" problem and reset it
              if (clan.warStateData === '[object Object]' || clan.warStateData.includes('[object Object]')) {
                console.warn(`[Config] Detected corrupted "[object Object]" string in warStateData for clan ${clan.tag}, resetting to null`);
                return null;
              }
              // If it's already a string, try to parse and re-stringify to ensure it's valid JSON
              try {
                JSON.parse(clan.warStateData);
                return clan.warStateData; // It's valid JSON string, use as-is
              } catch (e) {
                console.warn(`[Config] Invalid JSON string in warStateData for clan ${clan.tag}:`, clan.warStateData);
                return null; // Invalid JSON string, reset to null
              }
            } else if (typeof clan.warStateData === 'object') {
              // It's an object, stringify it
              try {
                return JSON.stringify(clan.warStateData);
              } catch (e) {
                console.warn(`[Config] Error stringifying warStateData for clan ${clan.tag}:`, e.message);
                return null;
              }
            }
            return null;
          })()
        ]);
      }
    }
  }
  
  // Save CWL channel configurations to guild_clashofclans_cwl_state table
  if (next.trackCWL && next.clanConfigs) {
    try {
      for (const [clanTag, clanConfig] of Object.entries(next.clanConfigs)) {
        // Skip if no CWL channels configured
        if (!clanConfig.cwlAnnounceChannelId && !clanConfig.cwlLeaderboardChannelId) {
          continue;
        }
        
        const season = (() => {
          const now = new Date();
          const year = now.getFullYear();
          const month = String(now.getMonth() + 1).padStart(2, '0');
          return `${year}-${month}`;
        })();
        
        // Check if record exists for this clan in current season
        const [existing] = await db.sqlPool.query(
          'SELECT id FROM guild_clashofclans_cwl_state WHERE guild_id = ? AND clan_tag = ? AND season = ?',
          [guildId, clanTag, season]
        );
        
        if (existing.length > 0) {
          // Update existing record
          await db.sqlPool.query(
            `UPDATE guild_clashofclans_cwl_state 
             SET cwl_announce_channel_id = ?, cwl_leaderboard_channel_id = ? 
             WHERE id = ?`,
            [clanConfig.cwlAnnounceChannelId || null, clanConfig.cwlLeaderboardChannelId || null, existing[0].id]
          );
        } else {
          // Insert new record for CWL channel configuration
          await db.sqlPool.query(
            `INSERT INTO guild_clashofclans_cwl_state 
             (guild_id, clan_tag, season, cwl_announce_channel_id, cwl_leaderboard_channel_id, cwl_state) 
             VALUES (?, ?, ?, ?, ?, 'not_in_cwl')`,
            [guildId, clanTag, season, clanConfig.cwlAnnounceChannelId || null, clanConfig.cwlLeaderboardChannelId || null]
          );
        }
      }
    } catch (cwlSaveError) {
      console.error('[CWL] Error saving CWL channel config:', cwlSaveError.message);
    }
  }
  
  return { ...next };
}

// Helper function to get mention targets for a specific clan
async function getClanMentionTargets(guildId, clanTag, eventType = 'war') {
  if (!guildId || !clanTag) return [];
  
  if (db.mariaAvailable && db.sqlPool) {
    try {
      const column = `${eventType}_mention_target`;
      const [rows] = await db.sqlPool.query(`
        SELECT ${column} FROM guild_clashofclans_watch 
        WHERE guild_id = ? AND clan_tag = ?
      `, [guildId, clanTag]);
      
      if (rows.length > 0 && rows[0][column]) {
        return rows[0][column].split(',').filter(Boolean);
      }
    } catch (error) {
      console.error('Error getting clan mention targets:', error.message);
    }
  }
  
  return [];
}

// Helper function to update mention targets for a specific clan
async function setClanMentionTargets(guildId, clanTag, eventType, mentionTargets) {
  if (!guildId || !clanTag) throw new Error('guildId and clanTag required');
  
  if (db.mariaAvailable && db.sqlPool) {
    const column = `${eventType}_mention_target`;
    const mentionString = Array.isArray(mentionTargets) ? mentionTargets.join(',') : mentionTargets || '';
    
    await db.sqlPool.query(`
      UPDATE guild_clashofclans_watch 
      SET ${column} = ? 
      WHERE guild_id = ? AND clan_tag = ?
    `, [mentionString, guildId, clanTag]);
    
    // Clear cache
    const cacheData = cache.getCache();
    if (cacheData.guildClashOfClansConfigCache) {
      cacheData.guildClashOfClansConfigCache.delete(guildId);
    }
  }
}

module.exports = {
  getGuildClashOfClansConfig,
  setGuildClashOfClansConfig,
  getClanMentionTargets,
  setClanMentionTargets
};