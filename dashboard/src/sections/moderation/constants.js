// Moderation features with their configurations
export const MODERATION_FEATURES = [
  {
    key: 'welcome',
    label: 'Welcome Messages',
    icon: 'fa-door-open',
    color: '#10b981',
    desc: 'Greet new members with customizable welcome messages and cards.',
    features: ['Custom Messages', 'Welcome Cards', 'Role Assignment', 'Channel Selection']
  },
  {
    key: 'automod',
    label: 'Auto Moderation',
    icon: 'fa-robot',
    color: '#dc2626',
    desc: 'Automatically detect and handle spam, excessive caps, and inappropriate content.',
    features: ['Spam Detection', 'Caps Lock Filter', 'Link Filtering', 'Profanity Filter']
  },
  {
    key: 'roles',
    label: 'Role Management',
    icon: 'fa-users-gear',
    color: '#8b5cf6',
    desc: 'Manage roles with reaction roles and role menus.',
    features: ['Reaction Roles', 'Role Menus', 'Permission Sync', 'Custom Messages']
  },
  {
    key: 'xp',
    label: 'XP & Leveling',
    icon: 'fa-chart-line',
    color: '#06b6d4',
    desc: 'Reward active members with XP points and level progression.',
    features: ['XP Tracking', 'Level Rewards', 'Leaderboards', 'Custom Multipliers']
  },
  {
    key: 'scheduler',
    label: 'Scheduled Messages',
    icon: 'fa-calendar-days',
    color: '#3b82f6',
    desc: 'Schedule announcements and recurring messages for your server.',
    features: ['Scheduled Posts', 'Recurring Messages', 'Event Reminders', 'Auto Announcements']
  },
  {
    key: 'logging',
    label: 'Audit Logging',
    icon: 'fa-clipboard-list',
    color: '#f97316',
    desc: 'Track all moderation actions and server changes.',
    features: ['Message Logs', 'Member Logs', 'Channel Logs', 'Role Logs']
  },
  {
    key: 'antiraid',
    label: 'Anti-Raid Protection',
    icon: 'fa-shield',
    color: '#ef4444',
    desc: 'Protect your server from raids and mass join attacks.',
    features: ['Join Rate Limiting', 'Account Age Filter', 'Auto Lockdown', 'Verification System']
  }
];

// Feature configuration defaults
export const FEATURE_DEFAULTS = {
  welcome: {
    enabled: false,
    channelId: '',
    messageType: 'text',
    messageText: 'Welcome to {server}, {user}!',
    cardEnabled: false,
    roleId: '',
    dmEnabled: false,
    dmMessage: 'Welcome to {server}! Thanks for joining us.'
  },
  automod: {
    enabled: false,
    spamDetection: false,
    capsFilter: false,
    linkFilter: false,
    profanityFilter: false,
    logChannelId: '',
    autoDelete: false,
    bypassRoles: []
  },
  roles: {
    enabled: false,
    reactionRoles: [],
    slashCommands: true
  },
  xp: {
    enabled: false,
    baseXp: 15,
    maxXp: 25,
    cooldown: 60,
    levelUpMessage: true,
    levelUpChannel: '',
    excludedChannels: [],
    multiplierRoles: []
  },
  scheduler: {
    enabled: false,
    messages: []
  },
  logging: {
    enabled: false,
    messageChannel: '',
    memberChannel: '',
    channelChannel: '',
    roleChannel: ''
  },
  antiraid: {
    enabled: false,
    joinRate: 5,
    joinWindow: 10,
    accountAge: 7,
    autoLockdown: true,
    verificationLevel: 'medium'
  }
};
