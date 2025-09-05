const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  name: 'audit',
  execute: async (interaction) => {
    const sub = interaction.options.getSubcommand();
    await interaction.deferReply({ flags: 64 });
    const store = require('../../config/store');
    const guildId = interaction.guild.id;
    const manageGuild = interaction.member.permissions.has(PermissionFlagsBits.ManageGuild);

    try {
      switch(sub){
        case 'recent': {
          if(!manageGuild) return interaction.editReply('Missing Manage Server permission.');
          
          // Use store method to get audit logs
          const result = await store.getGuildAuditLogs(guildId, { limit: 15 });
          if(!result.logs.length) return interaction.editReply('No recent audit entries.');
          
          const desc = result.logs.map(r=>{
            const target = r.target_id ? `<@${r.target_id}>` : (r.user_id ? `<@${r.user_id}>` : 'N/A');
            const mod = r.moderator_id ? ` by <@${r.moderator_id}>` : '';
            const channel = r.channel_id ? ` in <#${r.channel_id}>` : '';
            const timestamp = `<t:${Math.floor(new Date(r.created_at).getTime()/1000)}:R>`;
            
            // Add context based on action type
            let context = '';
            if (r.before_data && r.after_data && r.action_type.includes('Update')) {
              context = ` (${r.before_data?.substring(0,20)}... → ${r.after_data?.substring(0,20)}...)`;
            } else if (r.metadata) {
              if (r.metadata.count) context = ` (${r.metadata.count} messages)`;
              if (r.metadata.type) context = ` (${r.metadata.type})`;
              if (r.metadata.roles) context = ` (${r.metadata.roles.join(', ')})`;
            }
            
            const reason = r.reason ? ` - ${r.reason.slice(0,30)}` : '';
            return `#${r.id} **${r.action_type}** ${target}${mod}${channel} ${timestamp}${context}${reason}`;
          }).join('\n');
          
          const embed = new EmbedBuilder()
            .setTitle('Recent Audit Log')
            .setDescription(desc.slice(0,4000))
            .setColor(0x5865F2)
            .setFooter({ text: `Showing last ${result.logs.length} of ${result.total} entries` });
          return interaction.editReply({ embeds:[embed] });
        }
        case 'search': {
          if(!manageGuild) return interaction.editReply('Missing Manage Server permission.');
          
          const user = interaction.options.getUser('user');
          const actionType = interaction.options.getString('action');
          const limit = interaction.options.getInteger('limit') || 10;
          
          const searchOptions = { limit };
          if (user) searchOptions.userId = user.id;
          if (actionType) searchOptions.actionType = actionType;
          
          const result = await store.getGuildAuditLogs(guildId, searchOptions);
          if(!result.logs.length) {
            const criteria = [];
            if (user) criteria.push(`user: ${user.tag}`);
            if (actionType) criteria.push(`action: ${actionType}`);
            return interaction.editReply(`No audit entries found${criteria.length ? ` for ${criteria.join(', ')}` : ''}.`);
          }
          
          const desc = result.logs.map(r=>{
            const target = r.target_id ? `<@${r.target_id}>` : (r.user_id ? `<@${r.user_id}>` : 'N/A');
            const mod = r.moderator_id ? ` by <@${r.moderator_id}>` : '';
            const channel = r.channel_id ? ` in <#${r.channel_id}>` : '';
            const timestamp = `<t:${Math.floor(new Date(r.created_at).getTime()/1000)}:R>`;
            const reason = r.reason ? ` - ${r.reason.slice(0,40)}` : '';
            return `#${r.id} **${r.action_type}** ${target}${mod}${channel} ${timestamp}${reason}`;
          }).join('\n');
          
          const searchCriteria = [];
          if (user) searchCriteria.push(`User: ${user.tag}`);
          if (actionType) searchCriteria.push(`Action: ${actionType}`);
          
          const embed = new EmbedBuilder()
            .setTitle('Audit Log Search Results')
            .setDescription(desc.slice(0,4000))
            .setColor(0x5865F2)
            .setFooter({ text: `${searchCriteria.join(' | ')} | ${result.logs.length} of ${result.total} results` });
          return interaction.editReply({ embeds:[embed] });
        }
        case 'stats': {
          if(!manageGuild) return interaction.editReply('Missing Manage Server permission.');
          
          const db = require('../../config/store/database/connection');
          if(!db.mariaAvailable || !db.sqlPool) return interaction.editReply('DB not available.');
          
          // Get statistics
          const [totalRows] = await db.sqlPool.query('SELECT COUNT(*) as total FROM guild_audit_logs WHERE guild_id=?', [guildId]);
          const [actionStats] = await db.sqlPool.query(`
            SELECT action_type, COUNT(*) as count 
            FROM guild_audit_logs 
            WHERE guild_id=? 
            GROUP BY action_type 
            ORDER BY count DESC 
            LIMIT 10
          `, [guildId]);
          
          const [recentStats] = await db.sqlPool.query(`
            SELECT COUNT(*) as count 
            FROM guild_audit_logs 
            WHERE guild_id=? AND created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
          `, [guildId]);
          
          const total = totalRows[0].total;
          const weeklyCount = recentStats[0].count;
          
          const embed = new EmbedBuilder()
            .setTitle('Audit Log Statistics')
            .setColor(0x5865F2)
            .addFields([
              { name: 'Total Entries', value: total.toString(), inline: true },
              { name: 'Last 7 Days', value: weeklyCount.toString(), inline: true },
              { name: 'Daily Average', value: Math.round(weeklyCount / 7).toString(), inline: true }
            ]);
          
          if (actionStats.length > 0) {
            const topActions = actionStats.slice(0, 5).map(stat => 
              `**${stat.action_type}**: ${stat.count}`
            ).join('\n');
            embed.addFields([{ name: 'Top Action Types', value: topActions, inline: false }]);
          }
          
          return interaction.editReply({ embeds:[embed] });
        }
        default:
          return interaction.editReply('Unknown subcommand.');
      }
    } catch(e){
      console.error('audit command error', e);
      return interaction.editReply('Error processing command.');
    }
  }
};
