const AuditLogger = require('../services/auditLogger');

function setupAuditLoggingEvents(client, store) {
  const auditLogger = new AuditLogger(store);

  // Message Delete Event
  client.on('messageDelete', async (message) => {
    try {
      // Skip if message is partial or from DM
      if (message.partial || !message.guild) return;
      
      const attachmentInfo = message.attachments.size > 0 ? 
        `\n📎 Attachments: ${message.attachments.map(a => a.name).join(', ')}` : '';
      
      await auditLogger.logEvent(message.guild, 'messageDelete', {
        author: message.author,
        channel: message.channel,
        messageId: message.id,
        content: message.content,
        attachments: message.attachments.size > 0 ? Array.from(message.attachments.values()) : null
      });
    } catch (error) {
      console.error('Error in messageDelete audit log:', error);
    }
  });

  // Message Update Event
  client.on('messageUpdate', async (oldMessage, newMessage) => {
    try {
      // Skip if messages are partial, from DM, or content hasn't changed
      if (oldMessage.partial || newMessage.partial || !newMessage.guild) return;
      if (oldMessage.content === newMessage.content) return;
      
      await auditLogger.logEvent(newMessage.guild, 'messageUpdate', {
        author: newMessage.author,
        channel: newMessage.channel,
        messageId: newMessage.id,
        oldContent: oldMessage.content,
        newContent: newMessage.content
      });
    } catch (error) {
      console.error('Error in messageUpdate audit log:', error);
    }
  });

  // Bulk Message Delete Event
  client.on('messageDeleteBulk', async (messages) => {
    try {
      const firstMessage = messages.first();
      if (!firstMessage || !firstMessage.guild) return;

      await auditLogger.logEvent(firstMessage.guild, 'messageBulkDelete', {
        channel: firstMessage.channel,
        count: messages.size,
        messageIds: messages.map(m => m.id)
      });
    } catch (error) {
      console.error('Error in messageDeleteBulk audit log:', error);
    }
  });

  // Guild Member Add Event
  client.on('guildMemberAdd', async (member) => {
    try {
      await auditLogger.logEvent(member.guild, 'guildMemberAdd', {
        user: member.user,
        memberCount: member.guild.memberCount
      });
    } catch (error) {
      console.error('Error in guildMemberAdd audit log:', error);
    }
  });

  // Guild Member Remove Event
  client.on('guildMemberRemove', async (member) => {
    try {
      await auditLogger.logEvent(member.guild, 'guildMemberRemove', {
        user: member.user,
        memberCount: member.guild.memberCount,
        joinedAt: member.joinedTimestamp,
        roles: member.roles.cache.filter(role => role.id !== member.guild.id).map(role => role.name)
      });
    } catch (error) {
      console.error('Error in guildMemberRemove audit log:', error);
    }
  });

  // Guild Member Update Event
  client.on('guildMemberUpdate', async (oldMember, newMember) => {
    try {
      // Check for nickname changes
      const oldNickname = oldMember.nickname || '';
      const newNickname = newMember.nickname || '';
      
      if (oldNickname !== newNickname) {
        await auditLogger.logEvent(newMember.guild, 'guildMemberUpdate', {
          user: newMember.user,
          type: 'nickname',
          oldNickname: oldMember.nickname || 'None',
          newNickname: newMember.nickname || 'None'
        });
      }

      // Check for role changes
      const oldRoles = oldMember.roles.cache;
      const newRoles = newMember.roles.cache;
      
      const addedRoles = newRoles.filter(role => !oldRoles.has(role.id));
      const removedRoles = oldRoles.filter(role => !newRoles.has(role.id));

      if (addedRoles.size > 0) {
        await auditLogger.logEvent(newMember.guild, 'guildMemberUpdate', {
          user: newMember.user,
          type: 'roleAdd',
          roles: addedRoles.map(role => role.name)
        });
      }

      if (removedRoles.size > 0) {
        await auditLogger.logEvent(newMember.guild, 'guildMemberUpdate', {
          user: newMember.user,
          type: 'roleRemove',
          roles: removedRoles.map(role => role.name)
        });
      }
    } catch (error) {
      console.error('Error in guildMemberUpdate audit log:', error);
    }
  });

  // Guild Ban Add Event
  client.on('guildBanAdd', async (ban) => {
    try {
      await auditLogger.logEvent(ban.guild, 'guildBanAdd', {
        user: ban.user,
        reason: ban.reason
      });
    } catch (error) {
      console.error('Error in guildBanAdd audit log:', error);
    }
  });

  // Guild Ban Remove Event
  client.on('guildBanRemove', async (ban) => {
    try {
      await auditLogger.logEvent(ban.guild, 'guildBanRemove', {
        user: ban.user
      });
    } catch (error) {
      console.error('Error in guildBanRemove audit log:', error);
    }
  });

  // Channel Create Event
  client.on('channelCreate', async (channel) => {
    try {
      if (!channel.guild) return;

      await auditLogger.logEvent(channel.guild, 'channelCreate', {
        channel: channel
      });
    } catch (error) {
      console.error('Error in channelCreate audit log:', error);
    }
  });

  // Channel Delete Event
  client.on('channelDelete', async (channel) => {
    try {
      if (!channel.guild) return;

      await auditLogger.logEvent(channel.guild, 'channelDelete', {
        channelName: channel.name,
        channelId: channel.id,
        channelType: channel.type
      });
    } catch (error) {
      console.error('Error in channelDelete audit log:', error);
    }
  });

  // Channel Update Event
  client.on('channelUpdate', async (oldChannel, newChannel) => {
    try {
      if (!newChannel.guild) return;

      // Check for name changes
      const oldName = oldChannel.name || '';
      const newName = newChannel.name || '';
      
      if (oldName !== newName) {
        await auditLogger.logEvent(newChannel.guild, 'channelUpdate', {
          channel: newChannel,
          type: 'name',
          oldName: oldChannel.name,
          newName: newChannel.name
        });
      }

      // Check for topic changes (text channels only)
      if (newChannel.isTextBased()) {
        const oldTopic = oldChannel.topic || '';
        const newTopic = newChannel.topic || '';
        
        if (oldTopic !== newTopic) {
          await auditLogger.logEvent(newChannel.guild, 'channelUpdate', {
            channel: newChannel,
            type: 'topic',
            oldTopic: oldTopic || 'None',
            newTopic: newTopic || 'None'
          });
        }
      }

      // Check for NSFW (age restriction) changes
      if (oldChannel.nsfw !== newChannel.nsfw) {
        await auditLogger.logEvent(newChannel.guild, 'channelUpdate', {
          channel: newChannel,
          type: 'nsfw',
          oldValue: oldChannel.nsfw ? 'Yes' : 'No',
          newValue: newChannel.nsfw ? 'Yes' : 'No'
        });
      }

      // Check for slowmode changes
      if (oldChannel.rateLimitPerUser !== newChannel.rateLimitPerUser) {
        await auditLogger.logEvent(newChannel.guild, 'channelUpdate', {
          channel: newChannel,
          type: 'slowmode',
          oldValue: oldChannel.rateLimitPerUser ? `${oldChannel.rateLimitPerUser}s` : 'Off',
          newValue: newChannel.rateLimitPerUser ? `${newChannel.rateLimitPerUser}s` : 'Off'
        });
      }
    } catch (error) {
      console.error('Error in channelUpdate audit log:', error);
    }
  });

  // Role Create Event
  client.on('roleCreate', async (role) => {
    try {
      await auditLogger.logEvent(role.guild, 'roleCreate', {
        role: role
      });
    } catch (error) {
      console.error('Error in roleCreate audit log:', error);
    }
  });

  // Role Delete Event
  client.on('roleDelete', async (role) => {
    try {
      await auditLogger.logEvent(role.guild, 'roleDelete', {
        roleName: role.name,
        roleId: role.id
      });
    } catch (error) {
      console.error('Error in roleDelete audit log:', error);
    }
  });

  // Role Update Event
  client.on('roleUpdate', async (oldRole, newRole) => {
    try {
      // Check for name changes
      const oldRoleName = oldRole.name || '';
      const newRoleName = newRole.name || '';
      
      if (oldRoleName !== newRoleName) {
        await auditLogger.logEvent(newRole.guild, 'roleUpdate', {
          role: newRole,
          type: 'name',
          oldName: oldRole.name,
          newName: newRole.name
        });
      }

      // Check for color changes
      if (oldRole.color !== newRole.color) {
        await auditLogger.logEvent(newRole.guild, 'roleUpdate', {
          role: newRole,
          type: 'color',
          oldColor: oldRole.hexColor,
          newColor: newRole.hexColor
        });
      }

      // Check for permission changes
      if (!oldRole.permissions.equals(newRole.permissions)) {
        await auditLogger.logEvent(newRole.guild, 'roleUpdate', {
          role: newRole,
          type: 'permissions',
          message: 'Role permissions were updated'
        });
      }

      // Check for mentionable changes
      if (oldRole.mentionable !== newRole.mentionable) {
        await auditLogger.logEvent(newRole.guild, 'roleUpdate', {
          role: newRole,
          type: 'mentionable',
          oldValue: oldRole.mentionable ? 'Yes' : 'No',
          newValue: newRole.mentionable ? 'Yes' : 'No'
        });
      }

      // Check for hoist changes (show separately in member list)
      if (oldRole.hoist !== newRole.hoist) {
        await auditLogger.logEvent(newRole.guild, 'roleUpdate', {
          role: newRole,
          type: 'hoist',
          oldValue: oldRole.hoist ? 'Yes' : 'No',
          newValue: newRole.hoist ? 'Yes' : 'No'
        });
      }

      // Check for position changes
      if (oldRole.position !== newRole.position) {
        await auditLogger.logEvent(newRole.guild, 'roleUpdate', {
          role: newRole,
          type: 'position',
          oldValue: oldRole.position.toString(),
          newValue: newRole.position.toString()
        });
      }
    } catch (error) {
      console.error('Error in roleUpdate audit log:', error);
    }
  });

  // Voice State Update Event
  client.on('voiceStateUpdate', async (oldState, newState) => {
    try {
      if (!newState.guild) return;

      // User joined a voice channel
      if (!oldState.channel && newState.channel) {
        await auditLogger.logEvent(newState.guild, 'voiceStateUpdate', {
          user: newState.member.user,
          type: 'join',
          newChannel: newState.channel
        });
      }
      // User left a voice channel
      else if (oldState.channel && !newState.channel) {
        await auditLogger.logEvent(newState.guild, 'voiceStateUpdate', {
          user: newState.member.user,
          type: 'leave',
          oldChannel: oldState.channel
        });
      }
      // User moved between voice channels
      else if (oldState.channel && newState.channel && oldState.channel.id !== newState.channel.id) {
        await auditLogger.logEvent(newState.guild, 'voiceStateUpdate', {
          user: newState.member.user,
          type: 'move',
          oldChannel: oldState.channel,
          newChannel: newState.channel
        });
      }
      
      // Check for mute/deafen status changes
      if (oldState.mute !== newState.mute) {
        await auditLogger.logEvent(newState.guild, 'voiceStateUpdate', {
          user: newState.member.user,
          type: newState.mute ? 'mute' : 'unmute',
          channel: newState.channel || oldState.channel
        });
      }
      
      if (oldState.deaf !== newState.deaf) {
        await auditLogger.logEvent(newState.guild, 'voiceStateUpdate', {
          user: newState.member.user,
          type: newState.deaf ? 'deafen' : 'undeafen',
          channel: newState.channel || oldState.channel
        });
      }
    } catch (error) {
      console.error('Error in voiceStateUpdate audit log:', error);
    }
  });

  // Guild Update Event
  client.on('guildUpdate', async (oldGuild, newGuild) => {
    try {
      // Check for name changes
      const oldGuildName = oldGuild.name || '';
      const newGuildName = newGuild.name || '';
      
      if (oldGuildName !== newGuildName) {
        await auditLogger.logEvent(newGuild, 'guildUpdate', {
          type: 'name',
          oldName: oldGuild.name,
          newName: newGuild.name
        });
      }

      // Check for icon changes
      if (oldGuild.icon !== newGuild.icon) {
        await auditLogger.logEvent(newGuild, 'guildUpdate', {
          type: 'icon',
          message: 'Server icon was updated'
        });
      }
    } catch (error) {
      console.error('Error in guildUpdate audit log:', error);
    }
  });

  // Emoji Create Event
  client.on('emojiCreate', async (emoji) => {
    try {
      if (!emoji.guild) return;

      await auditLogger.logEvent(emoji.guild, 'emojiCreate', {
        emoji: emoji
      });
    } catch (error) {
      console.error('Error in emojiCreate audit log:', error);
    }
  });

  // Emoji Delete Event
  client.on('emojiDelete', async (emoji) => {
    try {
      if (!emoji.guild) return;

      await auditLogger.logEvent(emoji.guild, 'emojiDelete', {
        emojiName: emoji.name,
        emojiId: emoji.id
      });
    } catch (error) {
      console.error('Error in emojiDelete audit log:', error);
    }
  });

  // Webhook Update Event
  client.on('webhookUpdate', async (channel) => {
    try {
      if (!channel.guild) return;

      await auditLogger.logEvent(channel.guild, 'webhookUpdate', {
        channel: channel
      });
    } catch (error) {
      console.error('Error in webhookUpdate audit log:', error);
    }
  });

  // Guild Integrations Update Event
  client.on('guildIntegrationsUpdate', async (guild) => {
    try {
      await auditLogger.logEvent(guild, 'guildIntegrationsUpdate', {
        message: 'Guild integrations were updated (bots, webhooks, etc.)'
      });
    } catch (error) {
      console.error('Error in guildIntegrationsUpdate audit log:', error);
    }
  });

  console.log('Audit logging events registered successfully');
}

module.exports = setupAuditLoggingEvents;
