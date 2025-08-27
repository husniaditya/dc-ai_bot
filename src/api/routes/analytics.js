const express = require('express');

function createAnalyticsRoutes(client, store, startTimestamp, commandMap) {
  const router = express.Router();

  // Enhanced analytics overview for dashboard
  router.get('/overview', async (req, res) => {
    try {
      const guildId = req.query.guildId || (req.user.type === 'discord' ? 
        (await store.getUser(req.user.userId))?.selected_guild_id : null);
      
      // Original data
      let autos = guildId ? await store.getGuildAutoResponses(guildId) : store.getAutoResponses();
      if (!Array.isArray(autos)) autos = [];
      
      const autoEnabled = autos.filter(a => a && a.enabled !== false).length;
      const cmdList = commandMap ? Array.from(commandMap.values()).map(c => c.name) : [];
      
      let toggles = {};
      try { 
        toggles = guildId ? await store.getGuildCommandToggles(guildId) : store.getCommandToggles(); 
      } catch {}
      
      const commandsEnabled = cmdList.filter(n => toggles[n] !== false).length;
      const commandsDisabled = cmdList.length - commandsEnabled;
      const autoBuckets = autos.reduce((acc, a) => { 
        const k = (a.key || '').charAt(0).toUpperCase() || '#'; 
        acc[k] = (acc[k] || 0) + 1; 
        return acc; 
      }, {});
      
      // New analytics data - make it guild-specific
      const botStats = store.getBotStats(client);
      const topCommands = store.getTopCommands(guildId);
      const recentActivity = store.getRecentActivity(guildId);
      const systemMetrics = store.getSystemMetrics();
      
      // Guild-specific stats
      let guildStats = { members: 0, name: 'Unknown Guild' };
      if (guildId && client.guilds.cache.has(guildId)) {
        const guild = client.guilds.cache.get(guildId);
        guildStats = {
          members: guild.memberCount || 0,
          name: guild.name || 'Unknown Guild',
          id: guild.id
        };
      }
      
      res.json({
        guildId,
        // Original data
        totals: { 
          autos: autos.length, 
          autosEnabled: autoEnabled, 
          commands: cmdList.length, 
          commandsEnabled, 
          commandsDisabled,
          // Guild-specific stats instead of global
          members: guildStats.members,
          guildName: guildStats.name
        },
        autoBuckets,
        // New data for enhanced dashboard
        guild: {
          members: guildStats.members,
          name: guildStats.name,
          id: guildStats.id || guildId
        },
        commands: {
          today: systemMetrics.commands.daily,
          top: topCommands
        },
        activity: {
          recent: recentActivity
        },
        system: {
          memory: {
            used: Math.round(systemMetrics.memory.used / 1024 / 1024), // MB
            total: Math.round(systemMetrics.memory.total / 1024 / 1024), // MB
            percentage: Math.round((systemMetrics.memory.used / systemMetrics.memory.total) * 100)
          },
          cpu: {
            usage: systemMetrics.cpu.usage
          },
          performance: {
            avgResponseTime: systemMetrics.responseTime.avg,
            successRate: systemMetrics.successRate,
            errorsLastHour: systemMetrics.errors.hourly
          }
        }
      });
    } catch(e) { 
      console.error('Analytics overview error:', e);
      res.status(500).json({ error: 'load_failed' }); 
    }
  });

  // Enhanced API status with system health metrics
  router.get('/status', (req, res) => {
    try {
      const geminiEnabled = !!(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY);
      const discordReady = !!client.readyAt;
      const ping = typeof client.ws?.ping === 'number' ? Math.round(client.ws.ping) : null;
      const uptimeSeconds = Math.floor((Date.now() - startTimestamp) / 1000);
      const dbMode = store.persistenceModeRef?.mode || 'unknown';
      const dbConnected = dbMode !== 'memory' ? true : true;
      
      // Get system metrics
      const systemMetrics = store.getSystemMetrics();
      
      // Calculate health status
      const health = {
        status: 'healthy',
        checks: {
          discord: discordReady ? 'healthy' : 'unhealthy',
          database: dbConnected ? 'healthy' : 'unhealthy',
          gemini: geminiEnabled ? 'healthy' : 'disabled',
          memory: systemMetrics.memory.used / systemMetrics.memory.total < 0.9 ? 'healthy' : 'warning',
          responseTime: systemMetrics.responseTime.avg < 1000 ? 'healthy' : 'warning'
        }
      };
      
      // Overall health based on critical services
      if (!discordReady || !dbConnected) {
        health.status = 'unhealthy';
      } else if (systemMetrics.memory.used / systemMetrics.memory.total > 0.9 || 
                 systemMetrics.responseTime.avg > 1000) {
        health.status = 'warning';
      }
      
      res.json({
        // Original status data
        gemini: { enabled: geminiEnabled },
        discord: { ready: discordReady, ping },
        database: { mode: dbMode, connected: dbConnected },
        uptime: { seconds: uptimeSeconds, startedAt: new Date(startTimestamp).toISOString() },
        // New system health data
        health,
        system: {
          memory: {
            used: Math.round(systemMetrics.memory.used / 1024 / 1024), // MB
            total: Math.round(systemMetrics.memory.total / 1024 / 1024), // MB
            percentage: Math.round((systemMetrics.memory.used / systemMetrics.memory.total) * 100)
          },
          cpu: {
            usage: systemMetrics.cpu.usage
          },
          performance: {
            avgResponseTime: systemMetrics.responseTime.avg,
            successRate: systemMetrics.successRate,
            errorsLastHour: systemMetrics.errors.hourly
          }
        }
      });
    } catch(e) {
      console.error('Status endpoint error:', e);
      res.status(500).json({ error: 'status_check_failed' });
    }
  });

  // Lightweight guild list
  router.get('/guilds', (req, res) => {
    try {
      const list = client.guilds.cache.map(g => ({ 
        id: g.id, 
        name: g.name, 
        icon: g.icon 
      }));
      res.json(list);
    } catch(e) { 
      res.status(500).json({ error: 'load_failed' }); 
    }
  });

  // List channels (text-based) for current guild
  router.get('/channels', async (req, res) => {
    try {
      const guildId = req.query.guildId || (req.user.type === 'discord' ? 
        (await store.getUser(req.user.userId))?.selected_guild_id : null);
      
      if (!guildId) return res.status(400).json({ error: 'guild_required' });
      
      const guild = client.guilds.cache.get(guildId);
      if (!guild) return res.status(400).json({ error: 'bot_not_in_guild' });

      // Fetch to ensure cache population
      try { await guild.channels.fetch(); } catch {}
      
      const channels = guild.channels.cache
        .filter(c => c && c.isTextBased && typeof c.isTextBased === 'function' ? 
          c.isTextBased() : (c.type && /text|forum|news/i.test(String(c.type))))
        .map(c => ({ 
          id: c.id, 
          name: c.name, 
          type: c.type, 
          parentId: c.parentId || null, 
          position: c.rawPosition || c.position || 0 
        }))
        .sort((a, b) => a.position - b.position);

      res.json({ guildId, channels });
    } catch(e) { 
      res.status(500).json({ error: 'load_failed' }); 
    }
  });

  // List roles for current guild
  router.get('/roles', async (req, res) => {
    try {
      const guildId = req.query.guildId || (req.user.type === 'discord' ? 
        (await store.getUser(req.user.userId))?.selected_guild_id : null);
      
      if (!guildId) return res.status(400).json({ error: 'guild_required' });
      
      const guild = client.guilds.cache.get(guildId);
      if (!guild) return res.status(400).json({ error: 'bot_not_in_guild' });

      try { await guild.roles.fetch(); } catch {}
      
      const roles = guild.roles.cache
        .filter(r => !r.managed) // skip integration managed roles
        .map(r => ({ 
          id: r.id, 
          name: r.name, 
          position: r.position, 
          mentionable: r.mentionable 
        }))
        .sort((a, b) => b.position - a.position);

      res.json({ guildId, roles });
    } catch(e) { 
      res.status(500).json({ error: 'load_failed' }); 
    }
  });

  return router;
}

module.exports = createAnalyticsRoutes;
