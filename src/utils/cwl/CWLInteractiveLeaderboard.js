// CWL Interactive Leaderboard - Discord components with buttons and reactions
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { cleanClanTag } = require('../../bot/services/clashofclans');

class CWLInteractiveLeaderboard {
  constructor(sqlPool) {
    this.sqlPool = sqlPool;
  }

  /**
   * Create interactive leaderboard buttons
   * @param {string} clanTag - Clan tag
   * @param {string} season - Season (YYYY-MM)
   * @returns {Array} Action rows with buttons
   */
  createLeaderboardButtons(clanTag, season) {
    const row1 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`cwl_refresh_${clanTag}_${season}`)
          .setLabel('🔄 Refresh')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`cwl_stats_${clanTag}_${season}`)
          .setLabel('📊 Full Stats')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`cwl_history_${clanTag}_${season}`)
          .setLabel('📈 History')
          .setStyle(ButtonStyle.Secondary)
      );

    const row2 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`cwl_mvp_${clanTag}_${season}`)
          .setLabel('🏆 MVP')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`cwl_export_${clanTag}_${season}`)
          .setLabel('💾 Export')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`cwl_predictions_${clanTag}_${season}`)
          .setLabel('🔮 Predictions')
          .setStyle(ButtonStyle.Secondary)
      );

    return [row1, row2];
  }

  /**
   * Create player selection dropdown
   * @param {string} guildId - Guild ID
   * @param {string} clanTag - Clan tag
   * @param {string} season - Season (YYYY-MM)
   * @returns {ActionRowBuilder} Dropdown menu
   */
  async createPlayerSelectMenu(guildId, clanTag, season) {
    try {
      const [players] = await this.sqlPool.query(
        `SELECT DISTINCT player_tag, player_name
         FROM guild_clashofclans_cwl_player_performance
         WHERE guild_id = ? AND clan_tag = ? AND season = ?
         ORDER BY player_name
         LIMIT 25`,
        [guildId, clanTag, season]
      );

      if (players.length === 0) {
        return null;
      }

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`cwl_player_select_${clanTag}_${season}`)
        .setPlaceholder('Select a player to view stats')
        .addOptions(
          players.map(p => ({
            label: p.player_name,
            value: p.player_tag,
            description: `View ${p.player_name}'s CWL stats`
          }))
        );

      return new ActionRowBuilder().addComponents(selectMenu);
    } catch (error) {
      console.error('[CWL Interactive] Error creating player select menu:', error.message);
      return null;
    }
  }

  /**
   * Handle button interaction
   * @param {Interaction} interaction - Discord interaction
   * @param {Object} managers - Manager instances (leaderboard, predictions, mvp, export)
   */
  async handleButtonInteraction(interaction, managers) {
    const customId = interaction.customId;
    
    // Parse custom ID
    const parts = customId.split('_');
    const action = parts[1];
    let clanTag = parts[2];
    clanTag = cleanClanTag(clanTag);
    const season = parts[3];
    const guildId = interaction.guildId;

    try {
      // For refresh, update the message instead of sending ephemeral reply
      if (action === 'refresh') {
        await interaction.deferUpdate();
      } else {
        await interaction.deferReply({ flags: 64 }); // 64 = EPHEMERAL
      }

      switch (action) {
        case 'refresh':
          await this.handleRefresh(interaction, managers.dashboard, guildId, clanTag, season);
          break;
        case 'stats':
          await this.handleFullStats(interaction, guildId, clanTag, season);
          break;
        case 'history':
          await this.handleHistory(interaction, managers.leaderboard, guildId, clanTag, season);
          break;
        case 'mvp':
          await this.handleMVP(interaction, managers.mvp, guildId, clanTag, season);
          break;
        case 'export':
          await this.handleExport(interaction, managers.export, guildId, clanTag, season);
          break;
        case 'predictions':
          await this.handlePredictions(interaction, managers.predictions, guildId, clanTag, season);
          break;
        default:
          await interaction.editReply({ content: '❌ Unknown action!' });
      }
    } catch (error) {
      console.error('[CWL Interactive] Error handling button:', error.message);
      await interaction.editReply({ content: '❌ An error occurred!' });
    }
  }

  /**
   * Handle player select interaction
   * @param {Interaction} interaction - Discord interaction
   * @param {string} guildId - Guild ID
   * @param {string} clanTag - Clan tag
   * @param {string} season - Season (YYYY-MM)
   * @param {string} playerTag - Player tag
   */
  async handlePlayerSelect(interaction, guildId, clanTag, season, playerTag) {
    try {
      await interaction.deferReply({ flags: 64 }); // 64 = EPHEMERAL

      // Get player stats
      const [stats] = await this.sqlPool.query(
        `SELECT 
          player_name,
          SUM(stars_earned) as total_stars,
          AVG(destruction_percentage) as avg_destruction,
          SUM(three_star) as three_star_count,
          COUNT(*) as total_attacks,
          COUNT(DISTINCT round_number) as rounds_participated
         FROM guild_clashofclans_cwl_player_performance
         WHERE guild_id = ? AND clan_tag = ? AND season = ? AND player_tag = ?
         AND attacks_used > 0
         GROUP BY player_tag, player_name`,
        [guildId, clanTag, season, playerTag]
      );

      if (stats.length === 0) {
        await interaction.editReply({ content: '❌ No stats found for this player!' });
        return;
      }

      const player = stats[0];

      // Get round-by-round breakdown
      const [rounds] = await this.sqlPool.query(
        `SELECT round_number, SUM(stars_earned) as stars, AVG(destruction_percentage) as destruction
         FROM guild_clashofclans_cwl_player_performance
         WHERE guild_id = ? AND clan_tag = ? AND season = ? AND player_tag = ?
         AND attacks_used > 0
         GROUP BY round_number
         ORDER BY round_number`,
        [guildId, clanTag, season, playerTag]
      );

      const roundBreakdown = rounds.map(r => 
        `Round ${r.round_number}: ${r.stars}⭐ (${(parseFloat(r.destruction) || 0).toFixed(1)}%)`
      ).join('\n') || 'No data';

      const embed = {
        title: `📊 ${player.player_name}'s CWL Stats`,
        description: `Season ${season}`,
        color: 0x3498db,
        fields: [
          {
            name: '⭐ Total Stars',
            value: `${player.total_stars}`,
            inline: true
          },
          {
            name: '💥 Avg Destruction',
            value: `${(parseFloat(player.avg_destruction) || 0).toFixed(2)}%`,
            inline: true
          },
          {
            name: '🌟 Three Stars',
            value: `${player.three_star_count}`,
            inline: true
          },
          {
            name: '⚔️ Total Attacks',
            value: `${player.total_attacks}`,
            inline: true
          },
          {
            name: '🎯 Rounds',
            value: `${player.rounds_participated}/7`,
            inline: true
          },
          {
            name: '\u200B',
            value: '\u200B',
            inline: true
          },
          {
            name: '📋 Round Breakdown',
            value: roundBreakdown,
            inline: false
          }
        ],
        timestamp: new Date()
      };

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('[CWL Interactive] Error handling player select:', error.message);
      await interaction.editReply({ content: '❌ An error occurred!' });
    }
  }

  // Handler methods
  async handleRefresh(interaction, dashboardManager, guildId, clanTag, season) {
    const embed = await dashboardManager.generateDashboardEmbed(guildId, clanTag, season);
    if (embed) {
      const buttons = this.createLeaderboardButtons(clanTag, season);
      // Update the original message instead of sending a new reply
      await interaction.editReply({ embeds: [embed], components: buttons });
    } else {
      // If no data, send ephemeral error message
      await interaction.followUp({ content: '❌ Could not refresh dashboard!', flags: 64 });
    }
  }

  async handleFullStats(interaction, guildId, clanTag, season) {
    // Get comprehensive team statistics
    const [stats] = await this.sqlPool.query(
      `SELECT 
        COUNT(DISTINCT player_tag) as total_players,
        SUM(attacks_used) as total_attacks,
        SUM(stars_earned) as total_stars,
        AVG(destruction_percentage) as avg_destruction,
        SUM(three_star) as total_three_stars,
        AVG(CASE WHEN attacks_used > 0 THEN stars_earned ELSE NULL END) as avg_stars_per_attack
       FROM guild_clashofclans_cwl_player_performance
       WHERE guild_id = ? AND clan_tag = ? AND season = ?`,
      [guildId, clanTag, season]
    );

    const teamStats = stats[0];

    const embed = {
      title: '📊 Team Statistics',
      description: `Season ${season} - Complete Overview`,
      color: 0x2ecc71,
      fields: [
        {
          name: '👥 Total Players',
          value: `${teamStats.total_players}`,
          inline: true
        },
        {
          name: '⚔️ Total Attacks',
          value: `${teamStats.total_attacks}`,
          inline: true
        },
        {
          name: '⭐ Total Stars',
          value: `${teamStats.total_stars}`,
          inline: true
        },
        {
          name: '💥 Avg Destruction',
          value: `${(parseFloat(teamStats.avg_destruction) || 0).toFixed(2)}%`,
          inline: true
        },
        {
          name: '🌟 Three Stars',
          value: `${teamStats.total_three_stars}`,
          inline: true
        },
        {
          name: '📊 Avg Stars/Attack',
          value: `${(parseFloat(teamStats.avg_stars_per_attack) || 0).toFixed(2)}`,
          inline: true
        }
      ],
      timestamp: new Date()
    };

    await interaction.editReply({ embeds: [embed] });
  }

  async handleHistory(interaction, leaderboardManager, guildId, clanTag, season) {
    const history = await leaderboardManager.getStandingsHistory(guildId, clanTag, season);
    
    if (!history || history.length === 0) {
      await interaction.editReply({ content: '❌ No history available!' });
      return;
    }

    const historyText = history.map(h => 
      `Round ${h.round_number}: Position **${h.position}**/${h.total_clans} - ${h.stars_earned}⭐ (${(parseFloat(h.destruction_percentage) || 0).toFixed(1)}%)`
    ).join('\n');

    const embed = {
      title: '📈 Position History',
      description: `Season ${season}`,
      color: 0x9b59b6,
      fields: [
        {
          name: 'Round-by-Round Standings',
          value: historyText,
          inline: false
        }
      ],
      timestamp: new Date()
    };

    await interaction.editReply({ embeds: [embed] });
  }

  async handleMVP(interaction, mvpManager, guildId, clanTag, season) {
    const embed = await mvpManager.generateSeasonMVPEmbed(guildId, clanTag, season);
    if (embed) {
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.editReply({ content: '❌ MVP data not available yet!' });
    }
  }

  async handleExport(interaction, exportManager, guildId, clanTag, season) {
    const exportData = await exportManager.generateExportAttachment(guildId, clanTag, season, 'json', 'report');
    
    if (exportData) {
      await interaction.editReply({ 
        content: '✅ Export ready! Check your DMs.',
        files: [{
          attachment: exportData.filePath,
          name: exportData.filename
        }]
      });
    } else {
      await interaction.editReply({ content: '❌ Export failed!' });
    }
  }

  async handlePredictions(interaction, predictionsManager, guildId, clanTag, season) {
    const embed = await predictionsManager.generatePredictionEmbed(guildId, clanTag, season);
    if (embed) {
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.editReply({ content: '❌ Predictions not available yet! (Need 3+ rounds)' });
    }
  }
}

module.exports = CWLInteractiveLeaderboard;
