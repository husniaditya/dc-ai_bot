const { ytStats } = require('../services/youtube');

module.exports = {
  name: 'ytstats',
  execute: async (interaction) => {
    const guild = interaction.guild;
    if(!guild){ return interaction.reply({ content:'Guild only.', flags:64 }); }
    const member = await guild.members.fetch(interaction.user.id).catch(()=>null);
    if(!member || !member.permissions.has(require('discord.js').PermissionsBitField.Flags.ManageGuild)){
      return interaction.reply({ content:'Manage Server permission required.', flags:64 });
    }
    const uptimeSec = Math.floor((Date.now() - ytStats.started)/1000);
    const fmt = (n)=> n.toString();
    const lines = [
      `Uptime: ${uptimeSec}s`,
      `Uploads: api=${fmt(ytStats.uploadsApiCalls)} playlist=${fmt(ytStats.uploadsPlaylistCalls)} rss=${fmt(ytStats.uploadsRssCalls)} cacheHits=${fmt(ytStats.cacheHitsUploads)}`,
      `Live: search=${fmt(ytStats.liveSearchCalls)} scrape=${fmt(ytStats.liveScrapeCalls)} cacheHits=${fmt(ytStats.cacheHitsLive)}`,
      `Env: uploadMin=${process.env.YT_UPLOAD_MIN_INTERVAL_SEC||'300'}s liveMin=${process.env.YT_LIVE_MIN_INTERVAL_SEC||'120'}s quietMult=${process.env.YT_LONG_INTERVAL_MULT||'3'}`
    ];
    await interaction.reply({ content: 'YouTube Stats:\n'+lines.join('\n'), flags: 64 });
  }
};
