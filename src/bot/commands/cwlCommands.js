// CWL Slash Commands - Example commands for Phase 2 features
const { SlashCommandBuilder } = require('discord.js');
const store = require('../../config/store');
const {
  getCWLStateManager,
  getCWLStatisticsDashboard,
  getCWLDataExport,
  getCWLMVPAwards,
  getCWLClanManagement,
  getCWLInteractiveLeaderboard
} = require('../watchers/cwl');

// /cwl dashboard - Show comprehensive CWL statistics
const cwlDashboardCommand = {
  data: new SlashCommandBuilder()
    .setName('cwl-dashboard')
    .setDescription('Show comprehensive CWL statistics dashboard')
    .addStringOption(option =>
      option.setName('clan')
        .setDescription('Clan tag (optional - uses primary clan if not specified)')
        .setRequired(false)
    ),
  
  async execute(interaction) {
    await interaction.deferReply();

    try {
      const cfg = await store.getGuildClashOfClansConfig(interaction.guildId);
      if (!cfg.enabled || !cfg.trackCWL) {
        return interaction.editReply({ content: '❌ CWL tracking is not enabled!' });
      }

      // Get clan tag
      let clanTag = interaction.options.getString('clan');
      if (!clanTag && cfg.clans && cfg.clans.length > 0) {
        clanTag = cfg.clans[0]; // Use first clan as default
      }

      if (!clanTag) {
        return interaction.editReply({ content: '❌ No clan specified and no default clan configured!' });
      }

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
    } catch (error) {
      console.error('[CWL Dashboard] Error:', error.message);
      await interaction.editReply({ content: '❌ Failed to generate dashboard!' });
    }
  }
};

// /cwl export - Export CWL data
const cwlExportCommand = {
  data: new SlashCommandBuilder()
    .setName('cwl-export')
    .setDescription('Export CWL data to file')
    .addStringOption(option =>
      option.setName('type')
        .setDescription('Type of data to export')
        .setRequired(true)
        .addChoices(
          { name: 'Player Performance', value: 'performance' },
          { name: 'Standings History', value: 'standings' },
          { name: 'Season Report', value: 'report' }
        )
    )
    .addStringOption(option =>
      option.setName('format')
        .setDescription('Export format')
        .setRequired(true)
        .addChoices(
          { name: 'JSON', value: 'json' },
          { name: 'CSV', value: 'csv' }
        )
    )
    .addStringOption(option =>
      option.setName('clan')
        .setDescription('Clan tag (optional - uses primary clan if not specified)')
        .setRequired(false)
    ),
  
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
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
    } catch (error) {
      console.error('[CWL Export] Error:', error.message);
      await interaction.editReply({ content: '❌ Failed to export data!' });
    }
  }
};

// /cwl mvp - Show MVP awards
const cwlMvpCommand = {
  data: new SlashCommandBuilder()
    .setName('cwl-mvp')
    .setDescription('Show CWL MVP awards')
    .addIntegerOption(option =>
      option.setName('round')
        .setDescription('Round number (leave empty for season MVP)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(7)
    )
    .addStringOption(option =>
      option.setName('clan')
        .setDescription('Clan tag (optional - uses primary clan if not specified)')
        .setRequired(false)
    ),
  
  async execute(interaction) {
    await interaction.deferReply();

    try {
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

      // Get current season
      const stateManager = getCWLStateManager();
      const season = stateManager.getCurrentSeason();

      // Generate MVP embed
      const mvpAwards = getCWLMVPAwards();
      let embed;

      if (roundNumber) {
        // Round MVP
        embed = await mvpAwards.generateRoundMVPEmbed(interaction.guildId, clanTag, season, roundNumber);
      } else {
        // Season MVP
        embed = await mvpAwards.generateSeasonMVPEmbed(interaction.guildId, clanTag, season);
      }

      if (!embed) {
        return interaction.editReply({ content: '❌ No MVP data available!' });
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('[CWL MVP] Error:', error.message);
      await interaction.editReply({ content: '❌ Failed to get MVP data!' });
    }
  }
};

// /cwl roster - Show lineup recommendations
const cwlRosterCommand = {
  data: new SlashCommandBuilder()
    .setName('cwl-roster')
    .setDescription('Show CWL lineup recommendations')
    .addIntegerOption(option =>
      option.setName('size')
        .setDescription('Roster size')
        .setRequired(false)
        .addChoices(
          { name: '15 players', value: 15 },
          { name: '30 players', value: 30 },
          { name: '50 players', value: 50 }
        )
    )
    .addStringOption(option =>
      option.setName('clan')
        .setDescription('Clan tag (optional - uses primary clan if not specified)')
        .setRequired(false)
    ),
  
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
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
    } catch (error) {
      console.error('[CWL Roster] Error:', error.message);
      await interaction.editReply({ content: '❌ Failed to generate roster report!' });
    }
  }
};

// /cwl alerts - Check for performance issues
const cwlAlertsCommand = {
  data: new SlashCommandBuilder()
    .setName('cwl-alerts')
    .setDescription('Check for CWL performance issues')
    .addStringOption(option =>
      option.setName('clan')
        .setDescription('Clan tag (optional - uses primary clan if not specified)')
        .setRequired(false)
    ),
  
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
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
    } catch (error) {
      console.error('[CWL Alerts] Error:', error.message);
      await interaction.editReply({ content: '❌ Failed to check performance alerts!' });
    }
  }
};

module.exports = {
  cwlDashboardCommand,
  cwlExportCommand,
  cwlMvpCommand,
  cwlRosterCommand,
  cwlAlertsCommand
};
