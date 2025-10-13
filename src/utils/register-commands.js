const { REST, Routes } = require('discord.js');
const path = require('path');

// Load .env from the root directory (two levels up from src/utils)
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;

if (!token || !clientId) {
  console.error('Missing DISCORD_TOKEN or CLIENT_ID in environment. See .env.example.');
  process.exit(1);
}

// Function to get all guild IDs from database
async function getAllGuildIds() {
  try {
    const store = require('../config/store');
    
    // Initialize persistence to load data
    const mode = await store.initPersistence();
    console.log(`Connected to database (${mode}), fetching all guild IDs...`);
    
    if (mode === 'maria') {
      const mysql = require('mysql2/promise');
      const host = process.env.MARIADB_HOST;
      const user = process.env.MARIADB_USER;
      const password = process.env.MARIADB_PASS;
      const database = process.env.MARIADB_DB;
      
      if (host && user && database) {
        const connection = await mysql.createConnection({
          host, user, password, database,
          port: process.env.MARIADB_PORT ? parseInt(process.env.MARIADB_PORT, 10) : 3306
        });
        
        // Get unique guild IDs from various tables
        const guildQueries = [
          'SELECT DISTINCT guild_id FROM guild_settings',
          'SELECT DISTINCT guild_id FROM guild_auto_responses',
          'SELECT DISTINCT guild_id FROM guild_command_toggles',
          'SELECT DISTINCT guild_id FROM guild_personalization',
          'SELECT DISTINCT guild_id FROM guild_welcome',
          'SELECT DISTINCT guild_id FROM guild_youtube_watch',
          'SELECT DISTINCT guild_id FROM guild_twitch_watch',
          'SELECT DISTINCT selected_guild_id as guild_id FROM m_user WHERE selected_guild_id IS NOT NULL'
        ];
        
        const allGuildIds = new Set();
        
        for (const query of guildQueries) {
          try {
            const [rows] = await connection.execute(query);
            rows.forEach(row => {
              const guildId = row.guild_id;
              if (guildId && guildId.length >= 15) { // Valid Discord guild ID length
                allGuildIds.add(guildId);
              }
            });
          } catch (err) {
            console.warn(`Query failed (table might not exist): ${query.split(' ')[3]}`);
          }
        }
        
        await connection.end();
        return Array.from(allGuildIds);
      }
    }
    
    return [];
  } catch (error) {
    console.warn('Could not access database:', error.message);
    return [];
  }
}

const commands = [
  {
    name: 'ping',
    description: 'Replies with Pong!'
  },
  {
    name: 'whoami',
    description: 'Shows your username and ID'
  },
  {
    name: 'uptime',
    description: 'Shows bot uptime'
  },
  {
    name: 'echo',
    description: 'Echo back text',
    options: [
      {
        name: 'text',
        description: 'Text to echo',
        type: 3, // STRING
        required: true
      }
    ]
  },
  {
    name: 'user',
    description: 'User utilities',
    options: [
      {
        name: 'info',
        description: 'Show user info',
        type: 1, // SUB_COMMAND
        options: [
          { name: 'target', description: 'User to query', type: 6, required: false }
        ]
      }
    ]
  },
  {
    name: 'math',
    description: 'Simple math operations',
    options: [
  { name: 'add', description: 'Add two numbers', type: 1, options: [ { name: 'a', description: 'First number', type: 10, required: true }, { name: 'b', description: 'Second number', type: 10, required: true } ] },
  { name: 'sub', description: 'Subtract two numbers', type: 1, options: [ { name: 'a', description: 'Minuend', type: 10, required: true }, { name: 'b', description: 'Subtrahend', type: 10, required: true } ] },
  { name: 'mul', description: 'Multiply two numbers', type: 1, options: [ { name: 'a', description: 'First factor', type: 10, required: true }, { name: 'b', description: 'Second factor', type: 10, required: true } ] },
  { name: 'div', description: 'Divide two numbers', type: 1, options: [ { name: 'a', description: 'Dividend', type: 10, required: true }, { name: 'b', description: 'Divisor', type: 10, required: true } ] }
    ]
  },
  {
    name: 'poll',
    description: 'Create a simple poll',
    options: [
  { name: 'create', description: 'Create a poll', type: 1, options: [ { name: 'question', description: 'Poll question', type: 3, required: true }, { name: 'options', description: 'Comma-separated options (max 5)', type: 3, required: true } ] },
  { name: 'results', description: 'Show poll results', type: 1, options: [ { name: 'id', description: 'Poll id', type: 3, required: true } ] }
    ]
  },
  {
    name: 'remind',
    description: 'Set a reminder via DM',
    options: [
      { name: 'minutes', description: 'Minutes until reminder', type: 4, required: true },
      { name: 'text', description: 'Reminder text', type: 3, required: true }
    ]
  },
  {
    name: 'ask',
    description: 'Ask Gemini AI a question',
    options: [
      { name: 'prompt', description: 'The prompt to send to the AI', type: 3, required: true }
    ]
  },
  {
    name: 'explain_image',
    description: 'Upload up to 3 images or reply to one to get AI explanations.',
    options: [
      {
        name: 'image',
        description: 'Image attachment to explain',
        type: 11, // ATTACHMENT
        required: false
      },
      { name: 'image2', description: 'Second image (optional)', type: 11, required: false },
      { name: 'image3', description: 'Third image (optional)', type: 11, required: false },
      {
        name: 'prompt',
        description: 'Optional extra context / instruction',
        type: 3,
        required: false
      }
    ],
  },
  {
    name: 'askfollow',
    description: 'Ask follow-up based on your recent AI conversation',
    options: [ { name: 'prompt', description: 'Follow-up prompt', type: 3, required: true } ]
  },
  {
    name: 'summarize',
    description: 'Summarize recent channel messages',
    options: [ { name: 'count', description: 'Number of messages (max 100, default 30)', type: 4, required: false } ]
  },
  {
    name: 'translate',
    description: 'Translate text to a target language',
    options: [ { name: 'text', description: 'Text to translate', type: 3, required: true }, { name: 'target', description: 'Target language (e.g. en, id, fr)', type: 3, required: true } ]
  },
  {
    name: 'help',
    description: 'Show help (ephemeral)'
  },
  {
    name: 'meme',
    description: 'Send a random meme image (optionally search topic)',
    options: [
      { name: 'query', description: 'Optional topic / keyword to search', type: 3, required: false }
    ]
  },
  {
    name: 'ytwatch',
    description: 'Manage YouTube notifications (Manage Server required)',
    options: [
      { name: 'action', description: 'Action to perform (enable, disable, addchannel, etc.)', type:3, required:false },
      { name: 'channel_id', description: 'YouTube channel ID for add/remove', type:3, required:false },
      { name: 'discord_channel', description: 'Discord channel to announce in', type:7, required:false },
      { name: 'role', description: 'Role to mention', type:8, required:false },
      { name: 'seconds', description: 'Polling interval seconds (>=30)', type:4, required:false },
      { name: 'template', description: 'Message template for template actions', type:3, required:false }
    ]
  },
  {
    name: 'ytstats',
    description: 'Show YouTube watcher cache & quota stats'
  },
  {
    name: 'ytdebug',
    description: 'Show recent YouTube watcher debug events (Manage Server)'
  },
  {
    name: 'twitchstats',
    description: 'Show Twitch watcher statistics'
  },
  {
    name: 'twitchdebug',
    description: 'Show recent Twitch watcher debug events (Manage Server)'
  },
  {
    name: 'role',
    description: 'Manage self-assignable roles',
    options: [
      {
        name: 'list',
        description: 'List all available self-assignable roles',
        type: 1 // SUB_COMMAND
      },
      {
        name: 'add',
        description: 'Add a role to yourself or another user',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'role',
            description: 'Name of the role to add',
            type: 3, // STRING
            required: true
          },
          {
            name: 'user',
            description: 'User to add the role to (defaults to yourself)',
            type: 6, // USER
            required: false
          }
        ]
      },
      {
        name: 'menu',
        description: 'Show an interactive role selection menu',
        type: 1 // SUB_COMMAND
      },
      {
        name: 'remove',
        description: 'Remove a role from yourself or another user',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'role',
            description: 'Name of the role to remove',
            type: 3, // STRING
            required: true
          },
          {
            name: 'user',
            description: 'User to remove the role from (defaults to yourself)',
            type: 6, // USER
            required: false
          }
        ]
      },
      {
        name: 'setup',
        description: 'Configure self-assignable roles (Manage Roles required)',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'action',
            description: 'Action to perform',
            type: 3, // STRING
            required: true,
            choices: [
              { name: 'Add Role', value: 'add' },
              { name: 'Remove Role', value: 'remove' },
              { name: 'List Configuration', value: 'list' }
            ]
          },
          {
            name: 'role',
            description: 'Role to configure (required for add/remove)',
            type: 8, // ROLE
            required: false
          },
          {
            name: 'command_name',
            description: 'Command name to group roles under (default: roles)',
            type: 3, // STRING
            required: false
          },
          {
            name: 'type',
            description: 'How the role should behave',
            type: 3, // STRING
            required: false,
            choices: [
              { name: 'Toggle (Add/Remove)', value: 'toggle' },
              { name: 'Add Only', value: 'add_only' },
              { name: 'Remove Only', value: 'remove_only' }
            ]
          },
          {
            name: 'channel',
            description: 'Channel where this role command can be used (optional)',
            type: 7, // CHANNEL
            required: false
          }
        ]
      },
      {
        name: 'toggle',
        description: 'Enable/disable a role command (Manage Roles required)',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'command_name',
            description: 'Name of the role command to toggle',
            type: 3, // STRING
            required: true
          }
        ]
      }
    ]
  },
  {
    name: 'xp',
    description: 'XP and leveling commands',
    options: [
      {
        name: 'check',
        description: 'Check your or another user\'s XP and level',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'user',
            description: 'User to check (defaults to yourself)',
            type: 6, // USER
            required: false
          }
        ]
      },
      {
        name: 'leaderboard',
        description: 'Show the XP leaderboard for this server',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'limit',
            description: 'Number of users to show (default: 10, max: 25)',
            type: 4, // INTEGER
            required: false,
            min_value: 1,
            max_value: 25
          }
        ]
      }
    ]
  },
  {
    name: 'xpadmin',
    description: 'XP administration commands (Manage Server required)',
    options: [
      {
        name: 'give',
        description: 'Give XP to a user',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'user',
            description: 'User to give XP to',
            type: 6, // USER
            required: true
          },
          {
            name: 'amount',
            description: 'Amount of XP to give',
            type: 4, // INTEGER
            required: true,
            min_value: 1,
            max_value: 10000
          },
          {
            name: 'reason',
            description: 'Reason for giving XP',
            type: 3, // STRING
            required: false
          }
        ]
      },
      {
        name: 'remove',
        description: 'Remove XP from a user',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'user',
            description: 'User to remove XP from',
            type: 6, // USER
            required: true
          },
          {
            name: 'amount',
            description: 'Amount of XP to remove',
            type: 4, // INTEGER
            required: true,
            min_value: 1,
            max_value: 10000
          },
          {
            name: 'reason',
            description: 'Reason for removing XP',
            type: 3, // STRING
            required: false
          }
        ]
      },
      {
        name: 'reset',
        description: 'Reset a user\'s XP and level',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'user',
            description: 'User to reset XP for',
            type: 6, // USER
            required: true
          },
          {
            name: 'confirm',
            description: 'Type "CONFIRM" to confirm the reset',
            type: 3, // STRING
            required: true
          }
        ]
      },
      {
        name: 'set',
        description: 'Set a user\'s XP to a specific amount',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'user',
            description: 'User to set XP for',
            type: 6, // USER
            required: true
          },
          {
            name: 'amount',
            description: 'XP amount to set',
            type: 4, // INTEGER
            required: true,
            min_value: 0,
            max_value: 100000
          },
          {
            name: 'reason',
            description: 'Reason for setting XP',
            type: 3, // STRING
            required: false
          }
        ]
      }
    ]
  },
  {
    name: 'level',
    description: 'Quick command to check your level and XP'
  },
  {
    name: 'rank',
    description: 'Check your rank on the leaderboard',
    options: [
      {
        name: 'user',
        description: 'User to check rank for (defaults to yourself)',
        type: 6, // USER
        required: false
      }
    ]
  },
  {
    name: 'scheduler',
    description: 'Manage scheduled messages',
    options: [
      {
        name: 'list',
        description: 'List all scheduled messages',
        type: 1 // SUB_COMMAND
      },
      {
        name: 'info',
        description: 'View detailed info for a scheduled message',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'id',
            description: 'ID of the scheduled message',
            type: 4, // INTEGER
            required: true
          }
        ]
      },
      {
        name: 'enable',
        description: 'Enable a scheduled message',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'id',
            description: 'ID of the scheduled message',
            type: 4, // INTEGER
            required: true
          }
        ]
      },
      {
        name: 'disable',
        description: 'Disable a scheduled message',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'id',
            description: 'ID of the scheduled message',
            type: 4, // INTEGER
            required: true
          }
        ]
      },
      {
        name: 'run',
        description: 'Manually trigger a scheduled message now',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'id',
            description: 'ID of the scheduled message',
            type: 4, // INTEGER
            required: true
          }
        ]
      }
    ]
  },
  {
    name: 'automod',
    description: 'Manage automod rules',
    options: [
      {
        name: 'list',
        description: 'Show all configured automod rules',
        type: 1 // SUB_COMMAND
      },
      {
        name: 'info',
        description: 'View detailed info for an automod rule',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'id',
            description: 'ID of the automod rule',
            type: 4, // INTEGER
            required: true
          }
        ]
      },
      {
        name: 'toggle',
        description: 'Enable/disable an automod rule',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'id',
            description: 'ID of the automod rule',
            type: 4, // INTEGER
            required: true
          },
          {
            name: 'enabled',
            description: 'Whether to enable or disable the rule',
            type: 5, // BOOLEAN
            required: true
          }
        ]
      }
    ]
  },
  {
    name: 'antiraid',
    description: 'Manage anti-raid protection',
    options: [
      {
        name: 'status',
        description: 'View current anti-raid protection status',
        type: 1 // SUB_COMMAND
      },
      {
        name: 'toggle',
        description: 'Enable/disable anti-raid protection',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'enabled',
            description: 'Whether to enable or disable anti-raid protection',
            type: 5, // BOOLEAN
            required: true
          }
        ]
      }
    ]
  },
  {
    name: 'welcome',
    description: 'Manage welcome system',
    options: [
      {
        name: 'preview',
        description: 'Preview current welcome message configuration',
        type: 1 // SUB_COMMAND
      },
      {
        name: 'toggle',
        description: 'Enable/disable welcome system',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'enabled',
            description: 'Whether to enable or disable the welcome system',
            type: 5, // BOOLEAN
            required: true
          }
        ]
      }
    ]
  },
  {
    name: 'moderation',
    description: 'Moderation commands',
    options: [
      {
        name: 'ban',
        description: 'Ban a user',
        type: 1, // SUB_COMMAND
        options: [
          { name: 'user', description: 'User to ban', type: 6, required: true },
          { name: 'reason', description: 'Reason', type: 3, required: false },
          { name: 'del_days', description: 'Delete message history (0-7 days)', type: 4, required: false, min_value: 0, max_value: 7 }
        ]
      },
      {
        name: 'unban',
        description: 'Unban a user by ID',
        type: 1, // SUB_COMMAND
        options: [
          { name: 'user_id', description: 'User ID to unban', type: 3, required: true },
          { name: 'reason', description: 'Reason', type: 3, required: false }
        ]
      },
      {
        name: 'kick',
        description: 'Kick a user',
        type: 1, // SUB_COMMAND
        options: [
          { name: 'user', description: 'User to kick', type: 6, required: true },
          { name: 'reason', description: 'Reason', type: 3, required: false }
        ]
      },
      {
        name: 'mute',
        description: 'Timeout (mute) a user',
        type: 1, // SUB_COMMAND
        options: [
          { name: 'user', description: 'User to mute', type: 6, required: true },
          { name: 'duration', description: 'Duration (e.g., 10m, 2h, 1d)', type: 3, required: true },
          { name: 'reason', description: 'Reason', type: 3, required: false }
        ]
      },
      {
        name: 'unmute',
        description: 'Remove timeout (unmute) a user',
        type: 1, // SUB_COMMAND
        options: [
          { name: 'user', description: 'User to unmute', type: 6, required: true },
          { name: 'reason', description: 'Reason', type: 3, required: false }
        ]
      },
      {
        name: 'slowmode',
        description: 'Set channel slowmode',
        type: 1, // SUB_COMMAND
        options: [
          { name: 'seconds', description: 'Seconds between messages (0-21600)', type: 4, required: true, min_value: 0, max_value: 21600 },
          { name: 'channel', description: 'Channel to apply slowmode to', type: 7, required: false },
          { name: 'reason', description: 'Reason', type: 3, required: false }
        ]
      }
    ]
  },
  {
    name: 'audit',
    description: 'View audit logs and moderation history',
    options: [
      {
        name: 'recent',
        description: 'View recent moderation actions',
        type: 1 // SUB_COMMAND
      },
      {
        name: 'search',
        description: 'Search audit logs by user or action type',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'user',
            description: 'User to search logs for',
            type: 6, // USER
            required: false
          },
          {
            name: 'action',
            description: 'Action type to filter by',
            type: 3, // STRING
            required: false,
            choices: [
              { name: 'Message Delete', value: 'messageDelete' },
              { name: 'Message Edit', value: 'messageUpdate' },
              { name: 'Member Join', value: 'guildMemberAdd' },
              { name: 'Member Leave', value: 'guildMemberRemove' },
              { name: 'Ban', value: 'guildBanAdd' },
              { name: 'Unban', value: 'guildBanRemove' },
              { name: 'Role Changes', value: 'guildMemberUpdate' },
              { name: 'Channel Changes', value: 'channelUpdate' }
            ]
          },
          {
            name: 'limit',
            description: 'Number of results to show (max 25)',
            type: 4, // INTEGER
            required: false,
            min_value: 1,
            max_value: 25
          }
        ]
      },
      {
        name: 'stats',
        description: 'View audit log statistics',
        type: 1 // SUB_COMMAND
      }
    ]
  },
  {
    name: 'coc',
    description: 'Clash of Clans information and commands',
    options: [
      {
        name: 'clan',
        description: 'Get clan information',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'tag',
            description: 'Clan tag (e.g., #2Y0YRGG0)',
            type: 3, // STRING
            required: true
          }
        ]
      },
      {
        name: 'player',
        description: 'Get player information',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'tag',
            description: 'Player tag (e.g., #ABC123)',
            type: 3, // STRING
            required: true
          }
        ]
      },
      {
        name: 'war',
        description: 'Get current war information',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'tag',
            description: 'Clan tag (e.g., #2Y0YRGG0)',
            type: 3, // STRING
            required: true
          }
        ]
      },
      {
        name: 'search',
        description: 'Search for clans',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'name',
            description: 'Clan name to search for',
            type: 3, // STRING
            required: true
          },
          {
            name: 'limit',
            description: 'Number of results (1-20)',
            type: 4, // INTEGER
            required: false,
            min_value: 1,
            max_value: 20
          }
        ]
      },
      {
        name: 'playersearch',
        description: 'Search for players',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'name',
            description: 'Player name to search for',
            type: 3, // STRING
            required: true
          },
          {
            name: 'limit',
            description: 'Number of results (1-20)',
            type: 4, // INTEGER
            required: false,
            min_value: 1,
            max_value: 20
          }
        ]
      },
      {
        name: 'compare',
        description: 'Compare two players',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'player1',
            description: 'First player tag (e.g., #ABC123)',
            type: 3, // STRING
            required: true
          },
          {
            name: 'player2',
            description: 'Second player tag (e.g., #DEF456)',
            type: 3, // STRING
            required: true
          }
        ]
      },
      {
        name: 'attacks',
        description: 'Show remaining war attacks',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'tag',
            description: 'Clan tag (e.g., #2Y0YRGG0)',
            type: 3, // STRING
            required: true
          }
        ]
      },
      {
        name: 'top',
        description: 'Show top players in clan',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'tag',
            description: 'Clan tag (e.g., #2Y0YRGG0)',
            type: 3, // STRING
            required: true
          },
          {
            name: 'category',
            description: 'What to rank by',
            type: 3, // STRING
            required: false,
            choices: [
              { name: 'Trophies', value: 'trophies' },
              { name: 'Donations', value: 'donations' },
              { name: 'Donations Received', value: 'received' },
              { name: 'Level', value: 'level' }
            ]
          }
        ]
      },
      {
        name: 'stats',
        description: 'Show detailed player statistics',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'tag',
            description: 'Player tag (e.g., #ABC123)',
            type: 3, // STRING
            required: true
          }
        ]
      },
      {
        name: 'warlog',
        description: 'Show recent war history',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'tag',
            description: 'Clan tag (e.g., #2Y0YRGG0)',
            type: 3, // STRING
            required: true
          },
          {
            name: 'limit',
            description: 'Number of wars to show (1-10)',
            type: 4, // INTEGER
            required: false,
            min_value: 1,
            max_value: 10
          }
        ]
      },
      {
        name: 'watch',
        description: 'Add clan to monitoring (Admin only)',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'tag',
            description: 'Clan tag (e.g., #2Y0YRGG0)',
            type: 3, // STRING
            required: true
          }
        ]
      },
      {
        name: 'unwatch',
        description: 'Remove clan from monitoring (Admin only)',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'tag',
            description: 'Clan tag (e.g., #2Y0YRGG0)',
            type: 3, // STRING
            required: true
          }
        ]
      },
      {
        name: 'config',
        description: 'Show COC configuration (Admin only)',
        type: 1 // SUB_COMMAND
      },
      {
        name: 'leaderboard',
        description: 'Generate donation leaderboard for a clan',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'tag',
            description: 'Clan tag (e.g., #2Y0YRGG0)',
            type: 3, // STRING
            required: true
          }
        ]
      }
    ]
  },
  {
    name: 'cocdebug',
    description: 'Show COC watcher debug events and statistics (Manage Server)'
  },
  {
    name: 'Explain Image',
    type: 3 // MESSAGE context menu
  },
  {
    name: 'Summarize',
    type: 3 // MESSAGE context menu
  },
  {
    name: 'Translate',
    type: 3 // MESSAGE context menu
  }
];

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    const guildIds = await getAllGuildIds();
    
    if (guildIds.length === 0) {
      console.log('No guilds found in database. Consider running register-commands-global.js instead.');
      process.exit(1);
    }
    
    console.log(`Found ${guildIds.length} guild(s) in database. Registering commands for all of them...`);
    
    let successCount = 0;
    let failCount = 0;
    
    for (const guildId of guildIds) {
      try {
        console.log(`Registering commands for guild: ${guildId}`);
        
        await rest.put(
          Routes.applicationGuildCommands(clientId, guildId),
          { body: commands }
        );
        
        console.log(`✅ Successfully registered commands for guild ${guildId}`);
        successCount++;
      } catch (error) {
        console.error(`❌ Failed to register commands for guild ${guildId}:`, error.message);
        if (error.status === 403) {
          console.error('   Bot might not be in that guild or lacks permissions.');
        }
        failCount++;
      }
    }
    
    console.log(`\n📊 Registration Summary:`);
    console.log(`   ✅ Successful: ${successCount} guild(s)`);
    console.log(`   ❌ Failed: ${failCount} guild(s)`);
    console.log(`\nCommands should be available immediately in successful guilds.`);
    
  } catch (error) {
    console.error('Failed to fetch guild IDs or register commands:', error);
    process.exit(1);
  }
})();
