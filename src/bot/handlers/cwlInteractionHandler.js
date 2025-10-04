// CWL Interaction Handler - Example handler for button and select menu interactions
// Add this to your Discord bot's interaction handling system

const {
  getCWLLeaderboard,
  getCWLPredictions,
  getCWLMVPAwards,
  getCWLDataExport,
  getCWLInteractiveLeaderboard,
  getCWLStatisticsDashboard,
  getCWLClanManagement
} = require('../watchers/cwl');

/**
 * Handle CWL button interactions
 * @param {Interaction} interaction - Discord button interaction
 */
async function handleCWLButtonInteraction(interaction) {
  if (!interaction.isButton()) return false;
  if (!interaction.customId.startsWith('cwl_')) return false;

  // Parse custom ID: cwl_action_clanTag_season
  const parts = interaction.customId.split('_');
  if (parts.length < 4) return false;

  const action = parts[1];
  const clanTag = parts[2];
  const season = parts[3];
  const guildId = interaction.guildId;

  // Get manager instances
  const managers = {
    leaderboard: getCWLLeaderboard(),
    predictions: getCWLPredictions(),
    mvp: getCWLMVPAwards(),
    export: getCWLDataExport(),
    dashboard: getCWLStatisticsDashboard(),
    management: getCWLClanManagement()
  };

  const interactive = getCWLInteractiveLeaderboard();
  await interactive.handleButtonInteraction(interaction, managers);

  return true;
}

/**
 * Handle CWL select menu interactions
 * @param {Interaction} interaction - Discord select menu interaction
 */
async function handleCWLSelectMenuInteraction(interaction) {
  if (!interaction.isStringSelectMenu()) return false;
  if (!interaction.customId.startsWith('cwl_player_select_')) return false;

  // Parse custom ID: cwl_player_select_clanTag_season
  const parts = interaction.customId.split('_');
  if (parts.length < 5) return false;

  const clanTag = parts[3];
  const season = parts[4];
  const guildId = interaction.guildId;
  const playerTag = interaction.values[0]; // Selected player

  const interactive = getCWLInteractiveLeaderboard();
  await interactive.handlePlayerSelect(interaction, guildId, clanTag, season, playerTag);

  return true;
}

/**
 * Main interaction handler - add this to your bot's interactionCreate event
 */
async function handleInteraction(interaction) {
  try {
    // Handle button interactions
    if (interaction.isButton()) {
      const handled = await handleCWLButtonInteraction(interaction);
      if (handled) return;
    }

    // Handle select menu interactions
    if (interaction.isStringSelectMenu()) {
      const handled = await handleCWLSelectMenuInteraction(interaction);
      if (handled) return;
    }

    // Add other interaction handlers here...
  } catch (error) {
    console.error('[CWL Interaction] Error handling interaction:', error.message);
    
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: '❌ An error occurred!' });
    } else {
      await interaction.reply({ content: '❌ An error occurred!', ephemeral: true });
    }
  }
}

module.exports = {
  handleInteraction,
  handleCWLButtonInteraction,
  handleCWLSelectMenuInteraction
};
