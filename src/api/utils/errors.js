/**
 * API error handling utilities
 */

class APIError extends Error {
  constructor(message, statusCode = 500, code = null) {
    super(message);
    this.name = 'APIError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

class ValidationError extends APIError {
  constructor(message, errors = []) {
    super(message, 400, 'VALIDATION_ERROR');
    this.validationErrors = errors;
  }
}

class AuthenticationError extends APIError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

class AuthorizationError extends APIError {
  constructor(message = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

class NotFoundError extends APIError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

class ConflictError extends APIError {
  constructor(message = 'Resource already exists') {
    super(message, 409, 'CONFLICT');
  }
}

class RateLimitError extends APIError {
  constructor(message = 'Rate limit exceeded') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
  }
}

/**
 * Express error handling middleware
 */
function errorHandler(err, req, res, next) {
  // If response was already sent, delegate to default Express error handler
  if (res.headersSent) {
    return next(err);
  }

  console.error('API Error:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  let statusCode = 500;
  let response = {
    success: false,
    timestamp: new Date().toISOString(),
    error: 'Internal server error'
  };

  if (err instanceof APIError) {
    statusCode = err.statusCode;
    response.error = err.message;
    response.code = err.code;

    if (err instanceof ValidationError) {
      response.validationErrors = err.validationErrors;
    }
  } else if (err.name === 'ValidationError') {
    // Mongoose validation error
    statusCode = 400;
    response.error = 'Validation failed';
    response.validationErrors = Object.values(err.errors).map(e => e.message);
  } else if (err.name === 'CastError') {
    // Mongoose cast error
    statusCode = 400;
    response.error = 'Invalid data format';
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    response.error = 'Invalid token';
    response.code = 'INVALID_TOKEN';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    response.error = 'Token expired';
    response.code = 'TOKEN_EXPIRED';
  } else if (err.code === 'ECONNREFUSED') {
    statusCode = 503;
    response.error = 'Service unavailable';
    response.code = 'SERVICE_UNAVAILABLE';
  }

  // Add request ID if available
  if (req.id) {
    response.requestId = req.id;
  }

  res.status(statusCode).json(response);
}

/**
 * 404 handler for unmatched routes
 */
function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    timestamp: new Date().toISOString(),
    error: 'Endpoint not found',
    code: 'ENDPOINT_NOT_FOUND',
    path: req.path,
    method: req.method
  });
}

/**
 * Async wrapper to catch errors in async route handlers
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Create an error with status code
 */
function createError(message, statusCode = 500, code = null) {
  return new APIError(message, statusCode, code);
}

module.exports = {
  APIError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  errorHandler,
  notFoundHandler,
  asyncHandler,
  createError
};
