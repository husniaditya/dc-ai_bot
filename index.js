const { Client, GatewayIntentBits, Partials } = require('discord.js');
require('dotenv').config();
const { askGemini, explainImage } = require('./ai-client');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { sendLongReply, buildImageEmbedResponse } = require('./util');
const { getConversationStore } = require('./state');
// dynamic command collection
const commandMap = new Map();
const startTimestamp = Date.now();
function loadCommands(client){
  const dir = path.join(__dirname, 'commands');
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

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.log('No DISCORD_TOKEN found. Exiting.');
  process.exit(0);
}

// Intents: Guilds for slash commands. Message content intent only if you enabled it in the Developer Portal.
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages], partials:[Partials.Channel, Partials.Message] });
loadCommands(client);

// Poll handler will come from commands/poll if present
const pollModule = commandMap.get('poll');

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// Message context menu: Explain Image (must be after client is created)
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isMessageContextMenuCommand || interaction.commandName !== 'Explain Image') return;
  const msg = interaction.targetMessage;
  let imgAtt = null;
  if (msg.attachments && msg.attachments.size) {
    imgAtt = Array.from(msg.attachments.values()).find(att => (att.contentType && att.contentType.startsWith('image/')) || /\.(png|jpe?g|gif)$/i.test(att.url));
  }
  if (!imgAtt) {
    await interaction.reply({ content: 'No image found in the selected message.', flags: 64 });
    return;
  }
  await interaction.deferReply();
  try {
    const explanation = await explainImage(imgAtt.url);
    // (Re)upload image so it appears with bot message
    let fileBuffer = null;
    let filename = 'image';
    try {
      const resp = await axios.get(imgAtt.url, { responseType: 'arraybuffer' });
      fileBuffer = Buffer.from(resp.data);
      if (fileBuffer.length > 7_500_000) fileBuffer = null; // skip very large files (> ~7.5MB)
      const extMatch = imgAtt.url.split('?')[0].match(/\.([a-zA-Z0-9]{3,5})$/);
      if (extMatch) filename += '.' + extMatch[1].toLowerCase(); else filename += '.png';
    } catch (e) {
      console.warn('Could not fetch image for re-upload, falling back to embed URL');
    }
    const chunks = [];
    let remaining = explanation || '';
    const MAX_EMBED_DESC = 4000;
    while (remaining.length > 0) { chunks.push(remaining.slice(0, MAX_EMBED_DESC)); remaining = remaining.slice(MAX_EMBED_DESC); }
    const first = chunks.shift() || 'No explanation.';
    const embedImageRef = fileBuffer ? { url: `attachment://${filename}` } : { url: imgAtt.url };
    await interaction.editReply({
      embeds: [{ title: 'Image Explanation', description: first, image: embedImageRef, color: 0x5865F2 }],
      files: fileBuffer ? [{ attachment: fileBuffer, name: filename }] : []
    });
    for (const part of chunks) await interaction.followUp({ content: part });
  } catch (e) {
    console.error('Image explain failed (context menu)', e);
    await interaction.editReply({ content: 'Image explain failed.', flags: 64 });
  }
});

client.on('interactionCreate', async (interaction) => {
  if (interaction.isChatInputCommand()){
    const cmd = commandMap.get(interaction.commandName);
    if (!cmd) return interaction.reply({ content: 'Unknown command (not loaded).', ephemeral: true });
    try { await cmd.execute(interaction, client); } catch (e){
      console.error('Command error', interaction.commandName, e);
      if (interaction.deferred || interaction.replied) { try { await interaction.editReply('Command failed.'); } catch {} }
      else { try { await interaction.reply({ content:'Command failed.', ephemeral:true }); } catch {} }
    }
  } else if (interaction.isStringSelectMenu() && interaction.customId==='help_select') {
    const value = interaction.values[0];
    // re-use help command categories from module
    const help = commandMap.get('help');
    const categories = {
      core: '**Core**\n/ping\n/whoami\n/uptime\n/echo <text>\n/help',
      ai: '**AI**\n/ask\n/askfollow\n/explain_image (1-3 images)\n/summarize [count]\n/translate text target',
      polls: '**Polls**\n/poll create question options\n/poll results id',
      util: '**Utilities**\n/user info [target]\n/math add|sub|mul|div a b\n/remind minutes text',
      notes: '**Notes**\nOutputs chunked. Images >8MB skipped. Data in-memory.'
    };
    await interaction.update({ embeds:[{ title:'Help', description: categories[value] || 'Unknown', color:0x5865F2 }] });
  }
});

client.on('interactionCreate', async (interaction) => {
  if (interaction.isButton()){
    if (pollModule && pollModule.handleButton){
      try { await pollModule.handleButton(interaction, client); } catch(e){ console.error('Poll button error', e); }
    }
  }
});

client.login(token).catch(err => { console.error('Failed to login:', err); process.exit(1); });
