module.exports = (client) => ({
  name: 'ytwatch',
  description: 'Manage YouTube live/upload notifications (admins only)',
  async execute(interaction){
    const sub = interaction.options.getSubcommand(false) || null; // Not using subcommands in registration yet
    const guild = interaction.guild;
    if(!guild){ await interaction.reply({ content:'Guild only.', flags:64 }); return; }
    // Permission check
    const member = await guild.members.fetch(interaction.user.id).catch(()=>null);
    if(!member || !member.permissions.has(require('discord.js').PermissionsBitField.Flags.ManageGuild)){
      await interaction.reply({ content:'Manage Server permission required.', flags:64 }); return;
    }
    const store = require('../config/store');
    await interaction.deferReply({ ephemeral:true });
    const cfg = await store.getGuildYouTubeConfig(guild.id);
    const action = interaction.options.getString('action');
    if(!action){
      await interaction.editReply(formatConfig(cfg));
      return;
    }
    let updated = cfg;
    if(action === 'enable'){
      updated = await store.setGuildYouTubeConfig(guild.id, { enabled:true });
    } else if(action === 'disable'){
      updated = await store.setGuildYouTubeConfig(guild.id, { enabled:false });
    } else if(action === 'addchannel'){
      const cid = (interaction.options.getString('channel_id')||'').trim();
      if(!cid) return interaction.editReply('channel_id required');
      updated = await store.setGuildYouTubeConfig(guild.id, cur => { if(!cur.channels.includes(cid)) cur.channels.push(cid); return cur; });
    } else if(action === 'removechannel'){
      const cid = (interaction.options.getString('channel_id')||'').trim();
      updated = await store.setGuildYouTubeConfig(guild.id, cur => { cur.channels = cur.channels.filter(c=>c!==cid); return cur; });
    } else if(action === 'announcechannel'){
      const discordChannel = interaction.options.getChannel('discord_channel');
      if(!discordChannel) return interaction.editReply('discord_channel required');
      updated = await store.setGuildYouTubeConfig(guild.id, { announceChannelId: discordChannel.id });
    } else if(action === 'mentionrole'){
      const role = interaction.options.getRole('role');
      updated = await store.setGuildYouTubeConfig(guild.id, { mentionRoleId: role? role.id : null });
    } else if(action === 'interval'){
      const sec = interaction.options.getInteger('seconds');
      if(!sec || sec < 30) return interaction.editReply('seconds >= 30 required');
      updated = await store.setGuildYouTubeConfig(guild.id, { intervalSec: sec });
    } else if(action === 'status'){
      // no changes
    } else {
      await interaction.editReply('Unknown action');
      return;
    }
    await interaction.editReply(formatConfig(updated));
  }
});

function formatConfig(cfg){
  return 'YouTube Watch Config:\n'
    + `Enabled: ${cfg.enabled}\n`
    + `AnnounceChannel: ${cfg.announceChannelId || 'unset'}\n`
    + `MentionRole: ${cfg.mentionRoleId || 'none'}\n`
    + `IntervalSec: ${cfg.intervalSec}\n`
    + `Channels(${cfg.channels.length}): ${cfg.channels.join(', ') || 'none'}\n`
    + 'Actions: use /ytwatch with options (action, channel_id, discord_channel, role, seconds).';
}
