// CWL State Manager - Manages CWL state tracking and transitions in database
class CWLStateManager {
  constructor(sqlPool) {
    this.sqlPool = sqlPool;
    
    // CWL States
    this.STATES = {
      NOT_IN_CWL: 'not_in_cwl',
      PREPARATION: 'preparation',
      ACTIVE: 'active',
      ENDED: 'ended'
    };
  }

  /**
   * Get current CWL state for a clan
   */
  async getCurrentCWLState(guildId, clanTag) {
    try {
      const [rows] = await this.sqlPool.execute(
        `SELECT * FROM guild_clashofclans_cwl_state 
         WHERE guild_id = ? AND clan_tag = ? 
         ORDER BY created_at DESC LIMIT 1`,
        [guildId, clanTag]
      );

      if (rows.length === 0) {
        return {
          cwl_state: this.STATES.NOT_IN_CWL,
          season: this.getCurrentSeason(),
          current_round: 0,
          war_tags: [],
          announced_rounds: []
        };
      }

      const row = rows[0];
      return {
        ...row,
        war_tags: row.war_tags ? JSON.parse(row.war_tags) : [],
        announced_rounds: row.announced_rounds ? JSON.parse(row.announced_rounds) : []
      };
    } catch (error) {
      console.error('[CWL] Error getting current CWL state:', error.message);
      return {
        cwl_state: this.STATES.NOT_IN_CWL,
        season: this.getCurrentSeason(),
        current_round: 0,
        war_tags: [],
        announced_rounds: []
      };
    }
  }

  /**
   * Get current season in YYYY-MM format
   */
  getCurrentSeason() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  /**
   * Update CWL state in database
   */
  async updateCWLState(guildId, clanTag, newState, leagueData = null, additionalData = {}) {
    try {
      const season = this.getCurrentSeason();
      
      // Check if record exists for this season
      const [existing] = await this.sqlPool.execute(
        `SELECT id FROM guild_clashofclans_cwl_state 
         WHERE guild_id = ? AND clan_tag = ? AND season = ?`,
        [guildId, clanTag, season]
      );

      const updateData = {
        cwl_state: newState,
        last_checked: new Date(),
        ...additionalData
      };

      if (leagueData) {
        updateData.league_name = leagueData.league?.name || null;
        
        // Extract war tags from league data
        if (leagueData.rounds && Array.isArray(leagueData.rounds)) {
          const warTags = [];
          leagueData.rounds.forEach(round => {
            round.warTags.forEach(tag => {
              if (tag && tag !== '#0') {
                warTags.push(tag);
              }
            });
          });
          updateData.war_tags = JSON.stringify(warTags);
        }
      }

      if (existing.length > 0) {
        // Update existing record
        const updateFields = Object.keys(updateData).map(key => `${key} = ?`).join(', ');
        const updateValues = Object.values(updateData);
        
        await this.sqlPool.execute(
          `UPDATE guild_clashofclans_cwl_state SET ${updateFields} WHERE id = ?`,
          [...updateValues, existing[0].id]
        );
      } else {
        // Insert new record
        updateData.guild_id = guildId;
        updateData.clan_tag = clanTag;
        updateData.season = season;
        updateData.current_round = 0;
        updateData.announced_rounds = JSON.stringify([]);
        
        if (!updateData.war_tags) {
          updateData.war_tags = JSON.stringify([]);
        }

        const fields = Object.keys(updateData).join(', ');
        const placeholders = Object.keys(updateData).map(() => '?').join(', ');
        const values = Object.values(updateData);

        await this.sqlPool.execute(
          `INSERT INTO guild_clashofclans_cwl_state (${fields}) VALUES (${placeholders})`,
          values
        );
      }

      if (process.env.COC_DEBUG === '1') {
        console.log(`[CWL] Updated state to '${newState}' for clan ${clanTag} in guild ${guildId}`);
      }

      return true;
    } catch (error) {
      console.error('[CWL] Error updating CWL state:', error.message);
      return false;
    }
  }

  /**
   * Mark a round as announced
   */
  async markRoundAnnounced(guildId, clanTag, roundNumber) {
    try {
      const currentState = await this.getCurrentCWLState(guildId, clanTag);
      const announcedRounds = currentState.announced_rounds || [];
      
      if (!announcedRounds.includes(roundNumber)) {
        announcedRounds.push(roundNumber);
        announcedRounds.sort((a, b) => a - b);

        await this.sqlPool.execute(
          `UPDATE guild_clashofclans_cwl_state 
           SET announced_rounds = ?, current_round = ? 
           WHERE guild_id = ? AND clan_tag = ? AND season = ?`,
          [JSON.stringify(announcedRounds), roundNumber, guildId, clanTag, this.getCurrentSeason()]
        );

        if (process.env.COC_DEBUG === '1') {
          console.log(`[CWL] Marked round ${roundNumber} as announced for clan ${clanTag}`);
        }
      }

      return true;
    } catch (error) {
      console.error('[CWL] Error marking round announced:', error.message);
      return false;
    }
  }

  /**
   * Update CWL channel configuration
   */
  async updateCWLChannels(guildId, clanTag, announceChannelId, leaderboardChannelId) {
    try {
      const season = this.getCurrentSeason();
      
      await this.sqlPool.execute(
        `UPDATE guild_clashofclans_cwl_state 
         SET cwl_announce_channel_id = ?, cwl_leaderboard_channel_id = ? 
         WHERE guild_id = ? AND clan_tag = ? AND season = ?`,
        [announceChannelId, leaderboardChannelId, guildId, clanTag, season]
      );

      return true;
    } catch (error) {
      console.error('[CWL] Error updating CWL channels:', error.message);
      return false;
    }
  }

  /**
   * Store CWL message ID
   */
  async storeCWLMessageId(guildId, clanTag, messageType, messageId) {
    try {
      const season = this.getCurrentSeason();
      const field = `cwl_${messageType}_message_id`;
      
      await this.sqlPool.execute(
        `UPDATE guild_clashofclans_cwl_state 
         SET ${field} = ? 
         WHERE guild_id = ? AND clan_tag = ? AND season = ?`,
        [messageId, guildId, clanTag, season]
      );

      return true;
    } catch (error) {
      console.error(`[CWL] Error storing CWL message ID (${messageType}):`, error.message);
      return false;
    }
  }

  /**
   * Determine state transition based on league data
   */
  getTransitionAction(currentState, leagueData) {
    const currentCWLState = currentState.cwl_state || this.STATES.NOT_IN_CWL;

    // No league data means not in CWL
    if (!leagueData) {
      if (currentCWLState !== this.STATES.NOT_IN_CWL && currentCWLState !== this.STATES.ENDED) {
        return {
          action: 'transition',
          from: currentCWLState,
          to: this.STATES.ENDED,
          reason: 'CWL ended or clan left CWL'
        };
      }
      return { action: 'none', reason: 'Not in CWL' };
    }

    // Check league state
    const leagueState = leagueData.state;

    // CWL just started (preparation)
    if (leagueState === 'preparation' && currentCWLState === this.STATES.NOT_IN_CWL) {
      return {
        action: 'transition',
        from: currentCWLState,
        to: this.STATES.PREPARATION,
        reason: 'CWL preparation started'
      };
    }

    // CWL wars active
    if (leagueState === 'inWar' && currentCWLState !== this.STATES.ACTIVE) {
      return {
        action: 'transition',
        from: currentCWLState,
        to: this.STATES.ACTIVE,
        reason: 'CWL wars started'
      };
    }

    // CWL ended
    if (leagueState === 'ended' && currentCWLState !== this.STATES.ENDED) {
      return {
        action: 'transition',
        from: currentCWLState,
        to: this.STATES.ENDED,
        reason: 'CWL ended'
      };
    }

    return { action: 'none', reason: `State unchanged: ${currentCWLState}` };
  }
}

module.exports = CWLStateManager;
