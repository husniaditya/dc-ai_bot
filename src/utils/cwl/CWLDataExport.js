// CWL Data Export - Export CWL data to CSV/JSON formats
const fs = require('fs').promises;
const path = require('path');

class CWLDataExport {
  constructor(sqlPool) {
    this.sqlPool = sqlPool;
  }

  /**
   * Export player performance data to JSON
   * @param {string} guildId - Guild ID
   * @param {string} clanTag - Clan tag
   * @param {string} season - Season (YYYY-MM)
   * @returns {Object} JSON data
   */
  async exportPlayerPerformanceJSON(guildId, clanTag, season) {
    try {
      const [performances] = await this.sqlPool.query(
        `SELECT * FROM guild_clashofclans_cwl_player_performance
         WHERE guild_id = ? AND clan_tag = ? AND season = ?
         ORDER BY round_number, player_name`,
        [guildId, clanTag, season]
      );

      return {
        export_date: new Date().toISOString(),
        guild_id: guildId,
        clan_tag: clanTag,
        season: season,
        total_records: performances.length,
        data: performances.map(p => ({
          player_tag: p.player_tag,
          player_name: p.player_name,
          round: p.round_number,
          attacks_used: p.attacks_used,
          stars_earned: p.stars_earned,
          destruction: parseFloat(p.destruction_percentage),
          target_th: p.target_townhall_level,
          three_star: p.three_star === 1,
          attack_time: p.attack_time
        }))
      };
    } catch (error) {
      console.error('[CWL Export] Error exporting player performance JSON:', error.message);
      return null;
    }
  }

  /**
   * Export player performance data to CSV
   * @param {string} guildId - Guild ID
   * @param {string} clanTag - Clan tag
   * @param {string} season - Season (YYYY-MM)
   * @returns {string} CSV content
   */
  async exportPlayerPerformanceCSV(guildId, clanTag, season) {
    try {
      const [performances] = await this.sqlPool.query(
        `SELECT * FROM guild_clashofclans_cwl_player_performance
         WHERE guild_id = ? AND clan_tag = ? AND season = ?
         ORDER BY round_number, player_name`,
        [guildId, clanTag, season]
      );

      if (performances.length === 0) {
        return null;
      }

      // CSV Header
      const header = [
        'Player Tag',
        'Player Name',
        'Round',
        'Attacks Used',
        'Attacks Remaining',
        'Stars Earned',
        'Destruction %',
        'Target Position',
        'Target TH Level',
        'Attack Order',
        'Three Star',
        'Attack Time'
      ].join(',');

      // CSV Rows
      const rows = performances.map(p => [
        p.player_tag,
        `"${p.player_name}"`,
        p.round_number,
        p.attacks_used,
        p.attacks_remaining,
        p.stars_earned,
        p.destruction_percentage,
        p.target_position || '',
        p.target_townhall_level || '',
        p.attack_order || '',
        p.three_star ? 'Yes' : 'No',
        p.attack_time ? p.attack_time.toISOString() : ''
      ].join(','));

      return [header, ...rows].join('\n');
    } catch (error) {
      console.error('[CWL Export] Error exporting player performance CSV:', error.message);
      return null;
    }
  }

  /**
   * Export standings data to JSON
   * @param {string} guildId - Guild ID
   * @param {string} clanTag - Clan tag
   * @param {string} season - Season (YYYY-MM)
   * @returns {Object} JSON data
   */
  async exportStandingsJSON(guildId, clanTag, season) {
    try {
      const [standings] = await this.sqlPool.query(
        `SELECT * FROM guild_clashofclans_cwl_round_standings
         WHERE guild_id = ? AND clan_tag = ? AND season = ?
         ORDER BY round_number`,
        [guildId, clanTag, season]
      );

      return {
        export_date: new Date().toISOString(),
        guild_id: guildId,
        clan_tag: clanTag,
        season: season,
        league: standings[0]?.league_name || 'Unknown',
        total_rounds: standings.length,
        data: standings.map(s => ({
          round: s.round_number,
          position: s.position,
          total_clans: s.total_clans,
          stars: s.stars_earned,
          destruction: parseFloat(s.destruction_percentage),
          wins: s.wins,
          losses: s.losses
        }))
      };
    } catch (error) {
      console.error('[CWL Export] Error exporting standings JSON:', error.message);
      return null;
    }
  }

  /**
   * Export comprehensive season report to JSON
   * @param {string} guildId - Guild ID
   * @param {string} clanTag - Clan tag
   * @param {string} season - Season (YYYY-MM)
   * @returns {Object} Complete season report
   */
  async exportSeasonReportJSON(guildId, clanTag, season) {
    try {
      // Get standings
      const standingsData = await this.exportStandingsJSON(guildId, clanTag, season);

      // Get top performers
      const [topPerformers] = await this.sqlPool.query(
        `SELECT 
          player_tag,
          player_name,
          SUM(stars_earned) as total_stars,
          AVG(destruction_percentage) as avg_destruction,
          SUM(three_star) as three_star_count,
          COUNT(*) as total_attacks,
          COUNT(DISTINCT round_number) as rounds_participated
         FROM guild_clashofclans_cwl_player_performance
         WHERE guild_id = ? AND clan_tag = ? AND season = ?
         AND attacks_used > 0
         GROUP BY player_tag, player_name
         ORDER BY total_stars DESC, avg_destruction DESC
         LIMIT 10`,
        [guildId, clanTag, season]
      );

      // Get team statistics
      const [teamStats] = await this.sqlPool.query(
        `SELECT 
          COUNT(DISTINCT player_tag) as total_players,
          SUM(attacks_used) as total_attacks,
          SUM(stars_earned) as total_stars,
          AVG(destruction_percentage) as avg_destruction,
          SUM(three_star) as total_three_stars
         FROM guild_clashofclans_cwl_player_performance
         WHERE guild_id = ? AND clan_tag = ? AND season = ?`,
        [guildId, clanTag, season]
      );

      return {
        export_date: new Date().toISOString(),
        guild_id: guildId,
        clan_tag: clanTag,
        season: season,
        standings: standingsData?.data || [],
        final_position: standingsData?.data[standingsData?.data.length - 1]?.position || null,
        league: standingsData?.league || 'Unknown',
        team_statistics: {
          total_players: teamStats[0]?.total_players || 0,
          total_attacks: teamStats[0]?.total_attacks || 0,
          total_stars: teamStats[0]?.total_stars || 0,
          avg_destruction: parseFloat(teamStats[0]?.avg_destruction || 0),
          total_three_stars: teamStats[0]?.total_three_stars || 0
        },
        top_performers: topPerformers.map(p => ({
          player_tag: p.player_tag,
          player_name: p.player_name,
          total_stars: p.total_stars,
          avg_destruction: parseFloat(p.avg_destruction),
          three_star_count: p.three_star_count,
          total_attacks: p.total_attacks,
          rounds_participated: p.rounds_participated
        }))
      };
    } catch (error) {
      console.error('[CWL Export] Error exporting season report:', error.message);
      return null;
    }
  }

  /**
   * Save export to file
   * @param {string} filename - Filename
   * @param {string} content - File content
   * @param {string} format - Format (json or csv)
   * @returns {string} File path
   */
  async saveToFile(filename, content, format = 'json') {
    try {
      const exportDir = path.join(process.cwd(), 'exports', 'cwl');
      await fs.mkdir(exportDir, { recursive: true });

      const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
      const fullFilename = `${filename}_${timestamp}.${format}`;
      const filePath = path.join(exportDir, fullFilename);

      if (format === 'json') {
        await fs.writeFile(filePath, JSON.stringify(content, null, 2));
      } else {
        await fs.writeFile(filePath, content);
      }

      console.log(`[CWL Export] Saved export to ${filePath}`);
      return filePath;
    } catch (error) {
      console.error('[CWL Export] Error saving file:', error.message);
      return null;
    }
  }

  /**
   * Generate Discord attachment for export
   * @param {string} guildId - Guild ID
   * @param {string} clanTag - Clan tag
   * @param {string} season - Season (YYYY-MM)
   * @param {string} format - Format (json or csv)
   * @param {string} type - Type (performance, standings, report)
   * @returns {Object} Discord attachment data
   */
  async generateExportAttachment(guildId, clanTag, season, format = 'json', type = 'report') {
    try {
      let content;
      let filename;

      if (type === 'performance') {
        if (format === 'json') {
          content = await this.exportPlayerPerformanceJSON(guildId, clanTag, season);
          filename = `cwl_performance_${season}`;
        } else {
          content = await this.exportPlayerPerformanceCSV(guildId, clanTag, season);
          filename = `cwl_performance_${season}`;
        }
      } else if (type === 'standings') {
        content = await this.exportStandingsJSON(guildId, clanTag, season);
        filename = `cwl_standings_${season}`;
      } else {
        content = await this.exportSeasonReportJSON(guildId, clanTag, season);
        filename = `cwl_report_${season}`;
      }

      if (!content) {
        return null;
      }

      const filePath = await this.saveToFile(filename, content, format);

      return {
        filePath: filePath,
        filename: `${filename}.${format}`,
        content: format === 'json' ? JSON.stringify(content, null, 2) : content
      };
    } catch (error) {
      console.error('[CWL Export] Error generating export attachment:', error.message);
      return null;
    }
  }
}

module.exports = CWLDataExport;
