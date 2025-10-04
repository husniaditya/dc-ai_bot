// CWL Reminders Manager - Send attack reminders for players who haven't attacked
class CWLReminders {
  constructor(sqlPool, discordClient) {
    this.sqlPool = sqlPool;
    this.client = discordClient;
  }

  /**
   * Check and send attack reminders for a clan
   * @param {string} guildId - Guild ID
   * @param {string} clanTag - Clan tag
   * @param {string} season - Season (YYYY-MM)
   * @param {number} roundNumber - Current round number
   * @param {Object} warData - War data from API
   * @returns {number} Number of reminders sent
   */
  async sendAttackReminders(guildId, clanTag, season, roundNumber, warData) {
    try {
      // Check if war is still active
      if (warData.state !== 'inWar') {
        console.log('[CWL Reminders] War not active, skipping reminders');
        return 0;
      }

      // Calculate time remaining
      const now = new Date();
      const endTime = new Date(warData.endTime);
      const hoursRemaining = (endTime - now) / (1000 * 60 * 60);

      // Only send reminders in final 4 hours
      if (hoursRemaining > 4) {
        console.log('[CWL Reminders] More than 4 hours remaining, skipping reminders');
        return 0;
      }

      // Check if we've already sent reminders for this round
      const [reminderCheck] = await this.sqlPool.query(
        `SELECT attack_reminders_sent FROM guild_clashofclans_cwl_state
         WHERE guild_id = ? AND clan_tag = ? AND season = ?`,
        [guildId, clanTag, season]
      );

      if (reminderCheck.length === 0) {
        return 0;
      }

      const remindersSent = reminderCheck[0].attack_reminders_sent 
        ? JSON.parse(reminderCheck[0].attack_reminders_sent) 
        : [];

      // Check if we already sent reminder for this round
      if (remindersSent.includes(roundNumber)) {
        console.log(`[CWL Reminders] Already sent reminders for round ${roundNumber}`);
        return 0;
      }

      // Get players without attacks
      const [players] = await this.sqlPool.query(
        `SELECT player_tag, player_name, attacks_remaining
         FROM guild_clashofclans_cwl_player_performance
         WHERE guild_id = ? AND clan_tag = ? AND season = ? AND round_number = ?
         AND attacks_remaining > 0`,
        [guildId, clanTag, season, roundNumber]
      );

      if (players.length === 0) {
        console.log('[CWL Reminders] All players have attacked');
        // Mark as sent even if no one needed reminder
        remindersSent.push(roundNumber);
        await this._updateRemindersSent(guildId, clanTag, season, remindersSent);
        return 0;
      }

      // Get CWL announcement channel
      const [config] = await this.sqlPool.query(
        `SELECT cwl_announce_channel_id FROM guild_clashofclans_cwl_state
         WHERE guild_id = ? AND clan_tag = ? AND season = ?`,
        [guildId, clanTag, season]
      );

      if (config.length === 0 || !config[0].cwl_announce_channel_id) {
        console.log('[CWL Reminders] No CWL announcement channel configured');
        return 0;
      }

      const channelId = config[0].cwl_announce_channel_id;
      const channel = await this.client.channels.fetch(channelId);

      if (!channel) {
        console.log('[CWL Reminders] Could not fetch announcement channel');
        return 0;
      }

      // Build reminder message
      const playerList = players
        .map(p => `• ${p.player_name} (${p.attacks_remaining} attack${p.attacks_remaining > 1 ? 's' : ''} remaining)`)
        .join('\n');

      const embed = {
        title: '⚠️ CWL Attack Reminder',
        description: `**Round ${roundNumber}** - ${Math.floor(hoursRemaining)} hours ${Math.floor((hoursRemaining % 1) * 60)} minutes remaining`,
        fields: [
          {
            name: `${players.length} Player${players.length > 1 ? 's' : ''} Haven't Attacked`,
            value: playerList
          }
        ],
        color: 0xFF6B6B,
        timestamp: new Date(),
        footer: {
          text: 'Make sure to use all attacks!'
        }
      };

      await channel.send({ embeds: [embed] });

      // Mark reminder as sent
      remindersSent.push(roundNumber);
      await this._updateRemindersSent(guildId, clanTag, season, remindersSent);

      console.log(`[CWL Reminders] Sent reminder for ${players.length} players in round ${roundNumber}`);
      return players.length;
    } catch (error) {
      console.error('[CWL Reminders] Error sending attack reminders:', error.message);
      return 0;
    }
  }

  /**
   * Update reminders sent in database
   * @private
   */
  async _updateRemindersSent(guildId, clanTag, season, remindersSent) {
    try {
      await this.sqlPool.query(
        `UPDATE guild_clashofclans_cwl_state
         SET attack_reminders_sent = ?
         WHERE guild_id = ? AND clan_tag = ? AND season = ?`,
        [JSON.stringify(remindersSent), guildId, clanTag, season]
      );
    } catch (error) {
      console.error('[CWL Reminders] Error updating reminders sent:', error.message);
    }
  }

  /**
   * Get reminder statistics
   * @param {string} guildId - Guild ID
   * @param {string} clanTag - Clan tag
   * @param {string} season - Season (YYYY-MM)
   * @returns {Object} Reminder stats
   */
  async getReminderStats(guildId, clanTag, season) {
    try {
      const [state] = await this.sqlPool.query(
        `SELECT attack_reminders_sent FROM guild_clashofclans_cwl_state
         WHERE guild_id = ? AND clan_tag = ? AND season = ?`,
        [guildId, clanTag, season]
      );

      if (state.length === 0) {
        return {
          reminders_sent: 0,
          rounds_reminded: []
        };
      }

      const remindersSent = state[0].attack_reminders_sent 
        ? JSON.parse(state[0].attack_reminders_sent) 
        : [];

      return {
        reminders_sent: remindersSent.length,
        rounds_reminded: remindersSent
      };
    } catch (error) {
      console.error('[CWL Reminders] Error getting reminder stats:', error.message);
      return {
        reminders_sent: 0,
        rounds_reminded: []
      };
    }
  }
}

module.exports = CWLReminders;
