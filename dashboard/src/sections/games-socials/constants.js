// Services configuration for Games & Socials section
export const SERVICES = [
  { 
    key: 'youtube', 
    labelKey: 'gamesSocials.services.youtube.label', 
    image: 'youtube.png', 
    icon: 'fa-brands fa-youtube', 
    color: '#FF0000', 
    descKey: 'gamesSocials.services.youtube.desc',
    implemented: true
  },
  { 
    key: 'twitch', 
    labelKey: 'gamesSocials.services.twitch.label', 
    image: 'twitch.png', 
    icon: 'fa-brands fa-twitch', 
    color: '#9146FF', 
    descKey: 'gamesSocials.services.twitch.desc',
    implemented: true
  },
  { 
    key: 'pubg', 
    labelKey: 'gamesSocials.services.pubg.label', 
    image: 'pubg.png', 
    icon: 'fa-solid fa-crosshairs', 
    color: '#f59e0b', 
    descKey: 'gamesSocials.services.pubg.desc',
    implemented: false
  },
  { 
    key: 'valorant', 
    labelKey: 'gamesSocials.services.valorant.label', 
    image: 'valorant.png', 
    icon: 'fa-solid fa-bullseye', 
    color: '#e11d48', 
    descKey: 'gamesSocials.services.valorant.desc',
    implemented: false
  },
  { 
    key: 'apex', 
    labelKey: 'gamesSocials.services.apex.label', 
    image: 'apexlegends.png', 
    icon: 'fa-solid fa-mountain', 
    color: '#7c3aed', 
    descKey: 'gamesSocials.services.apex.desc',
    implemented: false
  },
  { 
    key: 'mobilelegends', 
    labelKey: 'gamesSocials.services.mobilelegends.label', 
    image: 'mobilelegends.png', 
    icon: 'fa-solid fa-mobile-screen-button', 
    color: '#0ea5e9', 
    descKey: 'gamesSocials.services.mobilelegends.desc',
    implemented: false
  },
  { 
    key: 'clashofclans', 
    labelKey: 'gamesSocials.services.clashofclans.label', 
    image: 'clashofclans.png', 
    icon: 'fa-solid fa-shield', 
    color: '#16a34a', 
    descKey: 'gamesSocials.services.clashofclans.desc',
    implemented: true
  },
  { 
    key: 'fortnite', 
    labelKey: 'gamesSocials.services.fortnite.label', 
    image: 'fornite.png', 
    icon: 'fa-solid fa-flag', 
    color: '#6366f1', 
    descKey: 'gamesSocials.services.fortnite.desc',
    implemented: false
  },
  { 
    key: 'genshin', 
    labelKey: 'gamesSocials.services.genshin.label', 
    image: 'genshinimpact.png', 
    icon: 'fa-solid fa-flag', 
    color: '#6366f1', 
    descKey: 'gamesSocials.services.genshin.desc',
    implemented: false
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
  }
};
