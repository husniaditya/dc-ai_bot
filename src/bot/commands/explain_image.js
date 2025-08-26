const { explainImages } = require('../../utils/ai-client');
const { buildImageEmbedResponse } = require('../../utils/util');
module.exports = {
  name: 'explain_image',
  execute: async (interaction) => {
    const attachments = [];
    ['image','image2','image3'].forEach(n => { const a = interaction.options.getAttachment(n); if (a) attachments.push(a); });
    if (!attachments.length && interaction.message && interaction.message.reference && interaction.message.reference.messageId) {
      try {
        const repliedMsg = await interaction.channel.messages.fetch(interaction.message.reference.messageId);
        if (repliedMsg.attachments) attachments.push(...Array.from(repliedMsg.attachments.values()).slice(0,3));
      } catch {}
    }
    if (!attachments.length) {
      return interaction.reply({ content: 'Attach 1–3 images or reply to a message with images.', flags: 64 });
    }
    const prompt = interaction.options.getString('prompt');
    const images = attachments.filter(a => (a.size || 0) < 8*1024*1024);
    if (!images.length) return interaction.reply({ content: 'All images too large (>8MB).', flags: 64 });
    await interaction.deferReply();
    try {
      const urls = images.map(a=>a.url);
      const explanation = await explainImages(urls, prompt);
      await buildImageEmbedResponse(interaction, urls, explanation);
    } catch (e) {
      await interaction.editReply({ content: 'Image explanation failed.', flags: 64 });
    }
  }
};
