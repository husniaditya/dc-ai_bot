const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();
const { askGemini, explainImage } = require('./ai-client');
const axios = require('axios');

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.log('No DISCORD_TOKEN found. Exiting.');
  process.exit(0);
}

// Intents: Guilds for slash commands. Message content intent only if you enabled it in the Developer Portal.
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });
const startTimestamp = Date.now();

const MAX_DISCORD_MESSAGE = 2000;

// Simple in-memory poll storage and button handling (declare early so handlers can use it)
const polls = new Map();

async function sendLongReply(interaction, text) {
  if (!text) return interaction.editReply('');
  // Ensure string
  let s = text.toString();
  if (s.length <= MAX_DISCORD_MESSAGE) {
    return interaction.editReply(s);
  }
  // Split into chunks
  const parts = [];
  while (s.length > 0) {
    parts.push(s.slice(0, MAX_DISCORD_MESSAGE));
    s = s.slice(MAX_DISCORD_MESSAGE);
  }
  // Send first part as editReply (we already deferred)
  await interaction.editReply(parts[0]);
  // Send remaining as followUps
  for (let i = 1; i < parts.length; i++) {
    // small delay to avoid rate limits
    await interaction.followUp({ content: parts[i] });
  }
}

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
  if (!interaction.isChatInputCommand()) return;
  console.log('Received command', interaction.commandName, 'from', interaction.user.tag);
  try {
  switch (interaction.commandName) {
      case 'explain_image': {
        const attachment = interaction.options.getAttachment('image');
        const prompt = interaction.options.getString('prompt');
        if (!attachment) {
          // Fallback legacy behaviour: attempt to use replied message (if any)
          let imageUrl = null;
          let repliedMsg = null;
          if (interaction.message && interaction.message.reference && interaction.message.reference.messageId) {
            try { repliedMsg = await interaction.channel.messages.fetch(interaction.message.reference.messageId); } catch {}
          }
          if (repliedMsg && repliedMsg.attachments && repliedMsg.attachments.size) {
            const imgAtt = Array.from(repliedMsg.attachments.values()).find(att => (att.contentType && att.contentType.startsWith('image/')) || /\.(png|jpe?g|gif)$/i.test(att.url));
            if (imgAtt) imageUrl = imgAtt.url;
          }
          if (!imageUrl) {
            await interaction.reply({ content: 'Attach an image with this command (via the + attachment field) or reply to a message containing an image.', flags: 64 });
            break;
          }
          await interaction.deferReply();
          try {
            const explanation = await explainImage(imageUrl, prompt);
            // Attempt to fetch image for attachment
            let fileBuffer = null; let filename = 'image';
            try {
              const resp = await axios.get(imageUrl, { responseType: 'arraybuffer' });
              fileBuffer = Buffer.from(resp.data);
              if (fileBuffer.length > 7_500_000) fileBuffer = null;
              const extMatch = imageUrl.split('?')[0].match(/\.([a-zA-Z0-9]{3,5})$/); if (extMatch) filename += '.' + extMatch[1].toLowerCase(); else filename += '.png';
            } catch {}
            const chunks = []; let remaining = explanation || ''; const MAX_EMBED_DESC = 4000;
            while (remaining.length > 0) { chunks.push(remaining.slice(0, MAX_EMBED_DESC)); remaining = remaining.slice(MAX_EMBED_DESC); }
            const first = chunks.shift() || 'No explanation.';
            const embedImageRef = fileBuffer ? { url: `attachment://${filename}` } : { url: imageUrl };
            await interaction.editReply({ embeds: [{ title: 'Image Explanation', description: first, image: embedImageRef, color: 0x5865F2 }], files: fileBuffer ? [{ attachment: fileBuffer, name: filename }] : [] });
            for (const part of chunks) await interaction.followUp({ content: part });
          } catch (e) {
            console.error('Image explain failed (fallback)', e);
            const msg = (e && e.message) ? e.message.toString().slice(0, 200) : 'Image explain failed.';
            await interaction.editReply({ content: `Image explain failed: ${msg}`, flags: 64 });
          }
          break;
        }
        // Attachment path
        const url = attachment.url;
        if (!/\.(png|jpe?g|gif|webp)$/i.test(url) && !(attachment.contentType && attachment.contentType.startsWith('image/'))) {
          await interaction.reply({ content: 'Please provide a valid image file (png, jpg, jpeg, gif, webp).', flags: 64 });
          break;
        }
        await interaction.deferReply();
        try {
          const explanation = await explainImage(url, prompt);
          // Re-upload the provided attachment image
          let fileBuffer = null; let filename = 'image';
          try {
            const resp = await axios.get(url, { responseType: 'arraybuffer' });
            fileBuffer = Buffer.from(resp.data);
            if (fileBuffer.length > 7_500_000) fileBuffer = null; // Skip huge
            const extMatch = url.split('?')[0].match(/\.([a-zA-Z0-9]{3,5})$/); if (extMatch) filename += '.' + extMatch[1].toLowerCase(); else filename += '.png';
          } catch {}
          const chunks = []; let remaining = explanation || ''; const MAX_EMBED_DESC = 4000;
          while (remaining.length > 0) { chunks.push(remaining.slice(0, MAX_EMBED_DESC)); remaining = remaining.slice(MAX_EMBED_DESC); }
          const first = chunks.shift() || 'No explanation.';
          const embedImageRef = fileBuffer ? { url: `attachment://${filename}` } : { url };
          await interaction.editReply({ embeds: [{ title: 'Image Explanation', description: first, image: embedImageRef, color: 0x5865F2 }], files: fileBuffer ? [{ attachment: fileBuffer, name: filename }] : [] });
          for (const part of chunks) await interaction.followUp({ content: part });
        } catch (e) {
          console.error('Image explain failed (attachment)', e);
          const msg = (e && e.message) ? e.message.toString().slice(0, 200) : 'Image explain failed.';
          await interaction.editReply({ content: `Image explain failed: ${msg}`, flags: 64 });
        }
        break;
      }
      case 'ping':
        await interaction.reply('Pong!');
        break;
      case 'whoami':
        await interaction.reply(`${interaction.user.tag} (id: ${interaction.user.id})`);
        break;
      case 'uptime': {
        const seconds = Math.floor((Date.now() - startTimestamp) / 1000);
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        await interaction.reply(`Uptime: ${hrs}h ${mins}m ${secs}s`);
        break;
      }
      case 'echo': {
        const text = interaction.options.getString('text') || '';
        await interaction.reply({ content: text, ephemeral: false });
        break;
      }
      case 'help':
        await interaction.reply({
          flags: 64,
          embeds: [
            {
              title: 'Discord AI Bot Help',
              color: 0x5865F2,
              fields: [
                { name: 'Core', value: '/ping\n/whoami\n/uptime\n/echo <text>\n/help', inline: true },
                { name: 'User & Math', value: '/user info [target]\n/math add|sub|mul|div a b', inline: true },
                { name: 'Polls', value: '/poll create question:<q> options:<a,b,c> (2–5 options)\nVotes update live', inline: false },
                { name: 'Reminders', value: '/remind minutes:<n> text:<msg> – DM after n minutes', inline: false },
                { name: 'AI Text', value: '/ask prompt:<question>', inline: true },
                { name: 'Image Explain', value: '/explain_image image:<attachment> [prompt]\nContext menu: Right‑click image → Apps → Explain Image', inline: true },
                { name: 'Notes', value: 'Large outputs chunked. Images >7.5MB not re-uploaded. Data in-memory. Extend with persistence & rate limits.', inline: false }
              ],
              footer: { text: 'Ephemeral help embed.' }
            }
          ]
        });
        break;
      case 'user': {
        const sub = interaction.options.getSubcommand();
        if (sub === 'info') {
          const user = interaction.options.getUser('target') || interaction.user;
          const member = interaction.guild ? await interaction.guild.members.fetch(user.id).catch(() => null) : null;
          const joined = member ? (member.joinedAt ? member.joinedAt.toISOString() : 'unknown') : 'not a guild member';
          await interaction.reply({ content: `${user.tag} (id: ${user.id}) — Joined: ${joined}` });
        }
        break;
      }

      case 'math': {
        const op = interaction.options.getSubcommand();
        const a = interaction.options.getNumber('a');
        const b = interaction.options.getNumber('b');
        let result;
        switch (op) {
          case 'add': result = a + b; break;
          case 'sub': result = a - b; break;
          case 'mul': result = a * b; break;
          case 'div': result = b === 0 ? 'Infinity (division by zero)' : a / b; break;
        }
        await interaction.reply({ content: `Result: ${result}` });
        break;
      }

      case 'poll': {
        const sub = interaction.options.getSubcommand();
        if (sub === 'create') {
          const question = interaction.options.getString('question');
          const optsRaw = interaction.options.getString('options');
          const options = optsRaw.split(',').map(s => s.trim()).filter(Boolean).slice(0, 5);
          if (options.length < 2) {
              await interaction.reply({ content: 'Provide at least two comma-separated options (max 5).', flags: 64 });
            break;
          }
          // create poll
          const pollId = `${Date.now()}-${Math.floor(Math.random()*10000)}`;
          const buttons = options.map((opt, i) => ({ type: 2, label: `${opt} (0)`, style: 1, custom_id: `poll_${pollId}_opt_${i}` }));
          const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
          const rows = [];
          const row = new ActionRowBuilder();
          for (let i = 0; i < buttons.length; i++) {
            row.addComponents(new ButtonBuilder().setCustomId(buttons[i].custom_id).setLabel(options[i] + ' (0)').setStyle(ButtonStyle.Primary));
            // start new row every 5 buttons (rare)
          }
          rows.push(row);
          const msg = await interaction.reply({ content: `📊 **${question}**`, components: rows, fetchReply: true });
          // store poll in memory
          polls.set(pollId, { messageId: msg.id, channelId: msg.channelId, options, votes: new Map(), userVotes: new Map() });
        }
        break;
      }

      case 'remind': {
        const minutes = interaction.options.getInteger('minutes');
        const text = interaction.options.getString('text');
        const ms = Math.max(1000, minutes * 60 * 1000);
            await interaction.reply({ content: `Okay — I'll remind you in ${minutes} minute(s).`, flags: 64 });
        setTimeout(async () => {
          try {
            await interaction.user.send(`Reminder: ${text}`);
          } catch (e) {
            // can't DM, try channel
            const channel = await client.channels.fetch(interaction.channelId).catch(() => null);
            if (channel) channel.send(`${interaction.user}, Reminder: ${text}`);
          }
        }, ms);
        break;
      }

      case 'ask': {
        const prompt = interaction.options.getString('prompt');
        await interaction.deferReply();
        try {
          const resp = await askGemini(prompt);
          // naive: prefer text field or stringify
          const reply = (resp && (resp.text || resp.result || JSON.stringify(resp))) || 'No response';
          await sendLongReply(interaction, reply.toString());
        } catch (e) {
          console.error('AI request failed', e);
          // show a concise error message to the user for debugging (no secrets)
          const msg = (e && e.message) ? e.message.toString().slice(0, 200) : 'AI request failed.';
            await interaction.editReply({ content: `AI request failed: ${msg}`, flags: 64 });
        }
        break;
      }

      default:
  await interaction.reply({ content: 'Unknown command', flags: 64 });
    }
  } catch (err) {
    console.error('Error handling interaction:', err);
    if (!interaction.replied) {
      try { await interaction.reply({ content: 'There was an error while executing the command.', ephemeral: true }); } catch (e) {}
  try { await interaction.reply({ content: 'There was an error while executing the command.', flags: 64 }); } catch (e) {}
    }
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;
  const id = interaction.customId;
  // no help_ pagination anymore
  if (!id.startsWith('poll_')) return;
  // poll_{pollId}_opt_{i}
  const parts = id.split('_');
  const pollId = parts[1];
  const optIndex = parseInt(parts[parts.length - 1], 10);
  const poll = polls.get(pollId);
  if (!poll) {
    await interaction.reply({ content: 'Poll not found or expired.', ephemeral: true });
    return;
  }
  const userId = interaction.user.id;
  const prev = poll.userVotes.get(userId);
  if (prev === optIndex) poll.userVotes.delete(userId); else poll.userVotes.set(userId, optIndex);
  const counts = new Array(poll.options.length).fill(0);
  for (const v of poll.userVotes.values()) counts[v]++;
  try {
    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
    const row = new ActionRowBuilder();
    for (let i = 0; i < poll.options.length; i++) {
      row.addComponents(new ButtonBuilder().setCustomId(`poll_${pollId}_opt_${i}`).setLabel(`${poll.options[i]} (${counts[i]})`).setStyle(ButtonStyle.Primary));
    }
    const ch = await client.channels.fetch(poll.channelId);
    const msg = await ch.messages.fetch(poll.messageId);
    await msg.edit({ components: [row] });
    await interaction.reply({ content: 'Vote updated.', ephemeral: true });
  } catch (e) {
    console.error('Failed to update poll message', e);
    try { await interaction.reply({ content: 'Vote recorded (could not update message).', ephemeral: true }); } catch {}
  }
});

client.login(token).catch(err => { console.error('Failed to login:', err); process.exit(1); });
