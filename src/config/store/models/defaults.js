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
