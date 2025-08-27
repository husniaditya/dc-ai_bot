function setupGuildMemberAddHandler(client, store, startTimestamp, commandMap) {
  // Welcome event
  client.on('guildMemberAdd', async (member) => {
    try {
      const guildId = member.guild.id;
      const cfg = await store.getGuildWelcome(guildId);
      
      if (!cfg || cfg.enabled === false || !cfg.channelId) return;
      
      const ch = member.guild.channels.cache.get(cfg.channelId);
      if (!ch || !ch.isTextBased()) return;
      
      const msgText = (cfg.messageText && cfg.messageText.trim()) ? cfg.messageText
        .replace(/\{user\}/g, `<@${member.id}>`)
        .replace(/\{server\}/g, member.guild.name)
        : `Welcome <@${member.id}>!`;
      
      if (cfg.messageType === 'embed') {
        const embed = { 
          title: 'Welcome!', 
          description: msgText, 
          color: 0x5865F2 
        };
        
        if (cfg.cardEnabled) {
          embed.thumbnail = { url: member.user.displayAvatarURL({ size: 128 }) };
          embed.footer = { text: `Member #${member.guild.memberCount}` };
        }
        
        await ch.send({ embeds: [embed] });
      } else {
        if (cfg.cardEnabled) {
          await ch.send({ content: msgText, files: [] }); // placeholder for future generated card image
        } else {
          await ch.send(msgText);
        }
      }
    } catch(e) { /* silent */ }
  });
}

module.exports = setupGuildMemberAddHandler;
