const { askGemini } = require('../ai-client');
const { sendLongReply, formatAIOutput } = require('../util');
const { getConversationStore } = require('../state');
module.exports = {
  name: 'askfollow',
  execute: async (interaction) => {
    const followPrompt = interaction.options.getString('prompt');
    const store = getConversationStore();
    const prev = store.get(interaction.user.id) || [];
    const context = prev.slice(-4).map(p => p.role + ': ' + p.content).join('\n');
    const composite = `Previous context (last ${prev.length}):\n${context}\n\nFollow-up: ${followPrompt}`;
    await interaction.deferReply();
    try {
      const resp = await askGemini(composite);
  const text = formatAIOutput(resp.text || 'No response');
      prev.push({ role: 'user', content: followPrompt });
      prev.push({ role: 'assistant', content: text });
      store.set(interaction.user.id, prev.slice(-10));
      await sendLongReply(interaction, text);
    } catch (e) {
      await interaction.editReply({ content: 'Follow-up failed.', flags: 64 });
    }
  }
};
