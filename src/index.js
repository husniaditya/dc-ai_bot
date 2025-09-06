const { Client, GatewayIntentBits, Partials, ActivityType, PermissionsBitField } = require('discord.js');
const express = require('express');
const { createApiServer } = require('./api/server');
// Use built-in global fetch (Node 18+) to avoid ESM require issues
const fetchFn = (...args) => globalThis.fetch(...args);
require('dotenv').config();
const { askGemini, explainImage } = require('./utils/ai-client');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { sendLongReply, buildImageEmbedResponse } = require('./utils/util');
const { getConversationStore } = require('./utils/state');
// dynamic command collection
const commandMap = new Map();
const startTimestamp = Date.now();
function loadCommands(client){
  const dir = path.join(__dirname, 'bot/commands');
  for (const file of fs.readdirSync(dir)){
    if (!file.endsWith('.js')) continue;
    const full = path.join(dir, file);
    const mod = require(full);
    try {
      if (typeof mod === 'function') {
        let instantiated;
        if (file === 'uptime.js') instantiated = mod(startTimestamp); // uptime needs timestamp
        else if (file === 'remind.js') instantiated = mod(client); // remind needs client for DM fallback
        else instantiated = mod(client); // default attempt
        if (instantiated && instantiated.name && instantiated.execute) {
          commandMap.set(instantiated.name, instantiated);
          continue;
        }
      }
      if (mod && mod.name && mod.execute) commandMap.set(mod.name, mod);
    } catch (e) {
      console.error('Failed loading command', file, e.message);
    }
  }
}

// Load event handlers
function loadEvents(client, store, commandMap, startTimestamp) {
  if (process.env.DEBUG_PERSONALIZATION === '1') {
    console.log(`[EVENT DEBUG] Loading events for client: ${client.user?.tag || 'not ready'}`);
  }
  const eventsDir = path.join(__dirname, 'bot/events');
  if (!fs.existsSync(eventsDir)) {
    console.warn('Events directory not found:', eventsDir);
    return;
  }
  
  for (const file of fs.readdirSync(eventsDir)) {
    if (!file.endsWith('.js')) continue;
    
    try {
      const eventHandler = require(path.join(eventsDir, file));
      if (typeof eventHandler === 'function') {
        // Call the setup function with required parameters
        if (process.env.DEBUG_PERSONALIZATION === '1') {
            console.log(`[EVENT DEBUG] Loading event: ${file.replace('.js', '')}`);
        }
        eventHandler(client, store, startTimestamp, commandMap);
        if (process.env.DEBUG_PERSONALIZATION === '1') {
            console.log(`[EVENT DEBUG] Loaded event: ${file.replace('.js', '')}`);
        }
      }
    } catch (e) {
      console.error('Failed loading event', file, e.message);
    }
  }
}

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.log('No DISCORD_TOKEN found. Exiting.');
  process.exit(0);
}

// Intents: make privileged intents optional (to avoid 'Disallowed intents' login error)
const enableAutoReply = process.env.AUTOREPLY_ENABLED === '1';
const intents = [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMessageReactions];
// Message Content intent (privileged) – required for reading message text for auto-replies & AI commands
if (process.env.ENABLE_MESSAGE_CONTENT !== '0') intents.push(GatewayIntentBits.MessageContent);
// Guild Members intent (privileged) – required for welcome join tracking & some member operations
if (process.env.ENABLE_GUILD_MEMBERS === '1' || process.env.ENABLE_WELCOME === '1') intents.push(GatewayIntentBits.GuildMembers);
const client = new Client({ intents, partials:[Partials.Channel, Partials.Message, Partials.Reaction] });
// Expose globally for services needing client (scheduler hooks)
global.discordClient = client;
loadCommands(client);

const store = require('./config/store');
const persistenceModeRef = { mode:null };
store.persistenceModeRef = persistenceModeRef;
// Initialize scheduler service (moved into services folder)
const { initScheduler } = require('./config/store/services/schedulerService');

// Initialize database before starting API server
async function initializeApp() {
  try {
    const mode = await store.initPersistence();
    persistenceModeRef.mode = mode; 
    store.persistenceModeRef.mode = mode;
    console.log('Persistence mode:', mode);
    
    // Create and start the API server AFTER database is ready
    const app = createApiServer(client, store, commandMap, startTimestamp);
    const DASHBOARD_PORT = process.env.DASHBOARD_PORT || 3001;
    app.listen(DASHBOARD_PORT, () => console.log('Dashboard API listening on :' + DASHBOARD_PORT));
  } catch (error) {
    console.error('Failed to initialize database:', error);
    // Still start API server with in-memory fallback
    const app = createApiServer(client, store, commandMap, startTimestamp);
    const DASHBOARD_PORT = process.env.DASHBOARD_PORT || 3001;
    app.listen(DASHBOARD_PORT, () => console.log('Dashboard API listening on :' + DASHBOARD_PORT + ' (in-memory mode)'));
  }
}

// Start initialization
initializeApp();

// Load events (including ready event that starts YouTube/Twitch watchers)
loadEvents(client, store, commandMap, startTimestamp);

// Start scheduler (after events so ready listener in scheduler can attach)
initScheduler(client);

// Fallback ready event if no ready.js event file exists
client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.login(token).catch(err => {
  if (String(err).includes('Disallowed intents') || String(err).includes('Used disallowed intents')) {
    console.error('Failed to login due to disallowed intents. Adjusting to safe intents and retrying...');
    // Remove privileged intents and retry once
    try { client.destroy(); } catch {}
    const safeIntents = [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMessageReactions];
    const safeClient = new Client({ intents: safeIntents, partials:[Partials.Channel, Partials.Message, Partials.Reaction] });
    loadCommands(safeClient);
    loadEvents(safeClient, store, commandMap, startTimestamp);
    // Re-bind minimal events needed
    safeClient.once('ready', () => {
      console.warn('Logged in with reduced intents (welcome & content-dependent features disabled). Enable intents in Developer Portal for full features.');
    });
    safeClient.login(token).catch(e2 => { console.error('Retry login failed:', e2); process.exit(1); });
  } else {
    console.error('Failed to login:', err);
    process.exit(1);
  }
});
