const { askGemini } = require('../ai-client');
const { sendLongReply, formatAIOutput } = require('../util');
const { getAskCache } = require('../state');
module.exports = {
  name: 'ask',
  execute: async (interaction) => {
    const prompt = interaction.options.getString('prompt');
    const cache = getAskCache();
    const cached = cache.get(prompt);
    if (cached && cached.expires > Date.now()) {
      await interaction.deferReply();
      return sendLongReply(interaction, cached.text + ' (cached)');
    }
    await interaction.deferReply();
    try {
      const resp = await askGemini(prompt);
  const reply = formatAIOutput(resp.text || 'No response');
      cache.set(prompt, { text: reply, expires: Date.now() + 3 * 60 * 1000 });
      await sendLongReply(interaction, reply.toString());
    } catch (e) {
      const msg = (e && e.message) ? e.message.toString().slice(0, 180) : 'AI request failed.';
      await interaction.editReply({ content: `AI request failed: ${msg}`, flags: 64 });
    }
  }
};
