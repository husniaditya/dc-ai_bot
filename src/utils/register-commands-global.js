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
    console.log('Started refreshing application (/) commands globally...');

    await rest.put(
      Routes.applicationCommands(clientId),
      { body: commands }
    );

    console.log('Successfully reloaded application (/) commands globally.');
    console.log('Note: Global commands may take up to 1 hour to update in all guilds.');
    console.log('For immediate testing, consider using register-commands.js for specific guilds.');
    
  } catch (error) {
    console.error('Failed to register global commands:', error);
  }
})();
