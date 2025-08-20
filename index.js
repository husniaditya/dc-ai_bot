const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();
const { askGemini } = require('./ai-client');

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.log('No DISCORD_TOKEN found. Create a .env file with DISCORD_TOKEN=your_token and re-run. Exiting.');
  process.exit(0);
}

// Use only the non-privileged Guilds intent. We'll use slash commands (interactions)
// which do not require the Message Content privileged intent.
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const startTimestamp = Date.now();

const MAX_DISCORD_MESSAGE = 2000;

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

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  console.log('Received command', interaction.commandName, 'from', interaction.user.tag);
  try {
    switch (interaction.commandName) {
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
    await interaction.reply({ content: 'Commands: /ping, /whoami, /uptime, /echo <text>, /help, /user info, /math, /poll create, /remind', flags: 64 });
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

// Simple in-memory poll storage and button handling
const polls = new Map();

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;
  const id = interaction.customId;
  if (!id.startsWith('poll_')) return;
  // poll_{pollId}_opt_{i}
  const parts = id.split('_');
  const pollId = parts[1] + (parts[2] ? '_' + parts[2] : '');
  const optIndex = parseInt(parts[parts.length-1], 10);
  const poll = polls.get(pollId);
  if (!poll) {
    await interaction.reply({ content: 'Poll not found or expired.', ephemeral: true });

  }
  const userId = interaction.user.id;
  // userVotes: Map userId -> optionIndex
  const prev = poll.userVotes.get(userId);
  if (prev === optIndex) {
    // unvote
    poll.userVotes.delete(userId);
  } else {
    poll.userVotes.set(userId, optIndex);
  }
  // recompute counts
  const counts = new Array(poll.options.length).fill(0);
  for (const v of poll.userVotes.values()) counts[v]++;
  // update message buttons labels
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
    try { await interaction.reply({ content: 'Vote recorded (could not update message).', ephemeral: true }); } catch (e) {}
  }
});
client.login(token).catch((err) => {
  console.error('Failed to login:', err);
  process.exit(1);
});
