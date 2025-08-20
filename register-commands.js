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
      { name: 'create', description: 'Create a poll', type: 1, options: [ { name: 'question', description: 'Poll question', type: 3, required: true }, { name: 'options', description: 'Comma-separated options (max 5)', type: 3, required: true } ] }
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
    name: 'help',
    description: 'Show help (ephemeral)'
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
