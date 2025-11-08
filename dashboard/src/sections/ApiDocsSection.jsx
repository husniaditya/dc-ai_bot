import React, { useState, useEffect } from 'react';
import { useTranslation } from '../i18n';

export default function ApiDocsSection({ guildId, pushToast }) {
  const { t } = useTranslation();
  
  // Access control - only allow specific server ID
  const ALLOWED_GUILD_ID = '935480450707759165';
  const hasAccess = guildId === ALLOWED_GUILD_ID;

  const [selectedCategory, setSelectedCategory] = useState('authentication');
  const [selectedEndpoint, setSelectedEndpoint] = useState(null);
  const [testRequest, setTestRequest] = useState({
    method: 'GET',
    headers: {},
    body: '',
    params: {}
  });
  const [testResponse, setTestResponse] = useState(null);
  const [isTestLoading, setIsTestLoading] = useState(false);
  const [showResponseExample, setShowResponseExample] = useState(false);

  // Helper: localized category label with fallback to raw name
  const getCategoryLabel = (category) => {
    if (!category) return '';
    const key = `apiDocs.categoryNames.${category.id}`;
    const label = t(key);
    return label === key ? category.name : label;
  };

  // API Documentation Data Structure
  const apiCategories = [
    {
      id: 'authentication',
      name: 'Authentication',
      icon: 'fa-key',
      color: '#5865F2',
      endpoints: [
        {
          id: 'get-oauth-url',
          method: 'GET',
          path: '/api/auth/oauth/discord/url',
          summary: 'Get Discord OAuth URL',
          description: 'Generate Discord OAuth2 authorization URL for user authentication.',
          auth: false,
          params: [
            { name: 'preferApp', type: 'query', required: false, description: 'Prefer Discord app over browser (boolean)' },
            { name: 'isMobile', type: 'query', required: false, description: 'Indicate mobile device (boolean)' }
          ],
          response: {
            url: 'https://discord.com/api/oauth2/authorize?...',
            state: 'generated_state_token'
          }
        },
        {
          id: 'exchange-oauth',
          method: 'POST',
          path: '/api/auth/oauth/discord/exchange',
          summary: 'Exchange OAuth Code',
          description: 'Exchange OAuth authorization code for JWT token.',
          auth: false,
          body: {
            code: 'OAUTH_AUTHORIZATION_CODE',
            state: 'STATE_FROM_PREVIOUS_REQUEST'
          },
          response: {
            token: 'JWT_TOKEN_HERE',
            guilds: []
          }
        },
        {
          id: 'validate-token',
          method: 'GET',
          path: '/api/auth/validate',
          summary: 'Validate Token',
          description: 'Validate current JWT token and get user information.',
          auth: true,
          response: {
            valid: true,
            userId: '123456789',
            username: 'User#1234'
          }
        }
      ]
    },
    {
      id: 'analytics',
      name: 'Analytics',
      icon: 'fa-chart-line',
      color: '#10b981',
      endpoints: [
        {
          id: 'analytics-overview',
          method: 'GET',
          path: '/api/analytics/overview',
          summary: 'Get Analytics Overview',
          description: 'Comprehensive analytics including guild stats, command usage, security metrics.',
          auth: true,
          params: [
            { name: 'guildId', type: 'query', required: true, description: 'Guild/Server ID' }
          ],
          response: {
            totals: {
              members: 1234,
              commands: 50,
              commandsEnabled: 45,
              autos: 10
            },
            commandStats: [],
            securityMetrics: {}
          }
        },
        {
          id: 'command-analytics',
          method: 'GET',
          path: '/api/analytics/commands',
          summary: 'Get Command Analytics',
          description: 'Detailed command analytics including top commands and daily trends.',
          auth: true,
          params: [
            { name: 'guildId', type: 'query', required: true, description: 'Guild/Server ID' }
          ]
        }
      ]
    },
    {
      id: 'guilds',
      name: 'Guilds',
      icon: 'fa-server',
      color: '#8b5cf6',
      endpoints: [
        {
          id: 'get-guilds',
          method: 'GET',
          path: '/api/guilds',
          summary: 'Get User Guilds',
          description: 'Get all guilds the authenticated user can manage where the bot is present.',
          auth: true,
          response: {
            guilds: [
              {
                id: '123456789',
                name: 'My Server',
                icon: 'icon_hash',
                canManage: true,
                memberCount: 1234,
                botPresent: true
              }
            ]
          }
        },
        {
          id: 'get-guild-emojis',
          method: 'GET',
          path: '/api/guilds/:guildId/emojis',
          summary: 'Get Guild Emojis',
          description: 'Get all custom emojis from the guild.',
          auth: true,
          params: [
            { name: 'guildId', type: 'path', required: true, description: 'Guild/Server ID' }
          ],
          response: {
            emojis: [
              {
                id: '111111111111111111',
                name: 'custom_emoji',
                animated: false,
                url: 'https://cdn.discordapp.com/emojis/111111111111111111.png'
              }
            ]
          }
        },
        {
          id: 'get-guild-channels',
          method: 'GET',
          path: '/api/guilds/:guildId/channels',
          summary: 'Get Guild Channels',
          description: 'Get all channels in the guild.',
          auth: true,
          params: [
            { name: 'guildId', type: 'path', required: true, description: 'Guild/Server ID' }
          ],
          response: {
            channels: [
              {
                id: '222222222222222222',
                name: 'general',
                type: 'GUILD_TEXT',
                position: 0,
                parentId: null
              },
              {
                id: '333333333333333333',
                name: 'General',
                type: 'GUILD_VOICE',
                position: 1,
                parentId: null
              }
            ]
          }
        },
        {
          id: 'get-guild-roles',
          method: 'GET',
          path: '/api/guilds/:guildId/roles',
          summary: 'Get Guild Roles',
          description: 'Get all roles in the guild.',
          auth: true,
          params: [
            { name: 'guildId', type: 'path', required: true, description: 'Guild/Server ID' }
          ],
          response: {
            roles: [
              {
                id: '444444444444444444',
                name: '@everyone',
                color: 0,
                position: 0,
                permissions: '1071698660929'
              },
              {
                id: '555555555555555555',
                name: 'Moderator',
                color: 3447003,
                position: 1,
                permissions: '1099511627775'
              }
            ]
          }
        }
      ]
    },
    {
      id: 'moderation',
      name: 'Moderation',
      icon: 'fa-shield-halved',
      color: '#dc2626',
      endpoints: [
        {
          id: 'get-automod-rules',
          method: 'GET',
          path: '/api/moderation/automod/rules',
          summary: 'Get AutoMod Rules',
          description: 'Get all automod rules for the guild.',
          auth: true,
          headers: [
            { name: 'X-Guild-Id', required: true, description: 'Guild/Server ID' }
          ],
          response: {
            rules: [
              {
                id: 1,
                name: 'Spam Filter',
                triggerType: 'spam',
                enabled: true,
                actionType: 'delete',
                config: {
                  threshold: 5,
                  timeWindow: 10
                }
              }
            ]
          }
        },
        {
          id: 'create-automod-rule',
          method: 'POST',
          path: '/api/moderation/automod/rules',
          summary: 'Create AutoMod Rule',
          description: 'Create a new automod rule.',
          auth: true,
          headers: [
            { name: 'X-Guild-Id', required: true, description: 'Guild/Server ID' }
          ],
          body: {
            name: 'Spam Filter',
            triggerType: 'spam',
            actionType: 'delete',
            enabled: true,
            config: {
              threshold: 5,
              timeWindow: 10
            }
          },
          response: {
            success: true,
            message: 'AutoMod rule created successfully',
            rule: {
              id: 2,
              name: 'Spam Filter',
              triggerType: 'spam',
              enabled: true,
              createdAt: '2025-01-01T00:00:00Z'
            }
          }
        },
        {
          id: 'update-automod-rule',
          method: 'PUT',
          path: '/api/moderation/automod/rules/:ruleId',
          summary: 'Update AutoMod Rule',
          description: 'Update an existing automod rule.',
          auth: true,
          headers: [
            { name: 'X-Guild-Id', required: true, description: 'Guild/Server ID' }
          ],
          params: [
            { name: 'ruleId', type: 'path', required: true, description: 'AutoMod rule ID' }
          ],
          body: {
            enabled: false,
            config: {
              threshold: 10
            }
          },
          response: {
            success: true,
            message: 'AutoMod rule updated successfully'
          }
        },
        {
          id: 'delete-automod-rule',
          method: 'DELETE',
          path: '/api/moderation/automod/rules/:ruleId',
          summary: 'Delete AutoMod Rule',
          description: 'Delete an automod rule.',
          auth: true,
          headers: [
            { name: 'X-Guild-Id', required: true, description: 'Guild/Server ID' }
          ],
          params: [
            { name: 'ruleId', type: 'path', required: true, description: 'AutoMod rule ID' }
          ],
          response: {
            success: true,
            message: 'AutoMod rule deleted successfully'
          }
        },
        {
          id: 'get-audit-logs',
          method: 'GET',
          path: '/api/moderation/audit-logs',
          summary: 'Get Audit Logs',
          description: 'Get moderation audit logs for the guild.',
          auth: true,
          params: [
            { name: 'guildId', type: 'query', required: true, description: 'Guild/Server ID' },
            { name: 'limit', type: 'query', required: false, description: 'Number of logs to return (default: 50)' },
            { name: 'action', type: 'query', required: false, description: 'Filter by action type (ban, kick, mute, etc.)' }
          ],
          response: {
            logs: [
              {
                id: 1,
                action: 'ban',
                targetUserId: '123456789',
                targetUsername: 'User#1234',
                moderatorId: '987654321',
                moderatorUsername: 'Mod#5678',
                reason: 'Spam',
                timestamp: '2025-01-01T12:00:00Z'
              }
            ],
            total: 1
          }
        },
        {
          id: 'get-warnings',
          method: 'GET',
          path: '/api/moderation/warnings/:userId',
          summary: 'Get User Warnings',
          description: 'Get all warnings for a specific user.',
          auth: true,
          params: [
            { name: 'userId', type: 'path', required: true, description: 'Discord User ID' },
            { name: 'guildId', type: 'query', required: true, description: 'Guild/Server ID' }
          ],
          response: {
            userId: '123456789',
            username: 'User#1234',
            warnings: [
              {
                id: 1,
                reason: 'Inappropriate language',
                moderatorId: '987654321',
                timestamp: '2025-01-01T10:00:00Z'
              }
            ],
            totalWarnings: 1
          }
        }
      ]
    },
    {
      id: 'settings',
      name: 'Settings',
      icon: 'fa-gear',
      color: '#f59e0b',
      endpoints: [
        {
          id: 'get-settings',
          method: 'GET',
          path: '/api/settings',
          summary: 'Get Settings',
          description: 'Get guild or global settings configuration.',
          auth: true,
          params: [
            { name: 'guildId', type: 'query', required: true, description: 'Guild/Server ID' }
          ],
          response: {
            guildId: '123456789',
            autoReplyEnabled: true,
            autoReplyCooldownMs: 3000,
            language: 'en',
            timezone: 'America/New_York',
            prefix: '!',
            welcomeEnabled: true
          }
        },
        {
          id: 'update-settings',
          method: 'PUT',
          path: '/api/settings',
          summary: 'Update Settings',
          description: 'Update guild or global settings.',
          auth: true,
          params: [
            { name: 'guildId', type: 'query', required: true, description: 'Guild/Server ID' }
          ],
          body: {
            autoReplyEnabled: true,
            autoReplyCooldownMs: 3000,
            language: 'en',
            timezone: 'America/New_York'
          },
          response: {
            success: true,
            message: 'Settings updated successfully',
            updated: {
              autoReplyEnabled: true,
              autoReplyCooldownMs: 3000,
              language: 'en',
              timezone: 'America/New_York'
            }
          }
        }
      ]
    },
    {
      id: 'auto-responses',
      name: 'Auto Responses',
      icon: 'fa-robot',
      color: '#06b6d4',
      endpoints: [
        {
          id: 'get-auto-responses',
          method: 'GET',
          path: '/api/autos',
          summary: 'Get Auto Responses',
          description: 'Get all auto-response triggers for the guild.',
          auth: true,
          headers: [
            { name: 'X-Guild-Id', required: true, description: 'Guild/Server ID' }
          ],
          response: {
            autoResponses: [
              {
                id: 1,
                trigger: 'hello',
                response: 'Hi there! 👋',
                isRegex: false,
                enabled: true,
                createdAt: '2025-01-01T00:00:00Z'
              },
              {
                id: 2,
                trigger: '^(help|support)$',
                response: 'Need help? Use /support command!',
                isRegex: true,
                enabled: true,
                createdAt: '2025-01-02T00:00:00Z'
              }
            ]
          }
        },
        {
          id: 'create-auto-response',
          method: 'POST',
          path: '/api/autos',
          summary: 'Create Auto Response',
          description: 'Create a new auto-response trigger.',
          auth: true,
          headers: [
            { name: 'X-Guild-Id', required: true, description: 'Guild/Server ID' }
          ],
          body: {
            trigger: 'hello',
            response: 'Hi there! 👋',
            isRegex: false,
            enabled: true
          },
          response: {
            success: true,
            message: 'Auto response created successfully',
            autoResponse: {
              id: 3,
              trigger: 'hello',
              response: 'Hi there! 👋',
              isRegex: false,
              enabled: true,
              createdAt: '2025-01-03T00:00:00Z'
            }
          }
        },
        {
          id: 'update-auto-response',
          method: 'PUT',
          path: '/api/autos/:id',
          summary: 'Update Auto Response',
          description: 'Update an existing auto-response trigger.',
          auth: true,
          headers: [
            { name: 'X-Guild-Id', required: true, description: 'Guild/Server ID' }
          ],
          params: [
            { name: 'id', type: 'path', required: true, description: 'Auto response ID' }
          ],
          body: {
            trigger: 'hi',
            response: 'Hello! 😊',
            enabled: true
          },
          response: {
            success: true,
            message: 'Auto response updated successfully'
          }
        },
        {
          id: 'delete-auto-response',
          method: 'DELETE',
          path: '/api/autos/:id',
          summary: 'Delete Auto Response',
          description: 'Delete an auto-response trigger.',
          auth: true,
          headers: [
            { name: 'X-Guild-Id', required: true, description: 'Guild/Server ID' }
          ],
          params: [
            { name: 'id', type: 'path', required: true, description: 'Auto response ID' }
          ],
          response: {
            success: true,
            message: 'Auto response deleted successfully'
          }
        }
      ]
    },
    {
      id: 'commands',
      name: 'Commands',
      icon: 'fa-terminal',
      color: '#8b5cf6',
      endpoints: [
        {
          id: 'get-commands',
          method: 'GET',
          path: '/api/commands',
          summary: 'Get Commands',
          description: 'Get all available bot commands for the guild.',
          auth: true,
          headers: [
            { name: 'X-Guild-Id', required: true, description: 'Guild/Server ID' }
          ],
          response: {
            commands: [
              {
                id: 1,
                name: 'help',
                description: 'Show help information',
                category: 'utility',
                enabled: true,
                usageCount: 150
              },
              {
                id: 2,
                name: 'kick',
                description: 'Kick a member from the server',
                category: 'moderation',
                enabled: true,
                usageCount: 25
              }
            ]
          }
        },
        {
          id: 'toggle-command',
          method: 'PATCH',
          path: '/api/commands/:commandId/toggle',
          summary: 'Toggle Command',
          description: 'Enable or disable a specific command.',
          auth: true,
          headers: [
            { name: 'X-Guild-Id', required: true, description: 'Guild/Server ID' }
          ],
          params: [
            { name: 'commandId', type: 'path', required: true, description: 'Command ID' }
          ],
          body: {
            enabled: false
          },
          response: {
            success: true,
            message: 'Command toggled successfully',
            command: {
              id: 2,
              name: 'kick',
              enabled: false
            }
          }
        }
      ]
    },
    {
      id: 'leveling',
      name: 'XP & Leveling',
      icon: 'fa-trophy',
      color: '#eab308',
      endpoints: [
        {
          id: 'get-leaderboard',
          method: 'GET',
          path: '/api/xp/leaderboard',
          summary: 'Get XP Leaderboard',
          description: 'Get top users by XP in the guild.',
          auth: true,
          params: [
            { name: 'guildId', type: 'query', required: true, description: 'Guild/Server ID' },
            { name: 'limit', type: 'query', required: false, description: 'Number of users to return (default: 10)' }
          ],
          response: {
            leaderboard: [
              {
                userId: '123456789',
                username: 'User#1234',
                xp: 5000,
                level: 10,
                rank: 1
              },
              {
                userId: '987654321',
                username: 'User#5678',
                xp: 4500,
                level: 9,
                rank: 2
              }
            ]
          }
        },
        {
          id: 'get-user-xp',
          method: 'GET',
          path: '/api/xp/user/:userId',
          summary: 'Get User XP',
          description: 'Get XP and level information for a specific user.',
          auth: true,
          params: [
            { name: 'userId', type: 'path', required: true, description: 'Discord User ID' },
            { name: 'guildId', type: 'query', required: true, description: 'Guild/Server ID' }
          ],
          response: {
            userId: '123456789',
            username: 'User#1234',
            xp: 5000,
            level: 10,
            rank: 1,
            nextLevelXp: 5500,
            progress: 0.91
          }
        },
        {
          id: 'reset-user-xp',
          method: 'DELETE',
          path: '/api/xp/user/:userId',
          summary: 'Reset User XP',
          description: 'Reset XP and level for a specific user.',
          auth: true,
          params: [
            { name: 'userId', type: 'path', required: true, description: 'Discord User ID' }
          ],
          headers: [
            { name: 'X-Guild-Id', required: true, description: 'Guild/Server ID' }
          ],
          response: {
            success: true,
            message: 'User XP reset successfully',
            userId: '123456789'
          }
        }
      ]
    },
    {
      id: 'games-social',
      name: 'Games & Social',
      icon: 'fa-gamepad',
      color: '#a855f7',
      endpoints: [
        {
          id: 'get-coc-config',
          method: 'GET',
          path: '/api/clashofclans/config',
          summary: 'Get Clash of Clans Config',
          description: 'Get Clash of Clans configuration for a guild including tracked clans, channels, and settings.',
          auth: true,
          params: [
            { name: 'guildId', type: 'query', required: true, description: 'Guild/Server ID' }
          ],
          response: {
            clans: ['#2PP', '#ABC123'],
            clanNames: { '#2PP': 'Best Clan', '#ABC123': 'Second Clan' },
            warAnnounceChannelId: '123456789012345678',
            memberAnnounceChannelId: '123456789012345678',
            donationAnnounceChannelId: '123456789012345678',
            donationLeaderboardChannelId: '123456789012345678',
            warLeaderboardChannelId: '123456789012345678',
            enabled: true,
            trackWars: true,
            trackMembers: true,
            trackDonations: true,
            trackDonationLeaderboard: true,
            trackWarLeaderboard: true,
            trackCWL: true,
            intervalSec: 300
          }
        },
        {
          id: 'get-coc-clan',
          method: 'GET',
          path: '/api/clashofclans/clan/:clanTag',
          summary: 'Get Clan Information',
          description: 'Get Clash of Clans clan information by clan tag.',
          auth: true,
          params: [
            { name: 'clanTag', type: 'path', required: true, description: 'Clan tag (with or without #, e.g., 2PP or #2PP)' }
          ],
          response: {
            tag: '#2PP',
            name: 'Best Clan',
            level: 15,
            memberCount: 48,
            badgeUrls: {
              small: 'https://...',
              medium: 'https://...',
              large: 'https://...'
            },
            source: 'api'
          }
        },
        {
          id: 'validate-coc-clan',
          method: 'POST',
          path: '/api/clashofclans/validate-clan',
          summary: 'Validate Clan Tag',
          description: 'Validate a Clash of Clans clan tag and get basic clan info.',
          auth: true,
          headers: [
            { name: 'Content-Type', required: true, description: 'application/json' }
          ],
          body: {
            clanTag: '#2PP'
          },
          response: {
            clanTag: '#2PP',
            clanName: 'Best Clan',
            clanLevel: 15,
            memberCount: 48,
            source: 'api'
          }
        },
        {
          id: 'update-coc-config',
          method: 'PUT',
          path: '/api/clashofclans/config',
          summary: 'Update CoC Configuration',
          description: 'Update Clash of Clans tracking configuration for a guild.',
          auth: true,
          params: [
            { name: 'guildId', type: 'query', required: true, description: 'Guild/Server ID' }
          ],
          headers: [
            { name: 'Content-Type', required: true, description: 'application/json' }
          ],
          body: {
            clans: ['#2PP', '#ABC123'],
            warAnnounceChannelId: '123456789012345678',
            memberAnnounceChannelId: '123456789012345678',
            donationAnnounceChannelId: '123456789012345678',
            trackWars: true,
            trackMembers: true,
            trackDonations: true,
            enabled: true
          },
          response: {
            clans: ['#2PP', '#ABC123'],
            clanNames: { '#2PP': 'Best Clan', '#ABC123': 'Second Clan' },
            warAnnounceChannelId: '123456789012345678',
            memberAnnounceChannelId: '123456789012345678',
            donationAnnounceChannelId: '123456789012345678',
            enabled: true,
            trackWars: true,
            trackMembers: true,
            trackDonations: true
          }
        },
        {
          id: 'get-coc-war',
          method: 'GET',
          path: '/api/clashofclans/war/:clanTag',
          summary: 'Get Current War Status',
          description: 'Get current war status and details for a Clash of Clans clan.',
          auth: true,
          params: [
            { name: 'clanTag', type: 'path', required: true, description: 'Clan tag (e.g., 2PP or #2PP)' },
            { name: 'guildId', type: 'query', required: true, description: 'Guild/Server ID' }
          ],
          response: {
            clanTag: '#2PP',
            currentState: 'inWar',
            lastStateChange: '2025-11-07T10:30:00.000Z',
            warData: {
              state: 'inWar',
              teamSize: 15,
              attacksPerMember: 2,
              preparationStartTime: '2025-11-07T08:00:00.000Z',
              startTime: '2025-11-07T10:00:00.000Z',
              endTime: '2025-11-08T10:00:00.000Z',
              clan: {
                tag: '#2PP',
                name: 'Best Clan',
                attacks: 12,
                stars: 28,
                destructionPercentage: 75.5
              },
              opponent: {
                tag: '#ENEMY',
                name: 'Enemy Clan',
                attacks: 10,
                stars: 25,
                destructionPercentage: 68.2
              }
            },
            messageIds: {
              preparing: '987654321098765432',
              active: '123456789012345678'
            }
          }
        },
        {
          id: 'get-coc-cwl',
          method: 'GET',
          path: '/api/clashofclans/cwl/:clanTag',
          summary: 'Get CWL Status',
          description: 'Get Clan War League (CWL) status and player performance for a clan.',
          auth: true,
          params: [
            { name: 'clanTag', type: 'path', required: true, description: 'Clan tag (e.g., 2PP or #2PP)' },
            { name: 'guildId', type: 'query', required: true, description: 'Guild/Server ID' }
          ],
          response: {
            clanTag: '#2PP',
            trackingEnabled: true,
            lastUpdate: '2025-11-07T10:00:00.000Z',
            finalizedRounds: 5,
            lastReminderTime: '2025-11-06T20:00:00.000Z',
            cwlData: {
              season: '2025-11',
              state: 'inWar',
              clans: [
                { tag: '#2PP', name: 'Best Clan', clanLevel: 15 },
                { tag: '#CLAN2', name: 'Opponent 1', clanLevel: 14 }
              ]
            },
            playerPerformance: [
              {
                playerTag: '#PLAYER1',
                playerName: 'Top Player',
                warsParticipated: 7,
                starsEarned: 18,
                destruction: 650.5,
                avgStars: 2.57
              },
              {
                playerTag: '#PLAYER2',
                playerName: 'Player Two',
                warsParticipated: 6,
                starsEarned: 15,
                destruction: 520.3,
                avgStars: 2.5
              }
            ]
          }
        },
        {
          id: 'get-coc-donation-leaderboard',
          method: 'GET',
          path: '/api/clashofclans/leaderboard/donations/:clanTag',
          summary: 'Get Donation Leaderboard',
          description: 'Get donation leaderboard for a Clash of Clans clan.',
          auth: true,
          params: [
            { name: 'clanTag', type: 'path', required: true, description: 'Clan tag (e.g., 2PP or #2PP)' },
            { name: 'guildId', type: 'query', required: true, description: 'Guild/Server ID' }
          ],
          response: {
            clanTag: '#2PP',
            trackingEnabled: true,
            channelId: '123456789012345678',
            messageId: '987654321098765432',
            threshold: 100,
            schedule: 'weekly',
            scheduledTime: '20:00:00',
            template: '💎 Top donors this week!',
            leaderboard: [
              {
                playerTag: '#PLAYER1',
                playerName: 'Top Donor',
                donations: 2500,
                donationsReceived: 1200,
                townHallLevel: 15,
                role: 'coLeader'
              },
              {
                playerTag: '#PLAYER2',
                playerName: 'Second Donor',
                donations: 2100,
                donationsReceived: 1000,
                townHallLevel: 14,
                role: 'elder'
              }
            ]
          }
        },
        {
          id: 'get-coc-war-leaderboard',
          method: 'GET',
          path: '/api/clashofclans/leaderboard/war/:clanTag',
          summary: 'Get War Performance Leaderboard',
          description: 'Get war performance statistics and leaderboard for a clan.',
          auth: true,
          params: [
            { name: 'clanTag', type: 'path', required: true, description: 'Clan tag (e.g., 2PP or #2PP)' },
            { name: 'guildId', type: 'query', required: true, description: 'Guild/Server ID' }
          ],
          response: {
            clanTag: '#2PP',
            trackingEnabled: true,
            channelId: '123456789012345678',
            messageIds: {
              preparing: '987654321098765432',
              active: '123456789012345678'
            },
            leaderboard: [
              {
                playerTag: '#PLAYER1',
                playerName: 'War Hero',
                warsParticipated: 45,
                warsWon: 32,
                warsLost: 10,
                warsTied: 3,
                attacksMade: 88,
                starsEarned: 210,
                winRate: 71.11,
                avgStars: 2.39,
                avgDestruction: 82.5,
                lastWarDate: '2025-11-06T18:00:00.000Z'
              },
              {
                playerTag: '#PLAYER2',
                playerName: 'Second Best',
                warsParticipated: 40,
                warsWon: 28,
                warsLost: 10,
                warsTied: 2,
                attacksMade: 78,
                starsEarned: 185,
                winRate: 70.0,
                avgStars: 2.37,
                avgDestruction: 80.1,
                lastWarDate: '2025-11-06T18:00:00.000Z'
              }
            ]
          }
        },
        {
          id: 'get-coc-events',
          method: 'GET',
          path: '/api/clashofclans/events',
          summary: 'Get Active CoC Events',
          description: 'Get currently active Clash of Clans in-game events.',
          auth: true,
          params: [
            { name: 'guildId', type: 'query', required: true, description: 'Guild/Server ID' }
          ],
          response: {
            trackingEnabled: true,
            channelId: '123456789012345678',
            messageId: '987654321098765432',
            lastUpdate: '2025-11-07T10:00:00.000Z',
            events: {
              raidWeekend: {
                active: true,
                startTime: '2025-11-01T08:00:00.000Z',
                endTime: '2025-11-04T08:00:00.000Z'
              },
              clanGames: {
                active: false,
                nextStartTime: '2025-11-22T08:00:00.000Z'
              },
              goldPass: {
                active: true,
                endTime: '2025-11-30T08:00:00.000Z'
              }
            }
          }
        },
        {
          id: 'get-coc-members',
          method: 'GET',
          path: '/api/clashofclans/members/:clanTag',
          summary: 'Get Clan Members',
          description: 'Get list of all members in a Clash of Clans clan with their stats.',
          auth: true,
          params: [
            { name: 'clanTag', type: 'path', required: true, description: 'Clan tag (e.g., 2PP or #2PP)' }
          ],
          response: {
            clanTag: '#2PP',
            memberCount: 48,
            members: [
              {
                playerTag: '#PLAYER1',
                playerName: 'Leader Name',
                role: 'leader',
                expLevel: 180,
                league: {
                  id: 29000022,
                  name: 'Legend League'
                },
                trophies: 5200,
                versusTrophies: 3500,
                clanRank: 1,
                previousClanRank: 1,
                donations: 2500,
                donationsReceived: 1200,
                townHallLevel: 15,
                builderHallLevel: 9
              },
              {
                playerTag: '#PLAYER2',
                playerName: 'Co-Leader Name',
                role: 'coLeader',
                expLevel: 175,
                league: {
                  id: 29000021,
                  name: 'Titan League I'
                },
                trophies: 4900,
                versusTrophies: 3200,
                clanRank: 2,
                previousClanRank: 3,
                donations: 2100,
                donationsReceived: 1000,
                townHallLevel: 15,
                builderHallLevel: 9
              }
            ]
          }
        },
        {
          id: 'get-coc-war-attacks',
          method: 'GET',
          path: '/api/clashofclans/war/:clanTag/attacks',
          summary: 'Get War Attack History',
          description: 'Get detailed attack history for a specific war or latest wars.',
          auth: true,
          params: [
            { name: 'clanTag', type: 'path', required: true, description: 'Clan tag (e.g., 2PP or #2PP)' },
            { name: 'guildId', type: 'query', required: true, description: 'Guild/Server ID' },
            { name: 'warId', type: 'query', required: false, description: 'Specific war ID (optional, returns latest if not provided)' }
          ],
          response: {
            clanTag: '#2PP',
            warId: 'latest',
            attacks: [
              {
                warId: 'war_2025110712345',
                playerTag: '#PLAYER1',
                playerName: 'Attacker One',
                townHallLevel: 15,
                mapPosition: 1,
                attacksUsed: 2,
                opponentAttacksReceived: 2,
                attacks: [
                  {
                    defenderTag: '#ENEMY1',
                    stars: 3,
                    destructionPercentage: 100.0
                  },
                  {
                    defenderTag: '#ENEMY2',
                    stars: 2,
                    destructionPercentage: 85.5
                  }
                ],
                totalStars: 5,
                avgDestruction: 92.75,
                warResult: 'win',
                warStartTime: '2025-11-07T10:00:00.000Z',
                warEndTime: '2025-11-08T10:00:00.000Z',
                warState: 'warEnded'
              }
            ]
          }
        },
        {
          id: 'get-youtube-config',
          method: 'GET',
          path: '/api/youtube/config',
          summary: 'Get YouTube Configuration',
          description: 'Get YouTube monitoring configuration for a guild.',
          auth: true,
          params: [
            { name: 'guildId', type: 'query', required: true, description: 'Guild/Server ID' }
          ],
          response: {
            channels: ['UC-lHJZR3Gqxm24_Vd_AJ5Yw', 'UCXuqSBlHAE6Xw-yeJA0Tunw'],
            channelNames: {
              'UC-lHJZR3Gqxm24_Vd_AJ5Yw': 'Linus Tech Tips',
              'UCXuqSBlHAE6Xw-yeJA0Tunw': 'Linus Tech Tips'
            },
            announceChannelId: '123456789012345678',
            uploadAnnounceChannelId: '123456789012345678',
            liveAnnounceChannelId: '987654321098765432',
            mentionRoleId: '111111111111111111',
            mentionTargets: ['@everyone'],
            enabled: true,
            intervalSec: 300,
            embedEnabled: true,
            uploadTemplate: '📹 New video from {channel}: {title}!',
            liveTemplate: '🔴 {channel} is live: {title}!'
          }
        },
        {
          id: 'update-youtube-config',
          method: 'PUT',
          path: '/api/youtube/config',
          summary: 'Update YouTube Configuration',
          description: 'Update YouTube monitoring configuration.',
          auth: true,
          params: [
            { name: 'guildId', type: 'query', required: true, description: 'Guild/Server ID' }
          ],
          headers: [
            { name: 'Content-Type', required: true, description: 'application/json' }
          ],
          body: {
            channels: ['UC-lHJZR3Gqxm24_Vd_AJ5Yw'],
            uploadAnnounceChannelId: '123456789012345678',
            liveAnnounceChannelId: '987654321098765432',
            mentionRoleId: '111111111111111111',
            enabled: true,
            embedEnabled: true
          },
          response: {
            channels: ['UC-lHJZR3Gqxm24_Vd_AJ5Yw'],
            channelNames: { 'UC-lHJZR3Gqxm24_Vd_AJ5Yw': 'Linus Tech Tips' },
            uploadAnnounceChannelId: '123456789012345678',
            liveAnnounceChannelId: '987654321098765432',
            mentionRoleId: '111111111111111111',
            enabled: true,
            embedEnabled: true
          }
        },
        {
          id: 'resolve-youtube-channel',
          method: 'POST',
          path: '/api/youtube/resolve-channel',
          summary: 'Resolve YouTube Channel',
          description: 'Convert YouTube handle/URL to channel ID.',
          auth: true,
          headers: [
            { name: 'Content-Type', required: true, description: 'application/json' }
          ],
          body: {
            input: '@LinusTechTips'
          },
          response: {
            channelId: 'UC-lHJZR3Gqxm24_Vd_AJ5Yw',
            title: 'Linus Tech Tips',
            source: 'scrape'
          }
        },
        {
          id: 'extract-youtube-channel-id',
          method: 'POST',
          path: '/api/youtube/extract-channel-id',
          summary: 'Extract Channel ID',
          description: 'Extract channel ID from various YouTube URL formats.',
          auth: true,
          headers: [
            { name: 'Content-Type', required: true, description: 'application/json' }
          ],
          body: {
            input: 'https://www.youtube.com/@LinusTechTips'
          },
          response: {
            channelId: 'UC-lHJZR3Gqxm24_Vd_AJ5Yw',
            channelName: 'Linus Tech Tips',
            extracted: true
          }
        },
        {
          id: 'get-youtube-latest',
          method: 'GET',
          path: '/api/youtube/service-status',
          summary: 'Get YouTube Service Status',
          description: 'Get YouTube monitoring service status including WebSub and polling stats.',
          auth: true,
          params: [
            { name: 'guildId', type: 'query', required: false, description: 'Optional Guild ID for config context' }
          ],
          response: {
            videoId: 'dQw4w9WgXcQ',
            title: 'Amazing Video Title',
            description: 'Check out this amazing video!',
            publishedAt: '2025-01-01T12:00:00Z',
            thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
            url: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
            channelTitle: 'My Channel',
            viewCount: 1000000,
            likeCount: 50000,
            commentCount: 1000
          }
        },
        {
          id: 'setup-youtube-notifications',
          method: 'POST',
          path: '/api/social/youtube/setup',
          summary: 'Setup YouTube Notifications',
          description: 'Configure YouTube channel notifications for the guild.',
          auth: true,
          headers: [
            { name: 'X-Guild-Id', required: true, description: 'Guild/Server ID' }
          ],
          body: {
            channelId: 'UC-lHJZR3Gqxm24_Vd_AJ5Yw',
            notificationChannelId: '123456789012345678',
            mentionRole: '987654321098765432',
            customMessage: '🎥 New video from {channel}: {title}!'
          },
          response: {
            success: true,
            message: 'YouTube notifications configured successfully',
            config: {
              channelId: 'UC-lHJZR3Gqxm24_Vd_AJ5Yw',
              channelName: 'My Channel',
              enabled: true
            }
          }
        },
        {
          id: 'get-twitch-config',
          method: 'GET',
          path: '/api/twitch/config',
          summary: 'Get Twitch Configuration',
          description: 'Get Twitch stream monitoring configuration for a guild.',
          auth: true,
          params: [
            { name: 'guildId', type: 'query', required: true, description: 'Guild/Server ID' }
          ],
          response: {
            streamers: ['ninja', 'shroud', 'pokimane'],
            streamerNames: {
              'ninja': 'Ninja',
              'shroud': 'shroud',
              'pokimane': 'Pokimane'
            },
            announceChannelId: '123456789012345678',
            mentionRoleId: '111111111111111111',
            mentionTargets: ['@everyone'],
            enabled: true,
            intervalSec: 300,
            embedEnabled: true,
            liveTemplate: '🔴 {streamer} is now live! Playing {game}\\n{title}'
          }
        },
        {
          id: 'update-twitch-config',
          method: 'PUT',
          path: '/api/twitch/config',
          summary: 'Update Twitch Configuration',
          description: 'Update Twitch stream monitoring configuration.',
          auth: true,
          params: [
            { name: 'guildId', type: 'query', required: true, description: 'Guild/Server ID' }
          ],
          headers: [
            { name: 'Content-Type', required: true, description: 'application/json' }
          ],
          body: {
            streamers: ['ninja', 'shroud'],
            announceChannelId: '123456789012345678',
            mentionRoleId: '111111111111111111',
            enabled: true,
            embedEnabled: true
          },
          response: {
            streamers: ['ninja', 'shroud'],
            streamerNames: { 'ninja': 'Ninja', 'shroud': 'shroud' },
            announceChannelId: '123456789012345678',
            mentionRoleId: '111111111111111111',
            enabled: true,
            embedEnabled: true
          }
        },
        {
          id: 'resolve-twitch-streamer',
          method: 'POST',
          path: '/api/twitch/resolve-streamer',
          summary: 'Resolve Twitch Streamer',
          description: 'Convert Twitch URL or username to clean username.',
          auth: true,
          headers: [
            { name: 'Content-Type', required: true, description: 'application/json' }
          ],
          body: {
            input: 'https://www.twitch.tv/ninja'
          },
          response: {
            username: 'ninja',
            displayName: 'Ninja',
            source: 'api'
          }
        },
        {
          id: 'get-twitch-status',
          method: 'GET',
          path: '/api/social/twitch/status',
          summary: 'Get Twitch Stream Status',
          description: 'Get current live status of configured Twitch channel.',
          auth: true,
          params: [
            { name: 'guildId', type: 'query', required: true, description: 'Guild/Server ID' }
          ],
          response: {
            isLive: true,
            streamId: '123456789',
            userId: '987654321',
            userName: 'streamer_name',
            userDisplayName: 'Streamer Name',
            gameId: '32982',
            gameName: 'Grand Theft Auto V',
            title: 'Epic GTA V Stream!',
            viewerCount: 1500,
            startedAt: '2025-01-01T10:00:00Z',
            language: 'en',
            thumbnailUrl: 'https://static-cdn.jtvnw.net/previews-ttv/live_user_streamer_name-{width}x{height}.jpg',
            tags: ['English', 'Roleplay']
          }
        },
        {
          id: 'setup-twitch-notifications',
          method: 'POST',
          path: '/api/social/twitch/setup',
          summary: 'Setup Twitch Notifications',
          description: 'Configure Twitch stream notifications for the guild.',
          auth: true,
          headers: [
            { name: 'X-Guild-Id', required: true, description: 'Guild/Server ID' }
          ],
          body: {
            twitchUsername: 'streamer_name',
            notificationChannelId: '123456789012345678',
            mentionRole: '987654321098765432',
            customMessage: '🔴 {streamer} is now live! Playing {game}\\n{title}'
          },
          response: {
            success: true,
            message: 'Twitch notifications configured successfully',
            config: {
              twitchUsername: 'streamer_name',
              twitchUserId: '987654321',
              enabled: true
            }
          }
        },
        {
          id: 'get-valorant-config',
          method: 'GET',
          path: '/api/valorant/config',
          summary: 'Get Valorant Configuration',
          description: 'Get Valorant player tracking configuration for a guild.',
          auth: true,
          params: [
            { name: 'guildId', type: 'query', required: true, description: 'Guild/Server ID' }
          ],
          response: {
            players: ['player1#NA1', 'player2#EUW'],
            playerNames: {
              'player1#NA1': 'PlayerOne',
              'player2#EUW': 'PlayerTwo'
            },
            playerRegions: {
              'player1#NA1': 'na',
              'player2#EUW': 'eu'
            },
            matchAnnounceChannelId: '123456789012345678',
            rankAnnounceChannelId: '987654321098765432',
            achievementAnnounceChannelId: '111111111111111111',
            enabled: true,
            trackMatches: true,
            trackRankChanges: true,
            trackAchievements: true,
            intervalSec: 600,
            embedEnabled: true
          }
        },
        {
          id: 'update-valorant-config',
          method: 'PUT',
          path: '/api/valorant/config',
          summary: 'Update Valorant Configuration',
          description: 'Update Valorant player tracking configuration.',
          auth: true,
          params: [
            { name: 'guildId', type: 'query', required: true, description: 'Guild/Server ID' }
          ],
          headers: [
            { name: 'Content-Type', required: true, description: 'application/json' }
          ],
          body: {
            players: ['player1#NA1'],
            matchAnnounceChannelId: '123456789012345678',
            rankAnnounceChannelId: '987654321098765432',
            trackMatches: true,
            trackRankChanges: true,
            enabled: true
          },
          response: {
            players: ['player1#NA1'],
            playerNames: { 'player1#NA1': 'PlayerOne' },
            playerRegions: { 'player1#NA1': 'na' },
            matchAnnounceChannelId: '123456789012345678',
            rankAnnounceChannelId: '987654321098765432',
            enabled: true,
            trackMatches: true,
            trackRankChanges: true
          }
        },
        {
          id: 'get-valorant-account',
          method: 'GET',
          path: '/api/valorant/account/:name/:tag',
          summary: 'Get Valorant Account',
          description: 'Get Valorant account information by Riot ID.',
          auth: true,
          params: [
            { name: 'name', type: 'path', required: true, description: 'Riot ID name' },
            { name: 'tag', type: 'path', required: true, description: 'Riot ID tag (e.g., NA1)' }
          ],
          response: {
            name: 'PlayerName',
            tag: 'NA1',
            puuid: 'abc123-def456-ghi789',
            region: 'na',
            account_level: 150,
            card: {
              small: 'https://...',
              large: 'https://...',
              wide: 'https://...',
              id: 'card_id'
            }
          }
        },
        {
          id: 'get-valorant-mmr',
          method: 'GET',
          path: '/api/valorant/mmr/:region/:name/:tag',
          summary: 'Get Valorant MMR/Rank',
          description: 'Get Valorant MMR and rank information.',
          auth: true,
          params: [
            { name: 'region', type: 'path', required: true, description: 'Region (na, eu, ap, kr)' },
            { name: 'name', type: 'path', required: true, description: 'Riot ID name' },
            { name: 'tag', type: 'path', required: true, description: 'Riot ID tag' }
          ],
          response: {
            currenttier: 21,
            currenttierpatched: 'Diamond 1',
            ranking_in_tier: 45,
            mmr_change_to_last_game: 25,
            elo: 2145,
            games_needed_for_rating: 0,
            old: false
          }
        },
        {
          id: 'get-valorant-matches',
          method: 'GET',
          path: '/api/valorant/matches/:region/:name/:tag',
          summary: 'Get Valorant Match History',
          description: 'Get recent Valorant matches for a player.',
          auth: true,
          params: [
            { name: 'region', type: 'path', required: true, description: 'Region (na, eu, ap, kr)' },
            { name: 'name', type: 'path', required: true, description: 'Riot ID name' },
            { name: 'tag', type: 'path', required: true, description: 'Riot ID tag' },
            { name: 'mode', type: 'query', required: false, description: 'Game mode filter' },
            { name: 'size', type: 'query', required: false, description: 'Number of matches (max 20)' }
          ],
          response: [
            {
              metadata: {
                matchid: 'match-id-123',
                map: 'Ascent',
                game_start_patched: 'Nov 7, 2025 at 12:00 PM',
                rounds_played: 24,
                mode: 'Competitive',
                queue: 'competitive'
              },
              players: {
                all_players: [],
                red: [],
                blue: []
              },
              teams: {
                red: { has_won: true, rounds_won: 13, rounds_lost: 11 },
                blue: { has_won: false, rounds_won: 11, rounds_lost: 13 }
              }
            }
          ]
        },
        {
          id: 'get-valorant-news',
          method: 'GET',
          path: '/api/social/valorant/news',
          summary: 'Get Valorant News',
          description: 'Get latest Valorant news and updates.',
          auth: true,
          params: [
            { name: 'limit', type: 'query', required: false, description: 'Number of news items (default: 5)' }
          ],
          response: {
            news: [
              {
                id: '1',
                title: 'New Agent Released: Clove',
                description: 'Meet Clove, the latest controller agent...',
                url: 'https://playvalorant.com/news/clove',
                imageUrl: 'https://playvalorant.com/assets/clove.jpg',
                publishedAt: '2025-01-01T00:00:00Z',
                category: 'agents'
              }
            ]
          }
        },
        {
          id: 'get-valorant-shop',
          method: 'GET',
          path: '/api/social/valorant/shop/:userId',
          summary: 'Get Valorant Daily Shop',
          description: 'Get daily shop rotation for a Valorant account.',
          auth: true,
          params: [
            { name: 'userId', type: 'path', required: true, description: 'Discord User ID linked to Riot account' }
          ],
          response: {
            shopDate: '2025-01-01',
            skins: [
              {
                uuid: 'abc-123',
                displayName: 'Reaver Vandal',
                cost: 1775,
                rarity: 'Premium',
                imageUrl: 'https://valorant-api.com/assets/weaponskins/abc-123.png'
              }
            ],
            nightMarket: null,
            lastUpdated: '2025-01-01T00:00:00Z'
          }
        },
        {
          id: 'get-reddit-posts',
          method: 'GET',
          path: '/api/social/reddit/:subreddit',
          summary: 'Get Reddit Posts',
          description: 'Get latest posts from a subreddit.',
          auth: true,
          params: [
            { name: 'subreddit', type: 'path', required: true, description: 'Subreddit name (without r/)' },
            { name: 'limit', type: 'query', required: false, description: 'Number of posts (default: 10)' },
            { name: 'sort', type: 'query', required: false, description: 'Sort by: hot, new, top (default: hot)' }
          ],
          response: {
            subreddit: 'discordapp',
            posts: [
              {
                id: 't3_abc123',
                title: 'Amazing Discord Bot Feature!',
                author: 'reddit_user',
                score: 500,
                numComments: 25,
                url: 'https://reddit.com/r/discordapp/comments/abc123',
                permalink: '/r/discordapp/comments/abc123',
                createdUtc: 1704067200,
                thumbnail: 'https://...',
                selftext: 'Post content here...',
                isVideo: false
              }
            ]
          }
        },
        {
          id: 'get-twitter-timeline',
          method: 'GET',
          path: '/api/social/twitter/timeline/:username',
          summary: 'Get Twitter Timeline',
          description: 'Get recent tweets from a Twitter user.',
          auth: true,
          params: [
            { name: 'username', type: 'path', required: true, description: 'Twitter username (without @)' },
            { name: 'limit', type: 'query', required: false, description: 'Number of tweets (default: 10)' }
          ],
          response: {
            username: 'discord',
            tweets: [
              {
                id: '1234567890123456789',
                text: 'Exciting announcement! 🎉',
                createdAt: '2025-01-01T12:00:00Z',
                likes: 5000,
                retweets: 1000,
                replies: 200,
                url: 'https://twitter.com/discord/status/1234567890123456789',
                media: [
                  {
                    type: 'photo',
                    url: 'https://pbs.twimg.com/media/...'
                  }
                ]
              }
            ]
          }
        }
      ]
    }
  ];

  // Filter to show only GET endpoints
  const filteredApiCategories = apiCategories
    .map(category => ({
      ...category,
      endpoints: category.endpoints.filter(endpoint => endpoint.method === 'GET')
    }))
    .filter(category => category.endpoints.length > 0); // Remove empty categories

  // Get current category and endpoint
  const currentCategory = filteredApiCategories.find(cat => cat.id === selectedCategory);
  const currentEndpoint = currentCategory?.endpoints.find(ep => ep.id === selectedEndpoint);

  // Initialize test request when endpoint changes
  useEffect(() => {
    if (currentEndpoint) {
      setTestRequest({
        method: currentEndpoint.method,
        headers: currentEndpoint.headers?.reduce((acc, h) => {
          acc[h.name] = h.name === 'X-Guild-Id' ? guildId || '' : '';
          return acc;
        }, {}) || {},
        body: currentEndpoint.body ? JSON.stringify(currentEndpoint.body, null, 2) : '',
        params: currentEndpoint.params?.reduce((acc, p) => {
          if (p.type === 'query') {
            acc[p.name] = p.name === 'guildId' ? guildId || '' : '';
          }
          return acc;
        }, {}) || {},
        pathParams: {} // Initialize path parameters
      });
      setTestResponse(null);
      setShowResponseExample(false); // Collapse response example when changing endpoints
    }
  }, [selectedEndpoint, guildId]); // Only depend on the IDs, not the object references

  // Test API endpoint
  const testEndpoint = async () => {
    if (!currentEndpoint) return;

    setIsTestLoading(true);
    setTestResponse(null);

    try {
      // Build URL - replace path parameters first
      let url = currentEndpoint.path;
      
      console.log('Testing endpoint:', {
        endpoint: currentEndpoint.path,
        method: currentEndpoint.method,
        params: testRequest.params,
        pathParams: testRequest.pathParams
      });
      
      // Replace path parameters (e.g., :clanTag, :name, :tag)
      if (testRequest.pathParams) {
        Object.entries(testRequest.pathParams).forEach(([key, value]) => {
          if (value) {
            url = url.replace(`:${key}`, encodeURIComponent(value));
          }
        });
      }
      
      // Add query parameters (robustly, only once)
      const queryParams = new URLSearchParams();
      Object.entries(testRequest.params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && String(value).length > 0) {
          queryParams.append(key, value);
        }
      });

      if (queryParams.toString()) {
        url += (url.includes('?') ? '&' : '?') + queryParams.toString();
      }

      console.log('Final URL:', url);

      // Prepare headers
      const headers = {
        'Content-Type': 'application/json',
        ...testRequest.headers
      };

      // Add auth header if required
      if (currentEndpoint.auth) {
        const token = localStorage.getItem('token');
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      }

      // Prepare fetch options
      const options = {
        method: testRequest.method,
        headers
      };

      // Add body for POST/PUT/PATCH
      if (['POST', 'PUT', 'PATCH'].includes(testRequest.method) && testRequest.body) {
        options.body = testRequest.body;
      }

      // Make request
      const response = await fetch(url, options);
      const contentType = response.headers.get('content-type');
      
      let responseData;
      if (contentType && contentType.includes('application/json')) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }

      console.log('API Response:', {
        url,
        status: response.status,
        statusText: response.statusText,
        contentType,
        data: responseData
      });

      setTestResponse({
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        data: responseData
      });

      if (response.ok) {
        pushToast('success', t('apiDocs.toasts.apiSuccess'));
      } else {
        pushToast('error', `${t('apiDocs.toasts.apiFailed')}: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      setTestResponse({
        status: 0,
        statusText: 'Network Error',
        error: error.message
      });
      pushToast('error', `${t('apiDocs.toasts.requestFailed')}: ${error.message}`);
    } finally {
      setIsTestLoading(false);
    }
  };

  // Copy response JSON/text to clipboard
  const handleCopyResponse = async () => {
    try {
      if (!testResponse) return;
      const payload = (testResponse.data !== undefined && testResponse.data !== null)
        ? (typeof testResponse.data === 'string'
            ? testResponse.data
            : JSON.stringify(testResponse.data, null, 2))
        : (testResponse.error
            ? (typeof testResponse.error === 'string' ? testResponse.error : JSON.stringify(testResponse.error, null, 2))
            : '');
      await navigator.clipboard.writeText(payload);
      pushToast && pushToast('success', t('apiDocs.toasts.copied'));
    } catch (err) {
      pushToast && pushToast('error', `${t('apiDocs.toasts.copyFailed')}: ${err.message || err}`);
    }
  };

  return (
    <div className="api-docs-section">
      {/* Access Control Check */}
      {!hasAccess ? (
        <div className="container mt-5">
          <div className="row justify-content-center">
            <div className="col-lg-6">
              <div className="card border-danger shadow-lg access-denied-card">
                <div className="card-header bg-danger text-white">
                  <h4 className="mb-0">
                    <i className="fa-solid fa-shield-halved me-2"></i>
                    {t('apiDocs.accessDenied.title')}
                  </h4>
                </div>
                <div className="card-body text-center py-5">
                  <i className="fa-solid fa-ban text-danger mb-3" style={{ fontSize: '4rem' }}></i>
                  <h5 className="mb-3">{t('apiDocs.accessDenied.restricted')}</h5>
                  <p className="text-muted mb-4">
                    {t('apiDocs.accessDenied.onlyAuthorized')}
                  </p>
                  <div className="alert alert-warning" role="alert">
                    <i className="fa-solid fa-exclamation-triangle me-2"></i>
                    <strong>{t('apiDocs.accessDenied.currentServerId')}</strong> {guildId || t('common.none')}
                  </div>
                  <p className="small text-muted mb-0">
                    {t('apiDocs.accessDenied.contactAdmin')}
                  </p>
                </div>
                <div className="card-footer text-center access-denied-footer">
                  <small className="text-muted">
                    <i className="fa-solid fa-info-circle me-1"></i>
                    {t('apiDocs.accessDenied.footerNote')}
                  </small>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="mb-1">
            <i className="fa-solid fa-book me-2"></i>
            {t('apiDocs.title')}
          </h2>
          <p className="text-muted mb-0">
            {t('apiDocs.subtitle')}
          </p>
        </div>
        <div className="d-flex gap-2">
          <a
            href="/docs/API_DOCUMENTATION.md"
            target="_blank"
            className="btn btn-outline-primary"
          >
            <i className="fa-solid fa-file-lines me-2"></i>
            {t('apiDocs.fullDocs')}
          </a>
          <a
            href="/docs/Discord_Bot_API.postman_collection.json"
            download
            className="btn btn-outline-secondary"
          >
            <i className="fa-solid fa-download me-2"></i>
            {t('apiDocs.postmanCollection')}
          </a>
        </div>
      </div>

      <div className="row">
        {/* Category Sidebar */}
        <div className="col-lg-3 mb-4">
          <div className="card shadow-sm">
            <div className="card-header api-docs-header text-white">
              <h6 className="mb-0">
                <i className="fa-solid fa-list me-2"></i>
                {t('apiDocs.categories')}
              </h6>
            </div>
            <div className="list-group list-group-flush">
              {filteredApiCategories.map(category => (
                <button
                  key={category.id}
                  className={`list-group-item list-group-item-action ${selectedCategory === category.id ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedCategory(category.id);
                    setSelectedEndpoint(null);
                  }}
                >
                  <i className={`fa-solid ${category.icon} me-2`}></i>
                  {getCategoryLabel(category)}
                  <span className="badge bg-secondary float-end">
                    {category.endpoints.length}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="card shadow-sm mt-3">
            <div className="card-body">
              <h6 className="card-subtitle mb-2 text-muted">{t('apiDocs.stats.title')}</h6>
              <div className="d-flex justify-content-between mb-2">
                <span>{t('apiDocs.stats.totalEndpoints')}</span>
                <strong>{filteredApiCategories.reduce((sum, cat) => sum + cat.endpoints.length, 0)}</strong>
              </div>
              <div className="d-flex justify-content-between mb-2">
                <span>{t('apiDocs.stats.categories')}</span>
                <strong>{filteredApiCategories.length}</strong>
              </div>
              <div className="d-flex justify-content-between">
                <span>{t('apiDocs.stats.baseUrl')}</span>
                <code className="small">https://chocomaid.xyz/api</code>
              </div>
            </div>
          </div>
        </div>

        {/* Endpoints List */}
        <div className="col-lg-4 mb-4">
          <div className="card shadow-sm" style={{ maxHeight: '800px', overflowY: 'auto' }}>
            <div className="card-header api-docs-header text-white">
              <h6 className="mb-0">
                <i className={`fa-solid ${currentCategory?.icon} me-2`}></i>
                {t('apiDocs.endpointsHeader', { name: getCategoryLabel(currentCategory) })}
              </h6>
            </div>
            <div className="list-group list-group-flush">
              {currentCategory?.endpoints.map(endpoint => (
                <button
                  key={endpoint.id}
                  className={`list-group-item list-group-item-action ${selectedEndpoint === endpoint.id ? 'active' : ''}`}
                  onClick={() => setSelectedEndpoint(endpoint.id)}
                >
                  <div className="d-flex justify-content-between align-items-start">
                    <div className="flex-grow-1">
                      <div className="d-flex align-items-center mb-1">
                        <span className={`badge me-2 ${
                          endpoint.method === 'GET' ? 'bg-success' :
                          endpoint.method === 'POST' ? 'bg-primary' :
                          endpoint.method === 'PUT' ? 'bg-warning' :
                          endpoint.method === 'DELETE' ? 'bg-danger' : 'bg-secondary'
                        }`}>
                          {endpoint.method}
                        </span>
                        <strong className="small">{endpoint.summary}</strong>
                      </div>
                      <code className="small text-muted d-block" style={{ fontSize: '0.75rem' }}>
                        {endpoint.path}
                      </code>
                    </div>
                    {endpoint.auth && (
                      <i className="fa-solid fa-lock text-warning ms-2" title={t('apiDocs.tooltips.requiresAuth')}></i>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Endpoint Details & Testing */}
        <div className="col-lg-5">
          {currentEndpoint ? (
            <div className="card shadow-sm">
              <div className="card-header api-docs-header text-white">
                <h6 className="mb-0">
                  <span className={`badge me-2 ${
                    currentEndpoint.method === 'GET' ? 'bg-success' :
                    currentEndpoint.method === 'POST' ? 'bg-primary' :
                    currentEndpoint.method === 'PUT' ? 'bg-warning' :
                    currentEndpoint.method === 'DELETE' ? 'bg-danger' : 'bg-secondary'
                  }`}>
                    {currentEndpoint.method}
                  </span>
                  {currentEndpoint.summary}
                </h6>
              </div>
              <div className="card-body" style={{ maxHeight: '700px', overflowY: 'auto' }}>
                {/* Description */}
                <p className="text-muted">{currentEndpoint.description}</p>

                {/* Path */}
                <div className="mb-3">
                  <label className="form-label fw-bold">{t('apiDocs.endpointLabel')}</label>
                  <code className="d-block p-2 border rounded endpoint-path">{currentEndpoint.path}</code>
                </div>

                {/* Authentication */}
                {currentEndpoint.auth && (
                  <div className="alert auth-required-alert mb-3">
                    <i className="fa-solid fa-lock me-2"></i>
                    <strong>{t('apiDocs.authRequired.title')}</strong>
                    <p className="mb-0 small mt-1">
                      {t('apiDocs.authRequired.desc')}
                    </p>
                  </div>
                )}

                {/* Parameters */}
                {currentEndpoint.params && currentEndpoint.params.length > 0 && (
                  <div className="mb-3">
                    <label className="form-label fw-bold">{t('apiDocs.parameters')}</label>
                    <div className="table-responsive">
                      <table className="table table-sm table-bordered api-table">
                        <thead>
                          <tr>
                            <th>{t('apiDocs.table.name')}</th>
                            <th>{t('apiDocs.table.type')}</th>
                            <th>{t('apiDocs.table.required')}</th>
                            <th>{t('apiDocs.table.description')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {currentEndpoint.params.map((param, idx) => (
                            <tr key={idx}>
                              <td><code>{param.name}</code></td>
                              <td><span className="badge bg-secondary">{param.type}</span></td>
                              <td>{param.required ? <span className="text-danger">✓</span> : '-'}</td>
                              <td className="small">{param.description}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Headers */}
                {currentEndpoint.headers && currentEndpoint.headers.length > 0 && (
                  <div className="mb-3">
                    <label className="form-label fw-bold">{t('apiDocs.headers')}</label>
                    <div className="table-responsive">
                      <table className="table table-sm table-bordered api-table">
                        <thead>
                          <tr>
                            <th>{t('apiDocs.table.name')}</th>
                            <th>{t('apiDocs.table.required')}</th>
                            <th>{t('apiDocs.table.description')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {currentEndpoint.headers.map((header, idx) => (
                            <tr key={idx}>
                              <td><code>{header.name}</code></td>
                              <td>{header.required ? <span className="text-danger">✓</span> : '-'}</td>
                              <td className="small">{header.description}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Request Body Example */}
                {currentEndpoint.body && (
                  <div className="mb-3">
                    <label className="form-label fw-bold">{t('apiDocs.requestBodyExample')}</label>
                    <pre className="border rounded p-2 small">
                      <code>{JSON.stringify(currentEndpoint.body, null, 2)}</code>
                    </pre>
                  </div>
                )}

                {/* Response Example - Collapsible */}
                {currentEndpoint.response && (
                  <div className="mb-3">
                    <button
                      className="btn btn-link p-0 text-decoration-none d-flex align-items-center w-100"
                      onClick={() => setShowResponseExample(!showResponseExample)}
                      type="button"
                    >
                      <i className={`fa-solid fa-chevron-${showResponseExample ? 'down' : 'right'} me-2 text-muted`}></i>
                      <label className="form-label fw-bold mb-0 cursor-pointer">{t('apiDocs.responseExample')}</label>
                    </button>
                    {showResponseExample && (
                      <pre className="border rounded p-2 small mt-2">
                        <code>{JSON.stringify(currentEndpoint.response, null, 2)}</code>
                      </pre>
                    )}
                  </div>
                )}

                {/* Interactive Testing */}
                <div className="border-top pt-3 mt-4">
                  <h6 className="mb-3">
                    <i className="fa-solid fa-vial me-2"></i>
                    {t('apiDocs.testTitle')}
                  </h6>

                  {/* Path Parameters */}
                  {currentEndpoint.params?.filter(p => p.type === 'path').length > 0 && (
                    <div className="mb-3">
                      <label className="form-label small fw-bold">{t('apiDocs.pathParams')}</label>
                      {currentEndpoint.params.filter(p => p.type === 'path').map(param => (
                        <div key={param.name} className="mb-2">
                          <label className="form-label small">
                            {param.name} {param.required && <span className="text-danger">*</span>}
                          </label>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            value={testRequest.pathParams?.[param.name] || ''}
                            onChange={(e) => setTestRequest(prev => ({
                              ...prev,
                              pathParams: { ...prev.pathParams, [param.name]: e.target.value }
                            }))}
                            placeholder={param.description}
                          />
                          <small className="text-muted">{param.description}</small>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Query Parameters */}
                  {currentEndpoint.params?.filter(p => p.type === 'query').length > 0 && (
                    <div className="mb-3">
                      <label className="form-label small fw-bold">{t('apiDocs.queryParams')}</label>
                      {currentEndpoint.params.filter(p => p.type === 'query').map(param => (
                        <div key={param.name} className="mb-2">
                          <label className="form-label small">{param.name}</label>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            value={testRequest.params[param.name] || ''}
                            onChange={(e) => setTestRequest(prev => ({
                              ...prev,
                              params: { ...prev.params, [param.name]: e.target.value }
                            }))}
                            placeholder={param.description}
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Custom Headers */}
                  {currentEndpoint.headers && (
                    <div className="mb-3">
                      <label className="form-label small fw-bold">{t('apiDocs.headers')}</label>
                      {currentEndpoint.headers.map(header => (
                        <div key={header.name} className="mb-2">
                          <label className="form-label small">{header.name}</label>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            value={testRequest.headers[header.name] || ''}
                            onChange={(e) => setTestRequest(prev => ({
                              ...prev,
                              headers: { ...prev.headers, [header.name]: e.target.value }
                            }))}
                            placeholder={header.description}
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Request Body */}
                  {['POST', 'PUT', 'PATCH'].includes(currentEndpoint.method) && (
                    <div className="mb-3">
                      <label className="form-label small fw-bold">{t('apiDocs.requestBody')}</label>
                      <textarea
                        className="form-control form-control-sm font-monospace"
                        rows="6"
                        value={testRequest.body}
                        onChange={(e) => setTestRequest(prev => ({ ...prev, body: e.target.value }))}
                        placeholder="Enter JSON request body..."
                      />
                    </div>
                  )}

                  {/* Send Request Button */}
                  <button
                    className="btn btn-primary w-100"
                    onClick={testEndpoint}
                    disabled={isTestLoading}
                  >
                    {isTestLoading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2"></span>
                        {t('apiDocs.sending')}
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-paper-plane me-2"></i>
                        {t('apiDocs.send')}
                      </>
                    )}
                  </button>

                  {/* Response */}
                  {testResponse && (
                    <div className="mt-3">
                      <div className="d-flex justify-content-between align-items-center">
                        <label className="form-label small fw-bold mb-0">{t('apiDocs.response')}</label>
                        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={handleCopyResponse} title={t('apiDocs.tooltips.copyResponse')}>
                          <i className="fa-regular fa-copy me-1"></i>
                          {t('apiDocs.copy')}
                        </button>
                      </div>
                      <div className={`alert ${testResponse.status >= 200 && testResponse.status < 300 ? 'alert-success' : 'alert-danger'} mb-2`}>
                        <strong>{t('apiDocs.status')}</strong> {testResponse.status} {testResponse.statusText}
                      </div>
                      <pre className="border rounded p-2 small" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                        <code>{JSON.stringify(testResponse.data || testResponse.error, null, 2)}</code>
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="card shadow-sm">
              <div className="card-body text-center py-5">
                <i className="fa-solid fa-hand-pointer fa-3x text-muted mb-3"></i>
                <h5 className="text-muted">{t('apiDocs.selectEndpointTitle')}</h5>
                <p className="text-muted">{t('apiDocs.selectEndpointHelp')}</p>
              </div>
            </div>
          )}
        </div>
      </div>
      </>
      )}
    </div>
  );
}
