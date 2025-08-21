const polls = new Map();
function getPolls() { return polls; }
module.exports = {
  name: 'poll',
  getPolls,
  execute: async (interaction) => {
    const sub = interaction.options.getSubcommand();
    if (sub === 'create') {
      const question = interaction.options.getString('question');
      const optsRaw = interaction.options.getString('options');
      const options = optsRaw.split(',').map(s => s.trim()).filter(Boolean).slice(0, 5);
      if (options.length < 2) {
        return interaction.reply({ content: 'Provide at least two comma-separated options (max 5).', flags: 64 });
      }
      const pollId = `${Date.now()}-${Math.floor(Math.random()*10000)}`;
      const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
      const row = new ActionRowBuilder();
      for (let i = 0; i < options.length; i++) {
        row.addComponents(new ButtonBuilder().setCustomId(`poll_${pollId}_opt_${i}`).setLabel(`${options[i]} (0)`).setStyle(ButtonStyle.Primary));
      }
      const msg = await interaction.reply({ content: `📊 **${question}**`, components: [row], fetchReply: true });
      polls.set(pollId, { messageId: msg.id, channelId: msg.channelId, options, votes: new Map(), userVotes: new Map(), question });
    } else if (sub === 'results') {
      const pollId = interaction.options.getString('id');
      const poll = polls.get(pollId);
      if (!poll) return interaction.reply({ content: 'Poll not found.', flags: 64 });
      const counts = new Array(poll.options.length).fill(0);
      for (const v of poll.userVotes.values()) counts[v]++;
      const total = Math.max(1, Array.from(poll.userVotes.values()).length);
      const lines = poll.options.map((opt,i)=>{
        const pct = ((counts[i]/total)*100).toFixed(1);
        const barCount = Math.round((counts[i]/total)*10);
        return `${opt}: [${'█'.repeat(barCount)}${' '.repeat(10-barCount)}] ${counts[i]} (${pct}%)`;
      }).join('\n');
      return interaction.reply({ content: `Results for **${poll.question}**\n${lines}`, flags: 64 });
    }
  },
  handleButton: async (interaction, client) => {
    const id = interaction.customId;
    if (!id.startsWith('poll_')) return false;
    const parts = id.split('_');
    const pollId = parts[1];
    const optIndex = parseInt(parts[parts.length - 1], 10);
    const poll = polls.get(pollId);
    if (!poll) {
      await interaction.reply({ content: 'Poll not found or expired.', ephemeral: true });
      return true;
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
    return true;
  }
};
