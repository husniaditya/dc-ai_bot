// Analytics service - handles command usage tracking, activity logs, and system metrics
const cache = require('../cache/manager');

function trackCommandUsage(commandName, guildId) {
  const now = Date.now();
  const key = commandName;
  const cacheData = cache.getCache();
  
  // Update daily counter
  if (!cacheData.commandUsageStats.has(key)) {
    cacheData.commandUsageStats.set(key, { daily: 0, hourly: 0, lastHour: now });
  }
  
  const stats = cacheData.commandUsageStats.get(key);
  stats.daily++;
  
  // Reset hourly counter if it's been an hour
  if (now - stats.lastHour > 3600000) {
    stats.hourly = 0;
    stats.lastHour = now;
  }
  stats.hourly++;
  
  // Update system stats
  cacheData.systemStats.commandsToday++;
  
  // Add to activity log
  cacheData.activityLog.push({
    type: 'command',
    action: `/${commandName} used`,
    guild: guildId || 'DM',
    timestamp: new Date().toISOString(),
    userId: null
  });
  
  // Keep activity log limited to last 100 entries
  if (cacheData.activityLog.length > 100) {
    cacheData.activityLog.shift();
  }
}

function trackAutoResponse(guildId, key) {
  const cacheData = cache.getCache();
  
  cacheData.activityLog.push({
    type: 'auto',
    action: `Auto response: ${key}`,
    guild: guildId || 'Unknown',
    timestamp: new Date().toISOString(),
    userId: null
  });
  
  if (cacheData.activityLog.length > 100) {
    cacheData.activityLog.shift();
  }
}

function trackError(error, context = '') {
  const now = Date.now();
  const cacheData = cache.getCache();
  
  // Reset error counter if it's been an hour
  if (now - cacheData.systemStats.lastHourReset > 3600000) {
    cacheData.systemStats.errorsThisHour = 0;
    cacheData.systemStats.lastHourReset = now;
  }
  
  cacheData.systemStats.errorsThisHour++;
  cacheData.errorLog.push({
    timestamp: new Date().toISOString(),
    error: error.message || String(error),
    context
  });
  
  // Keep error log limited
  if (cacheData.errorLog.length > 50) {
    cacheData.errorLog.shift();
  }
}

function trackApiResponse(responseTime, success = true) {
  const cacheData = cache.getCache();
  
  cacheData.systemStats.responseTimeSum += responseTime;
  cacheData.systemStats.responseTimeCount++;
  cacheData.systemStats.totalRequests++;
  
  if (success) {
    cacheData.systemStats.successCount++;
  }
}

function getSystemMetrics() {
  const now = Date.now();
  const cacheData = cache.getCache();
  
  // Cache metrics for 5 seconds to avoid excessive calculations
  if (cacheData.cachedSystemMetrics && (now - cacheData.lastMetricsUpdate) < 5000) {
    return cacheData.cachedSystemMetrics;
  }
  
  const uptime = now - cacheData.systemStats.startTime;
  const avgResponseTime = cacheData.systemStats.responseTimeCount > 0 
    ? Math.round(cacheData.systemStats.responseTimeSum / cacheData.systemStats.responseTimeCount) 
    : 0;
  
  const successRate = cacheData.systemStats.totalRequests > 0 
    ? (cacheData.systemStats.successCount / cacheData.systemStats.totalRequests) * 100 
    : 100;
  
  // Get memory usage
  const memUsage = process.memoryUsage();
  
  // Calculate CPU usage (simplified approach using process.hrtime)
  const cpuUsage = process.cpuUsage();
  const totalTime = (cpuUsage.user + cpuUsage.system) / 1000; // Convert to milliseconds
  const uptimeMs = uptime;
  let cpuPercent = 0;
  
  if (uptimeMs > 0) {
    cpuPercent = (totalTime / uptimeMs) * 100;
  }
  
  const metrics = {
    memory: {
      used: memUsage.heapUsed,
      total: memUsage.heapTotal
    },
    cpu: {
      usage: Math.max(0, cpuPercent)
    },
    responseTime: {
      avg: avgResponseTime
    },
    successRate: Math.round(successRate * 100) / 100,
    commands: {
      daily: cacheData.systemStats.commandsToday
    },
    errors: {
      hourly: cacheData.systemStats.errorsThisHour
    }
  };
  
  cache.setCachedSystemMetrics(metrics);
  return metrics;
}

function getTopCommands(guildId = null) {
  const cacheData = cache.getCache();
  return Array.from(cacheData.commandUsageStats.entries())
    .map(([name, stats]) => ({ name, count: stats.daily }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

function getRecentActivity(guildId = null) {
  const cacheData = cache.getCache();
  let activities = cacheData.activityLog.slice(-50); // Get more to filter from
  
  // Filter by guild if specified
  if (guildId) {
    activities = activities.filter(activity => activity.guild === guildId);
  }
  
  return activities.slice(-20).reverse(); // Last 20 activities, newest first
}

function getBotStats(client) {
  if (!client) return { guilds: 0, users: 0 };
  
  const guildCount = client.guilds.cache.size;
  const userCount = client.guilds.cache.reduce((total, guild) => total + guild.memberCount, 0);
  
  return {
    guilds: guildCount,
    users: userCount
  };
}

function resetDailyStats() {
  cache.resetDailyStats();
}

module.exports = {
  trackCommandUsage,
  trackAutoResponse,
  trackError,
  trackApiResponse,
  getSystemMetrics,
  getTopCommands,
  getRecentActivity,
  getBotStats,
  resetDailyStats
};
