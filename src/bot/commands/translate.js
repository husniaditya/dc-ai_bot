const { askGemini } = require('../../utils/ai-client');
const { sendLongReply, formatAIOutput } = require('../../utils/util');
module.exports = {
  name: 'translate',
  execute: async (interaction) => {
    const text = interaction.options.getString('text');
    const target = interaction.options.getString('target');
  await interaction.deferReply();
    try {
  const resp = await askGemini(`Translate to ${target}. Only output the translation. Text: ${text}`);
  await sendLongReply(interaction, formatAIOutput(resp.text || 'No translation'));
    } catch {
      await interaction.editReply('Translation failed');
    }
  }
};
