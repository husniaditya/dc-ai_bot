// User management service - handles Discord OAuth users and session management
const db = require('../database/connection');

async function upsertUser(user) {
  if (db.mariaAvailable && db.sqlPool) {
    await db.sqlPool.query(
      'REPLACE INTO m_user(user_id, username, global_name, avatar, last_login) VALUES (?,?,?,?,CURRENT_TIMESTAMP)',
      [user.userId || user.id, user.username, user.globalName, user.avatar]
    );
  }
}

async function setUserSelectedGuild(userId, guildId) {
  if (db.mariaAvailable && db.sqlPool) {
    await db.sqlPool.query(
      'UPDATE m_user SET selected_guild_id=? WHERE user_id=?',
      [guildId, userId]
    );
  }
}

async function getUser(userId) {
  if (db.mariaAvailable && db.sqlPool) {
    const [rows] = await db.sqlPool.query(
      'SELECT user_id, username, global_name, avatar, selected_guild_id, last_login FROM m_user WHERE user_id=?',
      [userId]
    );
    
    if (rows.length > 0) {
      const row = rows[0];
      return {
        userId: row.user_id,
        username: row.username,
        globalName: row.global_name,
        avatar: row.avatar,
        selected_guild_id: row.selected_guild_id,
        lastLogin: row.last_login
      };
    }
  }
  
  return null;
}

module.exports = {
  upsertUser,
  setUserSelectedGuild,
  getUser
};
