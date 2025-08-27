/**
 * API response formatting utilities
 */

/**
 * Create a standardized success response
 */
function successResponse(data = null, message = null) {
  const response = {
    success: true,
    timestamp: new Date().toISOString()
  };
  
  if (data !== null) response.data = data;
  if (message) response.message = message;
  
  return response;
}

/**
 * Create a standardized error response
 */
function errorResponse(error, statusCode = 500, details = null) {
  const response = {
    success: false,
    error: typeof error === 'string' ? error : error.message || 'Unknown error',
    timestamp: new Date().toISOString(),
    statusCode
  };
  
  if (details) response.details = details;
  
  return response;
}

/**
 * Create a validation error response
 */
function validationErrorResponse(errors) {
  return {
    success: false,
    error: 'Validation failed',
    timestamp: new Date().toISOString(),
    statusCode: 400,
    validationErrors: Array.isArray(errors) ? errors : [errors]
  };
}

/**
 * Create a paginated response
 */
function paginatedResponse(data, pagination) {
  return {
    success: true,
    timestamp: new Date().toISOString(),
    data,
    pagination: {
      page: pagination.page || 1,
      limit: pagination.limit || 10,
      total: pagination.total || 0,
      totalPages: pagination.totalPages || Math.ceil((pagination.total || 0) / (pagination.limit || 10))
    }
  };
}

/**
 * Format Discord user object for API response
 */
function formatUser(user) {
  if (!user) return null;
  
  return {
    id: user.id,
    username: user.username,
    discriminator: user.discriminator,
    avatar: user.avatar,
    displayName: user.global_name || user.username,
    selectedGuildId: user.selected_guild_id || null
  };
}

/**
 * Format Discord guild object for API response
 */
function formatGuild(guild) {
  if (!guild) return null;
  
  return {
    id: guild.id,
    name: guild.name,
    icon: guild.icon,
    canManage: guild.canManage || false,
    memberCount: guild.memberCount || 0
  };
}

/**
 * Format settings object for API response
 */
function formatSettings(settings) {
  if (!settings) return {};
  
  return {
    autoReplyEnabled: settings.autoReplyEnabled || false,
    autoReplyCooldownMs: settings.autoReplyCooldownMs || 3000,
    language: settings.language || 'en',
    timezone: settings.timezone || 'UTC',
    hourFormat: settings.hourFormat || 24,
    embedColor: settings.embedColor || '#5865F2',
    prefix: settings.prefix || '!',
    slashCommandsEnabled: settings.slashCommandsEnabled !== false
  };
}

/**
 * Format auto response object for API response
 */
function formatAutoResponse(response) {
  if (!response) return null;
  
  return {
    id: response.id,
    trigger: response.trigger,
    response: response.response,
    enabled: response.enabled !== false,
    createdAt: response.created_at,
    updatedAt: response.updated_at
  };
}

/**
 * Middleware to wrap route handlers with consistent response formatting
 */
function wrapResponse(handler) {
  return async (req, res, next) => {
    try {
      const result = await handler(req, res, next);
      
      // If response was already sent, don't send again
      if (res.headersSent) return;
      
      // If result is undefined, assume handler sent response
      if (result === undefined) return;
      
      // Send formatted success response
      res.json(successResponse(result));
    } catch (error) {
      console.error('Route handler error:', error);
      
      // Don't send error if response already sent
      if (res.headersSent) return;
      
      // Send formatted error response
      const statusCode = error.statusCode || 500;
      res.status(statusCode).json(errorResponse(error, statusCode));
    }
  };
}

module.exports = {
  successResponse,
  errorResponse,
  validationErrorResponse,
  paginatedResponse,
  formatUser,
  formatGuild,
  formatSettings,
  formatAutoResponse,
  wrapResponse
};
