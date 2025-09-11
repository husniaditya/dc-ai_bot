/**
 * Profanity Auto-Population Service
 * Automatically populates profanity words and patterns for new guilds from master tables
 */

class ProfanityAutoPopulateService {
  constructor(store) {
    this.store = store;
  }

  /**
   * Auto-populate profanity words and patterns for a new guild
   * Uses master tables as source of truth
   * @param {string} guildId - The Discord guild ID
   * @param {Object} options - Configuration options
   * @param {boolean} options.skipIfExists - Skip if guild already has data (default: true)
   * @param {string} options.severityFilter - Filter by severity level (optional)
   * @returns {Object} Result object with statistics
   */
  async populateForGuild(guildId, options = {}) {
    const { skipIfExists = true, severityFilter = null } = options;
    
    try {
      console.log(`[PROFANITY AUTO-POPULATE] Starting for guild: ${guildId}`);
      
      // Check if guild already has profanity data
      if (skipIfExists) {
        const hasExistingData = await this.checkExistingData(guildId);
        if (hasExistingData) {
          console.log(`[PROFANITY AUTO-POPULATE] Guild ${guildId} already has profanity data, skipping`);
          return {
            success: true,
            skipped: true,
            reason: 'Guild already has existing profanity data',
            wordsInserted: 0,
            patternsInserted: 0
          };
        }
      }
      
      // Get master profanity data
      const masterWords = await this.getMasterWords(severityFilter);
      const masterPatterns = await this.getMasterPatterns(severityFilter);
      
      // Insert data
      const wordsInserted = await this.insertWords(guildId, masterWords);
      const patternsInserted = await this.insertPatterns(guildId, masterPatterns);
      
      const result = {
        success: true,
        skipped: false,
        guildId,
        wordsInserted,
        patternsInserted,
        totalInserted: wordsInserted + patternsInserted
      };
      
      console.log(`[PROFANITY AUTO-POPULATE] Successfully populated guild ${guildId}:`);
      console.log(`  - ${wordsInserted} profanity words added (disabled)`);
      console.log(`  - ${patternsInserted} profanity patterns added (disabled)`);
      console.log(`[PROFANITY AUTO-POPULATE] Admins can enable filters via dashboard`);
      
      return result;
      
    } catch (error) {
      console.error(`[PROFANITY AUTO-POPULATE] Failed for guild ${guildId}:`, error);
      return {
        success: false,
        error: error.message,
        guildId
      };
    }
  }

  /**
   * Check if guild already has profanity data
   * @param {string} guildId - The Discord guild ID
   * @returns {boolean} True if guild has existing data
   */
  async checkExistingData(guildId) {
    try {
      const [existingWords] = await this.store.sqlPool.execute(
        'SELECT COUNT(*) as count FROM guild_profanity_words WHERE guild_id = ?',
        [guildId]
      );
      
      const [existingPatterns] = await this.store.sqlPool.execute(
        'SELECT COUNT(*) as count FROM guild_profanity_patterns WHERE guild_id = ?',
        [guildId]
      );
      
      return existingWords[0].count > 0 || existingPatterns[0].count > 0;
    } catch (error) {
      console.error(`[PROFANITY AUTO-POPULATE] Failed to check existing data for guild ${guildId}:`, error);
      return false;
    }
  }

  /**
   * Get master profanity words from database
   * @param {string} severityFilter - Optional severity filter
   * @returns {Array} Array of word objects
   */
  async getMasterWords(severityFilter = null) {
    try {
      let query = 'SELECT word, severity, language, case_sensitive, whole_word_only FROM m_profanity_words';
      let params = [];
      
      if (severityFilter) {
        query += ' WHERE severity = ?';
        params.push(severityFilter);
      }
      
      query += ' ORDER BY severity, word';
      
      const [rows] = await this.store.sqlPool.execute(query, params);
      return rows;
    } catch (error) {
      console.error('[PROFANITY AUTO-POPULATE] Failed to get master words:', error);
      throw error;
    }
  }

  /**
   * Get master profanity patterns from database
   * @param {string} severityFilter - Optional severity filter
   * @returns {Array} Array of pattern objects
   */
  async getMasterPatterns(severityFilter = null) {
    try {
      let query = 'SELECT pattern, severity, description, flags FROM m_profanity_patterns';
      let params = [];
      
      if (severityFilter) {
        query += ' WHERE severity = ?';
        params.push(severityFilter);
      }
      
      query += ' ORDER BY severity, pattern';
      
      const [rows] = await this.store.sqlPool.execute(query, params);
      return rows;
    } catch (error) {
      console.error('[PROFANITY AUTO-POPULATE] Failed to get master patterns:', error);
      throw error;
    }
  }

  /**
   * Insert profanity words for guild
   * @param {string} guildId - The Discord guild ID
   * @param {Array} words - Array of word objects
   * @returns {number} Number of words inserted
   */
  async insertWords(guildId, words) {
    let inserted = 0;
    
    for (const wordData of words) {
      try {
        await this.store.sqlPool.execute(
          `INSERT INTO guild_profanity_words (guild_id, word, enabled, severity, language, case_sensitive, whole_word_only, created_at) 
           VALUES (?, ?, 0, ?, ?, ?, ?, NOW())`,
          [guildId, wordData.word, wordData.severity, wordData.language, wordData.case_sensitive, wordData.whole_word_only]
        );
        inserted++;
      } catch (error) {
        console.error(`[PROFANITY AUTO-POPULATE] Failed to insert word "${wordData.word}" for guild ${guildId}:`, error);
      }
    }
    
    return inserted;
  }

  /**
   * Insert profanity patterns for guild
   * @param {string} guildId - The Discord guild ID
   * @param {Array} patterns - Array of pattern objects
   * @returns {number} Number of patterns inserted
   */
  async insertPatterns(guildId, patterns) {
    let inserted = 0;
    
    for (const patternData of patterns) {
      try {
        await this.store.sqlPool.execute(
          `INSERT INTO guild_profanity_patterns (guild_id, pattern, enabled, severity, description, flags, created_at) 
           VALUES (?, ?, 0, ?, ?, ?, NOW())`,
          [guildId, patternData.pattern, patternData.severity, patternData.description, patternData.flags]
        );
        inserted++;
      } catch (error) {
        console.error(`[PROFANITY AUTO-POPULATE] Failed to insert pattern "${patternData.pattern}" for guild ${guildId}:`, error);
      }
    }
    
    return inserted;
  }

  /**
   * Get statistics about master tables
   * @returns {Object} Statistics object
   */
  async getMasterTableStats() {
    try {
      const [wordsCount] = await this.store.sqlPool.execute(
        'SELECT COUNT(*) as count FROM m_profanity_words'
      );
      
      const [patternsCount] = await this.store.sqlPool.execute(
        'SELECT COUNT(*) as count FROM m_profanity_patterns'
      );
      
      const [wordsBySeverity] = await this.store.sqlPool.execute(
        'SELECT severity, COUNT(*) as count FROM m_profanity_words GROUP BY severity ORDER BY severity'
      );
      
      const [patternsBySeverity] = await this.store.sqlPool.execute(
        'SELECT severity, COUNT(*) as count FROM m_profanity_patterns GROUP BY severity ORDER BY severity'
      );
      
      return {
        totalWords: wordsCount[0].count,
        totalPatterns: patternsCount[0].count,
        wordsBySeverity: wordsBySeverity.reduce((acc, row) => {
          acc[row.severity] = row.count;
          return acc;
        }, {}),
        patternsBySeverity: patternsBySeverity.reduce((acc, row) => {
          acc[row.severity] = row.count;
          return acc;
        }, {})
      };
    } catch (error) {
      console.error('[PROFANITY AUTO-POPULATE] Failed to get master table stats:', error);
      throw error;
    }
  }
}

module.exports = ProfanityAutoPopulateService;
