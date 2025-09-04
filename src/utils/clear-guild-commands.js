const { REST, Routes } = require('discord.js');
const path = require('path');

// Load .env from the root directory
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = '935480450707759165';

if (!token || !clientId) {
  console.error('Missing DISCORD_TOKEN or CLIENT_ID in environment.');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    console.log('Clearing guild-specific commands to remove duplicates...');
    
    await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      { body: [] }
    );
    
    console.log('✅ Successfully cleared guild-specific commands.');
    console.log('Global commands should now be the only ones visible (may take a few minutes to update).');
    
  } catch (error) {
    console.error('Failed to clear guild commands:', error);
  }
})();
