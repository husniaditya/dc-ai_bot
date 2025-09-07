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
              let embedData = m.embed_data || m.embedData;
              
              // Parse JSON if it's a string
              if (typeof embedData === 'string') {
                try {
                  embedData = JSON.parse(embedData);
                } catch (e) {
                  console.error('Failed to parse embed data:', e);
                  return interaction.editReply('Invalid embed data format.');
                }
              }
              
              // Process embed data similar to scheduler service
              let embedArray = Array.isArray(embedData) ? embedData : [embedData];
              
              embedArray = embedArray.map(embed => {
                const processedEmbed = { ...embed };
                
                // Convert color from hex string to integer
                if (processedEmbed.color && typeof processedEmbed.color === 'string') {
                  const hexColor = processedEmbed.color.replace('#', '');
                  processedEmbed.color = parseInt(hexColor, 16);
                }
                
                // Ensure footer, thumbnail, and image are proper objects or removed if empty
                if (processedEmbed.footer && typeof processedEmbed.footer === 'string') {
                  if (processedEmbed.footer.trim()) {
                    processedEmbed.footer = { text: processedEmbed.footer };
                  } else {
                    delete processedEmbed.footer;
                  }
                }
                
                if (processedEmbed.thumbnail && typeof processedEmbed.thumbnail === 'string') {
                  if (processedEmbed.thumbnail.trim()) {
                    processedEmbed.thumbnail = { url: processedEmbed.thumbnail };
                  } else {
                    delete processedEmbed.thumbnail;
                  }
                }
                
                if (processedEmbed.image && typeof processedEmbed.image === 'string') {
                  if (processedEmbed.image.trim()) {
                    processedEmbed.image = { url: processedEmbed.image };
                  } else {
                    delete processedEmbed.image;
                  }
                }
                
                return processedEmbed;
              });
              
              await channel.send({ content: m.message_content || m.messageContent || undefined, embeds: embedArray });
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
