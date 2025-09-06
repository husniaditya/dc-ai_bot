const express = require('express');

module.exports = function(client, store) {
  const router = express.Router();

  // Get Discord roles for a guild
  router.get('/', async (req, res) => {
    try {
      const { guildId } = req.query;
      if (!guildId) {
        return res.status(400).json({ error: 'guildId is required' });
      }

      // Get guild from Discord client
      const guild = await client.guilds.fetch(guildId).catch(() => null);
      if (!guild) {
        return res.status(404).json({ error: 'Guild not found' });
      }

      // Fetch all roles
      const roles = await guild.roles.fetch();
      const roleList = roles
        .filter(role => role.id !== guild.id) // Exclude @everyone role
        .map(role => ({
          id: role.id,
          name: role.name,
          color: role.color,
          position: role.position,
          mentionable: role.mentionable,
          managed: role.managed
        }))
        .sort((a, b) => b.position - a.position); // Sort by position (highest first)

      res.json({ roles: roleList });
    } catch (error) {
      console.error('Error fetching roles:', error);
      res.status(500).json({ error: 'Failed to fetch roles' });
    }
  });

  // Get reaction roles for a guild
  router.get('/reaction-roles', async (req, res) => {
    try {
      const { guildId } = req.query;
      if (!guildId) {
        return res.status(400).json({ error: 'guildId is required' });
      }

      const reactionRoles = await store.getGuildReactionRoles(guildId);
      res.json({ reactionRoles });
    } catch (error) {
      console.error('Error fetching reaction roles:', error);
      res.status(500).json({ error: 'Failed to fetch reaction roles' });
    }
  });

  // Add a new reaction role
  router.post('/reaction-roles', async (req, res) => {
    try {
      const { guildId, channelId, reactions, customMessage, title, status } = req.body;
      
      if (!guildId || !channelId || !reactions || !Array.isArray(reactions) || reactions.length === 0 || !customMessage) {
        return res.status(400).json({ error: 'Missing required fields or invalid reactions array' });
      }

      // Validate that at least one reaction has a valid emoji and roleId
      const validReactions = reactions.filter(reaction => reaction.emoji && reaction.roleId && reaction.emoji.trim() !== '' && reaction.roleId.trim() !== '');
      if (validReactions.length === 0) {
        return res.status(400).json({ error: 'At least one valid reaction with emoji and role is required' });
      }

      let finalMessageId;

      // Always create a new message for new reaction roles
      try {
        // Use the client passed to this router
        if (!client || !client.isReady()) {
          return res.status(500).json({ error: 'Bot is not ready' });
        }

        const channel = await client.channels.fetch(channelId);
        if (!channel) {
          return res.status(404).json({ error: 'Channel not found' });
        }

        // Post the message
        const message = await channel.send(customMessage);
        finalMessageId = message.id;

        // Add all reactions
        for (const reaction of validReactions) {
          await message.react(reaction.emoji);
        }
      } catch (discordError) {
        console.error('Error creating Discord message:', discordError);
        return res.status(500).json({ error: 'Failed to create message in Discord' });
      }

      // Save each reaction to database
      const savedReactions = [];
      for (const reaction of validReactions) {
        const newReactionRole = await store.addGuildReactionRole(guildId, {
          messageId: finalMessageId,
          channelId,
          emoji: reaction.emoji,
          roleId: reaction.roleId,
          type: reaction.type || 'toggle',
          customMessage: customMessage,
          title: title || null,
          status: status !== false
        });

        if (newReactionRole) {
          savedReactions.push({
            ...newReactionRole,
            messageId: finalMessageId
          });
        }
      }

      if (savedReactions.length === 0) {
        return res.status(500).json({ error: 'Failed to create reaction roles' });
      }

      res.json({ 
        reactionRoles: savedReactions
      });
    } catch (error) {
      console.error('Error creating reaction role:', error);
      res.status(500).json({ error: 'Failed to create reaction role' });
    }
  });

  // Update a reaction role
  router.put('/reaction-roles/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { guildId, messageId, channelId, reactions, customMessage, title, status } = req.body;
      
      if (!guildId || !messageId || !channelId || !reactions || !Array.isArray(reactions)) {
        return res.status(400).json({ error: 'Missing required fields or invalid reactions array' });
      }

      // Validate that at least one reaction has a valid emoji and roleId
      const validReactions = reactions.filter(reaction => reaction.emoji && reaction.roleId && reaction.emoji.trim() !== '' && reaction.roleId.trim() !== '');
      if (validReactions.length === 0) {
        return res.status(400).json({ error: 'At least one valid reaction with emoji and role is required' });
      }

      // Update the Discord message if custom message changed
      try {
        if (!client || !client.isReady()) {
          return res.status(500).json({ error: 'Bot is not ready' });
        }

        const channel = await client.channels.fetch(channelId);
        if (!channel) {
          return res.status(404).json({ error: 'Channel not found' });
        }

        const message = await channel.messages.fetch(messageId);
        if (!message) {
          return res.status(404).json({ error: 'Message not found' });
        }

        // Update message content if it changed
        if (customMessage && message.content !== customMessage) {
          await message.edit(customMessage);
        }

        // Clear existing reactions and add new ones
        await message.reactions.removeAll();
        for (const reaction of validReactions) {
          await message.react(reaction.emoji);
        }
      } catch (discordError) {
        console.error('Error updating Discord message:', discordError);
        return res.status(500).json({ error: 'Failed to update message in Discord' });
      }

      // Remove existing reactions for this message and add new ones
      await store.removeGuildReactionRolesByMessage(guildId, messageId);
      
      const savedReactions = [];
      for (const reaction of validReactions) {
        const newReactionRole = await store.addGuildReactionRole(guildId, {
          messageId,
          channelId,
          emoji: reaction.emoji,
          roleId: reaction.roleId,
          type: reaction.type || 'toggle',
          customMessage: customMessage || null,
          title: title || null,
          status: status !== false
        });

        if (newReactionRole) {
          savedReactions.push(newReactionRole);
        }
      }

      if (savedReactions.length === 0) {
        return res.status(500).json({ error: 'Failed to update reaction roles' });
      }

      res.json({ reactionRoles: savedReactions });
    } catch (error) {
      console.error('Error updating reaction role:', error);
      res.status(500).json({ error: 'Failed to update reaction role' });
    }
  });

  // Toggle reaction role status (PATCH method)
  router.patch('/reaction-roles/:id/status', async (req, res) => {
    try {
      const { id } = req.params;
      const { guildId, status } = req.body;
      
      if (!guildId || status === undefined) {
        return res.status(400).json({ error: 'guildId and status are required' });
      }

      const success = await store.updateGuildReactionRoleStatus(guildId, parseInt(id), status);

      if (!success) {
        return res.status(500).json({ error: 'Failed to update reaction role status' });
      }

      res.json({ success: true, status: !!status });
    } catch (error) {
      console.error('Error updating reaction role status:', error);
      res.status(500).json({ error: 'Failed to update reaction role status' });
    }
  });

  // Toggle reaction role status (PUT method for compatibility)
  router.put('/reaction-roles/:id/status', async (req, res) => {
    try {
      const { id } = req.params;
      const { guildId, status } = req.body;
      
      if (!guildId || status === undefined) {
        return res.status(400).json({ error: 'guildId and status are required' });
      }

      const success = await store.updateGuildReactionRoleStatus(guildId, parseInt(id), status);

      if (!success) {
        return res.status(500).json({ error: 'Failed to update reaction role status' });
      }

      res.json({ success: true, status: !!status });
    } catch (error) {
      console.error('Error updating reaction role status:', error);
      res.status(500).json({ error: 'Failed to update reaction role status' });
    }
  });

  // Delete reaction role by message ID (deletes all reactions for a message)
  router.delete('/reaction-roles/message/:messageId', async (req, res) => {
    try {
      const { messageId } = req.params;
      const guildId = req.headers['x-guild-id'] || req.body.guildId;
      
      if (!guildId) {
        return res.status(400).json({ error: 'guildId is required (in x-guild-id header or request body)' });
      }

      // First, try to get the reaction role data to find the channel
      const reactionRoles = await store.getGuildReactionRoles(guildId);
      const messageReactionRoles = reactionRoles.filter(role => role.messageId === messageId);
      
      // Try to delete the Discord message if we can find the channel
      if (messageReactionRoles.length > 0 && client && client.isReady()) {
        try {
          const channelId = messageReactionRoles[0].channelId;
          const channel = await client.channels.fetch(channelId);
          if (channel) {
            const message = await channel.messages.fetch(messageId);
            if (message) {
              await message.delete();
            }
          }
        } catch (discordError) {
          console.warn('Could not delete Discord message (continuing with database cleanup):', discordError.message);
          // Don't fail the request if Discord message deletion fails
        }
      }

      // Delete from database
      const success = await store.deleteGuildReactionRoleByMessageId(guildId, messageId);

      if (!success) {
        return res.status(500).json({ error: 'Failed to delete reaction role configuration' });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting reaction role by message ID:', error);
      res.status(500).json({ error: 'Failed to delete reaction role configuration' });
    }
  });

  // Delete a reaction role by individual ID
  router.delete('/reaction-roles/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const guildId = req.headers['x-guild-id'] || req.body.guildId;
      
      if (!guildId) {
        return res.status(400).json({ error: 'guildId is required (in x-guild-id header or request body)' });
      }

      const success = await store.deleteGuildReactionRole(guildId, parseInt(id));

      if (!success) {
        return res.status(500).json({ error: 'Failed to delete reaction role' });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting reaction role:', error);
      res.status(500).json({ error: 'Failed to delete reaction role' });
    }
  });

  // ============================================
  // Self-Assignable Roles (Slash Command Roles)
  // ============================================

  // Get self-assignable roles for a guild
  router.get('/guild/:guildId/self-assignable-roles', async (req, res) => {
    try {
      const { guildId } = req.params;
      if (!guildId) {
        return res.status(400).json({ error: 'guildId is required' });
      }

      const slashRoles = await store.getGuildSelfAssignableRoles(guildId);
      res.json({ success: true, slashRoles });
    } catch (error) {
      console.error('Error fetching self-assignable roles:', error);
      res.status(500).json({ error: 'Failed to fetch self-assignable roles' });
    }
  });

  // Add a new self-assignable role command
  router.post('/guild/:guildId/self-assignable-roles', async (req, res) => {
    try {
      const { guildId } = req.params;
      const { commandName, description, channelId, roles, requirePermission, allowedRoles, status } = req.body;
      
      if (!guildId || !commandName || !roles || !Array.isArray(roles) || roles.length === 0) {
        return res.status(400).json({ error: 'guildId, commandName, and roles array are required' });
      }

      // Validate that all roles have roleId
      const validRoles = roles.filter(role => role.roleId && role.roleId.trim() !== '');
      if (validRoles.length === 0) {
        return res.status(400).json({ error: 'At least one valid role with roleId is required' });
      }

      // Validate command name format - now more flexible since it's just a title
      if (!commandName || commandName.trim().length === 0) {
        return res.status(400).json({ error: 'Title is required' });
      }

      if (commandName.length > 100) {
        return res.status(400).json({ error: 'Title must be 100 characters or less' });
      }

      // Check if command already exists
      const existingCommand = await store.getGuildSelfAssignableRoleByCommand(guildId, commandName);
      if (existingCommand) {
        return res.status(400).json({ error: 'A command with this name already exists' });
      }

      // Get user ID from token (you may need to implement this based on your auth system)
      const createdBy = req.user?.id || null;

      const slashRoles = await store.addGuildSelfAssignableRole(guildId, {
        commandName,
        description: description || '',
        channelId: channelId || null,
        roles: validRoles,
        requirePermission: requirePermission || false,
        allowedRoles: allowedRoles || [],
        status: status !== false
      }, createdBy);

      res.json({ success: true, slashRoles });
    } catch (error) {
      console.error('Error creating self-assignable role:', error);
      if (error.message.includes('already exists')) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to create self-assignable role' });
      }
    }
  });

  // Update a self-assignable role command
  router.put('/guild/:guildId/self-assignable-roles/:commandName', async (req, res) => {
    try {
      const { guildId, commandName } = req.params;
      const { description, channelId, roles, requirePermission, allowedRoles, status } = req.body;
      
      if (!guildId || !commandName) {
        return res.status(400).json({ error: 'guildId and commandName are required' });
      }

      // Check if command exists
      const existingCommand = await store.getGuildSelfAssignableRoleByCommand(guildId, commandName);
      if (!existingCommand) {
        return res.status(404).json({ error: 'Command not found' });
      }

      if (roles && Array.isArray(roles)) {
        const validRoles = roles.filter(role => role.roleId && role.roleId.trim() !== '');
        if (validRoles.length === 0) {
          return res.status(400).json({ error: 'At least one valid role with roleId is required' });
        }
      }

      // Get user ID from token
      const updatedBy = req.user?.id || null;

      const slashRoles = await store.updateGuildSelfAssignableRole(guildId, commandName, {
        description: description !== undefined ? description : existingCommand.description,
        channelId: channelId !== undefined ? channelId : existingCommand.channelId,
        roles: roles || existingCommand.roles,
        requirePermission: requirePermission !== undefined ? requirePermission : existingCommand.requirePermission,
        allowedRoles: allowedRoles !== undefined ? allowedRoles : existingCommand.allowedRoles,
        status: status !== undefined ? status : existingCommand.status
      }, updatedBy);

      res.json({ success: true, slashRoles });
    } catch (error) {
      console.error('Error updating self-assignable role:', error);
      res.status(500).json({ error: 'Failed to update self-assignable role' });
    }
  });

  // Toggle self-assignable role command status (PATCH method)
  router.patch('/guild/:guildId/self-assignable-roles/:commandName/toggle', async (req, res) => {
    try {
      const { guildId, commandName } = req.params;
      const { status } = req.body;
      
      if (!guildId || !commandName || status === undefined) {
        return res.status(400).json({ error: 'guildId, commandName, and status are required' });
      }

      const slashRoles = await store.toggleGuildSelfAssignableRoleStatus(guildId, commandName, status);
      res.json({ success: true, slashRoles });
    } catch (error) {
      console.error('Error toggling self-assignable role status:', error);
      res.status(500).json({ error: 'Failed to toggle self-assignable role status' });
    }
  });

  // Toggle self-assignable role command status (PUT method for compatibility)
  router.put('/guild/:guildId/self-assignable-roles/:commandName/toggle', async (req, res) => {
    try {
      const { guildId, commandName } = req.params;
      const { status } = req.body;
      
      if (!guildId || !commandName || status === undefined) {
        return res.status(400).json({ error: 'guildId, commandName, and status are required' });
      }

      const slashRoles = await store.toggleGuildSelfAssignableRoleStatus(guildId, commandName, status);
      res.json({ success: true, slashRoles });
    } catch (error) {
      console.error('Error toggling self-assignable role status:', error);
      res.status(500).json({ error: 'Failed to toggle self-assignable role status' });
    }
  });

  // Delete a self-assignable role command
  router.delete('/guild/:guildId/self-assignable-roles/:commandName', async (req, res) => {
    try {
      const { guildId, commandName } = req.params;
      
      if (!guildId || !commandName) {
        return res.status(400).json({ error: 'guildId and commandName are required' });
      }

      const success = await store.deleteGuildSelfAssignableRole(guildId, commandName);
      
      if (!success) {
        return res.status(404).json({ error: 'Command not found or failed to delete' });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting self-assignable role:', error);
      res.status(500).json({ error: 'Failed to delete self-assignable role' });
    }
  });

  // Get a specific self-assignable role command
  router.get('/guild/:guildId/self-assignable-roles/:commandName', async (req, res) => {
    try {
      const { guildId, commandName } = req.params;
      
      if (!guildId || !commandName) {
        return res.status(400).json({ error: 'guildId and commandName are required' });
      }

      const command = await store.getGuildSelfAssignableRoleByCommand(guildId, commandName);
      
      if (!command) {
        return res.status(404).json({ error: 'Command not found' });
      }

      res.json({ success: true, command });
    } catch (error) {
      console.error('Error fetching self-assignable role command:', error);
      res.status(500).json({ error: 'Failed to fetch self-assignable role command' });
    }
  });

  return router;
};
