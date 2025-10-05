// Data models and default configurations

const seedSettings = { 
  autoReplyEnabled: process.env.AUTOREPLY_ENABLED === '1', 
  autoReplyCooldownMs: parseInt(process.env.AUTOREPLY_COOLDOWN_MS || '30000', 10) 
};

function loadSeedAutoResponses() {
  try {
    const list = require('../../bot/services/auto-responses');
    return list.map(r => ({
      key: r.key,
      pattern: r.pattern.source,
      flags: r.pattern.flags || 'i',
      replies: r.replies
    }));
  } catch (e) {
    console.error('Failed loading seed auto responses', e.message);
    return [];
  }
}

function compileAutoResponses(autoResponses) {
  return autoResponses.filter(r => r.enabled !== false)
    .map(r => ({ ...r, pattern: new RegExp(r.pattern, r.flags) }));
}

function compileGuildAutoResponses(list) {
  return list.filter(r => r.enabled !== false)
    .map(r => ({ ...r, pattern: new RegExp(r.pattern, r.flags) }));
}

// Default configurations for various features
const defaultConfigs = {
  guildSettings: {
    ...seedSettings,
    language: 'en',
    timezone: 'UTC',
    hourFormat: 24,
    embedColor: '#5865F2',
    prefix: '!',
    slashCommandsEnabled: true
  },

  guildPersonalization: {
    nickname: null,
    activityType: null,
    activityText: null,
    avatarBase64: null,
    status: null
  },

  guildWelcome: {
    channelId: null,
    messageType: 'text',
    messageText: '',
    cardEnabled: false,
    enabled: true,
    roleId: null,
    dmEnabled: false,
    dmMessage: ''
  },

  guildYouTubeConfig: {
    channels: [],
    announceChannelId: null,
    uploadAnnounceChannelId: null,
    liveAnnounceChannelId: null,
    mentionRoleId: null,
    mentionTargets: [],
    enabled: false,
    intervalSec: 300,
    uploadTemplate: '🎥 New upload from {channelTitle}: **{title}**\n{url} {roleMention}',
    liveTemplate: '🔴 LIVE {channelTitle} is now LIVE: **{title}**\n{url} {roleMention}',
    memberOnlyUploadTemplate: '👑 New MEMBER-ONLY upload from {channelTitle}: **{title}**{memberText}\n{url} {roleMention}',
    memberOnlyLiveTemplate: '👑🔴 MEMBER-ONLY LIVE {channelTitle} is now LIVE: **{title}**{memberText}\n{url} {roleMention}',
    embedEnabled: true,
    channelMessages: {},
    channelNames: {}
  },

  guildTwitchConfig: {
    streamers: [],
    announceChannelId: null,
    mentionRoleId: null,
    mentionTargets: [],
    enabled: false,
    intervalSec: 300,
    liveTemplate: '🔴 LIVE {streamerName} is now LIVE: **{title}**\n{url} {roleMention}',
    embedEnabled: true,
    streamerMessages: {},
    streamerNames: {}
  },

  guildClashOfClansConfig: {
    clans: [],
    clanTag: '', // Single clan tag for frontend
    clanName: '', // Clan name from API
    warAnnounceChannelId: null,
    memberAnnounceChannelId: null,
    donationAnnounceChannelId: null,
    donationLeaderboardChannelId: null,
    warLeaderboardChannelId: null,
    donationMessageId: null,
    warPreparingMessageId: null,
    warActiveMessageId: null,
    warMentionTarget: null,
    memberMentionTarget: null,
    donationMentionTarget: null,
    mentionTargets: [], // Legacy compatibility
    enabled: false,
    intervalSec: 3600, // 1 hour default
    trackWars: true,
    trackMembers: true,
    trackDonations: true,
    trackDonationLeaderboard: false,
    trackWarEvents: true, // Frontend field names
    trackMemberEvents: true,
    trackDonationEvents: true,
    donationThreshold: 100,
    minDonationThreshold: 100, // Map frontend field name
    donationLeaderboardSchedule: 'hourly',
    donationLeaderboardTime: '20:00',
    donationLeaderboardTemplate: '',
    warStartTemplate: '🛡️ War started against {warOpponent}! Preparation ends {warEndTime}. Good luck {roleMention}!',
    warEndTemplate: '⚔️ War against {warOpponent} ended! Result: {warResult} - {warStars} stars with {warDestructionPercentage}% destruction. Great job {roleMention}!',
    memberJoinTemplate: '👋 Updated member {clanName}! We now have {memberCount} members!!',
    donationTemplate: '💎 Weekly donations summary for {clanName}: Top contributors this week! {roleMention}!',
    embedEnabled: true,
    clanData: {} // Clan data from API
  },

  guildGenshinConfig: {
    players: [],
    playerNames: {},
    playerMessages: {},
    profileAnnounceChannelId: null,
    achievementAnnounceChannelId: null,
    spiralAbyssAnnounceChannelId: null,
    mentionTargets: [],
    enabled: false,
    intervalSec: 1800, // 30 minutes default
    trackProfileUpdates: true,
    trackAchievements: true,
    trackSpiralAbyss: true,
    minAchievementThreshold: 10,
    profileUpdateTemplate: '🌟 {playerName} has updated their profile! Adventure Rank: {adventureRank}, World Level: {worldLevel}. {roleMention}',
    achievementTemplate: '🏆 {playerName} has earned new achievements! Total: {achievements}. {roleMention}',
    spiralAbyssTemplate: '🗼 {playerName} has progressed in Spiral Abyss! Floor: {spiralAbyss}. {roleMention}',
    embedEnabled: true
  },

  guildValorantConfig: {
    players: [],
    playerNames: {},
    playerMessages: {},
    playerRegions: {},
    matchAnnounceChannelId: null,
    rankAnnounceChannelId: null,
    achievementAnnounceChannelId: null,
    mentionTargets: [],
    enabled: false,
    intervalSec: 1800, // 30 minutes default
    trackMatches: true,
    trackRankChanges: true,
    trackAchievements: true,
    matchTypes: {
      competitive: true,
      unrated: false,
      deathmatch: false,
      spikerush: false
    },
    minKillsThreshold: 20,
    matchTemplate: '🎮 {playerName} just played {map} as {agent}! K/D: {kills}/{deaths}/{assists}, Rank: {rank}. {roleMention}',
    rankChangeTemplate: '📈 {playerName} ranked {rankChange}! Now {rank} with {rr} RR ({rrChange} RR). {roleMention}',
    achievementTemplate: '🏆 {playerName} achieved {achievement}! {kills} kills in {map} as {agent}. {roleMention}',
    embedEnabled: true
  },

  guildXpSettings: {
    enabled: false,
    xpPerMessage: 15,
    xpPerVoiceMinute: 5,
    cooldownSeconds: 60,
    excludedChannels: [],
    excludedRoles: [],
    levelUpMessages: true,
    levelUpChannel: null,
    doubleXpEvents: []
  },

  guildAntiRaidSettings: {
    enabled: false,
    joinRate: 5,
    joinWindow: 10,
    accountAge: 7,
    autoLockdown: false,
    autoKick: false,
    verificationLevel: 'medium',
    alertChannel: null,
    raidAction: 'lockdown',
    raidActionDuration: 60,
    kickSuspicious: false,
    deleteInviteSpam: true,
    gracePeriod: 30,
    bypassRoles: []
  },

  guildModerationFeatures: {
    welcome: { enabled: false, config: {} },
    automod: { enabled: false, config: {} },
    roles: { enabled: false, config: {} },
    xp: { enabled: false, config: {} },
    scheduler: { enabled: false, config: {} },
    logging: { enabled: false, config: {} },
    antiraid: { enabled: false, config: {} }
  }
};

module.exports = {
  seedSettings,
  defaultConfigs,
  loadSeedAutoResponses,
  compileAutoResponses,
  compileGuildAutoResponses
};
