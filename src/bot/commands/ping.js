const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with Pong! and shows bot latency'),
  name: 'ping',
  description: 'Replies with Pong! and shows bot latency',
  category: 'utility',
  execute: async (interaction) => {
    const start = Date.now();
    await interaction.reply('Pong!');
    const end = Date.now();
    const latency = end - start;
    const apiLatency = Math.round(interaction.client.ws.ping);
    await interaction.editReply(`🏓 Pong!\n**Response Time:** ${latency}ms\n**API Latency:** ${apiLatency}ms`);
  }
};
