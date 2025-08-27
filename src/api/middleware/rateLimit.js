// Basic in-memory rate limiting (per IP) for dashboard API
function createRateLimitMiddleware() {
  const rlWindowMs = parseInt(process.env.DASHBOARD_RATE_WINDOW_MS || '60000', 10); // 1 min
  const rlMax = parseInt(process.env.DASHBOARD_RATE_MAX || '120', 10);
  const rlMap = new Map(); // ip -> { count, ts }

  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();
    let rec = rlMap.get(ip);
    
    if (!rec || rec.ts + rlWindowMs < now) {
      rec = { count: 0, ts: now };
    }
    
    rec.count++;
    rlMap.set(ip, rec);
    
    if (rec.count > rlMax) {
      return res.status(429).json({ error: 'rate limit exceeded' });
    }
    
    next();
  };
}

module.exports = createRateLimitMiddleware;
