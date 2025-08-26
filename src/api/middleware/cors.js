const cors = require('cors');

// CORS setup
function createCorsMiddleware() {
  // DASHBOARD_CORS_ORIGINS: comma separated list of exact origins (scheme+host+port). If empty -> allow all.
  // DASHBOARD_CORS_ALLOW_ALL=1 forces allow-all (useful in dev). Trailing slashes must be removed.
  const allowedOriginsRaw = (process.env.DASHBOARD_CORS_ORIGINS || '')
    .split(',')
    .map(s=>s.trim())
    .filter(Boolean)
    .map(o => o.replace(/\/$/, '')); // normalize by stripping trailing slash
  
  const forceAllowAll = process.env.DASHBOARD_CORS_ALLOW_ALL === '1';
  
  if (forceAllowAll) {
    console.warn('[CORS] DASHBOARD_CORS_ALLOW_ALL=1 -> allowing all origins');
  }
  
  return cors({ 
    origin: (origin, cb) => {
      if (forceAllowAll) return cb(null,true);
      if (!origin) return cb(null, true); // non-browser / same-origin or curl
      const normalized = origin.replace(/\/$/,'');
      if (allowedOriginsRaw.length === 0 || allowedOriginsRaw.includes(normalized)) return cb(null, true);
      console.warn(`[CORS] Blocked origin ${origin}. Allowed: ${allowedOriginsRaw.length?allowedOriginsRaw.join(', '):'(all)'} . Set DASHBOARD_CORS_ORIGINS or DASHBOARD_CORS_ALLOW_ALL=1 to adjust.`);
      return cb(new Error('Not allowed by CORS'));
    }, 
    credentials: false 
  });
}

module.exports = createCorsMiddleware;
