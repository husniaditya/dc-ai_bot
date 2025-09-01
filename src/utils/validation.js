/**
 * Command validation utilities for Discord bot
 */

/**
 * Check if a command is enabled for a guild
 * @param {string} commandName - The full command name (e.g., "role list", "poll create")
 * @param {string} guildId - The guild ID
 * @param {Object} store - The store instance
 * @returns {Promise<boolean>} - True if command is enabled, false if disabled
 */
async function isCommandEnabled(commandName, guildId, store) {
  try {
    const commandToggles = await store.getGuildCommandToggles(guildId);
    return commandToggles[commandName] !== false;
  } catch (error) {
    console.warn('Failed to check command state, allowing by default:', error.message);
    return true; // Allow by default if there's an error
  }
}

/**
 * Validate if a command can be executed and return appropriate error response
 * @param {Object} interaction - Discord interaction object
 * @param {string} commandName - The full command name (e.g., "role list")
 * @param {Object} store - The store instance
 * @param {boolean} isEphemeral - Whether the command response should be ephemeral
 * @returns {Promise<string|null>} - Error message if command should be blocked, null if allowed
 */
async function validateCommandExecution(interaction, commandName, store, isEphemeral = false) {
  const guildId = interaction.guild?.id;
  
  if (!guildId) {
    return '❌ This command can only be used in servers.';
  }

  const enabled = await isCommandEnabled(commandName, guildId, store);
  
  if (!enabled) {
    return '❌ This command is currently disabled by server administrators.';
  }

  return null; // Command is allowed
}

/**
 * Check command and reply with error if disabled
 * @param {Object} interaction - Discord interaction object
 * @param {string} commandName - The full command name
 * @param {Object} store - The store instance
 * @param {boolean} isEphemeral - Whether the response should be ephemeral
 * @returns {Promise<boolean>} - True if command should continue, false if blocked
 */
async function checkCommandAndReply(interaction, commandName, store, isEphemeral = false) {
  const errorMessage = await validateCommandExecution(interaction, commandName, store, isEphemeral);
  
  if (errorMessage) {
    const flags = isEphemeral ? 64 : 0;
    
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({
        content: errorMessage,
        flags: flags
      });
    } else {
      await interaction.reply({
        content: errorMessage,
        flags: flags
      });
    }
    
    return false;
  }
  
  return true;
}

module.exports = {
  isCommandEnabled,
  validateCommandExecution,
  checkCommandAndReply
};
