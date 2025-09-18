const { Client, GatewayIntentBits, Partials, ActivityType, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Import intents configuration
const { getIntents } = require('../config/intents');

// Event handlers
const readyHandler = require('./events/ready');
const guildMemberAddHandler = require('./events/guildMemberAdd');
const interactionCreateHandler = require('./events/interactionCreate');
const messageCreateHandler = require('./events/messageCreate');
const messageReactionAddHandler = require('./events/messageReactionAdd');
const messageReactionRemoveHandler = require('./events/messageReactionRemove');
const voiceStateUpdateHandler = require('./events/voiceStateUpdate');
const setupAuditLoggingEvents = require('./events/auditLogging');

// Services
const { startYouTubeWatcher } = require('./services/youtube');
const { startTwitchWatcher } = require('./services/twitch');

function createDiscordClient(store, startTimestamp) {
  const token = process.env.DISCORD_TOKEN;
  if (!token) {
    console.log('No DISCORD_TOKEN found. Exiting.');
    process.exit(0);
  }

  // Use intents from the centralized configuration
  const intents = getIntents();

  const client = new Client({ 
    intents, 
    partials: [Partials.Channel, Partials.Message, Partials.Reaction] 
  });

  // Increase max listeners to prevent warning (we have multiple legitimate event handlers)
  client.setMaxListeners(20);

  // Load commands dynamically
  const commandMap = loadCommands(client, startTimestamp);

  // Set up event handlers
  readyHandler(client, store, startTimestamp, commandMap);
  guildMemberAddHandler(client, store);
  interactionCreateHandler(client, store, startTimestamp, commandMap);
  messageCreateHandler(client, store);
  messageReactionAddHandler(client, store);
  messageReactionRemoveHandler(client, store);
  voiceStateUpdateHandler(client, store);
  setupAuditLoggingEvents(client, store);

  // Login with error handling
  client.login(token).catch(err => {
    if (String(err).includes('Disallowed intents') || String(err).includes('Used disallowed intents')) {
      console.error('Failed to login due to disallowed intents. Adjusting to safe intents and retrying...');
      // Remove privileged intents and retry once
      try { client.destroy(); } catch {}
      
      const safeIntents = [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.GuildMessageReactions
      ];
      const safeClient = new Client({ 
        intents: safeIntents, 
        partials: [Partials.Channel, Partials.Message, Partials.Reaction] 
      });
      
      const safeCommandMap = loadCommands(safeClient, startTimestamp);
      
      // Re-bind minimal events needed
      safeClient.once('ready', () => {
        console.warn('Logged in with reduced intents (welcome, presence & content-dependent features disabled). Enable intents in Developer Portal for full features.');
      });
      
      safeClient.login(token).catch(e2 => { 
        console.error('Retry login failed:', e2); 
        process.exit(1); 
      });
      
      return { client: safeClient, commandMap: safeCommandMap };
    } else {
      console.error('Failed to login:', err);
      process.exit(1);
    }
  });

  return { client, commandMap };
}

function loadCommands(client, startTimestamp) {
  const commandMap = new Map();
  const dir = path.join(__dirname, 'commands');
  
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.js')) continue;
    
    const full = path.join(dir, file);
    const mod = require(full);
    
    try {
      if (typeof mod === 'function') {
        let instantiated;
        if (file === 'uptime.js') {
          instantiated = mod(startTimestamp); // uptime needs timestamp
        } else if (file === 'remind.js') {
          instantiated = mod(client); // remind needs client for DM fallback
        } else {
          instantiated = mod(client); // default attempt
        }
        
        if (instantiated && instantiated.name && instantiated.execute) {
          commandMap.set(instantiated.name, instantiated);
          continue;
        }
      }
      
      if (mod && mod.name && mod.execute) {
        commandMap.set(mod.name, mod);
      }
    } catch (e) {
      console.error('Failed loading command', file, e.message);
    }
  }
  
  return commandMap;
}

module.exports = { createDiscordClient };
