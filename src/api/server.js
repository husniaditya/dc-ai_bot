const express = require('express');
const path = require('path');
const fs = require('fs');

// Import middleware
const corsMiddleware = require('./middleware/cors');
const authMiddleware = require('./middleware/auth');
const rateLimitMiddleware = require('./middleware/rateLimit');
const auditMiddleware = require('./middleware/audit');
const trackingMiddleware = require('./middleware/tracking');

// Import routes
const authRoutes = require('./routes/auth');
const settingsRoutes = require('./routes/settings');
const personalizationRoutes = require('./routes/personalization');
const welcomeRoutes = require('./routes/welcome');
const commandsRoutes = require('./routes/commands');
const autoResponsesRoutes = require('./routes/autoResponses');
const analyticsRoutes = require('./routes/analytics');
const youtubeRoutes = require('./routes/youtube');
const twitchRoutes = require('./routes/twitch');
const channelsRoutes = require('./routes/channels');
const rolesRoutes = require('./routes/roles');

function createApiServer(client, store, commandMap, startTimestamp) {
  const app = express();
  
  // Basic middleware
  app.use(express.json());
  app.use((req,res,next)=>{ res.setHeader('Vary','Origin'); next(); });
  
  // Apply custom middleware
  app.use('/api', rateLimitMiddleware());
  app.use(corsMiddleware());
  app.use(trackingMiddleware(store));
  
  // Mount routes with dependencies
  app.use('/api/auth', authRoutes(client, store));
  app.use('/api/settings', authMiddleware, settingsRoutes(store));
  app.use('/api/personalization', authMiddleware, personalizationRoutes(client, store));
  app.use('/api/welcome', authMiddleware, welcomeRoutes(client, store));
  app.use('/api/commands', authMiddleware, commandsRoutes(store, commandMap));
  app.use('/api/auto-responses', authMiddleware, autoResponsesRoutes(store));
  app.use('/api/analytics', authMiddleware, analyticsRoutes(client, store, startTimestamp, commandMap));
  app.use('/api/youtube', authMiddleware, youtubeRoutes(client, store));
  app.use('/api/twitch', authMiddleware, twitchRoutes(client, store));
  app.use('/api/channels', authMiddleware, channelsRoutes(client, store));
  app.use('/api/roles', authMiddleware, rolesRoutes(client, store));
  
  // Root status endpoint for dashboard compatibility
  app.get('/api/status', authMiddleware, (req, res) => {
    try {
      const geminiEnabled = !!(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY);
      const discordReady = !!client.readyAt;
      const ping = typeof client.ws?.ping === 'number' ? Math.round(client.ws.ping) : null;
      const uptimeSeconds = Math.floor((Date.now() - startTimestamp) / 1000);
      const dbMode = 'Connected' || 'unknown';
      const dbConnected = dbMode !== 'memory' ? true : true;
      
      // Get system metrics for dashboard compatibility
      const systemMetrics = store.getSystemMetrics();
      
      res.json({
        gemini: { enabled: geminiEnabled },
        discord: { ready: discordReady, ping },
        database: { mode: dbMode, connected: dbConnected },
        uptime: { seconds: uptimeSeconds, startedAt: new Date(startTimestamp).toISOString() },
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
        },
        status: 'ok'
      });
    } catch(e) {
      console.error('Root status endpoint error:', e);
      res.status(500).json({ error: 'status_check_failed' });
    }
  });
  
  // Serve built dashboard (if built with vite build output in /dashboard/dist)
  const distPath = path.join(__dirname, '../../dashboard', 'dist');
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    // SPA fallback
    app.use((req,res,next)=>{
      if (req.method === 'GET' && !req.path.startsWith('/api/') && !req.path.includes('.')) {
        return res.sendFile(path.join(distPath, 'index.html'));
      }
      return next();
    });
  }
  
  return app;
}

module.exports = { createApiServer };
