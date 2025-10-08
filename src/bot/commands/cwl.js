const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const store = require('../../config/store');
const { cleanClanTag } = require('../services/clashofclans');
const {
  getCWLStateManager,
  getCWLStatisticsDashboard,
  getCWLDataExport,
  getCWLMVPAwards,
  getCWLClanManagement,
  getCWLInteractiveLeaderboard
} = require('../watchers/cwl');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cwl')
    .setDescription('Clan War League (CWL) information and commands')
    .addSubcommand(subcommand =>
      subcommand
        .setName('dashboard')
        .setDescription('Show comprehensive CWL statistics dashboard')
        .addStringOption(option =>
          option.setName('clan')
            .setDescription('Clan tag (optional - uses primary clan if not specified)')
            .setRequired(false)
        ))
    .addSubcommand(subcommand =>
      subcommand
        .setName('export')
        .setDescription('Export CWL data to file')
        .addStringOption(option =>
          option.setName('type')
            .setDescription('Type of data to export')
            .setRequired(true)
            .addChoices(
              { name: 'Player Performance', value: 'performance' },
              { name: 'Standings History', value: 'standings' },
              { name: 'Season Report', value: 'report' }
            ))
        .addStringOption(option =>
          option.setName('format')
            .setDescription('Export format')
            .setRequired(true)
            .addChoices(
              { name: 'JSON', value: 'json' },
              { name: 'CSV', value: 'csv' }
            ))
        .addStringOption(option =>
          option.setName('clan')
            .setDescription('Clan tag (optional - uses primary clan if not specified)')
            .setRequired(false)
        ))
    .addSubcommand(subcommand =>
      subcommand
        .setName('mvp')
        .setDescription('Show CWL MVP awards')
        .addIntegerOption(option =>
          option.setName('round')
            .setDescription('Round number (leave empty for season MVP)')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(7))
        .addStringOption(option =>
          option.setName('clan')
            .setDescription('Clan tag (optional - uses primary clan if not specified)')
            .setRequired(false)
        ))
    .addSubcommand(subcommand =>
      subcommand
        .setName('roster')
        .setDescription('Show CWL lineup recommendations')
        .addIntegerOption(option =>
          option.setName('size')
            .setDescription('Roster size')
            .setRequired(false)
            .addChoices(
              { name: '15 players', value: 15 },
              { name: '30 players', value: 30 },
              { name: '50 players', value: 50 }
            ))
        .addStringOption(option =>
          option.setName('clan')
            .setDescription('Clan tag (optional - uses primary clan if not specified)')
            .setRequired(false)
        ))
    .addSubcommand(subcommand =>
      subcommand
        .setName('alerts')
        .setDescription('Check for CWL performance issues')
        .addStringOption(option =>
          option.setName('clan')
            .setDescription('Clan tag (optional - uses primary clan if not specified)')
            .setRequired(false)
        )),
  
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    try {
      switch (subcommand) {
        case 'dashboard':
          await handleDashboardCommand(interaction);
          break;
        case 'export':
          await handleExportCommand(interaction);
          break;
        case 'mvp':
          await handleMvpCommand(interaction);
          break;
        case 'roster':
          await handleRosterCommand(interaction);
          break;
        case 'alerts':
          await handleAlertsCommand(interaction);
          break;
        default:
          await interaction.reply({ content: 'Unknown subcommand!', flags: 64 }); // 64 = EPHEMERAL
      }
    } catch (error) {
      console.error('[CWL Command] Error:', error);
      
      const errorMessage = 'An error occurred while processing your CWL request.';
      
      if (interaction.deferred) {
        await interaction.editReply({ content: errorMessage });
      } else {
        await interaction.reply({ content: errorMessage, flags: 64 }); // 64 = EPHEMERAL
      }
    }
  }
};

// Dashboard subcommand
async function handleDashboardCommand(interaction) {
  await interaction.deferReply();

  const cfg = await store.getGuildClashOfClansConfig(interaction.guildId);
  if (!cfg.enabled || !cfg.trackCWL) {
    return interaction.editReply({ content: '❌ CWL tracking is not enabled!' });
  }

  // Get clan tag
  let clanTag = interaction.options.getString('clan');
  if (!clanTag && cfg.clans && cfg.clans.length > 0) {
    clanTag = cfg.clans[0];
  }

  if (!clanTag) {
    return interaction.editReply({ content: '❌ No clan specified and no default clan configured!' });
  }

  // Clean the clan tag (remove # if present)
  clanTag = cleanClanTag(clanTag);

  // Get current season
  const stateManager = getCWLStateManager();
  const season = stateManager.getCurrentSeason();

  // Generate dashboard
  const dashboard = getCWLStatisticsDashboard();
  const embed = await dashboard.generateDashboardEmbed(interaction.guildId, clanTag, season);

  if (!embed) {
    return interaction.editReply({ content: '❌ No CWL data available for this season!' });
  }

  // Add interactive buttons
  const interactive = getCWLInteractiveLeaderboard();
  const buttons = interactive.createLeaderboardButtons(clanTag, season);

  await interaction.editReply({ embeds: [embed], components: buttons });
}

// Export subcommand
async function handleExportCommand(interaction) {
  await interaction.deferReply({ flags: 64 }); // 64 = EPHEMERAL

  const cfg = await store.getGuildClashOfClansConfig(interaction.guildId);
  if (!cfg.enabled || !cfg.trackCWL) {
    return interaction.editReply({ content: '❌ CWL tracking is not enabled!' });
  }

  // Get parameters
  const type = interaction.options.getString('type');
  const format = interaction.options.getString('format');
  let clanTag = interaction.options.getString('clan');
  
  if (!clanTag && cfg.clans && cfg.clans.length > 0) {
    clanTag = cfg.clans[0];
  }

  if (!clanTag) {
    return interaction.editReply({ content: '❌ No clan specified!' });
  }

  // Clean the clan tag (remove # if present)
  clanTag = cleanClanTag(clanTag);

  // Get current season
  const stateManager = getCWLStateManager();
  const season = stateManager.getCurrentSeason();

  // Generate export
  const exporter = getCWLDataExport();
  const exportData = await exporter.generateExportAttachment(
    interaction.guildId,
    clanTag,
    season,
    format,
    type
  );

  if (!exportData) {
    return interaction.editReply({ content: '❌ No data available to export!' });
  }

  await interaction.editReply({
    content: `✅ Export complete! File: \`${exportData.filename}\``,
    files: [{
      attachment: exportData.filePath,
      name: exportData.filename
    }]
  });
}

// MVP subcommand
async function handleMvpCommand(interaction) {
  await interaction.deferReply();

  const cfg = await store.getGuildClashOfClansConfig(interaction.guildId);
  if (!cfg.enabled || !cfg.trackCWL) {
    return interaction.editReply({ content: '❌ CWL tracking is not enabled!' });
  }

  // Get parameters
  const roundNumber = interaction.options.getInteger('round');
  let clanTag = interaction.options.getString('clan');
  
  if (!clanTag && cfg.clans && cfg.clans.length > 0) {
    clanTag = cfg.clans[0];
  }

  if (!clanTag) {
    return interaction.editReply({ content: '❌ No clan specified!' });
  }

  // Clean the clan tag (remove # if present)
  clanTag = cleanClanTag(clanTag);

  // Get current season
  const stateManager = getCWLStateManager();
  const season = stateManager.getCurrentSeason();

  // Generate MVP embed
  const mvpAwards = getCWLMVPAwards();
  let embed;

  if (roundNumber) {
    embed = await mvpAwards.generateRoundMVPEmbed(interaction.guildId, clanTag, season, roundNumber);
  } else {
    embed = await mvpAwards.generateSeasonMVPEmbed(interaction.guildId, clanTag, season);
  }

  if (!embed) {
    return interaction.editReply({ content: '❌ No MVP data available!' });
  }

  await interaction.editReply({ embeds: [embed] });
}

// Roster subcommand
async function handleRosterCommand(interaction) {
  await interaction.deferReply({ flags: 64 }); // 64 = EPHEMERAL

  const cfg = await store.getGuildClashOfClansConfig(interaction.guildId);
  if (!cfg.enabled || !cfg.trackCWL) {
    return interaction.editReply({ content: '❌ CWL tracking is not enabled!' });
  }

  // Get parameters
  const rosterSize = interaction.options.getInteger('size') || 15;
  let clanTag = interaction.options.getString('clan');
  
  if (!clanTag && cfg.clans && cfg.clans.length > 0) {
    clanTag = cfg.clans[0];
  }

  if (!clanTag) {
    return interaction.editReply({ content: '❌ No clan specified!' });
  }

  // Clean the clan tag (remove # if present)
  clanTag = cleanClanTag(clanTag);

  // Get current season
  const stateManager = getCWLStateManager();
  const season = stateManager.getCurrentSeason();

  // Generate roster report
  const management = getCWLClanManagement();
  const embed = await management.generateRosterReportEmbed(
    interaction.guildId,
    clanTag,
    season,
    rosterSize
  );

  if (!embed) {
    return interaction.editReply({ content: '❌ No roster data available!' });
  }

  await interaction.editReply({ embeds: [embed] });
}

// Alerts subcommand
async function handleAlertsCommand(interaction) {
  await interaction.deferReply({ flags: 64 }); // 64 = EPHEMERAL

  const cfg = await store.getGuildClashOfClansConfig(interaction.guildId);
  if (!cfg.enabled || !cfg.trackCWL) {
    return interaction.editReply({ content: '❌ CWL tracking is not enabled!' });
  }

  // Get clan tag
  let clanTag = interaction.options.getString('clan');
  if (!clanTag && cfg.clans && cfg.clans.length > 0) {
    clanTag = cfg.clans[0];
  }

  if (!clanTag) {
    return interaction.editReply({ content: '❌ No clan specified!' });
  }

  // Clean the clan tag (remove # if present)
  clanTag = cleanClanTag(clanTag);

  // Get current season
  const stateManager = getCWLStateManager();
  const season = stateManager.getCurrentSeason();

  // Generate performance alerts
  const management = getCWLClanManagement();
  const embed = await management.generatePerformanceAlertsEmbed(
    interaction.guildId,
    clanTag,
    season
  );

  if (!embed) {
    return interaction.editReply({ content: '❌ No performance data available!' });
  }

  await interaction.editReply({ embeds: [embed] });
}
