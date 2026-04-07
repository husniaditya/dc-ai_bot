// AI Chat history service - handles persistent chat history storage
const db = require('../database/connection');

/**
 * Save a chat message to the database
 * @param {string} guildId - The guild ID
 * @param {string} userId - The user ID
 * @param {string} role - Message role: 'user' or 'assistant'
 * @param {string} content - Message content
 */
async function saveAIChatMessage(guildId, userId, role, content) {
  if (!db.mariaAvailable) return;
  
  try {
    await db.sqlPool.query(
      `INSERT INTO guild_ai_chat_history (guild_id, user_id, role, content, created_at) 
       VALUES (?, ?, ?, ?, NOW())`,
      [guildId, userId, role, content.substring(0, 4000)] // Limit content length
    );
  } catch (error) {
    console.error('Failed to save AI chat message:', error);
    throw error;
  }
}

/**
 * Get chat history for a guild and user
 * @param {string} guildId - The guild ID
 * @param {string} userId - The user ID
 * @param {number} limit - Maximum number of messages to retrieve (default: 10)
 * @returns {Array} Array of message objects with role and content
 */
async function getAIChatHistory(guildId, userId, limit = 10) {
  if (!db.mariaAvailable) return [];
  
  try {
    const [rows] = await db.sqlPool.query(
      `SELECT role, content, created_at 
       FROM guild_ai_chat_history 
       WHERE guild_id = ? AND user_id = ? 
       ORDER BY created_at DESC 
       LIMIT ?`,
      [guildId, userId, limit]
    );
    
    // Reverse to get chronological order (oldest first)
    return rows.reverse().map(row => ({
      role: row.role,
      content: row.content
    }));
  } catch (error) {
    console.error('Failed to get AI chat history:', error);
    return [];
  }
}

/**
 * Clear chat history for a guild and user
 * @param {string} guildId - The guild ID
 * @param {string} userId - The user ID
 */
async function clearAIChatHistory(guildId, userId) {
  if (!db.mariaAvailable) return;
  
  try {
    await db.sqlPool.query(
      `DELETE FROM guild_ai_chat_history 
       WHERE guild_id = ? AND user_id = ?`,
      [guildId, userId]
    );
  } catch (error) {
    console.error('Failed to clear AI chat history:', error);
    throw error;
  }
}

/**
 * Clean up old chat history (older than 30 days)
 */
async function cleanupOldChatHistory() {
  if (!db.mariaAvailable) return;
  
  try {
    const [result] = await db.sqlPool.query(
      `DELETE FROM guild_ai_chat_history 
       WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)`
    );
    
    if (result.affectedRows > 0) {
      console.log(`Cleaned up ${result.affectedRows} old AI chat messages`);
    }
  } catch (error) {
    console.error('Failed to cleanup old chat history:', error);
  }
}

module.exports = {
  saveAIChatMessage,
  getAIChatHistory,
  clearAIChatHistory,
  cleanupOldChatHistory
};
