const { explainImage } = require('../../utils/ai-client');
const { sendLongReply } = require('../../utils/util');
const { checkCommandAndReply } = require('../../utils/validation');
const { withCommandLogging } = require('../../config/store/middleware/commandLogging');
const axios = require('axios');

function setupInteractionCreateHandler(client, store, startTimestamp, commandMap) {
  // Message context menus: Explain Image, Summarize
  client.on('interactionCreate', async (interaction) => {
    if (interaction.isMessageContextMenuCommand()) {
      await handleContextMenuCommand(interaction, store);
    } else if (interaction.isChatInputCommand()) {
      await handleChatInputCommand(interaction, client, store, commandMap);
    } else if (interaction.isStringSelectMenu()) {
      if (interaction.customId === 'help_select') {
        await handleHelpSelect(interaction);
      } else if (interaction.customId.startsWith('role_menu_')) {
        await handleRoleMenuSelect(interaction);
      } else if (interaction.customId.startsWith('cwl_player_select_')) {
        // Handle CWL player select menu
        const cwlHandler = require('../handlers/cwlInteractionHandler');
        try {
          await cwlHandler.handleCWLSelectMenuInteraction(interaction);
        } catch (error) {
          console.error('CWL select menu error:', error);
        }
      }
    } else if (interaction.isButton()) {
      await handleButtonInteraction(interaction, client, commandMap);
    }
  });
}

async function handleContextMenuCommand(interaction, store) {
  if (interaction.commandName === 'Explain Image') {
    const msg = interaction.targetMessage;
    let imgAtt = null;
    
    if (msg.attachments && msg.attachments.size) {
      imgAtt = Array.from(msg.attachments.values()).find(att => 
        (att.contentType && att.contentType.startsWith('image/')) || 
        /\.(png|jpe?g|gif)$/i.test(att.url)
      );
    }
    
    if (!imgAtt) {
      await interaction.reply({ content: 'No image found in the selected message.', flags: 64 });
      return;
    }
    
    await interaction.deferReply();
    
    try {
      const explanation = await explainImage(imgAtt.url);
      let fileBuffer = null;
      let filename = 'image';
      
      try {
        const resp = await axios.get(imgAtt.url, { responseType: 'arraybuffer' });
        fileBuffer = Buffer.from(resp.data);
        if (fileBuffer.length > 7_500_000) fileBuffer = null;
        
        const extMatch = imgAtt.url.split('?')[0].match(/\.([a-zA-Z0-9]{3,5})$/);
        if (extMatch) filename += '.' + extMatch[1].toLowerCase(); 
        else filename += '.png';
      } catch (e) {
        console.warn('Could not fetch image for re-upload, falling back to embed URL');
      }
      
      const chunks = [];
      let remaining = explanation || '';
      const MAX_EMBED_DESC = 4000;
      
      while (remaining.length > 0) { 
        chunks.push(remaining.slice(0, MAX_EMBED_DESC)); 
        remaining = remaining.slice(MAX_EMBED_DESC); 
      }
      
      const first = chunks.shift() || 'No explanation.';
      const embedImageRef = fileBuffer ? 
        { url: `attachment://${filename}` } : { url: imgAtt.url };
      
      await interaction.editReply({
        embeds: [{ 
          title: 'Image Explanation', 
          description: first, 
          image: embedImageRef, 
          color: 0x5865F2 
        }],
        files: fileBuffer ? [{ attachment: fileBuffer, name: filename }] : []
      });
      
      for (const part of chunks) {
        await interaction.followUp({ content: part });
      }
    } catch (e) {
      console.error('Image explain failed (context menu)', e);
      await interaction.editReply({ content: 'Image explain failed.', flags: 64 });
    }
    
  } else if (interaction.commandName === 'Summarize') {
    await interaction.deferReply();
    
    try {
      const target = interaction.targetMessage;
      const channel = target.channel;
      
      const [before, after] = await Promise.all([
        channel.messages.fetch({ before: target.id, limit: 35 }).catch(() => new Map()),
        channel.messages.fetch({ after: target.id, limit: 35 }).catch(() => new Map())
      ]);
      
      const combined = [...before.values(), target, ...after.values()]
        .filter(m => !m.author.bot)
        .sort((a, b) => a.createdTimestamp - b.createdTimestamp);
      
      function isNoise(content) {
        const c = (content || '').trim();
        if (!c) return true;
        if (c.startsWith('/')) return true;
        if (/^m!\S+/.test(c)) return true;
        if (/^[!./]\w+$/.test(c)) return true;
        if (/^[a-zA-Z]$/.test(c)) return true;
        if (/^\w{1,3}$/i.test(c) && !/^(yes|no|ok)$/i.test(c)) return true;
        if (c.length <= 2) return true;
        return false;
      }
      
      const filtered = combined.filter(m => !isNoise(m.cleanContent));
      const targetIdx = filtered.findIndex(m => m.id === target.id);
      const windowMsgs = filtered.slice(Math.max(0, targetIdx - 15), targetIdx + 16);
      const noiseCount = combined.length - filtered.length;
      
      const convo = windowMsgs.map(m => `${m.author.username}: ${m.cleanContent}`)
        .join('\n')
        .slice(0, 7000);
      
      if (!convo) { 
        await interaction.editReply('Not enough meaningful content to summarize.'); 
        return; 
      }
      
      const numbered = process.env.SUMMARY_NUMBER_SECTIONS === '1';
      const prompt = numbered
        ? `Summarize this Discord chat excerpt around a highlighted message. Provide:\n1. Overview (1 sentence)\n2. Key Points (bulleted)\n3. Action Items (bulleted or 'None')\nDo not invent facts. If it's mostly a single creative post, capture tone and content succinctly. NoiseFiltered: ${noiseCount}\nCHAT:\n${convo}`
        : `Summarize this Discord chat excerpt around a highlighted message. Provide the following sections (without numbering):\nOverview: one concise sentence.\nKey Points: bullet list (use - ).\nAction Items: bullet list or 'None'.\nDo not invent facts. If it's mostly a single creative post, capture tone and content succinctly. NoiseFiltered: ${noiseCount}\nCHAT:\n${convo}`;
      
      const { askGemini } = require('../../utils/ai-client');
      const { formatAIOutput } = require('../../utils/util');
      const resp = await askGemini(prompt, { maxOutputTokens: 260 });
      const summary = formatAIOutput(resp.text || 'No summary');
      
      await sendLongReply(interaction, summary);
    } catch(e) {
      console.error('Context menu summarize failed', e);
      try { 
        await interaction.editReply({ content: 'Summarization failed.', flags: 64 }); 
      } catch {}
    }
    
  } else if (interaction.commandName === 'Translate') {
    await interaction.deferReply();
    
    try {
      const target = interaction.targetMessage;
      let content = (target.cleanContent || '').trim();
      
      // If no raw text content, attempt to extract from first embed description
      if (!content && Array.isArray(target.embeds) && target.embeds.length) {
        for (const emb of target.embeds) {
          if (emb && emb.description) { 
            content = (emb.description || '').trim(); 
            if (content) break; 
          }
        }
      }
      
      if (!content) { 
        await interaction.editReply('No text content to translate.'); 
        return; 
      }
      
      // Simple heuristic: let model auto-detect source. Default target language can be English.
      const targetLang = 'ID';
      const prompt = `Detect the language of the following text and translate it into ${targetLang}. Only output the translation text without extra commentary.\n\nText:\n"""${content.slice(0, 1500)}"""`;
      
      const { askGemini } = require('../../utils/ai-client');
      const { formatAIOutput } = require('../../utils/util');
      const resp = await askGemini(prompt, { maxOutputTokens: 150 });
      const translation = formatAIOutput(resp.text || 'No translation');
      
      await sendLongReply(interaction, translation);
    } catch (e) {
      console.error('Context menu translate failed', e);
      try { 
        await interaction.editReply({ content: 'Translation failed.', flags: 64 }); 
      } catch {}
    }
  }
}

async function handleChatInputCommand(interaction, client, store, commandMap) {
  const cmd = commandMap.get(interaction.commandName);
  if (!cmd) {
    console.log(`Command not found in map: ${interaction.commandName}. Available commands:`, Array.from(commandMap.keys()));
    return interaction.reply({ content: 'Unknown command (not loaded).' });
  }

  // Guild-level slash command master toggle
  try {
    const guildId = interaction.guildId;
    if (guildId) {
      const gs = await store.getGuildSettings(guildId);
      if (gs && gs.slashCommandsEnabled === false) {
        return interaction.reply({ 
          content: 'Slash commands are disabled for this server by an administrator.'
        });
      }
    }
  } catch {}

  // Use new validation system for command toggles
  const canExecute = await checkCommandAndReply(interaction, interaction.commandName, store, false);
  if (!canExecute) {
    return; // Command is disabled, validation already sent the response
  }

  // Track command usage
  try {
    store.trackCommandUsage(interaction.commandName, interaction.guildId);
  } catch(trackErr) {
    console.warn('Failed to track command usage:', trackErr);
  }

  try { 
    // Wrap command execution with automatic logging
    const loggedExecute = withCommandLogging(cmd.execute, { 
      name: interaction.commandName,
      category: getCategoryForCommand(interaction.commandName)
    });
    await loggedExecute(interaction, store); 
  } catch (e) {
    console.error(`Command error for ${interaction.commandName}:`, e);
    
    // Track command errors
    try {
      store.trackError(e, `Command: ${interaction.commandName}`);
    } catch(trackErr) {
      console.warn('Failed to track command error:', trackErr);
    }
    
    // Try to respond with error message
    try { 
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply('Command failed.');
      } else if (interaction.deferred) {
        await interaction.editReply('Command failed.');
      }
    } catch (replyError) {
      console.error('Failed to send error reply:', replyError);
    }
  }
}

async function handleHelpSelect(interaction) {
  const value = interaction.values[0];
  
  const categories = {
    core: '**Core**\n/ping\n/whoami\n/uptime\n/echo <text>\n/help',
    ai: '**AI**\n/ask\n/askfollow\n/explain_image (1-3 images)\n/summarize [count]\n/translate text target',
    polls: '**Polls**\n/poll create question options\n/poll results id',
    util: '**Utilities**\n/user info [target]\n/math add|sub|mul|div a b\n/remind minutes text',
    manage: '**Management (Requires Manage Server)**\n/ytstats\n/ytdebug\n/twitchstats\n/twitchdebug\n/ytwatch (if configured)',
    notes: '**Notes**\nOutputs chunked. Images >8MB skipped. Data in-memory.'
  };
  
  await interaction.update({ 
    embeds: [{ 
      title: 'Help', 
      description: categories[value] || 'Unknown', 
      color: 0x5865F2 
    }] 
  });
}

async function handleButtonInteraction(interaction, client, commandMap) {
  // Handle CWL buttons
  if (interaction.customId.startsWith('cwl_')) {
    const cwlHandler = require('../handlers/cwlInteractionHandler');
    try {
      const handled = await cwlHandler.handleCWLButtonInteraction(interaction);
      if (handled) return;
    } catch (error) {
      console.error('CWL button error:', error);
      if (!interaction.replied && !interaction.deferred) {
        try {
          await interaction.reply({ 
            content: '❌ CWL interaction failed. Please try again.', 
            ephemeral: true 
          });
        } catch (replyError) {
          console.error('Failed to send CWL error reply:', replyError);
        }
      }
      return;
    }
  }
  
  // Handle leaderboard buttons first
  if (interaction.customId.startsWith('leaderboard_')) {
    // Get leaderboard handler from client if available
    if (client.leaderboardEvents && client.leaderboardEvents.interactionHandler) {
      try {
        await client.leaderboardEvents.interactionHandler.handleButtonInteraction(interaction);
        return;
      } catch (error) {
        console.error('Leaderboard button error:', error);
        // Try to send error message if interaction is still valid
        if (!interaction.replied && !interaction.deferred) {
          try {
            await interaction.reply({ 
              content: '❌ Leaderboard interaction failed. Please try again.', 
              ephemeral: true 
            });
          } catch (replyError) {
            console.error('Failed to send leaderboard error reply:', replyError);
          }
        }
        return;
      }
    } else {
      console.error('Leaderboard events not properly initialized on client');
      // Try to send error message if interaction is still valid
      if (!interaction.replied && !interaction.deferred) {
        try {
          await interaction.reply({ 
            content: '❌ Leaderboard system not ready. Please try again later.', 
            ephemeral: true 
          });
        } catch (replyError) {
          console.error('Failed to send leaderboard initialization error reply:', replyError);
        }
      }
      return;
    }
  }
  
  // Handle poll buttons
  const pollModule = commandMap.get('poll');
  
  if (pollModule && pollModule.handleButton) {
    try { 
      await pollModule.handleButton(interaction, client); 
    } catch(e) { 
      console.error('Poll button error', e); 
    }
  }
}

async function handleRoleMenuSelect(interaction) {
  try {
    const userId = interaction.customId.split('_')[2];
    
    // Verify this is the correct user
    if (userId !== interaction.user.id) {
      return await interaction.reply({
        content: '❌ This role menu is not for you.',
        flags: 64
      });
    }

    // Get role data from global storage
    if (!global.roleMenuData || !global.roleMenuData.has(userId)) {
      return await interaction.reply({
        content: '❌ Role menu has expired. Use `/role menu` to get a new one.',
        flags: 64
      });
    }

    const roleMap = global.roleMenuData.get(userId);
    const selectedRoleIds = interaction.values;
    const results = [];
    
    await interaction.deferReply({ flags: 64 });

    for (const roleId of selectedRoleIds) {
      const roleData = roleMap.get(roleId);
      if (!roleData) continue;

      const { role, type, hasRole } = roleData;
      
      try {
        if (hasRole) {
          // Remove role
          if (type === 'add_only') {
            results.push(`❌ Cannot remove "${role.name}" (add-only role)`);
            continue;
          }
          
          await interaction.member.roles.remove(role);
          results.push(`➖ Removed "${role.name}"`);
        } else {
          // Add role
          if (type === 'remove_only') {
            results.push(`❌ Cannot add "${role.name}" (remove-only role)`);
            continue;
          }
          
          await interaction.member.roles.add(role);
          results.push(`➕ Added "${role.name}"`);
        }
      } catch (error) {
        console.error(`Error managing role ${role.name}:`, error);
        results.push(`❌ Failed to manage "${role.name}"`);
      }
    }

    const responseText = results.length > 0 
      ? results.join('\n')
      : '❌ No changes were made.';

    await interaction.editReply(responseText);

    // Clean up the user's role menu data
    global.roleMenuData.delete(userId);

  } catch (error) {
    console.error('Error in handleRoleMenuSelect:', error);
    
    // Check if interaction was already replied to or deferred
    if (interaction.deferred) {
      await interaction.editReply({
        content: '❌ An error occurred while processing your role selection.'
      });
    } else if (!interaction.replied) {
      await interaction.reply({
        content: '❌ An error occurred while processing your role selection.',
        flags: 64
      });
    }
  }
}

// Helper function to categorize commands for analytics
function getCategoryForCommand(commandName) {
  const categories = {
    // Moderation commands
    'ban': 'moderation',
    'kick': 'moderation', 
    'timeout': 'moderation',
    'warn': 'moderation',
    'purge': 'moderation',
    'mute': 'moderation',
    'unmute': 'moderation',
    'automod': 'moderation',
    'audit': 'moderation',
    
    // Utility commands
    'ping': 'utility',
    'help': 'utility',
    'whoami': 'utility',
    'uptime': 'utility',
    'user': 'utility',
    'math': 'utility',
    
    // Fun commands
    'poll': 'fun',
    'echo': 'fun',
    'meme': 'fun',
    
    // XP/Leveling
    'level': 'leveling',
    'rank': 'leveling',
    'leaderboard': 'leveling',
    'xp': 'leveling',
    'xpadmin': 'leveling',
    
    // Auto systems
    'scheduler': 'automation',
    'autorole': 'automation',
    'welcome': 'automation',
    'role': 'automation',
    'antiraid': 'automation',
    
    // AI Integration
    'ask': 'ai',
    'askfollow': 'ai',
    'explain_image': 'ai',
    'summarize': 'ai',
    'translate': 'ai',
    
    // Streaming/Social
    'ytwatch': 'streaming',
    'ytstats': 'streaming',
    'ytdebug': 'streaming',
    'twitchstats': 'streaming',
    'twitchdebug': 'streaming',
    
    // Gaming
    'coc': 'gaming',
    'cocdebug': 'gaming',
    'genshin': 'gaming',
    
    // Configuration
    'config': 'configuration',
    'settings': 'configuration'
  };
  
  return categories[commandName.toLowerCase()] || 'other';
}

module.exports = setupInteractionCreateHandler;
