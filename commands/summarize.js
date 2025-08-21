const { askGemini } = require('../ai-client');
const { sendLongReply, formatAIOutput } = require('../util');
module.exports = {
  name: 'summarize',
  execute: async (interaction) => {
    const count = interaction.options.getInteger('count') || 30;
    await interaction.deferReply({});
    try {
      const messages = await interaction.channel.messages.fetch({ limit: Math.min(100, count) });
      const ordered = Array.from(messages.values()).filter(m => !m.author.bot).sort((a,b)=>a.createdTimestamp-b.createdTimestamp);
      const textBlock = ordered.map(m => `${m.author.username}: ${m.cleanContent}`).join('\n').slice(0, 6000);
      const prompt = `Summarize the following Discord conversation succinctly, list key topics and any action items.\n\n${textBlock}`;
      const resp = await askGemini(prompt, { maxOutputTokens: 400 });
  await sendLongReply(interaction, formatAIOutput(resp.text || 'No summary'));
    } catch (e) {
      await interaction.editReply({ content: 'Summarization failed.', flags: 64 });
    }
  }
};
