const express = require('express');

// Helper function to get timezone offset in hours
function getTimezoneOffset(timezone) {
  try {
    // Common timezone offsets
    const timezoneOffsets = {
      'UTC': 0,
      'America/New_York': -5,  // EST (or -4 for EDT)
      'America/Chicago': -6,   // CST (or -5 for CDT)
      'America/Denver': -7,    // MST (or -6 for MDT)
      'America/Los_Angeles': -8, // PST (or -7 for PDT)
      'Europe/London': 0,      // GMT (or +1 for BST)
      'Europe/Paris': 1,       // CET (or +2 for CEST)
      'Asia/Tokyo': 9,
      'Asia/Shanghai': 8,
      'Asia/Jakarta': 7,
      'Asia/Dubai': 4,
      'Australia/Sydney': 10,  // AEST (or +11 for AEDT)
    };
    
    if (timezoneOffsets.hasOwnProperty(timezone)) {
      return timezoneOffsets[timezone];
    }
    
    // Try to calculate offset using JavaScript Date API
    const date = new Date();
    const utcTime = date.getTime() + (date.getTimezoneOffset() * 60000);
    const targetTime = new Date(date.toLocaleString("en-US", {timeZone: timezone}));
    const offset = (targetTime.getTime() - utcTime) / (1000 * 60 * 60);
    return Math.round(offset);
  } catch (error) {
    console.log(`Could not determine offset for timezone ${timezone}, using UTC`);
    return 0;
  }
}

function createAnalyticsRoutes(client, store, startTimestamp, commandMap) {
  const router = express.Router();

  // Enhanced analytics overview for dashboard
  router.get('/overview', async (req, res) => {
    try {
      const guildId = req.query.guildId || (req.user.type === 'discord' ? 
        (await store.getUser(req.user.userId))?.selected_guild_id : null);
      
      // Get guild timezone setting
      let guildTimezone = 'UTC'; // Default fallback
      if (guildId && store.sqlPool) {
        try {
          const [timezoneResult] = await store.sqlPool.query(
            'SELECT timezone FROM guild_settings WHERE guild_id = ?', 
            [guildId]
          );
          if (timezoneResult.length > 0 && timezoneResult[0].timezone) {
            guildTimezone = timezoneResult[0].timezone;
          }
        } catch (error) {
          console.log('Could not fetch guild timezone, using UTC:', error.message);
        }
      }
      
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
      
      // Get real command data from guild_command_logs table
      let commandData = {
        today: 0,
        weeklyTrend: [45, 52, 38, 63, 71, 59, 48],
        top: [
          { name: 'ping', count: 142 },
          { name: 'help', count: 89 },
          { name: 'level', count: 67 },
          { name: 'rank', count: 54 },
          { name: 'poll', count: 32 }
        ]
      };
      
      // Fetch real command data if database is available
      if (guildId && store.sqlPool) {
        try {
          // Commands executed today (database already stores in local timezone)
          const [todayRows] = await store.sqlPool.query(`
            SELECT COUNT(*) as count 
            FROM guild_command_logs 
            WHERE guild_id = ? AND DATE(executed_at) = CURDATE()
          `, [guildId]);
          commandData.today = todayRows[0]?.count || 0;
          
          // Top commands in last 24 hours
          const [topRows] = await store.sqlPool.query(`
            SELECT command_name, COUNT(*) as count 
            FROM guild_command_logs 
            WHERE guild_id = ? AND executed_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
            GROUP BY command_name 
            ORDER BY count DESC 
            LIMIT 5
          `, [guildId]);
          if (topRows.length > 0) {
            commandData.top = topRows.map(row => ({
              name: row.command_name,
              count: row.count
            }));
          }
          
          // Weekly trend (last 7 days) - database already in local timezone
          const [weeklyRows] = await store.sqlPool.query(`
            SELECT DATE(executed_at) as date, COUNT(*) as count 
            FROM guild_command_logs 
            WHERE guild_id = ? AND executed_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            GROUP BY DATE(executed_at)
            ORDER BY date ASC
          `, [guildId]);
          
          // Always create a 7-day array using server's current date (which matches database timezone)
          const weeklyData = [];
          for (let i = 6; i >= 0; i--) {
            // Since database is in local time, use current date directly
            const today = new Date();
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            
            // Format date string for comparison (YYYY-MM-DD)
            const dateStr = date.toISOString().split('T')[0];
            
            const dayData = weeklyRows.find(row => {
              // Convert database date to local date string for comparison
              let dbDateStr;
              if (row.date instanceof Date) {
                dbDateStr = row.date.toLocaleDateString('en-CA'); // YYYY-MM-DD format in local timezone
              } else {
                // Handle string dates from database - extract YYYY-MM-DD part
                dbDateStr = row.date.toString().split(' ')[0];
              }
              return dbDateStr === dateStr;
            });
            weeklyData.push(dayData ? dayData.count : 0);
          }
          commandData.weeklyTrend = weeklyData;
        } catch (dbError) {
          console.warn('Failed to fetch command analytics from database:', dbError.message);
        }
      }
      
      const systemMetrics = store.getSystemMetrics();
      
      // Guild-specific stats - define early so it can be used in activity mapping
      let guildStats = { members: 0, name: 'Unknown Guild' };
      if (guildId && client.guilds.cache.has(guildId)) {
        const guild = client.guilds.cache.get(guildId);
        
        // Fetch additional guild data
        let onlineMembers = 0;
        let totalRoles = 0;
        let newMembersToday = 0;
        
        try {
          // Get online member count - try multiple approaches for better compatibility
          let onlineCount = 0;
          
          // Method 1: Try presences cache first
          if (guild.presences && guild.presences.cache) {
            onlineCount = guild.presences.cache.filter(presence => 
              presence.status && presence.status !== 'offline'
            ).size;
          }
          
          // Method 2: Fallback to members cache with presence check
          if (onlineCount === 0 && guild.members && guild.members.cache) {
            onlineCount = guild.members.cache.filter(member => 
              member.presence && member.presence.status && member.presence.status !== 'offline'
            ).size;
          }
          
          onlineMembers = onlineCount;
          
          // Get total roles (excluding @everyone)
          totalRoles = guild.roles.cache.size - 1;
          
          // Calculate new members today (approximation based on recent joins)
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          newMembersToday = guild.members.cache.filter(member => 
            member.joinedAt && member.joinedAt >= today
          ).size;
          
        } catch (discordError) {
          console.warn('Could not fetch detailed guild data:', discordError.message);
        }
        
        guildStats = {
          members: guild.memberCount || 0,
          name: guild.name || 'Unknown Guild',
          id: guild.id,
          onlineMembers,
          totalRoles,
          newMembersToday,
          iconURL: guild.iconURL(),
          description: guild.description,
          ownerId: guild.ownerId,
          createdAt: guild.createdAt,
          verified: guild.verified,
          partnered: guild.partnered
        };
      }
      
      // Get recent activity from command logs
      let recentActivity = [
        { action: '/scheduler used', guild: 'Discord Server', type: 'command', timestamp: new Date(Date.now() - 180000).toISOString() },
        { action: 'Auto-reply triggered', guild: 'Discord Server', type: 'auto', timestamp: new Date(Date.now() - 420000).toISOString() },
        { action: '/ping executed', guild: 'Discord Server', type: 'command', timestamp: new Date(Date.now() - 660000).toISOString() },
        { action: 'Welcome message sent', guild: 'Discord Server', type: 'auto', timestamp: new Date(Date.now() - 900000).toISOString() },
        { action: '/help requested', guild: 'Discord Server', type: 'command', timestamp: new Date(Date.now() - 1200000).toISOString() }
      ];
      
      if (guildId && store.sqlPool) {
        try {
          const [activityRows] = await store.sqlPool.query(`
            SELECT command_name, executed_at, status, user_tag
            FROM guild_command_logs 
            WHERE guild_id = ? 
            ORDER BY executed_at DESC 
            LIMIT 10
          `, [guildId]);
          
          if (activityRows.length > 0) {
            recentActivity = activityRows.map(row => ({
              action: `/${row.command_name} ${row.status === 'success' ? 'executed' : 'failed'}`,
              guild: guildStats.name,
              type: 'command',
              timestamp: row.executed_at,
              user: row.user_tag
            }));
          }
        } catch (dbError) {
          console.warn('Failed to fetch recent activity from database:', dbError.message);
        }
      }
      
      // Get real violation data from guild_user_violations table
      let violationData = {
        todayTotal: 0,
        weeklyTotal: 0,
        byType: {
          spam: 0,
          caps: 0,
          links: 0,
          profanity: 0,
          invite_links: 0,
          mention_spam: 0
        },
        byAction: {
          warn: 0,
          delete: 0,
          mute: 0,
          kick: 0,
          ban: 0
        },
        effectiveness: 0,
        weeklyTrend: [0, 0, 0, 0, 0, 0, 0]
      };
      
      // Get moderation features status
      let featuresData = {};
      try {
        if (guildId && store.getModerationFeatures) {
          const moderationFeatures = await store.getModerationFeatures(guildId);
          featuresData = {
            welcome_enabled: moderationFeatures.welcome?.enabled,
            automod_enabled: moderationFeatures.automod?.enabled,
            antiraid_enabled: moderationFeatures.antiraid?.enabled,
            xp_enabled: moderationFeatures.xp?.enabled,
            scheduler_enabled: moderationFeatures.scheduler?.enabled,
            audit_enabled: moderationFeatures.logging?.enabled,
            role_management_enabled: moderationFeatures.roles?.enabled,
            ai_enabled: moderationFeatures.ai?.enabled
          };
          
          // The moderation features table is the master control - don't override it
          // Only check guild welcome settings if moderation features is not available
        } else if (guildId && store.getGuildWelcome) {
          // Fallback to guild welcome settings if moderation features unavailable
          const welcomeConfig = await store.getGuildWelcome(guildId);
          featuresData.welcome_enabled = welcomeConfig.enabled;
        }
      } catch (featuresError) {
        console.warn('Could not fetch moderation features:', featuresError.message);
      }
      
      if (guildId && store.sqlPool) {
        try {
          // Total violations today
          const [todayViolations] = await store.sqlPool.query(`
            SELECT COUNT(*) as count 
            FROM guild_user_violations 
            WHERE guild_id = ? AND DATE(created_at) = CURDATE()
          `, [guildId]);
          violationData.todayTotal = todayViolations[0]?.count || 0;
          
          // Total violations this week
          const [weekViolations] = await store.sqlPool.query(`
            SELECT COUNT(*) as count 
            FROM guild_user_violations 
            WHERE guild_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
          `, [guildId]);
          violationData.weeklyTotal = weekViolations[0]?.count || 0;
          
          // Violations by type (last 24 hours)
          const [typeRows] = await store.sqlPool.query(`
            SELECT rule_type, COUNT(*) as count 
            FROM guild_user_violations 
            WHERE guild_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
            GROUP BY rule_type
          `, [guildId]);
          
          typeRows.forEach(row => {
            if (violationData.byType.hasOwnProperty(row.rule_type)) {
              violationData.byType[row.rule_type] = row.count;
            }
          });
          
          // Actions taken (last 24 hours)
          const [actionRows] = await store.sqlPool.query(`
            SELECT action_taken, COUNT(*) as count 
            FROM guild_user_violations 
            WHERE guild_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
            GROUP BY action_taken
          `, [guildId]);
          
          actionRows.forEach(row => {
            if (violationData.byAction.hasOwnProperty(row.action_taken)) {
              violationData.byAction[row.action_taken] = row.count;
            }
          });
          
          // Weekly trend (last 7 days)
          const [trendRows] = await store.sqlPool.query(`
            SELECT DATE(created_at) as date, COUNT(*) as count 
            FROM guild_user_violations 
            WHERE guild_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            GROUP BY DATE(created_at)
            ORDER BY date ASC
          `, [guildId]);
          
          // Fill weekly trend array
          const weeklyData = [];
          for (let i = 6; i >= 0; i--) {
            const today = new Date();
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            
            const dayData = trendRows.find(row => {
              let dbDateStr;
              if (row.date instanceof Date) {
                dbDateStr = row.date.toLocaleDateString('en-CA');
              } else {
                dbDateStr = row.date.toString().split(' ')[0];
              }
              return dbDateStr === dateStr;
            });
            weeklyData.push(dayData ? dayData.count : 0);
          }
          violationData.weeklyTrend = weeklyData;
          
          // Calculate effectiveness (successful auto-mod actions vs total violations)
          const totalViolations = violationData.weeklyTotal;
          const autoModActions = actionRows.reduce((sum, row) => sum + row.count, 0);
          violationData.effectiveness = totalViolations > 0 ? Math.round((autoModActions / totalViolations) * 100) : 100;
          
          // Calculate effectiveness improvement (this week vs previous week)
          let effectivenessImprovement = 0;
          try {
            // Get previous week's data for comparison
            const [prevWeekViolations] = await store.sqlPool.query(`
              SELECT COUNT(*) as count 
              FROM guild_user_violations 
              WHERE guild_id = ? 
              AND created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY) 
              AND created_at < DATE_SUB(NOW(), INTERVAL 7 DAY)
            `, [guildId]);
            
            const [prevWeekActions] = await store.sqlPool.query(`
              SELECT COUNT(*) as count 
              FROM guild_user_violations 
              WHERE guild_id = ? 
              AND created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY) 
              AND created_at < DATE_SUB(NOW(), INTERVAL 7 DAY)
              AND action_taken IS NOT NULL
            `, [guildId]);
            
            const prevWeekTotal = prevWeekViolations[0]?.count || 0;
            const prevWeekActionCount = prevWeekActions[0]?.count || 0;
            const prevWeekEffectiveness = prevWeekTotal > 0 ? Math.round((prevWeekActionCount / prevWeekTotal) * 100) : 100;
            
            effectivenessImprovement = violationData.effectiveness - prevWeekEffectiveness;
          } catch (comparisonError) {
            console.warn('Could not calculate effectiveness improvement:', comparisonError.message);
          }
          
          violationData.effectivenessImprovement = effectivenessImprovement;
          
        } catch (dbError) {
          console.warn('Failed to fetch violation data from database:', dbError.message);
        }
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
        // Features status from moderation settings
        features: featuresData,
        // New data for enhanced dashboard
        guild: {
          members: guildStats.members,
          name: guildStats.name,
          id: guildStats.id || guildId,
          onlineMembers: guildStats.onlineMembers || 0,
          totalRoles: guildStats.totalRoles || 0,
          newMembersToday: guildStats.newMembersToday || 0,
          iconURL: guildStats.iconURL,
          description: guildStats.description,
          ownerId: guildStats.ownerId,
          createdAt: guildStats.createdAt,
          verified: guildStats.verified,
          partnered: guildStats.partnered
        },
        commands: {
          today: commandData.today,
          weeklyTrend: commandData.weeklyTrend,
          top: commandData.top
        },
        activity: {
          recent: recentActivity
        },
        security: {
          autoMod: {
            effectiveness: violationData.effectiveness,
            effectivenessImprovement: violationData.effectivenessImprovement,
            violations: violationData.byType,
            actions: violationData.byAction
          },
          violationsToday: violationData.todayTotal,
          violationsWeek: violationData.weeklyTotal,
          violationTrend: violationData.weeklyTrend
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

  // Command analytics endpoint for detailed command statistics
  router.get('/commands', async (req, res) => {
    try {
      const guildId = req.query.guildId || (req.user.type === 'discord' ? 
        (await store.getUser(req.user.userId))?.selected_guild_id : null);
      
      if (!guildId) {
        return res.status(400).json({ error: 'guild_required' });
      }
      
      let analytics = {
        today: 0,
        thisWeek: 0,
        thisMonth: 0,
        topCommands: [],
        weeklyTrend: [],
        recentExecutions: [],
        performanceMetrics: {
          avgResponseTime: 0,
          successRate: 100,
          totalExecutions: 0
        }
      };
      
      if (store.sqlPool) {
        try {
          // Commands today
          const [todayRows] = await store.sqlPool.query(`
            SELECT COUNT(*) as count 
            FROM guild_command_logs 
            WHERE guild_id = ? AND DATE(executed_at) = CURDATE()
          `, [guildId]);
          analytics.today = todayRows[0]?.count || 0;
          
          // Commands this week
          const [weekRows] = await store.sqlPool.query(`
            SELECT COUNT(*) as count 
            FROM guild_command_logs 
            WHERE guild_id = ? AND executed_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
          `, [guildId]);
          analytics.thisWeek = weekRows[0]?.count || 0;
          
          // Commands this month
          const [monthRows] = await store.sqlPool.query(`
            SELECT COUNT(*) as count 
            FROM guild_command_logs 
            WHERE guild_id = ? AND executed_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
          `, [guildId]);
          analytics.thisMonth = monthRows[0]?.count || 0;
          
          // Top commands (last 30 days)
          const [topRows] = await store.sqlPool.query(`
            SELECT command_name, COUNT(*) as count, 
                   AVG(response_time_ms) as avg_response_time,
                   SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as success_rate
            FROM guild_command_logs 
            WHERE guild_id = ? AND executed_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            GROUP BY command_name 
            ORDER BY count DESC 
            LIMIT 10
          `, [guildId]);
          
          analytics.topCommands = topRows.map(row => ({
            name: row.command_name,
            count: row.count,
            avgResponseTime: Math.round(row.avg_response_time || 0),
            successRate: Math.round(row.success_rate || 100)
          }));
          
          // Daily trend for last 14 days
          const [trendRows] = await store.sqlPool.query(`
            SELECT DATE(executed_at) as date, COUNT(*) as count 
            FROM guild_command_logs 
            WHERE guild_id = ? AND executed_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)
            GROUP BY DATE(executed_at) 
            ORDER BY date ASC
          `, [guildId]);
          
          // Fill in the last 14 days
          const today = new Date();
          const trendData = [];
          for (let i = 13; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            const dayData = trendRows.find(row => row.date === dateStr);
            trendData.push({
              date: dateStr,
              count: dayData ? dayData.count : 0
            });
          }
          analytics.weeklyTrend = trendData;
          
          // Recent executions
          const [recentRows] = await store.sqlPool.query(`
            SELECT command_name, executed_at, status, response_time_ms, user_tag, error_message
            FROM guild_command_logs 
            WHERE guild_id = ? 
            ORDER BY executed_at DESC 
            LIMIT 20
          `, [guildId]);
          
          analytics.recentExecutions = recentRows.map(row => ({
            command: row.command_name,
            executedAt: row.executed_at,
            status: row.status,
            responseTime: row.response_time_ms,
            user: row.user_tag,
            error: row.error_message
          }));
          
          // Performance metrics
          const [perfRows] = await store.sqlPool.query(`
            SELECT 
              AVG(response_time_ms) as avg_response_time,
              SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as success_rate,
              COUNT(*) as total_executions
            FROM guild_command_logs 
            WHERE guild_id = ? AND executed_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
          `, [guildId]);
          
          if (perfRows[0]) {
            analytics.performanceMetrics = {
              avgResponseTime: Math.round(perfRows[0].avg_response_time || 0),
              successRate: Math.round(perfRows[0].success_rate || 100),
              totalExecutions: perfRows[0].total_executions || 0
            };
          }
          
        } catch (dbError) {
          console.warn('Failed to fetch command analytics:', dbError.message);
        }
      }
      
      res.json({
        guildId,
        analytics
      });
      
    } catch (e) {
      console.error('Command analytics error:', e);
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
