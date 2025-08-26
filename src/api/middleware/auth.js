const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  // Read JWT_SECRET inside the function to ensure dotenv has loaded
  const JWT_SECRET_RAW = process.env.DASHBOARD_JWT_SECRET || 'changeme_dev_secret';
  
  // Support multiple secrets for rotation (comma-separated)
  const JWT_SECRETS = JWT_SECRET_RAW.split(',').map(s => s.trim()).filter(s => s.length > 0);
  const PRIMARY_SECRET = JWT_SECRETS[0]; // Used for signing new tokens
  
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  
  if (!token) {
    return res.status(401).json({ error: 'missing token' });
  }
  
  // Try to verify with each secret (rotation support)
  let verified = false;
  let lastError = null;
  
  for (let i = 0; i < JWT_SECRETS.length; i++) {
    try {
      req.user = jwt.verify(token, JWT_SECRETS[i]);
      verified = true;
      
      // Log which secret was used for debugging
      if (JWT_SECRETS.length > 1) {
        console.log(`JWT verified with secret #${i + 1}/${JWT_SECRETS.length}`);
      }
      break;
    } catch(e) {
      lastError = e;
      // Continue to next secret
    }
  }
  
  if (!verified) {
    console.log('JWT verification failed with all secrets:', lastError?.message);
    console.log('Available JWT secrets count:', JWT_SECRETS.length);
    console.log('Primary secret length:', PRIMARY_SECRET.length);
    return res.status(401).json({ error: 'invalid token' });
  }
  
  next();
}

module.exports = authMiddleware;
