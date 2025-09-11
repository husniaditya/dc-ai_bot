/**
 * Auto-Response Auto-Population Service
 * Automatically populates auto-responses for new guilds from master table
 */

const cache = require('../../config/store/cache/manager');

class AutoResponseAutoPopulateService {
  constructor(store) {
    this.store = store;
  }

  /**
   * Auto-populate auto-responses for a new guild
   * Uses master auto_responses table as source of truth
   * @param {string} guildId - The Discord guild ID
   * @param {Object} options - Configuration options
   * @param {boolean} options.skipIfExists - Skip if guild already has data (default: true)
   * @returns {Object} Result object with statistics
   */
  async populateForGuild(guildId, options = {}) {
    const { skipIfExists = true } = options;
    
    try {
      console.log(`[AUTO-RESPONSE AUTO-POPULATE] Starting for guild: ${guildId}`);
      
      // Check if guild already has auto-response data
      if (skipIfExists) {
        const hasExistingData = await this.checkExistingData(guildId);
        if (hasExistingData) {
          console.log(`[AUTO-RESPONSE AUTO-POPULATE] Guild ${guildId} already has auto-response data, skipping`);
          return {
            success: true,
            skipped: true,
            reason: 'Guild already has existing auto-response data',
            responsesInserted: 0
          };
        }
      }
      
      // Get master auto-response data
      const masterResponses = await this.getMasterResponses();
      
      // Insert data
      const responsesInserted = await this.insertResponses(guildId, masterResponses);
      
      // Invalidate cache so fresh data is loaded from database
      const cacheData = cache.getCache();
      if (cacheData.guildAutoResponsesCache.has(guildId)) {
        cacheData.guildAutoResponsesCache.delete(guildId);
        console.log(`[AUTO-RESPONSE AUTO-POPULATE] Invalidated cache for guild ${guildId}`);
      }

      const result = {
        success: true,
        skipped: false,
        guildId,
        responsesInserted,
        totalInserted: responsesInserted
      };
      
      console.log(`[AUTO-RESPONSE AUTO-POPULATE] Successfully populated guild ${guildId}:`);
      console.log(`  - ${responsesInserted} auto-responses added (disabled)`);
      console.log(`[AUTO-RESPONSE AUTO-POPULATE] Admins can enable responses via dashboard`);
      
      return result;
      
    } catch (error) {
      console.error(`[AUTO-RESPONSE AUTO-POPULATE] Failed for guild ${guildId}:`, error);
      return {
        success: false,
        error: error.message,
        guildId
      };
    }
  }

  /**
   * Check if guild already has auto-response data
   * @param {string} guildId - The Discord guild ID
   * @returns {boolean} True if guild has existing data
   */
  async checkExistingData(guildId) {
    try {
      const [existingResponses] = await this.store.sqlPool.execute(
        'SELECT COUNT(*) as count FROM guild_auto_responses WHERE guild_id = ?',
        [guildId]
      );
      
      return existingResponses[0].count > 0;
    } catch (error) {
      console.error(`[AUTO-RESPONSE AUTO-POPULATE] Failed to check existing data for guild ${guildId}:`, error);
      return false;
    }
  }

  /**
   * Get master auto-responses from database
   * @returns {Array} Array of response objects
   */
  async getMasterResponses() {
    try {
      let query = 'SELECT `key`, pattern, flags, replies, raw_text, match_type FROM auto_responses';
      query += ' ORDER BY `key`';
      
      const [rows] = await this.store.sqlPool.execute(query);
      return rows;
    } catch (error) {
      console.error('[AUTO-RESPONSE AUTO-POPULATE] Failed to get master responses:', error);
      throw error;
    }
  }

  /**
   * Insert auto-responses for guild
   * @param {string} guildId - The Discord guild ID
   * @param {Array} responses - Array of response objects
   * @returns {number} Number of responses inserted
   */
  async insertResponses(guildId, responses) {
    let inserted = 0;
    
    for (const responseData of responses) {
      try {
        await this.store.sqlPool.execute(
          `INSERT INTO guild_auto_responses (guild_id, \`key\`, pattern, flags, replies, enabled, raw_text, match_type) 
           VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
          [
            guildId, 
            responseData.key, 
            responseData.pattern, 
            responseData.flags, 
            responseData.replies, 
            responseData.raw_text, 
            responseData.match_type
          ]
        );
        inserted++;
      } catch (error) {
        console.error(`[AUTO-RESPONSE AUTO-POPULATE] Failed to insert response "${responseData.key}" for guild ${guildId}:`, error);
      }
    }
    
    return inserted;
  }

  /**
   * Get statistics about master auto-responses table
   * @returns {Object} Statistics object
   */
  async getMasterTableStats() {
    try {
      const [responsesCount] = await this.store.sqlPool.execute(
        'SELECT COUNT(*) as count FROM auto_responses'
      );
      
      const [enabledCount] = await this.store.sqlPool.execute(
        'SELECT COUNT(*) as count FROM auto_responses WHERE enabled = 1'
      );
      
      const [disabledCount] = await this.store.sqlPool.execute(
        'SELECT COUNT(*) as count FROM auto_responses WHERE enabled = 0'
      );
      
      const [byMatchType] = await this.store.sqlPool.execute(
        'SELECT match_type, COUNT(*) as count FROM auto_responses GROUP BY match_type ORDER BY match_type'
      );
      
      return {
        totalResponses: responsesCount[0].count,
        enabled: enabledCount[0].count,
        disabled: disabledCount[0].count,
        byMatchType: byMatchType.reduce((acc, row) => {
          acc[row.match_type || 'unknown'] = row.count;
          return acc;
        }, {})
      };
    } catch (error) {
      console.error('[AUTO-RESPONSE AUTO-POPULATE] Failed to get master table stats:', error);
      throw error;
    }
  }

  /**
   * Clear all auto-responses for a guild (useful for testing)
   * @param {string} guildId - The Discord guild ID
   * @returns {number} Number of responses deleted
   */
  async clearGuildResponses(guildId) {
    try {
      const [result] = await this.store.sqlPool.execute(
        'DELETE FROM guild_auto_responses WHERE guild_id = ?',
        [guildId]
      );
      
      console.log(`[AUTO-RESPONSE AUTO-POPULATE] Cleared ${result.affectedRows} responses for guild ${guildId}`);
      return result.affectedRows;
    } catch (error) {
      console.error(`[AUTO-RESPONSE AUTO-POPULATE] Failed to clear responses for guild ${guildId}:`, error);
      throw error;
    }
  }
}

module.exports = AutoResponseAutoPopulateService;
