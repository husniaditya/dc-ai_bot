const { EmbedBuilder, AuditLogEvent } = require('discord.js');

class AuditLogger {
  constructor(store) {
    this.store = store;
  }

  async getAuditConfig(guildId) {
    try {
      return await this.store.getGuildAuditLogConfig(guildId);
    } catch (error) {
      console.error('Error getting audit log config:', error);
      return null;
    }
  }

  async logEvent(guild, eventType, data) {
    try {
      const config = await this.getAuditConfig(guild.id);
      if (!config || !config.enabled) return;

      // Determine which channel to log to based on event type
      let channelId = config.globalChannel; // Default to global
      
      switch (eventType) {
        case 'messageUpdate':
        case 'messageDelete':
        case 'messageBulkDelete':
          channelId = config.messageChannel || config.globalChannel;
          break;
        case 'guildMemberAdd':
        case 'guildMemberRemove':
        case 'guildMemberUpdate':
        case 'guildBanAdd':
        case 'guildBanRemove':
          channelId = config.memberChannel || config.globalChannel;
          break;
        case 'channelCreate':
        case 'channelDelete':
        case 'channelUpdate':
          channelId = config.channelChannel || config.globalChannel;
          break;
        case 'roleCreate':
        case 'roleDelete':
        case 'roleUpdate':
          channelId = config.roleChannel || config.globalChannel;
          break;
        case 'guildUpdate':
        case 'emojiCreate':
        case 'emojiDelete':
        case 'emojiUpdate':
        case 'webhookUpdate':
        case 'guildIntegrationsUpdate':
          channelId = config.serverChannel || config.globalChannel;
          break;
        case 'voiceStateUpdate':
          channelId = config.voiceChannel || config.globalChannel;
          break;
      }

      if (!channelId) return;

      const channel = guild.channels.cache.get(channelId);
      if (!channel || !channel.isTextBased()) return;

      // Check if we should include bots
      if (!config.includeBots && data.user && data.user.bot) return;

      // Create embed based on event type
      const embed = await this.createEmbed(eventType, data, config.enhancedDetails);
      
      await channel.send({ embeds: [embed] });
    } catch (error) {
      console.error('Error logging audit event:', error);
    }
  }

  async createEmbed(eventType, data, enhancedDetails = true) {
    const embed = new EmbedBuilder()
      .setTimestamp()
      .setFooter({ text: `Event: ${eventType}` });

    switch (eventType) {
      case 'messageDelete':
        embed
          .setTitle('📝 Message Deleted')
          .setColor(0xFF6B6B)
          .addFields([
            { name: 'Author', value: `${data.author} (${data.author.tag})`, inline: true },
            { name: 'Channel', value: `${data.channel}`, inline: true },
            { name: 'Message ID', value: data.messageId, inline: true }
          ]);
        
        if (data.content && enhancedDetails) {
          embed.addFields([
            { name: 'Content', value: data.content.length > 1024 ? data.content.substring(0, 1021) + '...' : data.content }
          ]);
        }
        
        if (data.attachments && data.attachments.length > 0 && enhancedDetails) {
          const attachmentList = data.attachments.map(att => `${att.name} (${att.size} bytes)`).join('\n');
          embed.addFields([
            { name: 'Attachments', value: attachmentList.length > 1024 ? attachmentList.substring(0, 1021) + '...' : attachmentList }
          ]);
        }
        break;

      case 'messageUpdate':
        embed
          .setTitle('✏️ Message Edited')
          .setColor(0xFFA500)
          .addFields([
            { name: 'Author', value: `${data.author} (${data.author.tag})`, inline: true },
            { name: 'Channel', value: `${data.channel}`, inline: true },
            { name: 'Message ID', value: data.messageId, inline: true }
          ]);

        if (enhancedDetails && data.oldContent && data.newContent) {
          embed.addFields([
            { name: 'Before', value: data.oldContent.length > 512 ? data.oldContent.substring(0, 509) + '...' : data.oldContent || '*Empty*' },
            { name: 'After', value: data.newContent.length > 512 ? data.newContent.substring(0, 509) + '...' : data.newContent || '*Empty*' }
          ]);
        }
        break;

      case 'guildMemberAdd':
        embed
          .setTitle('👋 Member Joined')
          .setColor(0x4CAF50)
          .addFields([
            { name: 'User', value: `${data.user} (${data.user.tag})`, inline: true },
            { name: 'Account Created', value: `<t:${Math.floor(data.user.createdTimestamp / 1000)}:R>`, inline: true },
            { name: 'Member Count', value: data.memberCount.toString(), inline: true }
          ]);

        if (data.user.avatarURL()) {
          embed.setThumbnail(data.user.avatarURL());
        }
        break;

      case 'guildMemberRemove':
        embed
          .setTitle('👋 Member Left')
          .setColor(0xF44336)
          .addFields([
            { name: 'User', value: `${data.user.tag} (${data.user.id})`, inline: true },
            { name: 'Joined', value: data.joinedAt ? `<t:${Math.floor(data.joinedAt / 1000)}:R>` : 'Unknown', inline: true },
            { name: 'Member Count', value: data.memberCount.toString(), inline: true }
          ]);

        if (data.user.avatarURL()) {
          embed.setThumbnail(data.user.avatarURL());
        }

        if (enhancedDetails && data.roles && data.roles.length > 0) {
          embed.addFields([
            { name: 'Roles', value: data.roles.join(', ').substring(0, 1024) }
          ]);
        }
        break;

      case 'guildBanAdd':
        embed
          .setTitle('🔨 Member Banned')
          .setColor(0x8B0000)
          .addFields([
            { name: 'User', value: `${data.user.tag} (${data.user.id})`, inline: true }
          ]);

        if (data.reason) {
          embed.addFields([{ name: 'Reason', value: data.reason }]);
        }
        break;

      case 'guildBanRemove':
        embed
          .setTitle('🔓 Member Unbanned')
          .setColor(0x4CAF50)
          .addFields([
            { name: 'User', value: `${data.user.tag} (${data.user.id})`, inline: true }
          ]);
        break;

      case 'channelCreate':
        embed
          .setTitle('📁 Channel Created')
          .setColor(0x4CAF50)
          .addFields([
            { name: 'Channel', value: `${data.channel} (${data.channel.name})`, inline: true },
            { name: 'Type', value: data.channel.type.toString(), inline: true }
          ]);
        break;

      case 'channelDelete':
        embed
          .setTitle('🗑️ Channel Deleted')
          .setColor(0xF44336)
          .addFields([
            { name: 'Channel', value: `#${data.channelName} (${data.channelId})`, inline: true },
            { name: 'Type', value: data.channelType.toString(), inline: true }
          ]);
        break;

      case 'roleCreate':
        embed
          .setTitle('🏷️ Role Created')
          .setColor(0x4CAF50)
          .addFields([
            { name: 'Role', value: `${data.role} (${data.role.name})`, inline: true },
            { name: 'Color', value: data.role.hexColor, inline: true }
          ]);
        break;

      case 'roleDelete':
        embed
          .setTitle('🗑️ Role Deleted')
          .setColor(0xF44336)
          .addFields([
            { name: 'Role', value: `${data.roleName} (${data.roleId})`, inline: true }
          ]);
        break;

      case 'guildMemberUpdate':
        if (data.type === 'nickname') {
          embed
            .setTitle('👤 Nickname Changed')
            .setColor(0xFFA500)
            .addFields([
              { name: 'User', value: `${data.user} (${data.user.tag})`, inline: true },
              { name: 'Before', value: data.oldNickname, inline: true },
              { name: 'After', value: data.newNickname, inline: true }
            ]);
        } else if (data.type === 'roleAdd') {
          embed
            .setTitle('🏷️ Roles Added')
            .setColor(0x4CAF50)
            .addFields([
              { name: 'User', value: `${data.user} (${data.user.tag})`, inline: true },
              { name: 'Roles', value: data.roles.join(', ').substring(0, 1024), inline: true }
            ]);
        } else if (data.type === 'roleRemove') {
          embed
            .setTitle('🗑️ Roles Removed')
            .setColor(0xF44336)
            .addFields([
              { name: 'User', value: `${data.user} (${data.user.tag})`, inline: true },
              { name: 'Roles', value: data.roles.join(', ').substring(0, 1024), inline: true }
            ]);
        }
        break;

      case 'channelUpdate':
        if (data.type === 'name') {
          embed
            .setTitle('📝 Channel Name Changed')
            .setColor(0xFFA500)
            .addFields([
              { name: 'Channel', value: `${data.channel}`, inline: true },
              { name: 'Before', value: data.oldName, inline: true },
              { name: 'After', value: data.newName, inline: true }
            ]);
        } else if (data.type === 'topic') {
          embed
            .setTitle('📋 Channel Topic Changed')
            .setColor(0xFFA500)
            .addFields([
              { name: 'Channel', value: `${data.channel}`, inline: true },
              { name: 'Before', value: data.oldTopic.substring(0, 512), inline: false },
              { name: 'After', value: data.newTopic.substring(0, 512), inline: false }
            ]);
        } else if (data.type === 'nsfw') {
          embed
            .setTitle('🔞 Age Restriction Changed')
            .setColor(0xFFA500)
            .addFields([
              { name: 'Channel', value: `${data.channel}`, inline: true },
              { name: 'Age Restricted', value: `${data.oldValue} → ${data.newValue}`, inline: true }
            ]);
        } else if (data.type === 'slowmode') {
          embed
            .setTitle('⏱️ Slowmode Changed')
            .setColor(0xFFA500)
            .addFields([
              { name: 'Channel', value: `${data.channel}`, inline: true },
              { name: 'Slowmode', value: `${data.oldValue} → ${data.newValue}`, inline: true }
            ]);
        }
        break;

      case 'roleUpdate':
        if (data.type === 'name') {
          embed
            .setTitle('🏷️ Role Name Changed')
            .setColor(0xFFA500)
            .addFields([
              { name: 'Role', value: `${data.role}`, inline: true },
              { name: 'Before', value: data.oldName, inline: true },
              { name: 'After', value: data.newName, inline: true }
            ]);
        } else if (data.type === 'color') {
          embed
            .setTitle('🎨 Role Color Changed')
            .setColor(0xFFA500)
            .addFields([
              { name: 'Role', value: `${data.role}`, inline: true },
              { name: 'Before', value: data.oldColor, inline: true },
              { name: 'After', value: data.newColor, inline: true }
            ]);
        } else if (data.type === 'permissions') {
          embed
            .setTitle('🔐 Role Permissions Updated')
            .setColor(0xFFA500)
            .addFields([
              { name: 'Role', value: `${data.role}`, inline: true },
              { name: 'Change', value: data.message, inline: true }
            ]);
        } else if (data.type === 'mentionable') {
          embed
            .setTitle('📢 Role Mentionable Changed')
            .setColor(0xFFA500)
            .addFields([
              { name: 'Role', value: `${data.role}`, inline: true },
              { name: 'Before', value: data.oldValue, inline: true },
              { name: 'After', value: data.newValue, inline: true }
            ]);
        } else if (data.type === 'hoist') {
          embed
            .setTitle('📋 Role Display Changed')
            .setColor(0xFFA500)
            .addFields([
              { name: 'Role', value: `${data.role}`, inline: true },
              { name: 'Show Separately', value: `${data.oldValue} → ${data.newValue}`, inline: true }
            ]);
        } else if (data.type === 'position') {
          embed
            .setTitle('🔄 Role Position Changed')
            .setColor(0xFFA500)
            .addFields([
              { name: 'Role', value: `${data.role}`, inline: true },
              { name: 'Position', value: `${data.oldValue} → ${data.newValue}`, inline: true }
            ]);
        }
        break;

      case 'voiceStateUpdate':
        if (data.type === 'join') {
          embed
            .setTitle('🔊 Voice Channel Joined')
            .setColor(0x4CAF50)
            .addFields([
              { name: 'User', value: `${data.user} (${data.user.tag})`, inline: true },
              { name: 'Channel', value: `${data.newChannel}`, inline: true }
            ]);
        } else if (data.type === 'leave') {
          embed
            .setTitle('🔇 Voice Channel Left')
            .setColor(0xF44336)
            .addFields([
              { name: 'User', value: `${data.user} (${data.user.tag})`, inline: true },
              { name: 'Channel', value: `${data.oldChannel}`, inline: true }
            ]);
        } else if (data.type === 'move') {
          embed
            .setTitle('🔄 Voice Channel Moved')
            .setColor(0xFFA500)
            .addFields([
              { name: 'User', value: `${data.user} (${data.user.tag})`, inline: true },
              { name: 'From', value: `${data.oldChannel}`, inline: true },
              { name: 'To', value: `${data.newChannel}`, inline: true }
            ]);
        } else if (data.type === 'mute') {
          embed
            .setTitle('🔇 User Muted')
            .setColor(0xF44336)
            .addFields([
              { name: 'User', value: `${data.user} (${data.user.tag})`, inline: true },
              { name: 'Channel', value: `${data.channel}`, inline: true }
            ]);
        } else if (data.type === 'unmute') {
          embed
            .setTitle('🔊 User Unmuted')
            .setColor(0x4CAF50)
            .addFields([
              { name: 'User', value: `${data.user} (${data.user.tag})`, inline: true },
              { name: 'Channel', value: `${data.channel}`, inline: true }
            ]);
        } else if (data.type === 'deafen') {
          embed
            .setTitle('🙉 User Deafened')
            .setColor(0xF44336)
            .addFields([
              { name: 'User', value: `${data.user} (${data.user.tag})`, inline: true },
              { name: 'Channel', value: `${data.channel}`, inline: true }
            ]);
        } else if (data.type === 'undeafen') {
          embed
            .setTitle('🙈 User Undeafened')
            .setColor(0x4CAF50)
            .addFields([
              { name: 'User', value: `${data.user} (${data.user.tag})`, inline: true },
              { name: 'Channel', value: `${data.channel}`, inline: true }
            ]);
        }
        break;

      case 'guildUpdate':
        if (data.type === 'name') {
          embed
            .setTitle('🏠 Server Name Changed')
            .setColor(0xFFA500)
            .addFields([
              { name: 'Before', value: data.oldName, inline: true },
              { name: 'After', value: data.newName, inline: true }
            ]);
        } else if (data.type === 'icon') {
          embed
            .setTitle('🖼️ Server Icon Updated')
            .setColor(0xFFA500)
            .setDescription(data.message);
        }
        break;

      case 'emojiCreate':
        embed
          .setTitle('😀 Emoji Created')
          .setColor(0x4CAF50)
          .addFields([
            { name: 'Emoji', value: `${data.emoji} (${data.emoji.name})`, inline: true },
            { name: 'ID', value: data.emoji.id, inline: true }
          ]);
        break;

      case 'emojiDelete':
        embed
          .setTitle('🗑️ Emoji Deleted')
          .setColor(0xF44336)
          .addFields([
            { name: 'Emoji', value: `${data.emojiName} (${data.emojiId})`, inline: true }
          ]);
        break;

      case 'messageBulkDelete':
        embed
          .setTitle('🗑️ Messages Bulk Deleted')
          .setColor(0xF44336)
          .addFields([
            { name: 'Channel', value: `${data.channel}`, inline: true },
            { name: 'Count', value: data.count.toString(), inline: true }
          ]);

        if (enhancedDetails && data.messageIds) {
          const messageIdsList = data.messageIds.slice(0, 10).join('\n'); // Show first 10 IDs
          embed.addFields([
            { name: 'Message IDs', value: messageIdsList + (data.messageIds.length > 10 ? '\n...' : '') }
          ]);
        }
        break;

      case 'webhookUpdate':
        embed
          .setTitle('🔗 Webhooks Updated')
          .setColor(0xFFA500)
          .addFields([
            { name: 'Channel', value: `${data.channel}`, inline: true }
          ]);
        break;

      case 'guildIntegrationsUpdate':
        embed
          .setTitle('🔌 Integrations Updated')
          .setColor(0xFFA500)
          .setDescription(data.message);
        break;

      default:
        embed
          .setTitle('📋 Guild Event')
          .setColor(0x5865F2)
          .setDescription(`Event type: ${eventType}`);
    }

    return embed;
  }
}

module.exports = AuditLogger;
