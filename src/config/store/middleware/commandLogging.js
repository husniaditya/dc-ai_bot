// Command execution wrapper for automatic logging
// This middleware captures command executions and logs them for analytics

const { getCommandLogger } = require('../services/commandLogger');

/**
 * Wrapper function for command execution with automatic logging
 * Use this to wrap your command handlers for automatic analytics tracking
 */
function withCommandLogging(commandHandler, commandConfig = {}) {
    return async function loggedCommandHandler(...args) {
        const interaction = args[0]; // First argument is always interaction
        const startTime = Date.now();
        let status = 'success';
        let errorMessage = null;
        let responseTimeMs = null;
        let apiCallsMade = 0;
        let databaseQueryTimeMs = null;

        try {
            // Extract command information
            const commandName = interaction.commandName || commandConfig.name || 'unknown';
            const guildId = interaction.guildId;
            const userId = interaction.user.id;
            const channelId = interaction.channelId;
            const userTag = `${interaction.user.username}#${interaction.user.discriminator}`;
            
            // Get user roles - handle both real Discord.js Collection and mock data
            let userRoles = [];
            try {
                if (interaction.member?.roles?.cache) {
                    if (typeof interaction.member.roles.cache.map === 'function') {
                        // Real Discord.js Collection
                        userRoles = interaction.member.roles.cache.map(role => ({
                            id: role.id,
                            name: role.name
                        }));
                    } else if (interaction.member.roles.cache instanceof Map) {
                        // Map-like structure
                        userRoles = Array.from(interaction.member.roles.cache.values()).map(role => ({
                            id: role.id,
                            name: role.name
                        }));
                    } else if (Array.isArray(interaction.member.roles.cache)) {
                        // Array structure
                        userRoles = interaction.member.roles.cache.map(role => ({
                            id: role.id,
                            name: role.name
                        }));
                    }
                }
            } catch (roleError) {
                console.warn('Failed to extract user roles:', roleError.message);
                userRoles = [];
            }

            // Extract command arguments for metadata
            const commandArgs = {};
            if (interaction.options) {
                // Slash commands
                interaction.options.data?.forEach(option => {
                    commandArgs[option.name] = option.value;
                });
            }

            const fullCommand = interaction.toString() || `/${commandName}`;

            // Track database queries (monkey patch for this execution)
            const originalQuery = global.dbQueryCount || 0;
            let dbStartTime = null;
            
            // Monitor API calls if interaction client is available
            if (interaction.client) {
                const originalApiCall = interaction.client.rest?.request;
                if (originalApiCall) {
                    interaction.client.rest.request = function(...args) {
                        apiCallsMade++;
                        return originalApiCall.apply(this, args);
                    };
                }
            }

            // Execute the actual command
            dbStartTime = Date.now();
            const result = await commandHandler(...args);
            
            // Calculate metrics
            responseTimeMs = Date.now() - startTime;
            databaseQueryTimeMs = global.dbQueryCount ? 
                (global.dbQueryCount - originalQuery) * 10 : null; // Estimate
            
            // Restore original API method
            if (interaction.client?.rest?.request) {
                // Reset to original (if we had stored it)
            }

            return result;

        } catch (error) {
            status = 'error';
            errorMessage = error.message;
            responseTimeMs = Date.now() - startTime;
            
            // Re-throw error to maintain original behavior
            throw error;
        } finally {
            // Log command execution regardless of success/failure
            try {
                const commandLogger = getCommandLogger();
                if (commandLogger) {
                    await commandLogger.logCommand({
                        guildId: interaction.guildId,
                        userId: interaction.user.id,
                        channelId: interaction.channelId,
                        commandName: interaction.commandName || commandConfig.name || 'unknown',
                        commandType: getCommandType(interaction),
                        fullCommand: interaction.toString() || `/${interaction.commandName}`,
                        userTag: `${interaction.user.username}#${interaction.user.discriminator}`,
                        userRoles: interaction.member?.roles?.cache?.map(role => ({
                            id: role.id,
                            name: role.name
                        })) || [],
                        status: status,
                        errorMessage: errorMessage,
                        responseTimeMs: responseTimeMs,
                        botLatencyMs: interaction.client?.ws?.ping || null,
                        databaseQueryTimeMs: databaseQueryTimeMs,
                        apiCallsMade: apiCallsMade,
                        metadata: {
                            commandArgs: getCommandArgs(interaction),
                            guildName: interaction.guild?.name,
                            channelName: interaction.channel?.name,
                            userDisplayName: interaction.member?.displayName,
                            isEphemeral: interaction.ephemeral,
                            locale: interaction.locale
                        }
                    });
                }
            } catch (logError) {
                console.warn('Failed to log command execution:', logError.message);
                // Don't fail the command execution if logging fails
            }
        }
    };
}

/**
 * Simple logging function for non-interaction commands (message commands, etc.)
 */
async function logCommand({
    guildId,
    userId,
    channelId,
    commandName,
    commandType = 'message',
    fullCommand = null,
    userTag = null,
    status = 'success',
    errorMessage = null,
    responseTimeMs = null,
    metadata = {}
}) {
    try {
        const commandLogger = getCommandLogger();
        if (commandLogger) {
            await commandLogger.logCommand({
                guildId,
                userId,
                channelId,
                commandName,
                commandType,
                fullCommand,
                userTag,
                userRoles: [],
                status,
                errorMessage,
                responseTimeMs,
                botLatencyMs: null,
                databaseQueryTimeMs: null,
                apiCallsMade: 0,
                metadata
            });
        }
    } catch (error) {
        console.warn('Failed to log command:', error.message);
    }
}

/**
 * Get command type from interaction
 */
function getCommandType(interaction) {
    if (interaction.isCommand?.()) return 'slash';
    if (interaction.isContextMenuCommand?.()) return 'context';
    if (interaction.isMessageCommand?.()) return 'message';
    return 'unknown';
}

/**
 * Extract command arguments from interaction
 */
function getCommandArgs(interaction) {
    const args = {};
    
    if (interaction.options) {
        // Slash commands
        interaction.options.data?.forEach(option => {
            args[option.name] = option.value;
        });
    }
    
    return args;
}

/**
 * Decorator for class methods (alternative syntax)
 */
function CommandLogged(commandConfig = {}) {
    return function(target, propertyName, descriptor) {
        const originalMethod = descriptor.value;
        descriptor.value = withCommandLogging(originalMethod, commandConfig);
        return descriptor;
    };
}

/**
 * Track performance of any async function
 */
function trackPerformance(name, fn) {
    return async function(...args) {
        const startTime = Date.now();
        try {
            const result = await fn.apply(this, args);
            const responseTime = Date.now() - startTime;
            
            // Log performance metric
            console.log(`[PERF] ${name}: ${responseTime}ms`);
            
            return result;
        } catch (error) {
            const responseTime = Date.now() - startTime;
            console.log(`[PERF] ${name}: ${responseTime}ms (ERROR: ${error.message})`);
            throw error;
        }
    };
}

module.exports = {
    withCommandLogging,
    logCommand,
    CommandLogged,
    trackPerformance,
    getCommandType,
    getCommandArgs
};
