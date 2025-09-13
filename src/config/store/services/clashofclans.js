// Clash of Clans service - handles guild Clash of Clans configuration
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
      const [rows] = await db.sqlPool.query(`
        SELECT clans, clan_name, war_announce_channel_id, member_announce_channel_id, donation_announce_channel_id,
               donation_leaderboard_channel_id, war_leaderboard_channel_id, donation_message_id, war_leaderboard_message_id, war_mention_target, member_mention_target, donation_mention_target, 
               enabled, interval_sec, track_wars, track_members, track_donations, track_donation_leaderboard,
               donation_threshold, donation_leaderboard_schedule, donation_leaderboard_time, 
               war_start_template, war_end_template, member_join_template, donation_template, 
               donation_leaderboard_template, embed_enabled, clan_data
        FROM guild_clashofclans_watch WHERE guild_id=?
      `, [guildId]);
      
      if (rows.length > 0) {
        const row = rows[0];
        const config = {
          clans: row.clans ? row.clans.split(',').filter(Boolean) : [],
          clanTag: row.clans ? row.clans.split(',').filter(Boolean)[0] || '' : '', // Map first clan as clanTag for frontend
          clanName: row.clan_name || '',
          clanNames: row.clan_data ? (JSON.parse(row.clan_data).clanNames || {}) : {}, // Extract clan names from clan_data
          warAnnounceChannelId: row.war_announce_channel_id,
          memberAnnounceChannelId: row.member_announce_channel_id,
          donationAnnounceChannelId: row.donation_announce_channel_id,
          donationLeaderboardChannelId: row.donation_leaderboard_channel_id,
          warLeaderboardChannelId: row.war_leaderboard_channel_id,
          donationMessageId: row.donation_message_id,
          warLeaderboardMessageId: row.war_leaderboard_message_id,
          warMentionTarget: row.war_mention_target || null,
          memberMentionTarget: row.member_mention_target || null,
          donationMentionTarget: row.donation_mention_target || null,
          mentionTargets: row.war_mention_target ? row.war_mention_target.split(',').filter(Boolean) : [], // Legacy compatibility
          enabled: !!row.enabled,
          intervalSec: row.interval_sec || 3600,
          trackWars: !!row.track_wars,
          trackMembers: !!row.track_members,
          trackDonations: !!row.track_donations,
          trackDonationLeaderboard: !!row.track_donation_leaderboard,
          trackWarLeaderboard: !!(row.war_leaderboard_channel_id), // Implicit when channel is set
          trackWarEvents: !!row.track_wars, // Map to frontend field names
          trackMemberEvents: !!row.track_members,
          trackDonationEvents: !!row.track_donations,
          donationThreshold: row.donation_threshold || 100,
          minDonationThreshold: row.donation_threshold || 100, // Map to frontend field name
          donationLeaderboardSchedule: row.donation_leaderboard_schedule || 'weekly',
          donationLeaderboardTime: row.donation_leaderboard_time || '20:00',
          donationLeaderboardTime: row.donation_leaderboard_time || '20:00',
          warStartTemplate: row.war_start_template || defaultConfigs.guildClashOfClansConfig.warStartTemplate,
          warEndTemplate: row.war_end_template || defaultConfigs.guildClashOfClansConfig.warEndTemplate,
          memberJoinTemplate: row.member_join_template || defaultConfigs.guildClashOfClansConfig.memberJoinTemplate,
          donationTemplate: row.donation_template || defaultConfigs.guildClashOfClansConfig.donationTemplate,
          donationLeaderboardTemplate: row.donation_leaderboard_template || '',
          embedEnabled: !!row.embed_enabled,
          clanData: row.clan_data ? JSON.parse(row.clan_data) : {}
        };
        
        cacheData.guildClashOfClansConfigCache.set(guildId, config);
        return { ...config };
      }
    } catch (e) {
      console.error('Error loading guild Clash of Clans config:', e.message);
    }
  }
  
  return { ...defaultConfigs.guildClashOfClansConfig }; // memory fallback (not persisted)
}

async function setGuildClashOfClansConfig(guildId, partial) {
  if (!guildId) throw new Error('guildId required');
  
  const current = await getGuildClashOfClansConfig(guildId);
  const next = { ...current };
  
  // Handle field mappings from frontend to database schema
  if (partial.clans !== undefined && Array.isArray(partial.clans)) {
    next.clans = partial.clans;
    // Set the first clan as the primary clan tag if available
    if (partial.clans.length > 0) {
      next.clanTag = partial.clans[0];
    }
  }
  if (partial.clanTag !== undefined) {
    // Also update clans array to include this tag if not already present
    if (partial.clanTag && !next.clans.includes(partial.clanTag)) {
      next.clans = [partial.clanTag, ...(next.clans || [])];
    }
  }
  if (partial.clanNames !== undefined) next.clanNames = partial.clanNames;
  if (partial.clanName !== undefined) next.clanName = partial.clanName;
  if (partial.warAnnounceChannelId !== undefined) next.warAnnounceChannelId = partial.warAnnounceChannelId;
  if (partial.memberAnnounceChannelId !== undefined) next.memberAnnounceChannelId = partial.memberAnnounceChannelId;
  if (partial.donationAnnounceChannelId !== undefined) next.donationAnnounceChannelId = partial.donationAnnounceChannelId;
  if (partial.donationLeaderboardChannelId !== undefined) next.donationLeaderboardChannelId = partial.donationLeaderboardChannelId;
  if (partial.warLeaderboardChannelId !== undefined) next.warLeaderboardChannelId = partial.warLeaderboardChannelId;
  if (partial.warLeaderboardMessageId !== undefined) next.warLeaderboardMessageId = partial.warLeaderboardMessageId;
  
  // Handle war leaderboard tracking - implicit when channel is set
  if (partial.trackWarLeaderboard !== undefined) {
    next.trackWarLeaderboard = partial.trackWarLeaderboard;
    // If enabling war leaderboard tracking but no channel is set, clear it
    if (!partial.trackWarLeaderboard) {
      next.warLeaderboardChannelId = null;
      next.warLeaderboardMessageId = null;
    }
  }
  if (partial.war_leaderboard_channel_id !== undefined) next.warLeaderboardChannelId = partial.war_leaderboard_channel_id;
  if (partial.war_leaderboard_message_id !== undefined) next.warLeaderboardMessageId = partial.war_leaderboard_message_id;
  
  // Handle mention targets - use global mentionTargets as primary source
  if (partial.mentionTargets !== undefined) {
    const mentionTargetsString = Array.isArray(partial.mentionTargets) ? 
      partial.mentionTargets.join(',') : (partial.mentionTargets || '');
    
    // Set all mention target fields to the same value for compatibility
    next.warMentionTarget = mentionTargetsString;
    next.memberMentionTarget = mentionTargetsString; 
    next.donationMentionTarget = mentionTargetsString;
    next.mentionTargets = partial.mentionTargets;
  }
  
  // Handle individual mention targets (for backwards compatibility)
  if (partial.warMentionTarget !== undefined) {
    next.warMentionTarget = Array.isArray(partial.warMentionTarget) ? 
      partial.warMentionTarget.join(',') : partial.warMentionTarget;
  }
  if (partial.memberMentionTarget !== undefined) {
    next.memberMentionTarget = Array.isArray(partial.memberMentionTarget) ? 
      partial.memberMentionTarget.join(',') : partial.memberMentionTarget;
  }
  if (partial.donationMentionTarget !== undefined) {
    next.donationMentionTarget = Array.isArray(partial.donationMentionTarget) ? 
      partial.donationMentionTarget.join(',') : partial.donationMentionTarget;
  }
  
  if (partial.enabled !== undefined) next.enabled = partial.enabled;
  if (partial.intervalSec !== undefined) next.intervalSec = partial.intervalSec;
  if (partial.donationThreshold !== undefined) {
    next.donationThreshold = partial.donationThreshold;
    next.minDonationThreshold = partial.donationThreshold; // Keep in sync
  }
  if (partial.minDonationThreshold !== undefined) {
    next.donationThreshold = partial.minDonationThreshold; // Map frontend field
    next.minDonationThreshold = partial.minDonationThreshold; // Keep in sync
  }
  
  // Handle donation leaderboard settings
  if (partial.trackDonationLeaderboard !== undefined) next.trackDonationLeaderboard = partial.trackDonationLeaderboard;
  if (partial.donationLeaderboardSchedule !== undefined) next.donationLeaderboardSchedule = partial.donationLeaderboardSchedule;
  if (partial.donationLeaderboardTime !== undefined) next.donationLeaderboardTime = partial.donationLeaderboardTime;
  if (partial.donationLeaderboardTemplate !== undefined) next.donationLeaderboardTemplate = partial.donationLeaderboardTemplate;
  
  // Map frontend tracking fields to database fields
  if (partial.trackWarEvents !== undefined) next.trackWars = partial.trackWarEvents;
  if (partial.trackMemberEvents !== undefined) next.trackMembers = partial.trackMemberEvents;
  if (partial.trackDonationEvents !== undefined) next.trackDonations = partial.trackDonationEvents;
  
  if (partial.warStartTemplate !== undefined) next.warStartTemplate = partial.warStartTemplate;
  if (partial.warEndTemplate !== undefined) next.warEndTemplate = partial.warEndTemplate;
  if (partial.memberJoinTemplate !== undefined) next.memberJoinTemplate = partial.memberJoinTemplate;
  if (partial.donationTemplate !== undefined) next.donationTemplate = partial.donationTemplate;
  if (partial.donationLeaderboardTemplate !== undefined) next.donationLeaderboardTemplate = partial.donationLeaderboardTemplate;
  if (partial.embedEnabled !== undefined) next.embedEnabled = partial.embedEnabled;
  if (partial.clanData !== undefined) next.clanData = partial.clanData;
  
  const cacheData = cache.getCache();
  if (!cacheData.guildClashOfClansConfigCache) {
    cacheData.guildClashOfClansConfigCache = new Map();
  }
  cacheData.guildClashOfClansConfigCache.set(guildId, next);
  
  if (db.mariaAvailable && db.sqlPool) {
    // Prepare clans as comma-separated string
    const clansString = (next.clans || []).join(',');
    
    // Get primary clan name from clanNames if available
    const primaryClanTag = next.clans && next.clans.length > 0 ? next.clans[0] : '';
    const primaryClanName = next.clanNames && primaryClanTag ? 
      next.clanNames[primaryClanTag] || next.clanName || '' : 
      (next.clanName || '');
    
    // Prepare clan_data with clanNames
    const clanData = {
      ...(next.clanData || {}),
      clanNames: next.clanNames || {}
    };

    await db.sqlPool.query(`
      REPLACE INTO guild_clashofclans_watch(
        guild_id, enabled, clans, clan_name, track_wars, track_members, track_donations, track_donation_leaderboard,
        war_announce_channel_id, member_announce_channel_id, donation_announce_channel_id, donation_leaderboard_channel_id, war_leaderboard_channel_id,
        donation_message_id, war_leaderboard_message_id, war_mention_target, member_mention_target, donation_mention_target,
        war_start_template, war_end_template, member_join_template, donation_template, donation_leaderboard_template,
        embed_enabled, clan_data, interval_sec, donation_threshold, donation_leaderboard_schedule, donation_leaderboard_time
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `, [
      guildId,
      next.enabled ? 1 : 0,
      clansString,
      primaryClanName,
      next.trackWars ? 1 : 0,
      next.trackMembers ? 1 : 0,
      next.trackDonations ? 1 : 0,
      next.trackDonationLeaderboard ? 1 : 0,
      next.warAnnounceChannelId,
      next.memberAnnounceChannelId,
      next.donationAnnounceChannelId,
      next.donationLeaderboardChannelId,
      next.warLeaderboardChannelId,
      next.donationMessageId,
      next.warLeaderboardMessageId,
      next.warMentionTarget,
      next.memberMentionTarget,
      next.donationMentionTarget,
      next.warStartTemplate,
      next.warEndTemplate,
      next.memberJoinTemplate,
      next.donationTemplate,
      next.donationLeaderboardTemplate,
      next.embedEnabled ? 1 : 0,
      JSON.stringify(clanData),
      next.intervalSec || 3600,
      next.donationThreshold || 100,
      next.donationLeaderboardSchedule || 'weekly',
      next.donationLeaderboardTime || '20:00'
    ]);
  }
  
  return { ...next };
}

module.exports = {
  getGuildClashOfClansConfig,
  setGuildClashOfClansConfig
};