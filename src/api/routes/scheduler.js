const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const authMiddleware = require('../middleware/auth');

// Get scheduled messages for a guild
router.get('/guild/:guildId/events', authMiddleware, async (req, res) => {
  try {
    const { guildId } = req.params;
    
    // Verify user has access to this guild
    const userGuilds = req.user.guilds || [];
    const hasAccess = userGuilds.some(guild => guild.id === guildId && (guild.permissions & 0x8) === 0x8);
    
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'discord_bot'
    });

    // Get scheduled messages/events for this guild
    const [events] = await connection.execute(`
      SELECT 
        id,
        message_content,
        channel_id,
        scheduled_time,
        recurring_pattern,
        is_recurring,
        created_by,
        created_at,
        is_active,
        last_sent
      FROM scheduled_messages 
      WHERE guild_id = ? AND is_active = 1
      ORDER BY scheduled_time ASC
    `, [guildId]);

    // Get channel information for better display
    const [channels] = await connection.execute(`
      SELECT channel_id, channel_name 
      FROM guild_channels 
      WHERE guild_id = ?
    `, [guildId]);

    const channelMap = {};
    channels.forEach(ch => {
      channelMap[ch.channel_id] = ch.channel_name;
    });

    // Format events with channel names
    const formattedEvents = events.map(event => ({
      ...event,
      channel_name: channelMap[event.channel_id] || 'Unknown Channel',
      scheduled_time: new Date(event.scheduled_time).toLocaleString(),
      created_at: new Date(event.created_at).toLocaleString(),
      last_sent: event.last_sent ? new Date(event.last_sent).toLocaleString() : null
    }));

    await connection.end();

    res.json({ events: formattedEvents });
  } catch (error) {
    console.error('Error fetching scheduled events:', error);
    res.status(500).json({ error: 'Failed to fetch scheduled events' });
  }
});

// Delete a scheduled message
router.delete('/guild/:guildId/events/:eventId', authMiddleware, async (req, res) => {
  try {
    const { guildId, eventId } = req.params;
    
    // Verify user has access to this guild
    const userGuilds = req.user.guilds || [];
    const hasAccess = userGuilds.some(guild => guild.id === guildId && (guild.permissions & 0x8) === 0x8);
    
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'discord_bot'
    });

    // Delete the scheduled message
    await connection.execute(`
      UPDATE scheduled_messages 
      SET is_active = 0 
      WHERE id = ? AND guild_id = ?
    `, [eventId, guildId]);

    await connection.end();

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting scheduled event:', error);
    res.status(500).json({ error: 'Failed to delete scheduled event' });
  }
});

module.exports = router;
