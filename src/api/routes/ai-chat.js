const express = require('express');
const { chatGroq, chatGroqWithTools } = require('../../utils/ai-client');
const { audit } = require('../middleware/audit');

/**
 * AI Chat route with function calling capabilities
 * Allows users to interact with bot features via natural language
 */
function createAiChatRoutes(client, store, commandMap) {
  const router = express.Router();

  // Define available tools/functions the AI can call
  const tools = [
    {
      name: 'get_bot_status',
      description: 'Get current bot status including uptime, guilds, and health',
      parameters: {},
      handler: async (params, guildId) => {
        const uptime = Math.floor(process.uptime());
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        
        return {
          status: client.ws.status === 0 ? 'online' : 'offline',
          uptime: `${hours}h ${minutes}m`,
          guilds: client.guilds.cache.size,
          ping: Math.round(client.ws.ping) + 'ms',
          users: client.users.cache.size
        };
      }
    },
    {
      name: 'get_guild_settings',
      description: 'Get current guild settings and configuration',
      parameters: {},
      handler: async (params, guildId) => {
        if (!guildId) return { error: 'No guild selected' };
        const settings = await store.getGuildSettings(guildId);
        const personalization = await store.getGuildPersonalization(guildId);
        return { settings, personalization };
      }
    },
    {
      name: 'list_auto_responses',
      description: 'List all auto-responses for the current guild',
      parameters: {},
      handler: async (params, guildId) => {
        if (!guildId) return { error: 'No guild selected' };
        const responses = await store.getGuildAutoResponses(guildId);
        return { count: responses.length, responses };
      }
    },
    {
      name: 'get_command_stats',
      description: 'Get command usage statistics for the guild',
      parameters: {
        limit: { type: 'number', description: 'Number of top commands to return', default: 10 }
      },
      handler: async (params, guildId) => {
        if (!guildId) return { error: 'No guild selected' };
        const limit = params.limit || 10;
        const logs = await store.getGuildCommandLogs(guildId, limit);
        return { commandLogs: logs };
      }
    },
    {
      name: 'get_xp_leaderboard',
      description: 'Get XP leaderboard for the guild',
      parameters: {
        limit: { type: 'number', description: 'Number of top users to return', default: 10 }
      },
      handler: async (params, guildId) => {
        if (!guildId) return { error: 'No guild selected' };
        const limit = params.limit || 10;
        const leaderboard = await store.getXpLeaderboard(guildId, limit);
        return { leaderboard };
      }
    },
    {
      name: 'check_moderation_status',
      description: 'Check if moderation features are enabled and get recent violations',
      parameters: {},
      handler: async (params, guildId) => {
        if (!guildId) return { error: 'No guild selected' };
        const features = await store.getGuildModerationFeatures(guildId);
        const automodRules = await store.getAutomodRules(guildId);
        return { features, automodRules: automodRules.length };
      }
    },
    {
      name: 'get_welcome_config',
      description: 'Get welcome system configuration',
      parameters: {},
      handler: async (params, guildId) => {
        if (!guildId) return { error: 'No guild selected' };
        const config = await store.getGuildWelcome(guildId);
        return config;
      }
    },
    {
      name: 'list_guild_channels',
      description: 'List all text channels in the guild',
      parameters: {},
      handler: async (params, guildId) => {
        if (!guildId) return { error: 'No guild selected' };
        const guild = client.guilds.cache.get(guildId);
        if (!guild) return { error: 'Guild not found' };
        
        const channels = guild.channels.cache
          .filter(c => c.isTextBased && typeof c.isTextBased === 'function' ? c.isTextBased() : true)
          .map(c => ({ id: c.id, name: c.name, type: c.type }))
          .slice(0, 20);
        
        return { channels };
      }
    },
    {
      name: 'get_analytics_summary',
      description: 'Get analytics summary for the guild',
      parameters: {},
      handler: async (params, guildId) => {
        if (!guildId) return { error: 'No guild selected' };
        
        const guild = client.guilds.cache.get(guildId);
        if (!guild) return { error: 'Guild not found' };
        
        const autoResponses = await store.getGuildAutoResponses(guildId);
        const commandLogs = await store.getGuildCommandLogs(guildId, 1);
        
        return {
          guildName: guild.name,
          memberCount: guild.memberCount,
          autoResponseCount: autoResponses.length,
          recentActivity: commandLogs.length > 0
        };
      }
    },
    {
      name: 'create_auto_response',
      description: 'Create a new auto-response trigger for the guild. The bot will automatically reply when a message matches the pattern.',
      parameters: {
        key: { type: 'string', description: 'Unique identifier for the auto-response (e.g., "greeting")', required: true },
        text: { type: 'string', description: 'Text to match in messages (e.g., "hello")', required: true },
        matchType: { type: 'string', description: 'Match type: "contains" (anywhere in message), "whole" (whole word), or "exact" (exact match)', default: 'contains' },
        flags: { type: 'string', description: 'Regular expression flags (e.g., "i" for case-insensitive)', default: 'i' },
        replies: { type: 'array', description: 'Array of possible reply messages. Bot will randomly choose one.', required: true },
        enabled: { type: 'boolean', description: 'Whether the auto-response is enabled', default: true }
      },
      handler: async (params, guildId) => {
        if (!guildId) return { error: 'No guild selected' };
        
        // Validate required parameters
        if (!params.key || typeof params.key !== 'string') {
          return { error: 'Parameter "key" is required and must be a string' };
        }
        if (!params.text || typeof params.text !== 'string') {
          return { error: 'Parameter "text" is required and must be a string' };
        }
        if (!params.replies || !Array.isArray(params.replies) || params.replies.length === 0) {
          return { error: 'Parameter "replies" is required and must be a non-empty array' };
        }

        // Build regex pattern based on match type
        const matchType = params.matchType || 'contains';
        const text = params.text.trim();
        let pattern;

        switch (matchType) {
          case 'exact':
            pattern = `^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`;
            break;
          case 'whole':
            pattern = `\\b${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`;
            break;
          case 'contains':
          default:
            pattern = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            break;
        }

        // Create auto-response entry
        const entry = {
          key: params.key,
          pattern: pattern,
          rawText: text,
          matchType: matchType,
          flags: params.flags || 'i',
          replies: params.replies,
          enabled: params.enabled !== false
        };

        try {
          await store.upsertGuildAutoResponse(guildId, entry);
          return { 
            success: true, 
            message: `Auto-response "${params.key}" created successfully`,
            entry: entry 
          };
        } catch (error) {
          return { error: `Failed to create auto-response: ${error.message}` };
        }
      }
    },
    {
      name: 'update_auto_response',
      description: 'Update an existing auto-response. You can modify the pattern, replies, or toggle it on/off.',
      parameters: {
        key: { type: 'string', description: 'The key/identifier of the auto-response to update', required: true },
        text: { type: 'string', description: 'New text to match (optional)' },
        matchType: { type: 'string', description: 'New match type: "contains", "whole", or "exact" (optional)' },
        flags: { type: 'string', description: 'New regex flags (optional)' },
        replies: { type: 'array', description: 'New array of reply messages (optional)' },
        enabled: { type: 'boolean', description: 'Enable or disable the auto-response (optional)' }
      },
      handler: async (params, guildId) => {
        if (!guildId) return { error: 'No guild selected' };
        
        if (!params.key || typeof params.key !== 'string') {
          return { error: 'Parameter "key" is required to identify which auto-response to update' };
        }

        try {
          // Get existing auto-response
          const existing = await store.getGuildAutoResponses(guildId);
          const current = existing.find(ar => ar.key === params.key);
          
          if (!current) {
            return { error: `Auto-response "${params.key}" not found` };
          }

          // Build updated entry (merge with existing)
          const entry = { ...current };

          // Update pattern if text or matchType changed
          if (params.text || params.matchType) {
            const text = (params.text || current.rawText || '').trim();
            const matchType = params.matchType || current.matchType || 'contains';
            let pattern;

            switch (matchType) {
              case 'exact':
                pattern = `^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`;
                break;
              case 'whole':
                pattern = `\\b${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`;
                break;
              case 'contains':
              default:
                pattern = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                break;
            }

            entry.pattern = pattern;
            entry.rawText = text;
            entry.matchType = matchType;
          }

          // Update other fields if provided
          if (params.flags !== undefined) entry.flags = params.flags;
          if (params.replies !== undefined) {
            if (!Array.isArray(params.replies) || params.replies.length === 0) {
              return { error: 'Parameter "replies" must be a non-empty array' };
            }
            entry.replies = params.replies;
          }
          if (params.enabled !== undefined) entry.enabled = params.enabled;

          await store.upsertGuildAutoResponse(guildId, entry);
          
          return { 
            success: true, 
            message: `Auto-response "${params.key}" updated successfully`,
            entry: entry 
          };
        } catch (error) {
          return { error: `Failed to update auto-response: ${error.message}` };
        }
      }
    },
    {
      name: 'delete_auto_response',
      description: 'Delete an auto-response from the guild',
      parameters: {
        key: { type: 'string', description: 'The key/identifier of the auto-response to delete', required: true }
      },
      handler: async (params, guildId) => {
        if (!guildId) return { error: 'No guild selected' };
        
        if (!params.key || typeof params.key !== 'string') {
          return { error: 'Parameter "key" is required to identify which auto-response to delete' };
        }

        try {
          // Check if exists
          const existing = await store.getGuildAutoResponses(guildId);
          const current = existing.find(ar => ar.key === params.key);
          
          if (!current) {
            return { error: `Auto-response "${params.key}" not found` };
          }

          await store.removeGuildAutoResponse(guildId, params.key);
          
          return { 
            success: true, 
            message: `Auto-response "${params.key}" deleted successfully` 
          };
        } catch (error) {
          return { error: `Failed to delete auto-response: ${error.message}` };
        }
      }
    },
    {
      name: 'toggle_auto_response',
      description: 'Enable or disable an auto-response without deleting it',
      parameters: {
        key: { type: 'string', description: 'The key/identifier of the auto-response', required: true },
        enabled: { type: 'boolean', description: 'True to enable, false to disable', required: true }
      },
      handler: async (params, guildId) => {
        if (!guildId) return { error: 'No guild selected' };
        
        if (!params.key || typeof params.key !== 'string') {
          return { error: 'Parameter "key" is required' };
        }
        if (typeof params.enabled !== 'boolean') {
          return { error: 'Parameter "enabled" must be a boolean (true or false)' };
        }

        try {
          const existing = await store.getGuildAutoResponses(guildId);
          const current = existing.find(ar => ar.key === params.key);
          
          if (!current) {
            return { error: `Auto-response "${params.key}" not found` };
          }

          const entry = { ...current, enabled: params.enabled };
          await store.upsertGuildAutoResponse(guildId, entry);
          
          return { 
            success: true, 
            message: `Auto-response "${params.key}" ${params.enabled ? 'enabled' : 'disabled'}`,
            entry: entry
          };
        } catch (error) {
          return { error: `Failed to toggle auto-response: ${error.message}` };
        }
      }
    },
    {
      name: 'get_auto_response',
      description: 'Get details of a specific auto-response by its key',
      parameters: {
        key: { type: 'string', description: 'The key/identifier of the auto-response', required: true }
      },
      handler: async (params, guildId) => {
        if (!guildId) return { error: 'No guild selected' };
        
        if (!params.key || typeof params.key !== 'string') {
          return { error: 'Parameter "key" is required' };
        }

        try {
          const responses = await store.getGuildAutoResponses(guildId);
          const response = responses.find(ar => ar.key === params.key);
          
          if (!response) {
            return { error: `Auto-response "${params.key}" not found` };
          }

          return { 
            success: true,
            autoResponse: response
          };
        } catch (error) {
          return { error: `Failed to get auto-response: ${error.message}` };
        }
      }
    },
    {
      name: 'list_commands',
      description: 'List all available bot commands with their status (enabled/disabled), grouped by category. Can filter by category, enabled status, or search by name/description.',
      parameters: {
        category: { type: 'string', description: 'Filter by category (e.g., "moderation", "gaming", "utility", "fun")', required: false },
        enabled: { type: 'boolean', description: 'Filter by enabled status (true = only enabled, false = only disabled)', required: false },
        search: { type: 'string', description: 'Search commands by name or description', required: false }
      },
      handler: async (params, guildId) => {
        if (!guildId) return { error: 'No guild selected' };
        
        try {
          const toggles = await store.getGuildCommandToggles(guildId);
          let allCommands = Array.from(commandMap.values())
            .filter(cmd => !cmd.ownerOnly && !cmd.devOnly)
            .map(cmd => {
              const cmdName = cmd.data?.name || cmd.name;
              return {
                name: cmdName,
                description: cmd.data?.description || cmd.description || 'No description available',
                enabled: toggles[cmdName] !== false,
                category: cmd.category || 'general',
                options: cmd.data?.options || []
              };
            });
          
          // Search by name or description
          if (params.search) {
            const searchLower = params.search.toLowerCase();
            allCommands = allCommands.filter(cmd => 
              cmd.name.toLowerCase().includes(searchLower) ||
              cmd.description.toLowerCase().includes(searchLower)
            );
          }
          
          // Filter by category if specified
          if (params.category) {
            allCommands = allCommands.filter(cmd => 
              cmd.category.toLowerCase() === params.category.toLowerCase()
            );
          }
          
          // Filter by enabled status if specified
          if (params.enabled !== undefined) {
            allCommands = allCommands.filter(cmd => cmd.enabled === params.enabled);
          }
          
          // Group by category
          const byCategory = {};
          allCommands.forEach(cmd => {
            if (!byCategory[cmd.category]) {
              byCategory[cmd.category] = [];
            }
            byCategory[cmd.category].push(cmd);
          });
          
          return {
            commands: allCommands,
            byCategory: byCategory,
            categories: Object.keys(byCategory),
            totalCount: allCommands.length,
            enabledCount: allCommands.filter(c => c.enabled).length,
            disabledCount: allCommands.filter(c => !c.enabled).length
          };
        } catch (error) {
          return { error: `Failed to list commands: ${error.message}` };
        }
      }
    },
    {
      name: 'toggle_command',
      description: 'Enable or disable a specific bot command',
      parameters: {
        commandName: { type: 'string', description: 'The name of the command to toggle', required: true },
        enabled: { type: 'boolean', description: 'True to enable, false to disable', required: true }
      },
      handler: async (params, guildId) => {
        if (!guildId) return { error: 'No guild selected' };
        
        if (!params.commandName || typeof params.commandName !== 'string') {
          return { error: 'Parameter "commandName" is required' };
        }
        if (typeof params.enabled !== 'boolean') {
          return { error: 'Parameter "enabled" must be a boolean (true or false)' };
        }

        try {
          // Check if command exists
          const command = commandMap.get(params.commandName);
          if (!command) {
            return { error: `Command "${params.commandName}" not found` };
          }

          // Update toggle
          await store.setGuildCommandToggle(guildId, params.commandName, params.enabled);
          
          return {
            success: true,
            message: `Command "${params.commandName}" ${params.enabled ? 'enabled' : 'disabled'}`,
            commandName: params.commandName,
            enabled: params.enabled
          };
        } catch (error) {
          return { error: `Failed to toggle command: ${error.message}` };
        }
      }
    },
    {
      name: 'get_command_info',
      description: 'Get detailed information about a specific command',
      parameters: {
        commandName: { type: 'string', description: 'The name of the command', required: true }
      },
      handler: async (params, guildId) => {
        if (!guildId) return { error: 'No guild selected' };
        
        if (!params.commandName || typeof params.commandName !== 'string') {
          return { error: 'Parameter "commandName" is required' };
        }

        try {
          const command = commandMap.get(params.commandName);
          if (!command) {
            return { error: `Command "${params.commandName}" not found` };
          }

          const toggles = await store.getGuildCommandToggles(guildId);
          const enabled = toggles[params.commandName] !== false;

          return {
            success: true,
            command: {
              name: command.data?.name || command.name,
              description: command.data?.description || command.description || '',
              category: command.category || 'general',
              enabled: enabled,
              options: command.data?.options || []
            }
          };
        } catch (error) {
          return { error: `Failed to get command info: ${error.message}` };
        }
      }
    },
    {
      name: 'enable_multiple_commands',
      description: 'Enable multiple commands at once',
      parameters: {
        commandNames: { type: 'array', description: 'Array of command names to enable', required: true }
      },
      handler: async (params, guildId) => {
        if (!guildId) return { error: 'No guild selected' };
        
        if (!Array.isArray(params.commandNames) || params.commandNames.length === 0) {
          return { error: 'Parameter "commandNames" must be a non-empty array' };
        }

        try {
          const results = [];
          for (const cmdName of params.commandNames) {
            const command = commandMap.get(cmdName);
            if (command) {
              await store.setGuildCommandToggle(guildId, cmdName, true);
              results.push({ name: cmdName, success: true });
            } else {
              results.push({ name: cmdName, success: false, error: 'Command not found' });
            }
          }

          const successCount = results.filter(r => r.success).length;
          return {
            success: true,
            message: `Enabled ${successCount} of ${params.commandNames.length} commands`,
            results: results
          };
        } catch (error) {
          return { error: `Failed to enable commands: ${error.message}` };
        }
      }
    },
    {
      name: 'disable_multiple_commands',
      description: 'Disable multiple commands at once',
      parameters: {
        commandNames: { type: 'array', description: 'Array of command names to disable', required: true }
      },
      handler: async (params, guildId) => {
        if (!guildId) return { error: 'No guild selected' };
        
        if (!Array.isArray(params.commandNames) || params.commandNames.length === 0) {
          return { error: 'Parameter "commandNames" must be a non-empty array' };
        }

        try {
          const results = [];
          for (const cmdName of params.commandNames) {
            const command = commandMap.get(cmdName);
            if (command) {
              await store.setGuildCommandToggle(guildId, cmdName, false);
              results.push({ name: cmdName, success: true });
            } else {
              results.push({ name: cmdName, success: false, error: 'Command not found' });
            }
          }

          const successCount = results.filter(r => r.success).length;
          return {
            success: true,
            message: `Disabled ${successCount} of ${params.commandNames.length} commands`,
            results: results
          };
        } catch (error) {
          return { error: `Failed to disable commands: ${error.message}` };
        }
      }
    },
    {
      name: 'list_automod_rules',
      description: 'List all auto-moderation rules for the guild',
      parameters: {},
      handler: async (params, guildId) => {
        if (!guildId) return { error: 'No guild selected' };
        
        try {
          const rules = await store.getGuildAutoModRules(guildId);
          return {
            success: true,
            count: rules.length,
            rules: rules.map(rule => ({
              id: rule.id,
              name: rule.name,
              triggerType: rule.trigger_type,
              actionType: rule.action_type,
              thresholdValue: rule.threshold_value,
              duration: rule.duration,
              enabled: rule.enabled,
              whitelistChannels: rule.whitelist_channels || [],
              whitelistRoles: rule.whitelist_roles || [],
              logChannelId: rule.log_channel_id,
              messageAction: rule.message_action
            }))
          };
        } catch (error) {
          return { error: `Failed to list automod rules: ${error.message}` };
        }
      }
    },
    {
      name: 'create_automod_rule',
      description: 'Create a new auto-moderation rule. Triggers include: spam, caps, links, invite_links, profanity, mention_spam. Actions include: warn, delete, mute, kick, ban.',
      parameters: {
        name: { type: 'string', description: 'Name of the rule (e.g., "Anti-Spam Rule")', required: true },
        triggerType: { type: 'string', description: 'Trigger type: spam, caps, links, invite_links, profanity, mention_spam', required: true },
        actionType: { type: 'string', description: 'Action to take: warn, delete, mute, kick, ban', required: true },
        thresholdValue: { type: 'number', description: 'Threshold value (e.g., 5 messages for spam, 70% for caps)', default: 5 },
        duration: { type: 'number', description: 'Duration in seconds for mute/ban actions (optional)' },
        enabled: { type: 'boolean', description: 'Enable the rule immediately', default: true },
        whitelistChannels: { type: 'array', description: 'Array of channel IDs to whitelist (optional)', default: [] },
        whitelistRoles: { type: 'array', description: 'Array of role IDs to whitelist (optional)', default: [] },
        logChannelId: { type: 'string', description: 'Channel ID for logging violations (optional)' },
        messageAction: { type: 'string', description: 'What to do with the message: keep or delete', default: 'keep' }
      },
      handler: async (params, guildId) => {
        if (!guildId) return { error: 'No guild selected' };
        
        if (!params.name || !params.triggerType || !params.actionType) {
          return { error: 'Parameters "name", "triggerType", and "actionType" are required' };
        }

        const validTriggers = ['spam', 'caps', 'links', 'invite_links', 'profanity', 'mention_spam'];
        const validActions = ['warn', 'delete', 'mute', 'kick', 'ban'];

        if (!validTriggers.includes(params.triggerType)) {
          return { error: `Invalid trigger type. Must be one of: ${validTriggers.join(', ')}` };
        }

        if (!validActions.includes(params.actionType)) {
          return { error: `Invalid action type. Must be one of: ${validActions.join(', ')}` };
        }

        try {
          const ruleData = {
            name: params.name,
            trigger_type: params.triggerType,
            action_type: params.actionType,
            threshold_value: params.thresholdValue || 5,
            duration: params.duration || null,
            enabled: params.enabled !== false,
            whitelist_channels: params.whitelistChannels || [],
            whitelist_roles: params.whitelistRoles || [],
            log_channel_id: params.logChannelId || null,
            message_action: params.messageAction || 'keep'
          };

          const result = await store.createGuildAutoModRule(guildId, ruleData);
          
          return {
            success: true,
            message: `Auto-moderation rule "${params.name}" created successfully`,
            ruleId: result.id
          };
        } catch (error) {
          return { error: `Failed to create automod rule: ${error.message}` };
        }
      }
    },
    {
      name: 'update_automod_rule',
      description: 'Update an existing auto-moderation rule',
      parameters: {
        ruleId: { type: 'number', description: 'ID of the rule to update', required: true },
        name: { type: 'string', description: 'New name for the rule' },
        triggerType: { type: 'string', description: 'New trigger type' },
        actionType: { type: 'string', description: 'New action type' },
        thresholdValue: { type: 'number', description: 'New threshold value' },
        duration: { type: 'number', description: 'New duration in seconds' },
        enabled: { type: 'boolean', description: 'Enable/disable the rule' },
        whitelistChannels: { type: 'array', description: 'New whitelist channels' },
        whitelistRoles: { type: 'array', description: 'New whitelist roles' },
        logChannelId: { type: 'string', description: 'New log channel ID' },
        messageAction: { type: 'string', description: 'New message action' }
      },
      handler: async (params, guildId) => {
        if (!guildId) return { error: 'No guild selected' };
        
        if (!params.ruleId) {
          return { error: 'Parameter "ruleId" is required' };
        }

        try {
          const rules = await store.getGuildAutoModRules(guildId);
          const existing = rules.find(r => r.id === params.ruleId);
          
          if (!existing) {
            return { error: `Rule with ID ${params.ruleId} not found` };
          }

          const updates = {};
          if (params.name !== undefined) updates.name = params.name;
          if (params.triggerType !== undefined) updates.trigger_type = params.triggerType;
          if (params.actionType !== undefined) updates.action_type = params.actionType;
          if (params.thresholdValue !== undefined) updates.threshold_value = params.thresholdValue;
          if (params.duration !== undefined) updates.duration = params.duration;
          if (params.enabled !== undefined) updates.enabled = params.enabled;
          if (params.whitelistChannels !== undefined) updates.whitelist_channels = params.whitelistChannels;
          if (params.whitelistRoles !== undefined) updates.whitelist_roles = params.whitelistRoles;
          if (params.logChannelId !== undefined) updates.log_channel_id = params.logChannelId;
          if (params.messageAction !== undefined) updates.message_action = params.messageAction;

          await store.updateGuildAutoModRule(guildId, params.ruleId, updates);
          
          return {
            success: true,
            message: `Auto-moderation rule updated successfully`
          };
        } catch (error) {
          return { error: `Failed to update automod rule: ${error.message}` };
        }
      }
    },
    {
      name: 'delete_automod_rule',
      description: 'Delete an auto-moderation rule',
      parameters: {
        ruleId: { type: 'number', description: 'ID of the rule to delete', required: true }
      },
      handler: async (params, guildId) => {
        if (!guildId) return { error: 'No guild selected' };
        
        if (!params.ruleId) {
          return { error: 'Parameter "ruleId" is required' };
        }

        try {
          await store.deleteGuildAutoModRule(guildId, params.ruleId);
          
          return {
            success: true,
            message: `Auto-moderation rule deleted successfully`
          };
        } catch (error) {
          return { error: `Failed to delete automod rule: ${error.message}` };
        }
      }
    },
    {
      name: 'toggle_automod_rule',
      description: 'Enable or disable an auto-moderation rule',
      parameters: {
        ruleId: { type: 'number', description: 'ID of the rule to toggle', required: true },
        enabled: { type: 'boolean', description: 'True to enable, false to disable', required: true }
      },
      handler: async (params, guildId) => {
        if (!guildId) return { error: 'No guild selected' };
        
        if (!params.ruleId || typeof params.enabled !== 'boolean') {
          return { error: 'Parameters "ruleId" and "enabled" are required' };
        }

        try {
          await store.toggleGuildAutoModRule(guildId, params.ruleId, params.enabled);
          
          return {
            success: true,
            message: `Auto-moderation rule ${params.enabled ? 'enabled' : 'disabled'}`
          };
        } catch (error) {
          return { error: `Failed to toggle automod rule: ${error.message}` };
        }
      }
    },
    {
      name: 'list_profanity_words',
      description: 'List all profanity words configured for the guild',
      parameters: {
        search: { type: 'string', description: 'Search filter for words (optional)' },
        enabled: { type: 'boolean', description: 'Filter by enabled status (optional)' }
      },
      handler: async (params, guildId) => {
        if (!guildId) return { error: 'No guild selected' };
        
        try {
          let words = await store.getGuildProfanityWords(guildId);
          
          if (params.search) {
            const searchLower = params.search.toLowerCase();
            words = words.filter(w => w.word.toLowerCase().includes(searchLower));
          }
          
          if (params.enabled !== undefined) {
            words = words.filter(w => w.enabled === params.enabled);
          }
          
          return {
            success: true,
            count: words.length,
            words: words.map(w => ({
              id: w.id,
              word: w.word,
              severity: w.severity,
              language: w.language,
              caseSensitive: w.case_sensitive,
              wholeWordOnly: w.whole_word_only,
              enabled: w.enabled
            }))
          };
        } catch (error) {
          return { error: `Failed to list profanity words: ${error.message}` };
        }
      }
    },
    {
      name: 'add_profanity_word',
      description: 'Add a new profanity word to the filter',
      parameters: {
        word: { type: 'string', description: 'The word to filter', required: true },
        severity: { type: 'string', description: 'Severity level: low, medium, high, critical', default: 'medium' },
        language: { type: 'string', description: 'Language code (e.g., en, es, fr)', default: 'en' },
        caseSensitive: { type: 'boolean', description: 'Match case exactly', default: false },
        wholeWordOnly: { type: 'boolean', description: 'Match whole word only', default: true },
        enabled: { type: 'boolean', description: 'Enable immediately', default: true }
      },
      handler: async (params, guildId) => {
        if (!guildId) return { error: 'No guild selected' };
        
        if (!params.word) {
          return { error: 'Parameter "word" is required' };
        }

        try {
          const wordData = {
            word: params.word.trim(),
            severity: params.severity || 'medium',
            language: params.language || 'en',
            case_sensitive: params.caseSensitive || false,
            whole_word_only: params.wholeWordOnly !== false,
            enabled: params.enabled !== false
          };

          await store.addGuildProfanityWord(guildId, wordData);
          
          return {
            success: true,
            message: `Profanity word "${params.word}" added successfully`
          };
        } catch (error) {
          return { error: `Failed to add profanity word: ${error.message}` };
        }
      }
    },
    {
      name: 'update_profanity_word',
      description: 'Update an existing profanity word',
      parameters: {
        wordId: { type: 'number', description: 'ID of the word to update', required: true },
        word: { type: 'string', description: 'New word text' },
        severity: { type: 'string', description: 'New severity level' },
        language: { type: 'string', description: 'New language code' },
        caseSensitive: { type: 'boolean', description: 'New case sensitivity setting' },
        wholeWordOnly: { type: 'boolean', description: 'New whole word setting' },
        enabled: { type: 'boolean', description: 'Enable/disable the word' }
      },
      handler: async (params, guildId) => {
        if (!guildId) return { error: 'No guild selected' };
        
        if (!params.wordId) {
          return { error: 'Parameter "wordId" is required' };
        }

        try {
          const updates = {};
          if (params.word !== undefined) updates.word = params.word.trim();
          if (params.severity !== undefined) updates.severity = params.severity;
          if (params.language !== undefined) updates.language = params.language;
          if (params.caseSensitive !== undefined) updates.case_sensitive = params.caseSensitive;
          if (params.wholeWordOnly !== undefined) updates.whole_word_only = params.wholeWordOnly;
          if (params.enabled !== undefined) updates.enabled = params.enabled;

          await store.updateGuildProfanityWord(guildId, params.wordId, updates);
          
          return {
            success: true,
            message: `Profanity word updated successfully`
          };
        } catch (error) {
          return { error: `Failed to update profanity word: ${error.message}` };
        }
      }
    },
    {
      name: 'delete_profanity_word',
      description: 'Delete a profanity word from the filter',
      parameters: {
        wordId: { type: 'number', description: 'ID of the word to delete', required: true }
      },
      handler: async (params, guildId) => {
        if (!guildId) return { error: 'No guild selected' };
        
        if (!params.wordId) {
          return { error: 'Parameter "wordId" is required' };
        }

        try {
          await store.deleteGuildProfanityWord(guildId, params.wordId);
          
          return {
            success: true,
            message: `Profanity word deleted successfully`
          };
        } catch (error) {
          return { error: `Failed to delete profanity word: ${error.message}` };
        }
      }
    },
    {
      name: 'list_profanity_patterns',
      description: 'List all profanity regex patterns configured for the guild',
      parameters: {
        search: { type: 'string', description: 'Search filter for patterns (optional)' },
        enabled: { type: 'boolean', description: 'Filter by enabled status (optional)' }
      },
      handler: async (params, guildId) => {
        if (!guildId) return { error: 'No guild selected' };
        
        try {
          let patterns = await store.getGuildProfanityPatterns(guildId);
          
          if (params.search) {
            const searchLower = params.search.toLowerCase();
            patterns = patterns.filter(p => 
              p.pattern.toLowerCase().includes(searchLower) ||
              (p.description && p.description.toLowerCase().includes(searchLower))
            );
          }
          
          if (params.enabled !== undefined) {
            patterns = patterns.filter(p => p.enabled === params.enabled);
          }
          
          return {
            success: true,
            count: patterns.length,
            patterns: patterns.map(p => ({
              id: p.id,
              pattern: p.pattern,
              description: p.description,
              severity: p.severity,
              flags: p.flags,
              enabled: p.enabled
            }))
          };
        } catch (error) {
          return { error: `Failed to list profanity patterns: ${error.message}` };
        }
      }
    },
    {
      name: 'add_profanity_pattern',
      description: 'Add a new profanity regex pattern to the filter. Use regex patterns to match complex profanity variations.',
      parameters: {
        pattern: { type: 'string', description: 'Regex pattern (e.g., "b[a@]d\\s*w[o0]rd")', required: true },
        description: { type: 'string', description: 'Description of what the pattern matches', required: true },
        severity: { type: 'string', description: 'Severity level: low, medium, high, critical', default: 'medium' },
        flags: { type: 'string', description: 'Regex flags (e.g., "gi" for global case-insensitive)', default: 'gi' },
        enabled: { type: 'boolean', description: 'Enable immediately', default: true }
      },
      handler: async (params, guildId) => {
        if (!guildId) return { error: 'No guild selected' };
        
        if (!params.pattern || !params.description) {
          return { error: 'Parameters "pattern" and "description" are required' };
        }

        // Validate regex pattern
        try {
          new RegExp(params.pattern, params.flags || 'gi');
        } catch (e) {
          return { error: `Invalid regex pattern: ${e.message}` };
        }

        try {
          const patternData = {
            pattern: params.pattern.trim(),
            description: params.description.trim(),
            severity: params.severity || 'medium',
            flags: params.flags || 'gi',
            enabled: params.enabled !== false
          };

          await store.addGuildProfanityPattern(guildId, patternData);
          
          return {
            success: true,
            message: `Profanity pattern "${params.description}" added successfully`
          };
        } catch (error) {
          return { error: `Failed to add profanity pattern: ${error.message}` };
        }
      }
    },
    {
      name: 'generate_profanity_pattern',
      description: 'Generate a regex pattern to match profanity with common character substitutions (e.g., a->@, o->0). Returns the pattern without saving it.',
      parameters: {
        baseWord: { type: 'string', description: 'Base word to create pattern from (e.g., "badword")', required: true },
        includeSpaces: { type: 'boolean', description: 'Allow spaces between characters', default: true },
        includeSubstitutions: { type: 'boolean', description: 'Include common character substitutions', default: true }
      },
      handler: async (params, guildId) => {
        if (!params.baseWord) {
          return { error: 'Parameter "baseWord" is required' };
        }

        const word = params.baseWord.toLowerCase().trim();
        const substitutions = {
          'a': '[a@4]',
          'e': '[e3]',
          'i': '[i1!|]',
          'o': '[o0]',
          's': '[s$5]',
          't': '[t7+]',
          'l': '[l1|]',
          'g': '[g9]',
          'b': '[b8]'
        };

        let pattern = '';
        for (let char of word) {
          if (params.includeSubstitutions && substitutions[char]) {
            pattern += substitutions[char];
          } else {
            pattern += char;
          }
          
          if (params.includeSpaces !== false) {
            pattern += '\\s*';
          }
        }

        // Remove trailing \s* if added
        if (params.includeSpaces !== false && pattern.endsWith('\\s*')) {
          pattern = pattern.slice(0, -3);
        }

        return {
          success: true,
          baseWord: params.baseWord,
          pattern: pattern,
          flags: 'gi',
          description: `Matches "${params.baseWord}" with character substitutions`,
          example: `Use add_profanity_pattern to save this pattern`
        };
      }
    },
    {
      name: 'update_profanity_pattern',
      description: 'Update an existing profanity pattern',
      parameters: {
        patternId: { type: 'number', description: 'ID of the pattern to update', required: true },
        pattern: { type: 'string', description: 'New regex pattern' },
        description: { type: 'string', description: 'New description' },
        severity: { type: 'string', description: 'New severity level' },
        flags: { type: 'string', description: 'New regex flags' },
        enabled: { type: 'boolean', description: 'Enable/disable the pattern' }
      },
      handler: async (params, guildId) => {
        if (!guildId) return { error: 'No guild selected' };
        
        if (!params.patternId) {
          return { error: 'Parameter "patternId" is required' };
        }

        // Validate regex if pattern is being updated
        if (params.pattern) {
          try {
            new RegExp(params.pattern, params.flags || 'gi');
          } catch (e) {
            return { error: `Invalid regex pattern: ${e.message}` };
          }
        }

        try {
          const updates = {};
          if (params.pattern !== undefined) updates.pattern = params.pattern.trim();
          if (params.description !== undefined) updates.description = params.description.trim();
          if (params.severity !== undefined) updates.severity = params.severity;
          if (params.flags !== undefined) updates.flags = params.flags;
          if (params.enabled !== undefined) updates.enabled = params.enabled;

          await store.updateGuildProfanityPattern(guildId, params.patternId, updates);
          
          return {
            success: true,
            message: `Profanity pattern updated successfully`
          };
        } catch (error) {
          return { error: `Failed to update profanity pattern: ${error.message}` };
        }
      }
    },
    {
      name: 'delete_profanity_pattern',
      description: 'Delete a profanity pattern from the filter',
      parameters: {
        patternId: { type: 'number', description: 'ID of the pattern to delete', required: true }
      },
      handler: async (params, guildId) => {
        if (!guildId) return { error: 'No guild selected' };
        
        if (!params.patternId) {
          return { error: 'Parameter "patternId" is required' };
        }

        try {
          await store.deleteGuildProfanityPattern(guildId, params.patternId);
          
          return {
            success: true,
            message: `Profanity pattern deleted successfully`
          };
        } catch (error) {
          return { error: `Failed to delete profanity pattern: ${error.message}` };
        }
      }
    }
  ];

  /**
   * GET /api/ai/chat/history - Get chat history for the current guild
   */
  router.get('/chat/history', async (req, res) => {
    try {
      const guildId = req.query.guildId || (req.user.type === 'discord' ? 
        (await store.getUser(req.user.userId))?.selected_guild_id : null);
      
      if (!guildId) {
        return res.status(400).json({ error: 'No guild selected' });
      }

      const userId = req.user.userId || 'anonymous';
      const history = await store.getAIChatHistory(guildId, userId, 20); // Get last 20 messages
      
      res.json({ history: history || [] });
    } catch (error) {
      console.error('Failed to get chat history:', error);
      res.status(500).json({ error: 'Failed to retrieve chat history' });
    }
  });

  /**
   * DELETE /api/ai/chat/history - Clear chat history for the current guild
   */
  router.delete('/chat/history', async (req, res) => {
    try {
      const guildId = req.query.guildId || (req.user.type === 'discord' ? 
        (await store.getUser(req.user.userId))?.selected_guild_id : null);
      
      if (!guildId) {
        return res.status(400).json({ error: 'No guild selected' });
      }

      const userId = req.user.userId || 'anonymous';
      await store.clearAIChatHistory(guildId, userId);
      
      res.json({ success: true, message: 'Chat history cleared' });
    } catch (error) {
      console.error('Failed to clear chat history:', error);
      res.status(500).json({ error: 'Failed to clear chat history' });
    }
  });

  /**
   * POST /api/ai/chat - Send a message to the AI assistant
   */
  router.post('/chat', async (req, res) => {
    try {
      const { message, history: clientHistory = [] } = req.body;
      
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'Message is required' });
      }

      // Get guild context
      const guildId = req.query.guildId || (req.user.type === 'discord' ? 
        (await store.getUser(req.user.userId))?.selected_guild_id : null);

      // Get user ID
      const userId = req.user.userId || 'anonymous';

      // Retrieve persistent chat history from database
      let history = clientHistory;
      if (guildId && store.getAIChatHistory) {
        try {
          const dbHistory = await store.getAIChatHistory(guildId, userId, 10);
          if (dbHistory && dbHistory.length > 0) {
            history = dbHistory;
          }
        } catch (e) {
          console.log('Failed to retrieve chat history:', e.message);
        }
      }

      // Audit log
      audit(req, { action: 'ai-chat', guildId, message: message.substring(0, 100) });

      let aiResponse = '';
      let functionResult = null;
      let functionName = null;

      // Try Groq with tool calling first
      try {
        const contextInfo = guildId ? `The user is currently viewing guild ${guildId}.` : 'No guild is selected.';
        
        const systemPrompt = `You are Chocomaid AI Assistant, a helpful and friendly assistant for managing a Discord bot dashboard. ${contextInfo}

Your capabilities:
- Answer questions about the bot and its features
- Help users configure bot settings
- Manage bot commands (list, enable, disable, get info)
- Create, update, and delete auto-responses
- Manage auto-moderation rules (spam, caps, links, profanity, etc.)
- Manage profanity filters (words and regex patterns)
- Generate profanity detection patterns with character substitutions
- Retrieve analytics and statistics
- Check moderation settings

Use the available tools when users ask to:
- List/show bot commands
- Enable/disable specific commands
- Get information about commands
- Bulk enable/disable multiple commands
- Create/add auto-responses
- Update/modify auto-responses
- Delete/remove auto-responses
- Enable/disable auto-responses
- List/show auto-responses
- List/create/update/delete auto-moderation rules
- List/add/update/delete profanity words
- List/add/update/delete profanity patterns
- Generate regex patterns for profanity detection
- Get bot status or statistics
- View leaderboards or analytics

When working with profanity patterns:
- Use generate_profanity_pattern to create patterns with character substitutions
- Patterns support regex for flexible matching (e.g., [a@4] matches a, @, or 4)
- Common substitutions: a->@/4, e->3, i->1/!/|, o->0, s->$/5, etc.
- Always validate patterns before adding them

Be conversational, concise, and use markdown formatting for better readability.`;

        const result = await chatGroqWithTools(message, tools, history, {
          systemPrompt,
          temperature: 0.7
        });

        // Check if a tool was called
        if (result.toolCall) {
          functionName = result.toolCall.name;
          const extractedParams = result.toolCall.arguments;
          
          const functionDef = tools.find(t => t.name === functionName);
          
          if (functionDef) {
            try {
              // Execute the function
              functionResult = await functionDef.handler(extractedParams, guildId);
              
              // Generate a natural language response based on the result
              const followUpMessage = `The user asked: "${message}"

I executed ${functionName} and got this result:
${JSON.stringify(functionResult, null, 2)}

Please provide a natural, helpful, and concise response to the user based on this information. Use markdown formatting. Be friendly and conversational.`;

              const followUp = await chatGroq(followUpMessage, [], {
                systemPrompt: 'You are Chocomaid AI Assistant. Format your responses with markdown when appropriate.',
                temperature: 0.7,
                maxTokens: 512
              });

              aiResponse = followUp.text;
            } catch (e) {
              console.log('Function execution failed:', e.message);
              aiResponse = `I tried to ${functionName.replace(/_/g, ' ')}, but encountered an error: ${e.message}`;
            }
          }
        } else {
          // No tool call, use the direct response
          aiResponse = result.text;
          
          // Fallback: Check if user is trying to perform CRUD operations using keyword matching
          const lowerMessage = message.toLowerCase();
          const crudKeywords = ['create', 'add', 'update', 'modify', 'delete', 'remove', 'enable', 'disable', 'toggle'];
          const autoResponseKeywords = ['auto-response', 'auto response', 'autoresponse', 'trigger', 'reply'];
          
          const hasCrudIntent = crudKeywords.some(k => lowerMessage.includes(k));
          const hasAutoResponseIntent = autoResponseKeywords.some(k => lowerMessage.includes(k));
          
          if (hasCrudIntent && hasAutoResponseIntent) {
            // Try to determine which function to use
            let functionMatch = null;
            let extractedParams = {};
            
            if (lowerMessage.includes('create') || lowerMessage.includes('add')) {
              functionMatch = tools.find(t => t.name === 'create_auto_response');
            } else if (lowerMessage.includes('update') || lowerMessage.includes('modify')) {
              functionMatch = tools.find(t => t.name === 'update_auto_response');
            } else if (lowerMessage.includes('delete') || lowerMessage.includes('remove')) {
              functionMatch = tools.find(t => t.name === 'delete_auto_response');
            } else if (lowerMessage.includes('enable') || lowerMessage.includes('disable') || lowerMessage.includes('toggle')) {
              functionMatch = tools.find(t => t.name === 'toggle_auto_response');
            }
            
            if (functionMatch) {
              try {
                // Extract parameters from message
                extractedParams = extractParametersFromMessage(message, functionMatch.parameters);
                
                // Execute the function
                functionResult = await functionMatch.handler(extractedParams, guildId);
                functionName = functionMatch.name;
                
                // Generate a natural language response based on the result
                const followUpMessage = `The user asked: "${message}"

I executed ${functionMatch.name} and got this result:
${JSON.stringify(functionResult, null, 2)}

Please provide a natural, helpful response based on this information. Use markdown formatting.`;

                const followUp = await chatGroq(followUpMessage, [], {
                  systemPrompt: 'You are Chocomaid AI Assistant.',
                  temperature: 0.7,
                  maxTokens: 512
                });

                aiResponse = followUp.text;
              } catch (e) {
                console.log('Function execution failed:', e.message);
              }
            }
          }
        }
      } catch (groqError) {
        console.error('Groq API error:', groqError.message);
        // Fallback to simple response if Groq fails
        aiResponse = "I'm having trouble connecting to the AI service right now. Please try again in a moment.";
      }

      // Save user message and AI response to database
      if (guildId && store.saveAIChatMessage) {
        try {
          await store.saveAIChatMessage(guildId, userId, 'user', message);
          await store.saveAIChatMessage(guildId, userId, 'assistant', aiResponse);
        } catch (e) {
          console.log('Failed to save chat history:', e.message);
        }
      }

      res.json({
        response: aiResponse,
        functionCalled: functionResult ? functionName : null,
        functionResult: functionResult || null,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('AI chat error:', error);
      res.status(500).json({ 
        error: 'Failed to process chat message',
        message: error.message 
      });
    }
  });

  /**
   * Extract parameters from user message based on function parameter definitions
   */
  function extractParametersFromMessage(message, paramDefs) {
    const params = {};
    const lowerMessage = message.toLowerCase();

    for (const [paramName, paramInfo] of Object.entries(paramDefs)) {
      switch (paramName) {
        case 'key':
          // Extract key from patterns like "key: xyz" or "called xyz" or "named xyz"
          const keyMatch = message.match(/(?:key|called|named)[:\s]+["']?(\w+)["']?/i) ||
                          message.match(/["'](\w+)["']\s+(?:auto[-\s]?response|trigger)/i);
          if (keyMatch) params.key = keyMatch[1];
          break;

        case 'text':
          // Extract text pattern from quotes or after keywords
          const textMatch = message.match(/(?:text|pattern|match|trigger)[:\s]+["']([^"']+)["']/i) ||
                           message.match(/when.*says?\s+["']([^"']+)["']/i) ||
                           message.match(/detect\s+["']([^"']+)["']/i);
          if (textMatch) params.text = textMatch[1];
          break;

        case 'replies':
          // Extract replies from quotes or after keywords
          const repliesMatches = message.match(/(?:repl(?:y|ies)|respond|say)[:\s]+["']([^"']+)["']/gi);
          if (repliesMatches) {
            params.replies = repliesMatches.map(m => {
              const match = m.match(/["']([^"']+)["']/);
              return match ? match[1] : m;
            });
          } else {
            // Try to find comma-separated replies
            const multiReplyMatch = message.match(/(?:replies|responses)[:\s]+(.+?)(?:\.|$)/i);
            if (multiReplyMatch) {
              params.replies = multiReplyMatch[1].split(/,|and/).map(r => 
                r.trim().replace(/^["']|["']$/g, '')
              ).filter(r => r.length > 0);
            }
          }
          break;

        case 'matchType':
          if (lowerMessage.includes('exact')) params.matchType = 'exact';
          else if (lowerMessage.includes('whole word')) params.matchType = 'whole';
          else if (lowerMessage.includes('contains')) params.matchType = 'contains';
          break;

        case 'enabled':
          if (lowerMessage.includes('disable') || lowerMessage.includes('turn off')) {
            params.enabled = false;
          } else if (lowerMessage.includes('enable') || lowerMessage.includes('turn on')) {
            params.enabled = true;
          }
          break;

        case 'flags':
          if (lowerMessage.includes('case sensitive')) {
            params.flags = '';
          } else if (lowerMessage.includes('case insensitive')) {
            params.flags = 'i';
          }
          break;
      }
    }

    return params;
  }

  /**
   * GET /api/ai/tools - List available AI tools
   */
  router.get('/tools', async (req, res) => {
    const toolList = tools.map(t => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters
    }));
    
    res.json({ tools: toolList });
  });

  return router;
}

module.exports = createAiChatRoutes;
