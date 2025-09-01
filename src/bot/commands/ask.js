const { askGemini } = require('../../utils/ai-client');
const { sendLongReply, formatAIOutput } = require('../../utils/util');
const { getAskCache } = require('../../utils/state');
const { checkCommandAndReply } = require('../../utils/validation');

module.exports = {
  name: 'ask',
  execute: async (interaction) => {
    const store = require('../../config/store');
    
    // Check if the ask command is enabled
    const canExecute = await checkCommandAndReply(interaction, 'ask', store, false);
    
    if (!canExecute) {
      return; // Command is disabled
    }
    
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
