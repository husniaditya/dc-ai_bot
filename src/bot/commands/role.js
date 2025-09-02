const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const { checkCommandAndReply } = require('../../utils/validation');

module.exports = {
  name: 'role',
  execute: async (interaction) => {
    const subcommand = interaction.options.getSubcommand();
    
    // Defer reply immediately to prevent interaction timeout
    // Make menu subcommand ephemeral (private)
    const isEphemeral = subcommand === 'menu';
    if (isEphemeral) {
      await interaction.deferReply({ flags: 64 });
    } else {
      await interaction.deferReply();
    }
    
    const store = require('../../config/store');
    const guildId = interaction.guild.id;
    const member = interaction.member;

    // Check if the specific role subcommand is enabled
    const commandName = `role ${subcommand}`;
    const canExecute = await checkCommandAndReply(interaction, commandName, store, isEphemeral);
    
    if (!canExecute) {
      return; // Command is disabled
    }

    // Check if user has manage roles permission for setup commands
    const requiresPermission = ['setup', 'add', 'remove', 'toggle'];
    if (requiresPermission.includes(subcommand) && !member.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return await interaction.editReply({
        content: '❌ You need the "Manage Roles" permission to use this command.'
      });
    }

    try {
      switch (subcommand) {
        case 'list':
          await handleRoleList(interaction, store, guildId);
          break;
        case 'add':
          await handleRoleAdd(interaction, store, guildId, member);
          break;
        case 'menu':
          await handleRoleMenu(interaction, store, guildId);
          break;
        case 'remove':
          await handleRoleRemove(interaction, store, guildId, member);
          break;
        case 'setup':
          await handleRoleSetup(interaction, store, guildId, member);
          break;
        case 'toggle':
          await handleRoleToggle(interaction, store, guildId, member);
          break;
        default:
          await interaction.editReply({
            content: '❌ Unknown subcommand.'
          });
      }
    } catch (error) {
      console.error(`Error in role command:`, error);
      
      // Since we deferred at the start, use editReply
      try {
        await interaction.editReply({
          content: '❌ An error occurred while processing your request.'
        });
      } catch (replyError) {
        console.error(`Failed to send error reply:`, replyError);
      }
    }
  }
};

// List available self-assignable roles
async function handleRoleList(interaction, store, guildId) {
  try {
    const roles = await store.getGuildSelfAssignableRoles(guildId);
    
    if (roles.length === 0) {
      return await interaction.editReply({
        content: '📝 No self-assignable roles have been configured yet.\n\nServer administrators can use `/role setup` to configure roles.'
      });
    }

    const embed = new EmbedBuilder()
      .setTitle('🎭 Available Self-Assignable Roles')
      .setColor(0x8b5cf6)
      .setDescription('Here are the roles you can assign to yourself:')
      .setTimestamp();

    const enabledRoles = roles.filter(role => role.status);
    
    if (enabledRoles.length === 0) {
      embed.setDescription('❌ All self-assignable roles are currently disabled.');
    } else {
      let description = '';
      
      for (const roleConfig of enabledRoles) {
        const roleNames = [];
        for (const roleData of roleConfig.roles) {
          const role = interaction.guild.roles.cache.get(roleData.roleId);
          if (role) {
            const typeIcon = roleData.type === 'add_only' ? '➕' : roleData.type === 'remove_only' ? '➖' : '🔄';
            roleNames.push(`${typeIcon} ${role.name}`);
          }
        }
        
        if (roleNames.length > 0) {
          description += `**${roleConfig.commandName}**\n`;
          description += `${roleConfig.description || 'No description'}\n`;
          description += `Roles:\n`;
          for (const roleName of roleNames) {
            description += `• ${roleName}\n`;
          }
          description += `\n`;
        }
      }
      
      embed.setDescription(description || 'No valid roles found.');
    }

    embed.setFooter({ text: 'Use /role menu to get an interactive role selection menu' });

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error in handleRoleList:', error);
    
    // Only reply if the interaction hasn't been acknowledged yet
    if (!interaction.replied && !interaction.deferred) {
      await interaction.editReply({
        content: '❌ An error occurred while loading roles.',
       flags: 64
      });
    } else if (interaction.deferred && !interaction.replied) {
      await interaction.editReply({
        content: '❌ An error occurred while loading roles.'
      });
    }
  }
}

// Add a role to user
async function handleRoleAdd(interaction, store, guildId, member) {
  const roleName = interaction.options.getString('role');
  const targetUser = interaction.options.getUser('user') || interaction.user;
  const targetMember = await interaction.guild.members.fetch(targetUser.id);

  // Find role by name
  const role = interaction.guild.roles.cache.find(r => 
    r.name.toLowerCase() === roleName.toLowerCase()
  );

  if (!role) {
    return await interaction.editReply({
      content: `❌ Role "${roleName}" not found.`,
     flags: 64
    });
  }

  // Check if role is self-assignable
  const selfAssignableRoles = await store.getGuildSelfAssignableRoles(guildId);
  const isAssignable = selfAssignableRoles.some(config => 
    config.status && config.roles.some(r => r.roleId === role.id && r.type !== 'remove_only')
  );

  if (!isAssignable && !member.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return await interaction.editReply({
      content: `❌ Role "${role.name}" is not self-assignable.`,
     flags: 64
    });
  }

  // Check if user already has the role
  if (targetMember.roles.cache.has(role.id)) {
    return await interaction.editReply({
      content: `❌ ${targetUser.id === interaction.user.id ? 'You' : targetUser.username} already have the "${role.name}" role.`,
     flags: 64
    });
  }

  try {
    await targetMember.roles.add(role);
    await interaction.editReply({
      content: `✅ Successfully added the "${role.name}" role to ${targetUser.id === interaction.user.id ? 'you' : targetUser.username}!`,
     flags: 64
    });
  } catch (error) {
    console.error('Error adding role:', error);
    await interaction.editReply({
      content: `❌ Failed to add role. Make sure the bot has permission to manage this role.`,
     flags: 64
    });
  }
}

// Show interactive role menu
async function handleRoleMenu(interaction, store, guildId) {
  try {
    const roles = await store.getGuildSelfAssignableRoles(guildId);
    const enabledRoles = roles.filter(role => role.status);
    
    if (enabledRoles.length === 0) {
      return await interaction.editReply({
        content: '❌ No self-assignable roles are currently available.',
        flags: 64
      });
    }

    const options = [];
    const roleMap = new Map();

    for (const roleConfig of enabledRoles) {
      for (const roleData of roleConfig.roles) {
        const role = interaction.guild.roles.cache.get(roleData.roleId);
        if (role && !roleMap.has(role.id)) {
          const hasRole = interaction.member.roles.cache.has(role.id);
          const canToggle = roleData.type === 'toggle';
          const canAdd = roleData.type === 'add_only' || roleData.type === 'toggle';
          const canRemove = roleData.type === 'remove_only' || roleData.type === 'toggle';
          
          let emoji = '🎭';
          let label = role.name;
          
          if (hasRole) {
            emoji = '✅';
            label += ' (You have this)';
          }
          
          if ((hasRole && canRemove) || (!hasRole && canAdd)) {
            options.push({
              label: label,
              value: role.id,
              emoji: emoji,
              description: hasRole ? 'Click to remove this role' : 'Click to add this role'
            });
            roleMap.set(role.id, { role, type: roleData.type, hasRole });
          }
        }
      }
    }

    if (options.length === 0) {
      return await interaction.editReply({
        content: '❌ No roles available for interaction.',
        flags: 64
      });
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`role_menu_${interaction.user.id}`)
      .setPlaceholder('Choose roles to add or remove')
      .setMinValues(1)
      .setMaxValues(Math.min(options.length, 25))
      .addOptions(options.slice(0, 25)); // Discord limit

    const row = new ActionRowBuilder().addComponents(selectMenu);

    const embed = new EmbedBuilder()
      .setTitle('🎭 Role Selection Menu')
      .setDescription('Select the roles you want to add or remove:')
      .setColor(0x8b5cf6)
      .setFooter({ text: 'This menu will expire in 5 minutes' });

    await interaction.editReply({
      embeds: [embed],
      components: [row],
      flags: 64
    });

    // Store role map for the interaction handler
    if (!global.roleMenuData) global.roleMenuData = new Map();
    global.roleMenuData.set(interaction.user.id, roleMap);

    // Clean up after 5 minutes
    setTimeout(() => {
      if (global.roleMenuData) {
        global.roleMenuData.delete(interaction.user.id);
      }
    }, 5 * 60 * 1000);

  } catch (error) {
    console.error('Error in handleRoleMenu:', error);
    
    // Only reply if the interaction hasn't been acknowledged yet
    if (!interaction.replied && !interaction.deferred) {
      await interaction.editReply({
        content: '❌ An error occurred while creating the role menu.',
       flags: 64
      });
    }
  }
}

// Remove a role from user
async function handleRoleRemove(interaction, store, guildId, member) {
  const roleName = interaction.options.getString('role');
  const targetUser = interaction.options.getUser('user') || interaction.user;
  const targetMember = await interaction.guild.members.fetch(targetUser.id);

  // Find role by name
  const role = interaction.guild.roles.cache.find(r => 
    r.name.toLowerCase() === roleName.toLowerCase()
  );

  if (!role) {
    return await interaction.editReply({
      content: `❌ Role "${roleName}" not found.`,
     flags: 64
    });
  }

  // Check if role is self-assignable
  const selfAssignableRoles = await store.getGuildSelfAssignableRoles(guildId);
  const isRemovable = selfAssignableRoles.some(config => 
    config.status && config.roles.some(r => r.roleId === role.id && r.type !== 'add_only')
  );

  if (!isRemovable && !member.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return await interaction.editReply({
      content: `❌ Role "${role.name}" cannot be self-removed.`,
     flags: 64
    });
  }

  // Check if user has the role
  if (!targetMember.roles.cache.has(role.id)) {
    return await interaction.editReply({
      content: `❌ ${targetUser.id === interaction.user.id ? 'You' : targetUser.username} don't have the "${role.name}" role.`,
     flags: 64
    });
  }

  try {
    await targetMember.roles.remove(role);
    await interaction.editReply({
      content: `✅ Successfully removed the "${role.name}" role from ${targetUser.id === interaction.user.id ? 'you' : targetUser.username}!`,
     flags: 64
    });
  } catch (error) {
    console.error('Error removing role:', error);
    await interaction.editReply({
      content: `❌ Failed to remove role. Make sure the bot has permission to manage this role.`,
     flags: 64
    });
  }
}

// Setup/configure self-assignable roles (admin only)
async function handleRoleSetup(interaction, store, guildId, member) {
  const action = interaction.options.getString('action');
  const role = interaction.options.getRole('role');
  const commandName = interaction.options.getString('command_name') || 'roles';
  const roleType = interaction.options.getString('type') || 'toggle';
  const channel = interaction.options.getChannel('channel');

  switch (action) {
    case 'add':
      if (!role) {
        return await interaction.editReply({
          content: '❌ Please specify a role to add.',
         flags: 64
        });
      }

      try {
        // Check if command already exists
        const existingCommand = await store.getGuildSelfAssignableRoleByCommand(guildId, commandName);
        
        if (existingCommand) {
          // Add role to existing command
          const updatedRoles = [...existingCommand.roles, { roleId: role.id, type: roleType }];
          await store.updateGuildSelfAssignableRole(guildId, commandName, {
            ...existingCommand,
            roles: updatedRoles
          }, member.id);
        } else {
          // Create new command
          await store.addGuildSelfAssignableRole(guildId, {
            commandName,
            description: `Self-assignable role command for ${role.name}`,
            channelId: channel ? channel.id : null,
            roles: [{ roleId: role.id, type: roleType }],
            requirePermission: false,
            allowedRoles: [],
            status: true
          }, member.id);
        }

        await interaction.editReply({
          content: `✅ Added role "${role.name}" as self-assignable with type "${roleType}".`,
         flags: 64
        });
      } catch (error) {
        console.error('Error adding self-assignable role:', error);
        await interaction.editReply({
          content: '❌ Failed to add self-assignable role.',
         flags: 64
        });
      }
      break;

    case 'remove':
      if (!role) {
        return await interaction.editReply({
          content: '❌ Please specify a role to remove.',
         flags: 64
        });
      }

      try {
        const command = await store.getGuildSelfAssignableRoleByCommand(guildId, commandName);
        if (!command) {
          return await interaction.editReply({
            content: `❌ No self-assignable role command "${commandName}" found.`,
           flags: 64
          });
        }

        const updatedRoles = command.roles.filter(r => r.roleId !== role.id);
        
        if (updatedRoles.length === 0) {
          // Delete the entire command if no roles left
          await store.deleteGuildSelfAssignableRole(guildId, commandName);
        } else {
          // Update with remaining roles
          await store.updateGuildSelfAssignableRole(guildId, commandName, {
            ...command,
            roles: updatedRoles
          }, member.id);
        }

        await interaction.editReply({
          content: `✅ Removed role "${role.name}" from self-assignable roles.`,
         flags: 64
        });
      } catch (error) {
        console.error('Error removing self-assignable role:', error);
        await interaction.editReply({
          content: '❌ Failed to remove self-assignable role.',
         flags: 64
        });
      }
      break;

    case 'list':
      try {
        const roles = await store.getGuildSelfAssignableRoles(guildId);
        
        if (roles.length === 0) {
          return await interaction.editReply({
            content: '📝 No self-assignable roles configured.',
           flags: 64
          });
        }

        let description = '';
        for (const roleConfig of roles) {
          description += `**${roleConfig.commandName}** (${roleConfig.status ? '✅ Enabled' : '❌ Disabled'})\n`;
          description += `Description: ${roleConfig.description || 'None'}\n`;
          description += `Roles: `;
          
          const roleNames = [];
          for (const roleData of roleConfig.roles) {
            const guildRole = interaction.guild.roles.cache.get(roleData.roleId);
            if (guildRole) {
              roleNames.push(`${guildRole.name} (${roleData.type})`);
            }
          }
          description += roleNames.join(', ') || 'None';
          description += '\n\n';
        }

        const embed = new EmbedBuilder()
          .setTitle('🛠️ Self-Assignable Role Configuration')
          .setDescription(description)
          .setColor(0x8b5cf6);

        await interaction.editReply({ embeds: [embed],flags: 64 });
      } catch (error) {
        console.error('Error listing self-assignable roles:', error);
        await interaction.editReply({
          content: '❌ Failed to list self-assignable roles.',
         flags: 64
        });
      }
      break;

    default:
      await interaction.editReply({
        content: '❌ Invalid action. Use: add, remove, or list.',
       flags: 64
      });
  }
}

// Toggle role command status
async function handleRoleToggle(interaction, store, guildId, member) {
  const commandName = interaction.options.getString('command_name');
  
  try {
    const command = await store.getGuildSelfAssignableRoleByCommand(guildId, commandName);
    if (!command) {
      return await interaction.editReply({
        content: `❌ No self-assignable role command "${commandName}" found.`,
       flags: 64
      });
    }

    const newStatus = !command.status;
    await store.toggleGuildSelfAssignableRoleStatus(guildId, commandName, newStatus);

    await interaction.editReply({
      content: `✅ Role command "${commandName}" is now ${newStatus ? 'enabled' : 'disabled'}.`,
     flags: 64
    });
  } catch (error) {
    console.error('Error toggling role command:', error);
    await interaction.editReply({
      content: '❌ Failed to toggle role command status.',
     flags: 64
    });
  }
}
