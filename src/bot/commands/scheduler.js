const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  name: 'scheduler',
  execute: async (interaction) => {
    const sub = interaction.options.getSubcommand();
    await interaction.deferReply({ flags: 64 });
    const store = require('../../config/store');
    const { parseCanonicalNext } = require('../../config/store/services/schedulerService');
    const guildId = interaction.guild.id;

    // Basic permission gate for mutating actions
    const manageGuild = interaction.member.permissions.has(PermissionFlagsBits.ManageGuild);

    try {
      switch(sub){
        case 'list': {
          const msgs = await store.getGuildScheduledMessages(guildId);
          if (!msgs.length) return interaction.editReply('No scheduled messages configured.');
          const lines = msgs.slice(0,25).map(m=>`#${m.id} [${m.schedule_type || m.scheduleType}:${m.schedule_value || m.scheduleValue}] ${m.title || '(no title)'} ${m.enabled?'':'(disabled)'} `);
          return interaction.editReply(lines.join('\n'));
        }
        case 'info': {
          const id = interaction.options.getInteger('id');
          const msgs = await store.getGuildScheduledMessages(guildId);
            const m = msgs.find(x=>x.id===id);
            if(!m) return interaction.editReply('Not found.');
            const next = parseCanonicalNext(m.schedule_type || m.scheduleType, m.schedule_value || m.scheduleValue);
            const embed = new EmbedBuilder()
              .setTitle(`Scheduled #${m.id}`)
              .setColor(0x5865F2)
              .addFields(
                { name:'Title', value: m.title || '(none)', inline:true },
                { name:'Type', value: (m.schedule_type || m.scheduleType)+ '', inline:true },
                { name:'Value', value: m.schedule_value || m.scheduleValue, inline:true },
                { name:'Enabled', value: m.enabled? 'yes':'no', inline:true },
                { name:'Channel', value: m.channel_id || m.channelId || 'unknown', inline:true },
                { name:'Next (calc)', value: next? `<t:${Math.floor(next.getTime()/1000)}:R>`:'(n/a)', inline:true }
              )
              .setTimestamp();
            return interaction.editReply({ embeds:[embed] });
        }
        case 'enable':
        case 'disable': {
          if (!manageGuild) return interaction.editReply('Missing Manage Server permission.');
          const id = interaction.options.getInteger('id');
          const msgs = await store.getGuildScheduledMessages(guildId);
          const existing = msgs.find(x=>x.id===id);
          if(!existing) return interaction.editReply('Not found.');
          const enabled = sub==='enable';
          await store.updateGuildScheduledMessage(guildId, id, { enabled });
          return interaction.editReply(`${enabled? 'Enabled':'Disabled'} #${id}.`);
        }
        case 'run': {
          if (!manageGuild) return interaction.editReply('Missing Manage Server permission.');
          const id = interaction.options.getInteger('id');
          const msgs = await store.getGuildScheduledMessages(guildId);
          const m = msgs.find(x=>x.id===id);
          if(!m) return interaction.editReply('Not found.');
          // Lightweight re-dispatch without altering schedule (simulate immediate run)
          try {
            const client = interaction.client;
            const channelId = m.channel_id || m.channelId;
            const channel = await client.channels.fetch(channelId).catch(()=>null);
            if(!channel) return interaction.editReply('Channel fetch failed.');
            if (m.embed_data || m.embedData) {
              const embedData = m.embed_data || m.embedData;
              await channel.send({ content: m.message_content || m.messageContent || undefined, embeds: Array.isArray(embedData)? embedData : [embedData] });
            } else {
              await channel.send({ content: m.message_content || m.messageContent });
            }
            return interaction.editReply(`Ran #${id} now.`);
          } catch(e){
            console.error('Manual run error', e);
            return interaction.editReply('Run failed.');
          }
        }
        default:
          return interaction.editReply('Unknown subcommand.');
      }
    } catch(e){
      console.error('scheduler command error', e);
      return interaction.editReply('Error processing command.');
    }
  }
};
