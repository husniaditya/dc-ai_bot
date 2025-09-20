// Security middleware for production deployment
// Implements Content Security Policy and security headers

/**
 * Content Security Policy middleware
 * Prevents XSS attacks by controlling resource loading
 */
function cspMiddleware() {
  return (req, res, next) => {
    const isProduction = process.env.NODE_ENV === 'production';
    const domain = process.env.PRODUCTION_DOMAIN || 'localhost:5173';
    
    // Define CSP directives
    const cspDirectives = {
      'default-src': ["'self'"],
      'script-src': [
        "'self'",
        "'unsafe-inline'", // Allow inline scripts (consider removing in strict mode)
        "'unsafe-eval'", // Needed for React dev tools (remove in production)
        'https://cdn.jsdelivr.net', // For external libraries
        'https://cdnjs.cloudflare.com' // For external libraries
      ],
      'style-src': [
        "'self'",
        "'unsafe-inline'", // Allow inline styles for React
        'https://fonts.googleapis.com',
        'https://cdn.jsdelivr.net',
        'https://cdnjs.cloudflare.com'
      ],
      'font-src': [
        "'self'",
        'https://fonts.gstatic.com',
        'https://cdn.jsdelivr.net',
        'data:' // For base64 fonts
      ],
      'img-src': [
        "'self'",
        'data:', // For base64 images
        'https:', // Allow HTTPS images (Discord avatars, etc.)
        'blob:' // For canvas/blob images
      ],
      'connect-src': [
        "'self'",
        isProduction ? `https://${domain}` : 'http://localhost:3001',
        'https://discord.com', // Discord API
        'https://discordapp.com' // Discord CDN
      ],
      'frame-ancestors': ["'none'"], // Prevent clickjacking
      'base-uri': ["'self'"],
      'form-action': ["'self'"],
      'object-src': ["'none'"],
      'media-src': ["'self'", 'data:', 'blob:']
    };
    
    // Only apply strict CSP in production
    if (isProduction) {
      // Remove unsafe-eval in production
      cspDirectives['script-src'] = cspDirectives['script-src'].filter(src => src !== "'unsafe-eval'");
    }
    
    // Build CSP header string
    const cspHeader = Object.entries(cspDirectives)
      .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
      .join('; ');
    
    res.setHeader('Content-Security-Policy', cspHeader);
    next();
  };
}

/**
 * Security headers middleware
 * Adds various security headers for production deployment
 */
function securityHeadersMiddleware() {
  return (req, res, next) => {
    const isProduction = process.env.NODE_ENV === 'production';
    
    // Strict Transport Security (HTTPS only)
    if (isProduction) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }
    
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');
    
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // XSS Protection (legacy browsers)
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Referrer Policy - limit referrer information
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Permissions Policy - restrict browser features
    res.setHeader('Permissions-Policy', [
      'camera=()', 
      'microphone=()', 
      'geolocation=()',
      'gyroscope=()',
      'magnetometer=()',
      'payment=()',
      'usb=()'
    ].join(', '));
    
    next();
  };
}

/**
 * Combined security middleware
 * Applies both CSP and security headers
 */
function securityMiddleware() {
  const csp = cspMiddleware();
  const headers = securityHeadersMiddleware();
  
  return (req, res, next) => {
    // Apply security headers first
    headers(req, res, () => {
      // Then apply CSP
      csp(req, res, next);
    });
  };
}

module.exports = {
  cspMiddleware,
  securityHeadersMiddleware,
  securityMiddleware
};