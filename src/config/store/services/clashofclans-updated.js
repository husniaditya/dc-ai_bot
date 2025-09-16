// Updated Clash of Clans service - handles multiple clans as separate rows
const db = require('../database/connection');
const cache = require('../cache/manager');
const { defaultConfigs } = require('../models/defaults');

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
               donation_message_id, war_leaderboard_message_id, 
               war_mention_target, member_mention_target, donation_mention_target, 
               enabled, interval_sec, track_wars, track_members, track_donations, track_donation_leaderboard,
               donation_threshold, donation_leaderboard_schedule, donation_leaderboard_time, 
               war_start_template, war_end_template, member_join_template, donation_template, 
               donation_leaderboard_template, embed_enabled, clan_data,
               CASE WHEN war_leaderboard_channel_id IS NOT NULL THEN 1 ELSE 0 END as track_war_leaderboard
        FROM guild_clashofclans_watch 
        WHERE guild_id = ?
        ORDER BY clan_order ASC, id ASC
      `, [guildId]);
      
      if (rows.length > 0) {
        // Build configuration from multiple clan rows
        const firstRow = rows[0];
        const clans = rows.map(row => ({
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
        rows.forEach(row => {
          if (row.clan_tag && row.clan_name) {
            clanNames[row.clan_tag] = row.clan_name;
          }
        });
        
        // Build per-clan configurations for frontend
        const clanConfigs = {};
        rows.forEach(row => {
          if (row.clan_tag) {
            clanConfigs[row.clan_tag] = {
              warMentionTargets: row.war_mention_target ? row.war_mention_target.split(',').filter(Boolean) : [],
              memberMentionTargets: row.member_mention_target ? row.member_mention_target.split(',').filter(Boolean) : [],
              donationMentionTargets: row.donation_mention_target ? row.donation_mention_target.split(',').filter(Boolean) : [],
              warAnnounceChannelId: row.war_announce_channel_id,
              memberAnnouncementChannelId: row.member_announce_channel_id,
              donationAnnounceChannelId: row.donation_announce_channel_id
            };
          }
        });
        
        const config = {
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
          warLeaderboardMessageId: firstRow.war_leaderboard_message_id,
          
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
          clanData: firstRow.clan_data ? JSON.parse(firstRow.clan_data) : {}
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
  if (partial.warLeaderboardMessageId !== undefined) next.warLeaderboardMessageId = partial.warLeaderboardMessageId;
  if (partial.donationMessageId !== undefined) next.donationMessageId = partial.donationMessageId;
  if (partial.donation_message_id !== undefined) next.donationMessageId = partial.donation_message_id;
  if (partial.war_leaderboard_message_id !== undefined) next.warLeaderboardMessageId = partial.war_leaderboard_message_id;
  
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
  
  // Handle war leaderboard tracking
  if (partial.trackWarLeaderboard !== undefined) {
    next.trackWarLeaderboard = partial.trackWarLeaderboard;
  }
  if (partial.track_war_leaderboard !== undefined) {
    next.trackWarLeaderboard = partial.track_war_leaderboard;
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
            donationAnnounceChannelId: clanConfig.donationAnnounceChannelId || null
          });
        });
      } else {
        // Handle clanConfigs as object (per-clan configuration with clan tags as keys)
        for (const [clanTag, clanConfig] of Object.entries(next.clanConfigs)) {
          
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
            donationAnnounceChannelId: clanConfig.donationAnnounceChannelId || null
          });
        }
      }
    } else if (next.clans?.length > 0) {
      // Handle legacy clans array
      next.clans.forEach((tag, index) => {
        
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
          donationAnnounceChannelId: null
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
          donation_message_id, war_leaderboard_message_id, 
          war_mention_target, member_mention_target, donation_mention_target,
          enabled, interval_sec, track_wars, track_members, track_donations, track_donation_leaderboard,
          donation_threshold, donation_leaderboard_schedule, donation_leaderboard_time,
          war_start_template, war_end_template, member_join_template, donation_template, 
          donation_leaderboard_template, embed_enabled, clan_data
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `, [
        guildId, '', '', 0, // Empty clan data
        null, null, null, // No announcement channels
        null, null, // No leaderboard channels
        next.donationMessageId, next.warLeaderboardMessageId,
        next.warMentionTarget || '', next.memberMentionTarget || '', next.donationMentionTarget || '',
        next.enabled ? 1 : 0, next.intervalSec || 3600, 
        next.trackWars ? 1 : 0, next.trackMembers ? 1 : 0, next.trackDonations ? 1 : 0, next.trackDonationLeaderboard ? 1 : 0,
        next.donationThreshold || 100, next.donationLeaderboardSchedule || 'hourly', next.donationLeaderboardTime || '20:00',
        next.warStartTemplate, next.warEndTemplate, next.memberJoinTemplate, next.donationTemplate,
        next.donationLeaderboardTemplate, next.embedEnabled ? 1 : 0, JSON.stringify(next.clanData || {})
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
            donation_message_id, war_leaderboard_message_id, 
            war_mention_target, member_mention_target, donation_mention_target,
            enabled, interval_sec, track_wars, track_members, track_donations, track_donation_leaderboard,
            donation_threshold, donation_leaderboard_schedule, donation_leaderboard_time,
            war_start_template, war_end_template, member_join_template, donation_template, 
            donation_leaderboard_template, embed_enabled, clan_data
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `, [
          guildId, clan.tag, clan.name, clan.order,
          clan.warAnnounceChannelId || null, clan.memberAnnouncementChannelId || null, clan.donationAnnounceChannelId || null,
          donationLeaderboardChannelId || null, warLeaderboardChannelId || null,
          next.donationMessageId || null, next.warLeaderboardMessageId || null,
          Array.isArray(clan.warMentionTargets) ? clan.warMentionTargets.join(',') : '',
          Array.isArray(clan.memberMentionTargets) ? clan.memberMentionTargets.join(',') : '',
          Array.isArray(clan.donationMentionTargets) ? clan.donationMentionTargets.join(',') : '',
          next.enabled ? 1 : 0, next.intervalSec || 3600, 
          next.trackWars ? 1 : 0, next.trackMembers ? 1 : 0, next.trackDonations ? 1 : 0, next.trackDonationLeaderboard ? 1 : 0,
          next.donationThreshold || 100, next.donationLeaderboardSchedule || 'hourly', next.donationLeaderboardTime || '20:00',
          next.warStartTemplate, next.warEndTemplate, next.memberJoinTemplate, next.donationTemplate,
          next.donationLeaderboardTemplate, next.embedEnabled ? 1 : 0, JSON.stringify(next.clanData || {})
        ]);
      }
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