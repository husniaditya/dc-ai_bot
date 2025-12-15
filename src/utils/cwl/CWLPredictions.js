// CWL Predictions Manager - Predict bonus medals and final positions
class CWLPredictions {
  constructor(sqlPool) {
    this.sqlPool = sqlPool;
  }

  /**
   * Medal bonus allocation by league and position
   * Source: https://clashofclans.fandom.com/wiki/Clan_War_Leagues
   */
  MEDAL_BONUSES = {
    'Champion League I': [350, 300, 280, 260, 240, 220, 200, 180],
    'Champion League II': [300, 280, 260, 240, 220, 200, 180, 160],
    'Champion League III': [280, 260, 240, 220, 200, 180, 160, 140],
    'Master League I': [260, 240, 220, 200, 180, 160, 140, 120],
    'Master League II': [240, 220, 200, 180, 160, 140, 120, 100],
    'Master League III': [220, 200, 180, 160, 140, 120, 100, 80],
    'Crystal League I': [200, 180, 160, 140, 120, 100, 80, 60],
    'Crystal League II': [180, 160, 140, 120, 100, 80, 60, 40],
    'Crystal League III': [160, 140, 120, 100, 80, 60, 40, 20],
    'Gold League I': [140, 120, 100, 80, 60, 40, 20, 10],
    'Gold League II': [120, 100, 80, 60, 40, 20, 10, 0],
    'Gold League III': [100, 80, 60, 40, 20, 10, 0, 0],
    'Silver League I': [80, 60, 40, 20, 10, 0, 0, 0],
    'Silver League II': [60, 40, 20, 10, 0, 0, 0, 0],
    'Silver League III': [40, 20, 10, 0, 0, 0, 0, 0],
    'Bronze League I': [20, 10, 0, 0, 0, 0, 0, 0],
    'Bronze League II': [10, 0, 0, 0, 0, 0, 0, 0],
    'Bronze League III': [0, 0, 0, 0, 0, 0, 0, 0]
  };

  /**
   * Predict final position based on current performance
   * @param {string} guildId - Guild ID
   * @param {string} clanTag - Clan tag
   * @param {string} season - Season (YYYY-MM)
   * @returns {Object} Position prediction
   */
  async predictFinalPosition(guildId, clanTag, season) {
    try {
      console.log(`[CWL Predictions] ==========================================`);
      console.log(`[CWL Predictions] Predict Final Position Called`);
      console.log(`[CWL Predictions] Guild ID: "${guildId}" (type: ${typeof guildId})`);
      console.log(`[CWL Predictions] Clan Tag: "${clanTag}" (type: ${typeof clanTag})`);
      console.log(`[CWL Predictions] Season: "${season}" (type: ${typeof season})`);
      console.log(`[CWL Predictions] ==========================================`);
      
      // Get current standings
      const [standings] = await this.sqlPool.query(
        `SELECT * FROM guild_clashofclans_cwl_round_standings
         WHERE guild_id = ? AND clan_tag = ? AND season = ?
         ORDER BY round_number DESC LIMIT 1`,
        [guildId, clanTag, season]
      );

      console.log(`[CWL Predictions] Query returned ${standings.length} rows`);
      if (standings.length > 0) {
        console.log(`[CWL Predictions] First row:`, JSON.stringify(standings[0], null, 2));
      }
      
      if (standings.length === 0) {
        console.log('[CWL Predictions] ❌ No standings data - returning null');
        return {
          predicted_position: null,
          confidence: 'none',
          reasoning: 'No standings data available'
        };
      }

      const current = standings[0];
      const roundsPlayed = current.round_number;
      const totalRounds = 7; // CWL always has 7 rounds
      const roundsRemaining = totalRounds - roundsPlayed;

      console.log(`[CWL Predictions] Current round: ${roundsPlayed}, remaining: ${roundsRemaining}`);

      // Get historical performance
      const [history] = await this.sqlPool.query(
        `SELECT * FROM guild_clashofclans_cwl_round_standings
         WHERE guild_id = ? AND clan_tag = ? AND season = ?
         ORDER BY round_number ASC`,
        [guildId, clanTag, season]
      );

      console.log(`[CWL Predictions] History rows: ${history.length}`);

      // Get cumulative total stars from the CWL state table (authoritative source)
      const [cwlState] = await this.sqlPool.query(
        `SELECT total_stars FROM guild_clashofclans_cwl_state
         WHERE guild_id = ? AND clan_tag = ? AND season = ?`,
        [guildId, clanTag, season]
      );
      
      console.log(`[CWL Predictions] CWL state rows: ${cwlState ? cwlState.length : 0}`);
      
      const totalStars = cwlState && cwlState.length > 0 ? (cwlState[0].total_stars || 0) : 0;
      const avgStarsPerRound = roundsPlayed > 0 ? totalStars / roundsPlayed : 0;
      
      console.log(`[CWL Predictions] Season ${season}, Round ${roundsPlayed}: Total stars = ${totalStars}, Avg = ${avgStarsPerRound}`);
      
      // Predict remaining stars
      const predictedRemainingStars = Math.round(avgStarsPerRound * roundsRemaining);
      const predictedTotalStars = totalStars + predictedRemainingStars;

      // Simple prediction: assume we maintain current position +/- 1
      let predictedPosition = current.position;
      
      // If we're improving (better avg than needed for current position), predict +1
      if (roundsPlayed >= 3) {
        const positionTrend = this._calculatePositionTrend(history);
        if (positionTrend < 0) {
          predictedPosition = Math.max(1, current.position - 1);
        } else if (positionTrend > 0) {
          predictedPosition = Math.min(current.total_clans, current.position + 1);
        }
      }

      return {
        predicted_position: predictedPosition,
        current_position: current.position,
        predicted_total_stars: predictedTotalStars,
        confidence: roundsPlayed >= 4 ? 'high' : (roundsPlayed >= 2 ? 'medium' : 'low'),
        rounds_remaining: roundsRemaining,
        avg_stars_per_round: Math.round(avgStarsPerRound * 10) / 10
      };
    } catch (error) {
      console.error('[CWL Predictions] Error predicting final position:', error.message);
      return {
        predicted_position: null,
        confidence: 'none',
        reasoning: 'Error calculating prediction'
      };
    }
  }

  /**
   * Predict medal bonuses based on predicted position
   * @param {string} guildId - Guild ID
   * @param {string} clanTag - Clan tag
   * @param {string} season - Season (YYYY-MM)
   * @returns {Object} Medal predictions
   */
  async predictMedalBonuses(guildId, clanTag, season) {
    try {
      const positionPrediction = await this.predictFinalPosition(guildId, clanTag, season);
      
      if (!positionPrediction.predicted_position) {
        return {
          predicted_bonuses: [],
          confidence: 'none'
        };
      }

      // Get league name
      const [cwlState] = await this.sqlPool.query(
        `SELECT league_name FROM guild_clashofclans_cwl_state
         WHERE guild_id = ? AND clan_tag = ? AND season = ?`,
        [guildId, clanTag, season]
      );

      if (cwlState.length === 0) {
        console.log('[CWL Predictions] No CWL state found for medal bonuses');
        return {
          predicted_bonuses: [],
          confidence: 'none'
        };
      }

      const leagueName = cwlState[0].league_name;
      console.log(`[CWL Predictions] League name from DB: "${leagueName}"`);
      console.log(`[CWL Predictions] Available leagues:`, Object.keys(this.MEDAL_BONUSES));
      
      const bonuses = this.MEDAL_BONUSES[leagueName] || [];
      
      if (bonuses.length === 0) {
        console.log(`[CWL Predictions] No bonuses found for league: "${leagueName}"`);
        return {
          predicted_bonuses: [],
          confidence: 'none',
          league: leagueName
        };
      }
      
      const position = positionPrediction.predicted_position - 1; // Convert to 0-indexed

      // Get bonus medals for predicted position and nearby positions
      const predictions = [];
      
      for (let i = Math.max(0, position - 1); i <= Math.min(bonuses.length - 1, position + 1); i++) {
        predictions.push({
          position: i + 1,
          medals: bonuses[i],
          likelihood: i === position ? 'most likely' : 'possible'
        });
      }

      // Store predictions in database
      await this.sqlPool.query(
        `UPDATE guild_clashofclans_cwl_state
         SET medal_bonus_predictions = ?, predicted_position = ?
         WHERE guild_id = ? AND clan_tag = ? AND season = ?`,
        [
          JSON.stringify(predictions),
          positionPrediction.predicted_position,
          guildId,
          clanTag,
          season
        ]
      );

      return {
        predicted_bonuses: predictions,
        confidence: positionPrediction.confidence,
        league: leagueName,
        ...positionPrediction
      };
    } catch (error) {
      console.error('[CWL Predictions] Error predicting medal bonuses:', error.message);
      return {
        predicted_bonuses: [],
        confidence: 'none'
      };
    }
  }

  /**
   * Calculate position trend from history
   * @private
   */
  _calculatePositionTrend(history) {
    if (history.length < 2) return 0;
    
    // Compare last 2 rounds
    const recent = history.slice(-2);
    return recent[1].position - recent[0].position;
  }

  /**
   * Generate prediction summary embed
   * @param {string} guildId - Guild ID
   * @param {string} clanTag - Clan tag
   * @param {string} season - Season (YYYY-MM)
   * @returns {Object} Embed data
   */
  async generatePredictionEmbed(guildId, clanTag, season) {
    try {
      const prediction = await this.predictMedalBonuses(guildId, clanTag, season);
      
      if (!prediction.predicted_position) {
        return null;
      }

      const confidenceEmoji = {
        'high': '🟢',
        'medium': '🟡',
        'low': '🟠',
        'none': '🔴'
      };

      let bonusText = 'Not enough data';
      if (prediction.predicted_bonuses.length > 0) {
        bonusText = prediction.predicted_bonuses
          .map(b => `${b.likelihood === 'most likely' ? '**' : ''}Position ${b.position}: ${b.medals} medals${b.likelihood === 'most likely' ? '**' : ''}`)
          .join('\n');
      }

      return {
        title: '🔮 CWL Predictions',
        description: `${prediction.league || 'Unknown League'}`,
        fields: [
          {
            name: 'Predicted Position',
            value: `**${prediction.predicted_position}**`,
            inline: true
          },
          {
            name: 'Confidence',
            value: `${confidenceEmoji[prediction.confidence]} ${prediction.confidence}`,
            inline: true
          },
          {
            name: 'Rounds Remaining',
            value: `${prediction.rounds_remaining}/7`,
            inline: true
          },
          {
            name: 'Predicted Total Stars',
            value: `⭐ ${prediction.predicted_total_stars != null ? prediction.predicted_total_stars : 'N/A'}`,
            inline: true
          },
          {
            name: 'Avg Stars/Round',
            value: `${prediction.avg_stars_per_round != null ? prediction.avg_stars_per_round : 'N/A'}`,
            inline: true
          },
          {
            name: 'Possible Medal Bonuses',
            value: bonusText,
            inline: false
          }
        ],
        color: 0x9B59B6,
        timestamp: new Date(),
        footer: {
          text: `Season ${season} • Predictions update after each round`
        }
      };
    } catch (error) {
      console.error('[CWL Predictions] Error generating prediction embed:', error.message);
      return null;
    }
  }
}

module.exports = CWLPredictions;
