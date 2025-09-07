const db = require('./src/config/database.js');

(async () => {
  try {
    await db.connect();
    const [rows] = await db.sqlPool.query('DESCRIBE guild_antiraid_logs');
    console.log('guild_antiraid_logs table structure:');
    console.table(rows);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
