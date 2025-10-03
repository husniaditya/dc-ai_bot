// Services configuration for Games & Socials section
export const SERVICES = [
  { 
    key: 'youtube', 
    labelKey: 'gamesSocials.services.youtube.label', 
    image: 'youtube.svg', 
    icon: 'fa-brands fa-youtube', 
    color: '#FF0000', 
    descKey: 'gamesSocials.services.youtube.desc',
    implemented: true
  },
  { 
    key: 'twitch', 
    labelKey: 'gamesSocials.services.twitch.label', 
    image: 'twitch.svg', 
    icon: 'fa-brands fa-twitch', 
    color: '#9146FF', 
    descKey: 'gamesSocials.services.twitch.desc',
    implemented: true
  },
  { 
    key: 'pubg', 
    labelKey: 'gamesSocials.services.pubg.label', 
    image: 'pubg.svg', 
    icon: 'fa-solid fa-crosshairs', 
    color: '#f59e0b', 
    descKey: 'gamesSocials.services.pubg.desc',
    implemented: false
  },
  { 
    key: 'valorant', 
    labelKey: 'gamesSocials.services.valorant.label', 
    image: 'valorant.svg', 
    icon: 'fa-solid fa-bullseye', 
    color: '#e11d48', 
    descKey: 'gamesSocials.services.valorant.desc',
    implemented: true
  },
  { 
    key: 'apex', 
    labelKey: 'gamesSocials.services.apex.label', 
    image: 'apexlegends.svg', 
    icon: 'fa-solid fa-mountain', 
    color: '#7c3aed', 
    descKey: 'gamesSocials.services.apex.desc',
    implemented: false
  },
  { 
    key: 'mobilelegends', 
    labelKey: 'gamesSocials.services.mobilelegends.label', 
    image: 'mobilelegends.svg', 
    icon: 'fa-solid fa-mobile-screen-button', 
    color: '#0ea5e9', 
    descKey: 'gamesSocials.services.mobilelegends.desc',
    implemented: false
  },
  { 
    key: 'clashofclans', 
    labelKey: 'gamesSocials.services.clashofclans.label', 
    image: 'clashofclans.svg', 
    icon: 'fa-solid fa-shield', 
    color: '#16a34a', 
    descKey: 'gamesSocials.services.clashofclans.desc',
    implemented: true
  },
  { 
    key: 'fortnite', 
    labelKey: 'gamesSocials.services.fortnite.label', 
    image: 'fornite.svg', 
    icon: 'fa-solid fa-flag', 
    color: '#6366f1', 
    descKey: 'gamesSocials.services.fortnite.desc',
    implemented: false
  },
  { 
    key: 'genshin', 
    labelKey: 'gamesSocials.services.genshin.label', 
    image: 'genshinimpact.svg', 
    icon: 'fa-solid fa-star', 
    color: '#FFD700', 
    descKey: 'gamesSocials.services.genshin.desc',
    implemented: true
  },
];

// Template placeholders for different services
export const TEMPLATE_PLACEHOLDERS = {
  youtube: [
    '{channelTitle}',
    '{title}',
    '{url}',
    '{roleNames}',
    '{roleMention}',
    '{thumbnail}',
    '{publishedAt}',
    '{publishedAtRelative}',
    '{memberText}'
  ],
  twitch: [
    '{streamerName}',
    '{title}',
    '{url}',
    '{roleNames}',
    '{roleMention}',
    '{game}',
    '{viewers}',
    '{thumbnail}',
    '{startedAt}',
    '{startedAtRelative}'
  ],
  clashofclans: [
    '{clanName}',
    '{clanTag}',
    '{clanLevel}',
    '{memberCount}',
    '{description}',
    '{warState}',
    '{warOpponent}',
    '{warResult}',
    '{roleNames}',
    '{roleMention}',
    '{warStars}',
    '{warDestructionPercentage}',
    '{warEndTime}',
    '{warPreparationStartTime}'
  ],
  genshin: [
    '{playerName}',
    '{uid}',
    '{adventureRank}',
    '{worldLevel}',
    '{achievements}',
    '{signature}',
    '{profileCharacter}',
    '{spiralAbyss}',
    '{roleNames}',
    '{roleMention}',
    '{characterCount}',
    '{lastUpdate}'
  ],
  valorant: [
    '{playerName}',
    '{region}',
    '{rank}',
    '{rr}',
    '{rrChange}',
    '{oldRank}',
    '{newRank}',
    '{map}',
    '{agent}',
    '{kills}',
    '{deaths}',
    '{assists}',
    '{kd}',
    '{acs}',
    '{result}',
    '{score}',
    '{mode}',
    '{achievement}',
    '{description}',
    '{roleNames}',
    '{roleMention}'
  ]
};

// Default configurations
export const DEFAULT_CONFIGS = {
  youtube: {
    enabled: false,
    intervalSec: 300,
    embedEnabled: true,
    channels: [],
    mentionTargets: [],
    channelMessages: {},
    channelNames: {},
    uploadTemplate: '',
    liveTemplate: '',
    memberOnlyUploadTemplate: '',
    memberOnlyLiveTemplate: '',
    uploadAnnounceChannelId: null,
    liveAnnounceChannelId: null
  },
  twitch: {
    enabled: false,
    intervalSec: 300,
    embedEnabled: true,
    streamers: [],
    mentionTargets: [],
    streamerMessages: {},
    streamerNames: {},
    liveTemplate: '',
    announceChannelId: null
  },
  clashofclans: {
    enabled: false,
    intervalSec: 3600, // Check every hour for clan updates
    embedEnabled: true,
    clans: [], // Array of clan tags to track
    mentionTargets: [],
    clanMessages: {},
    clanNames: {},
    warStartTemplate: '',
    warEndTemplate: '',
    donationTemplate: '',
    memberJoinTemplate: '',
    memberLeaveTemplate: '',
    warAnnounceChannelId: null,
    donationAnnounceChannelId: null,
    memberAnnounceChannelId: null,
    trackWars: true,
    trackDonations: false,
    trackMemberChanges: true,
    minDonationThreshold: 100
  },
  genshin: {
    enabled: false,
    intervalSec: 1800, // Check every 30 minutes for profile updates
    embedEnabled: true,
    players: [], // Array of UIDs to track
    mentionTargets: [],
    playerMessages: {},
    playerNames: {},
    profileUpdateTemplate: '',
    achievementTemplate: '',
    spiralAbyssTemplate: '',
    profileAnnounceChannelId: null,
    achievementAnnounceChannelId: null,
    spiralAbyssAnnounceChannelId: null,
    trackProfileUpdates: true,
    trackAchievements: true,
    trackSpiralAbyss: true,
    minAchievementThreshold: 10
  },
  valorant: {
    enabled: false,
    intervalSec: 1800, // Check every 30 minutes for match updates
    embedEnabled: true,
    players: [], // Array of Riot IDs (Name#TAG) to track
    mentionTargets: [],
    playerMessages: {},
    playerNames: {},
    playerRegions: {},
    matchTemplate: '',
    rankChangeTemplate: '',
    achievementTemplate: '',
    matchAnnounceChannelId: null,
    rankAnnounceChannelId: null,
    achievementAnnounceChannelId: null,
    trackMatches: true,
    trackRankChanges: true,
    trackAchievements: false,
    matchTypes: {
      competitive: true,
      unrated: false,
      deathmatch: false
    },
    minKillsThreshold: 10
  }
};

