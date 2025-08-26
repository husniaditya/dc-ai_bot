const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  // Read JWT_SECRET inside the function to ensure dotenv has loaded
  const JWT_SECRET = process.env.DASHBOARD_JWT_SECRET || 'changeme_dev_secret';
  
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  
  if (!token) {
    return res.status(401).json({ error: 'missing token' });
  }
  
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch(e) {
    console.log('JWT verification failed:', e.message);
    console.log('JWT_SECRET length:', JWT_SECRET.length);
    return res.status(401).json({ error: 'invalid token' });
  }
}

module.exports = authMiddleware;
