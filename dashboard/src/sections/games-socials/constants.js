// Services configuration for Games & Socials section
export const SERVICES = [
  { 
    key: 'youtube', 
    label: 'YouTube', 
    image: 'youtube.png', 
    icon: 'fa-brands fa-youtube', 
    color: '#FF0000', 
    desc: 'Video uploads & live notifications.',
    implemented: true
  },
  { 
    key: 'twitch', 
    label: 'Twitch', 
    image: 'twitch.png', 
    icon: 'fa-brands fa-twitch', 
    color: '#9146FF', 
    desc: 'Streamer live alerts.',
    implemented: true
  },
  { 
    key: 'pubg', 
    label: 'PUBG', 
    image: 'pubg.png', 
    icon: 'fa-solid fa-crosshairs', 
    color: '#f59e0b', 
    desc: 'Player / match stats (planned).',
    implemented: false
  },
  { 
    key: 'valorant', 
    label: 'Valorant', 
    image: 'valorant.png', 
    icon: 'fa-solid fa-bullseye', 
    color: '#e11d48', 
    desc: 'Match & agent stats (planned).',
    implemented: false
  },
  { 
    key: 'apex', 
    label: 'Apex', 
    image: 'apexlegends.png', 
    icon: 'fa-solid fa-mountain', 
    color: '#7c3aed', 
    desc: 'Legend stats & map rotation (planned).',
    implemented: false
  },
  { 
    key: 'mobilelegends', 
    label: 'Mobile Legends', 
    image: 'mobilelegends.png', 
    icon: 'fa-solid fa-mobile-screen-button', 
    color: '#0ea5e9', 
    desc: 'Hero stats & live matches (planned).',
    implemented: false
  },
  { 
    key: 'clashofclans', 
    label: 'Clash of Clans', 
    image: 'clashofclans.png', 
    icon: 'fa-solid fa-shield', 
    color: '#16a34a', 
    desc: 'Clan & war stats (planned).',
    implemented: false
  },
  { 
    key: 'fortnite', 
    label: 'Fortnite', 
    image: 'fornite.png', 
    icon: 'fa-solid fa-flag', 
    color: '#6366f1', 
    desc: 'Player stats & shop rotation (planned).',
    implemented: false
  },
  { 
    key: 'genshin', 
    label: 'Genshin Impact', 
    image: 'genshinimpact.png', 
    icon: 'fa-solid fa-flag', 
    color: '#6366f1', 
    desc: 'Player details & showcases (planned).',
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
  }
};
