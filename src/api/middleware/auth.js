const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  // Read JWT_SECRET inside the function to ensure dotenv has loaded
  const JWT_SECRET_RAW = process.env.DASHBOARD_JWT_SECRET || 'changeme_dev_secret';
  
  // Support multiple secrets for rotation (comma-separated)
  const JWT_SECRETS = JWT_SECRET_RAW.split(',').map(s => s.trim()).filter(s => s.length > 0);
  const PRIMARY_SECRET = JWT_SECRETS[0]; // Used for signing new tokens
  
  // Try to get token from Authorization header first (backward compatibility)
  let token = null;
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) {
    token = auth.slice(7);
  } 
  // Fallback to HttpOnly cookie (more secure for public websites)
  else if (req.cookies && req.cookies.authToken) {
    token = req.cookies.authToken;
  }
  
  if (!token) {
    return res.status(401).json({ 
      error: 'missing_token',
      message: 'Authentication required',
      requiresLogout: true 
    });
  }
  
  // Try to verify with each secret (rotation support)
  let verified = false;
  let lastError = null;
  let isExpired = false;
  
  for (let i = 0; i < JWT_SECRETS.length; i++) {
    try {
      req.user = jwt.verify(token, JWT_SECRETS[i]);
      verified = true;
      
      // Log which secret was used for debugging
      // if (JWT_SECRETS.length > 1) {
      //   console.log(`JWT verified with secret #${i + 1}/${JWT_SECRETS.length}`);
      // }
      break;
    } catch(e) {
      lastError = e;
      
      // Check if the error is specifically due to token expiration
      if (e.name === 'TokenExpiredError') {
        isExpired = true;
      }
      // Continue to next secret
    }
  }
  
  if (!verified) {
    console.log('JWT verification failed with all secrets:', lastError?.message);
    
    // Handle different types of JWT errors with specific responses
    if (isExpired) {
      return res.status(401).json({ 
        error: 'token_expired',
        message: 'Your session has expired. Please log in again.',
        requiresLogout: true,
        expiredAt: lastError.expiredAt || null
      });
    }
    
    if (lastError?.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: 'invalid_token',
        message: 'Invalid authentication token. Please log in again.',
        requiresLogout: true 
      });
    }
    
    if (lastError?.name === 'NotBeforeError') {
      return res.status(401).json({ 
        error: 'token_not_active',
        message: 'Token is not active yet.',
        requiresLogout: true 
      });
    }
    
    // Generic invalid token response
    return res.status(401).json({ 
      error: 'authentication_failed',
      message: 'Authentication failed. Please log in again.',
      requiresLogout: true 
    });
  }
  
  next();
}

module.exports = authMiddleware;
