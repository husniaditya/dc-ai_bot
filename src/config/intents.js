const { GatewayIntentBits } = require('discord.js');

const DEFAULT_INTENTS = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.GuildMessageReactions
];

const PRIVILEGED_INTENTS = [
  GatewayIntentBits.MessageContent,
  GatewayIntentBits.GuildMembers
];

function getIntents() {
  const intents = [...DEFAULT_INTENTS];
  
  // Message Content intent (privileged) – required for reading message text for auto-replies & AI commands
  if (process.env.ENABLE_MESSAGE_CONTENT !== '0') {
    intents.push(GatewayIntentBits.MessageContent);
  }
  
  // Guild Members intent (privileged) – required for welcome join tracking & some member operations
  if (process.env.ENABLE_GUILD_MEMBERS === '1' || process.env.ENABLE_WELCOME === '1') {
    intents.push(GatewayIntentBits.GuildMembers);
  }
  
  return intents;
}

function getSafeIntents() {
  return [...DEFAULT_INTENTS];
}

module.exports = {
  DEFAULT_INTENTS,
  PRIVILEGED_INTENTS,
  getIntents,
  getSafeIntents
};
