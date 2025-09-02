const { PermissionsBitField } = require('discord.js');

module.exports = (client, store) => {
  client.on('messageReactionRemove', async (reaction, user) => {
    try {
      // Ignore reactions from bots
      if (user.bot) return;

      // Fetch the message if it's partial
      if (reaction.partial) {
        try {
          await reaction.fetch();
        } catch (error) {
          console.error('Failed to fetch reaction:', error);
          return;
        }
      }

      // Fetch the user if they're partial
      if (user.partial) {
        try {
          await user.fetch();
        } catch (error) {
          console.error('Failed to fetch user:', error);
          return;
        }
      }

      const guild = reaction.message.guild;
      if (!guild) return;

      const member = await guild.members.fetch(user.id).catch(() => null);
      if (!member) return;

      // Check if the bot has permission to manage roles
      const botMember = guild.members.me;
      if (!botMember || !botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
        console.error(`Bot doesn't have Manage Roles permission in guild ${guild.id}`);
        return;
      }

      // Get all reaction roles for this guild
      const reactionRoles = await store.getGuildReactionRoles(guild.id);
      if (!reactionRoles || reactionRoles.length === 0) return;

      // Find matching reaction role
      const matchingRole = reactionRoles.find(rr => {
        // Check if message IDs match
        if (rr.messageId !== reaction.message.id) return false;
        
        // Check if emojis match
        const reactionEmoji = reaction.emoji.id ? `<:${reaction.emoji.name}:${reaction.emoji.id}>` : reaction.emoji.name;
        return rr.emoji === reactionEmoji;
      });

      if (!matchingRole) return;

      // Check if the reaction role is enabled
      if (matchingRole.status === false) return;

      // Get the Discord role
      const role = guild.roles.cache.get(matchingRole.roleId);
      if (!role) {
        console.error(`Role ${matchingRole.roleId} not found in guild ${guild.id}`);
        return;
      }

      // Check if bot can manage this role (role hierarchy)
      if (role.position >= botMember.roles.highest.position) {
        console.error(`Bot cannot manage role ${role.name} - role hierarchy issue`);
        return;
      }

      // Handle different reaction types
      const type = matchingRole.type || 'toggle';
      
      // Refresh member data to get latest roles (important for reaction removal timing)
      await member.fetch();
      const hasRole = member.roles.cache.has(role.id);

      try {
        if (type === 'toggle' && hasRole) {
          // For toggle type: remove role when user un-reacts (traditional behavior)
          await member.roles.remove(role);
          console.log(`Removed role ${role.name} from ${user.tag} via reaction removal (toggle)`);
        } else if (type === 'remove_only' && hasRole) {
          await member.roles.remove(role);
          console.log(`Removed role ${role.name} from ${user.tag} via reaction removal (remove_only)`);
        }
        // For add_only type, removing reaction doesn't remove the role
      } catch (error) {
        console.error(`Failed to manage role ${role.name} for user ${user.tag}:`, error);
        
        // If it's a permission error, log more details
        if (error.code === 50013) {
          console.error(`Missing permissions to manage role ${role.name} for user ${user.tag}`);
        }
      }

    } catch (error) {
      console.error('Error in messageReactionRemove event:', error);
    }
  });
};
