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

// Message context menus: Explain Image, Summarize
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isMessageContextMenuCommand()) return;
  if (interaction.commandName === 'Explain Image') {
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
      let fileBuffer = null;
      let filename = 'image';
      try {
        const resp = await axios.get(imgAtt.url, { responseType: 'arraybuffer' });
        fileBuffer = Buffer.from(resp.data);
        if (fileBuffer.length > 7_500_000) fileBuffer = null;
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
  } else if (interaction.commandName === 'Summarize') {
    await interaction.deferReply();
    try {
      const target = interaction.targetMessage;
      const channel = target.channel;
      const [before, after] = await Promise.all([
        channel.messages.fetch({ before: target.id, limit: 35 }).catch(()=>new Map()),
        channel.messages.fetch({ after: target.id, limit: 35 }).catch(()=>new Map())
      ]);
      const combined = [...before.values(), target, ...after.values()]
        .filter(m => !m.author.bot)
        .sort((a,b)=>a.createdTimestamp - b.createdTimestamp);
      function isNoise(content){
        const c = (content||'').trim();
        if (!c) return true;
        if (c.startsWith('/')) return true;
        if (/^m!\S+/.test(c)) return true;
        if (/^[!./]\w+$/.test(c)) return true;
        if (/^[a-zA-Z]$/.test(c)) return true;
        if (/^\w{1,3}$/i.test(c) && !/^(yes|no|ok)$/i.test(c)) return true;
        if (c.length <= 2) return true;
        return false;
      }
      const filtered = combined.filter(m => !isNoise(m.cleanContent));
      const targetIdx = filtered.findIndex(m=>m.id===target.id);
      const windowMsgs = filtered.slice(Math.max(0,targetIdx-15), targetIdx+16);
      const noiseCount = combined.length - filtered.length;
      const convo = windowMsgs.map(m => `${m.author.username}: ${m.cleanContent}`)
        .join('\n')
        .slice(0, 7000);
      if (!convo) { await interaction.editReply('Not enough meaningful content to summarize.'); return; }
      const numbered = process.env.SUMMARY_NUMBER_SECTIONS === '1';
      const prompt = numbered
        ? `Summarize this Discord chat excerpt around a highlighted message. Provide:\n1. Overview (1 sentence)\n2. Key Points (bulleted)\n3. Action Items (bulleted or 'None')\nDo not invent facts. If it's mostly a single creative post, capture tone and content succinctly. NoiseFiltered: ${noiseCount}\nCHAT:\n${convo}`
        : `Summarize this Discord chat excerpt around a highlighted message. Provide the following sections (without numbering):\nOverview: one concise sentence.\nKey Points: bullet list (use - ).\nAction Items: bullet list or 'None'.\nDo not invent facts. If it's mostly a single creative post, capture tone and content succinctly. NoiseFiltered: ${noiseCount}\nCHAT:\n${convo}`;
      const { askGemini } = require('./ai-client');
      const { formatAIOutput } = require('./util');
      const resp = await askGemini(prompt, { maxOutputTokens: 260 });
      const summary = formatAIOutput(resp.text || 'No summary');
      await sendLongReply(interaction, summary);
    } catch(e){
      console.error('Context menu summarize failed', e);
      try { await interaction.editReply({ content: 'Summarization failed.', flags: 64 }); } catch {}
    }
  } else if (interaction.commandName === 'Translate') {
    await interaction.deferReply();
    try {
      const target = interaction.targetMessage;
      const content = (target.cleanContent || '').trim();
      if (!content) { await interaction.editReply('No text content to translate.'); return; }
      // Simple heuristic: let model auto-detect source. Default target language can be English.
      const targetLang = 'ID';
      const prompt = `Detect the language of the following text and translate it into ${targetLang}. Only output the translation text without extra commentary.\n\nText:\n"""${content.slice(0,1500)}"""`;
      const { askGemini } = require('./ai-client');
      const { formatAIOutput } = require('./util');
      const resp = await askGemini(prompt, { maxOutputTokens: 150 });
      const translation = formatAIOutput(resp.text || 'No translation');
      await sendLongReply(interaction, translation);
    } catch (e) {
      console.error('Context menu translate failed', e);
      try { await interaction.editReply({ content: 'Translation failed.', flags: 64 }); } catch {}
    }
  }
});

client.on('interactionCreate', async (interaction) => {
  if (interaction.isChatInputCommand()){
    const cmd = commandMap.get(interaction.commandName);
  if (!cmd) return interaction.reply({ content: 'Unknown command (not loaded).', flags: 64 });
    try { await cmd.execute(interaction, client); } catch (e){
      console.error('Command error', interaction.commandName, e);
      if (interaction.deferred || interaction.replied) { try { await interaction.editReply('Command failed.'); } catch {} }
  else { try { await interaction.reply({ content:'Command failed.', flags:64 }); } catch {} }
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
