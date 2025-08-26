const { REST, Routes } = require('discord.js');
require('dotenv').config();

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID; // use a guild for faster registration during development

if (!token || !clientId || !guildId) {
  console.error('Missing one of DISCORD_TOKEN, CLIENT_ID, or GUILD_ID in environment. See .env.example.');
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
      { name: 'action', description: 'enable|disable|addchannel|removechannel|announcechannel|mentionrole|interval|status', type:3, required:false },
      { name: 'channel_id', description: 'YouTube channel ID for add/remove', type:3, required:false },
      { name: 'discord_channel', description: 'Discord channel to announce in', type:7, required:false },
      { name: 'role', description: 'Role to mention', type:8, required:false },
      { name: 'seconds', description: 'Polling interval seconds (>=30)', type:4, required:false }
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
    console.log('Registering application (/) commands for guild:', guildId);
    await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      { body: commands }
    );
    console.log('Successfully registered guild commands.');
  } catch (error) {
    console.error('Failed to register commands:', error);
    process.exit(1);
  }
})();
