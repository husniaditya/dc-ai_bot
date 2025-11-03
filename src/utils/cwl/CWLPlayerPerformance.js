// CWL Player Performance Manager - Track individual player performance across CWL rounds
class CWLPlayerPerformance {
  constructor(sqlPool) {
    this.sqlPool = sqlPool;
  }

  /**
   * Record player attacks for a specific round
   * @param {string} guildId - Guild ID
   * @param {string} clanTag - Clan tag
   * @param {string} season - Season (YYYY-MM)
   * @param {number} roundNumber - Round number (1-7)
   * @param {Object} warData - War data from API
   */
  async recordRoundAttacks(guildId, clanTag, season, roundNumber, warData) {
    if (!warData.clan || !warData.clan.members) {
      console.warn('[CWL Performance] No member data in war response');
      return;
    }

    try {
      // Clean tag helper
      const cleanTag = (tag) => {
        if (!tag) return null;
        return tag.replace(/^#/, '').toUpperCase();
      };
      
      const ourClanTag = cleanTag(clanTag);
      const clan1Tag = cleanTag(warData.clan?.tag);
      const clan2Tag = cleanTag(warData.opponent?.tag);
      
      // Find our clan (compare cleaned tags)
      const ourClan = (clan1Tag === ourClanTag) ? warData.clan : 
                      (clan2Tag === ourClanTag) ? warData.opponent : null;
      
      if (!ourClan) {
        // console.warn('[CWL Performance] Could not identify our clan in war data');
        // console.warn(`[CWL Performance] Looking for: ${ourClanTag}, Found: ${clan1Tag} vs ${clan2Tag}`);
        return;
      }

      // console.log(`[CWL Performance] Processing ${ourClan.members.length} members for round ${roundNumber}`);

      for (const member of ourClan.members) {
        const attacks = member.attacks || [];
        const attacksUsed = attacks.length;
        // CWL: Everyone gets exactly 1 attack regardless of Town Hall level
        const attacksRemaining = 1 - attacksUsed;

        // console.log(`[CWL Performance] Processing member: ${member.name} (${member.tag}), attacks: ${attacksUsed}`);

        // Calculate player's total performance (sum of all attacks)
        let totalStars = 0;
        let totalDestruction = 0;
        let bestAttack = null;
        let hasThreeStar = false;

        // Find opponent clan (the one that's NOT us)
        const opponentClan = (clan1Tag === ourClanTag) ? warData.opponent : warData.clan;

        for (const attack of attacks) {
          totalStars += attack.stars;
          totalDestruction += attack.destructionPercentage;
          
          if (!bestAttack || attack.stars > bestAttack.stars || 
              (attack.stars === bestAttack.stars && attack.destructionPercentage > bestAttack.destructionPercentage)) {
            bestAttack = attack;
          }
          
          if (attack.stars === 3) {
            hasThreeStar = true;
          }
        }

        // Insert or update player record ONCE per player (not per attack)
        try {
          const target = bestAttack ? opponentClan.members.find(m => m.tag === bestAttack.defenderTag) : null;
          
          await this.sqlPool.query(
            `INSERT INTO guild_clashofclans_cwl_player_performance (
              guild_id, clan_tag, season, round_number, player_tag, player_name,
              townhall_level, map_position,
              attacks_used, attacks_remaining, stars_earned, destruction_percentage,
              target_position, target_tag, target_townhall_level,
              attack_order, is_best_attack, three_star, attack_time
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
            ON DUPLICATE KEY UPDATE
              player_name = VALUES(player_name),
              townhall_level = VALUES(townhall_level),
              map_position = VALUES(map_position),
              attacks_used = VALUES(attacks_used),
              attacks_remaining = VALUES(attacks_remaining),
              stars_earned = VALUES(stars_earned),
              destruction_percentage = VALUES(destruction_percentage),
              target_position = VALUES(target_position),
              target_tag = VALUES(target_tag),
              target_townhall_level = VALUES(target_townhall_level),
              attack_order = VALUES(attack_order),
              is_best_attack = VALUES(is_best_attack),
              three_star = VALUES(three_star),
              attack_time = VALUES(attack_time)`,
            [
              guildId,
              clanTag,
              season,
              roundNumber,
              member.tag,
              member.name,
              member.townhallLevel || null, // Attacker's TH level from API
              member.mapPosition || null,   // Attacker's position in war lineup
              attacksUsed,
              attacksRemaining,
              totalStars,
              totalDestruction,
              target ? target.mapPosition : null,
              bestAttack ? bestAttack.defenderTag : null,
              target ? target.townhallLevel : null,
              attacks.length, // Total number of attacks
              hasThreeStar ? 1 : 0,
              hasThreeStar ? 1 : 0,
            ]
          );
          // console.log(`[CWL Performance] ✓ Recorded/updated ${member.name}: ${totalStars}⭐ (${attacksUsed} attacks)`);
        } catch (dbError) {
          console.error(`[CWL Performance] ✗ Failed to record player ${member.name}:`, dbError.message);
        }
      }

      // console.log(`[CWL Performance] Recorded round ${roundNumber} attacks for ${clanTag}`);
    } catch (error) {
      console.error('[CWL Performance] Error recording round attacks:', error.message);
    }
  }

  /**
   * Get player performance rows for a specific round (used for canvas)
   * @param {string} guildId
   * @param {string} clanTag - cleaned tag without leading '#'
   * @param {string} season - YYYY-MM
   * @param {number} roundNumber
   * @returns {Array} rows for the round
   */
  async getRoundPlayerPerformance(guildId, clanTag, season, roundNumber) {
    try {
      const [rows] = await this.sqlPool.query(
        `SELECT 
           player_tag,
           player_name,
           townhall_level,
           map_position,
           attacks_used,
           attacks_remaining,
           stars_earned,
           destruction_percentage,
           target_position,
           target_tag,
           target_townhall_level,
           attack_order,
           is_best_attack,
           three_star,
           attack_time
         FROM guild_clashofclans_cwl_player_performance
         WHERE guild_id = ? AND clan_tag = ? AND season = ? AND round_number = ?
         ORDER BY map_position ASC`,
        [guildId, clanTag, season, roundNumber]
      );
      return rows || [];
    } catch (error) {
      console.error('[CWL Performance] Error getting round performance:', error.message);
      return [];
    }
  }

  /**
   * Get players who haven't attacked yet in current round
   * @param {string} guildId - Guild ID
   * @param {string} clanTag - Clan tag
   * @param {string} season - Season (YYYY-MM)
   * @param {number} roundNumber - Round number
   * @returns {Array} List of players who haven't attacked
   */
  async getPlayersWithoutAttacks(guildId, clanTag, season, roundNumber) {
    try {
      const [rows] = await this.sqlPool.query(
        `SELECT player_tag, player_name, attacks_remaining
         FROM guild_clashofclans_cwl_player_performance
         WHERE guild_id = ? AND clan_tag = ? AND season = ? AND round_number = ?
         AND attacks_remaining > 0
         ORDER BY player_name`,
        [guildId, clanTag, season, roundNumber]
      );

      return rows;
    } catch (error) {
      console.error('[CWL Performance] Error getting players without attacks:', error.message);
      return [];
    }
  }

  /**
   * Get player statistics for current CWL season
   * @param {string} guildId - Guild ID
   * @param {string} clanTag - Clan tag
   * @param {string} season - Season (YYYY-MM)
   * @param {string} playerTag - Player tag
   * @returns {Object} Player statistics
   */
  async getPlayerStats(guildId, clanTag, season, playerTag) {
    try {
      const [rows] = await this.sqlPool.query(
        `SELECT 
          COUNT(*) as total_attacks,
          SUM(stars_earned) as total_stars,
          AVG(stars_earned) as avg_stars,
          AVG(destruction_percentage) as avg_destruction,
          SUM(three_star) as three_star_count,
          MAX(stars_earned) as best_stars
         FROM guild_clashofclans_cwl_player_performance
         WHERE guild_id = ? AND clan_tag = ? AND season = ? AND player_tag = ?
         AND attacks_used > 0`,
        [guildId, clanTag, season, playerTag]
      );

      return rows[0] || null;
    } catch (error) {
      console.error('[CWL Performance] Error getting player stats:', error.message);
      return null;
    }
  }

  /**
   * Get historical player performance (previous seasons)
   * @param {string} playerTag - Player tag
   * @param {number} seasonCount - Number of past seasons to retrieve
   * @returns {Array} Historical performance data
   */
  async getPlayerHistory(playerTag, seasonCount = 3) {
    try {
      const [rows] = await this.sqlPool.query(
        `SELECT 
          season,
          clan_tag,
          COUNT(*) as total_attacks,
          SUM(stars_earned) as total_stars,
          AVG(stars_earned) as avg_stars,
          AVG(destruction_percentage) as avg_destruction,
          SUM(three_star) as three_star_count
         FROM guild_clashofclans_cwl_player_performance
         WHERE player_tag = ? AND attacks_used > 0
         GROUP BY season, clan_tag
         ORDER BY season DESC
         LIMIT ?`,
        [playerTag, seasonCount]
      );

      return rows;
    } catch (error) {
      console.error('[CWL Performance] Error getting player history:', error.message);
      return [];
    }
  }

  /**
   * Get top performers for current CWL
   * @param {string} guildId - Guild ID
   * @param {string} clanTag - Clan tag
   * @param {string} season - Season (YYYY-MM)
   * @param {number} limit - Number of top players to return
   * @returns {Array} Top performing players
   */
  async getTopPerformers(guildId, clanTag, season, limit = 10) {
    try {
      const [rows] = await this.sqlPool.query(
        `SELECT 
          player_tag,
          player_name,
          COUNT(*) as total_attacks,
          SUM(stars_earned) as total_stars,
          AVG(stars_earned) as avg_stars,
          AVG(destruction_percentage) as avg_destruction,
          SUM(three_star) as three_star_count
         FROM guild_clashofclans_cwl_player_performance
         WHERE guild_id = ? AND clan_tag = ? AND season = ? AND attacks_used > 0
         GROUP BY player_tag, player_name
         ORDER BY total_stars DESC, avg_destruction DESC
         LIMIT ?`,
        [guildId, clanTag, season, limit]
      );

      return rows;
    } catch (error) {
      console.error('[CWL Performance] Error getting top performers:', error.message);
      return [];
    }
  }

  /**
   * Predict player stars based on historical performance
   * @param {string} playerTag - Player tag
   * @returns {Object} Prediction data
   */
  async predictPlayerStars(playerTag) {
    try {
      const history = await this.getPlayerHistory(playerTag, 3);
      
      if (history.length === 0) {
        return {
          predicted_stars: 2.0,
          confidence: 'low',
          based_on_seasons: 0
        };
      }

      const totalStars = history.reduce((sum, season) => sum + parseFloat(season.avg_stars || 0), 0);
      const avgStars = totalStars / history.length;

      return {
        predicted_stars: Math.round(avgStars * 10) / 10, // Round to 1 decimal
        confidence: history.length >= 3 ? 'high' : (history.length === 2 ? 'medium' : 'low'),
        based_on_seasons: history.length,
        historical_data: history
      };
    } catch (error) {
      console.error('[CWL Performance] Error predicting player stars:', error.message);
      return {
        predicted_stars: 2.0,
        confidence: 'low',
        based_on_seasons: 0
      };
    }
  }
}

module.exports = CWLPlayerPerformance;
