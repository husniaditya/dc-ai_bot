const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

// Clash of Clans API base URL
const COC_API_BASE = 'https://api.clashofclans.com/v1';

// Helper function to make COC API requests
async function cocApiRequest(endpoint) {
  const apiKey = process.env.COC_API_TOKEN;
  if (!apiKey) {
    throw new Error('Clash of Clans API token not configured');
  }

  const response = await fetch(`${COC_API_BASE}${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Not found');
    } else if (response.status === 403) {
      throw new Error('Access denied - check API token');
    } else {
      throw new Error(`API error: ${response.status}`);
    }
  }

  return await response.json();
}

// Helper function to clean clan/player tags
function cleanTag(tag) {
  return tag.trim().replace(/^#/, '').toUpperCase();
}

// Helper function to format numbers
function formatNumber(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'k';
  }
  return num.toString();
}

// Helper function to get war state emoji
function getWarStateEmoji(state) {
  switch (state) {
    case 'preparation': return '🛡️';
    case 'inWar': return '⚔️';
    case 'warEnded': return '🏆';
    default: return '❓';
  }
}

// Helper function to get league emoji
function getLeagueEmoji(league) {
  if (!league) return '🏆';
  const name = league.name.toLowerCase();
  if (name.includes('legend')) return '🌟';
  if (name.includes('titan')) return '💎';
  if (name.includes('champion')) return '🏆';
  if (name.includes('master')) return '🥇';
  if (name.includes('crystal')) return '💠';
  if (name.includes('gold')) return '🥉';
  if (name.includes('silver')) return '🥈';
  if (name.includes('bronze')) return '🥉';
  return '🏆';
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('coc')
    .setDescription('Clash of Clans information and commands')
    .addSubcommand(subcommand =>
      subcommand
        .setName('clan')
        .setDescription('Get clan information')
        .addStringOption(option =>
          option.setName('tag')
            .setDescription('Clan tag (e.g., #2Y0YRGG0)')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('player')
        .setDescription('Get player information')
        .addStringOption(option =>
          option.setName('tag')
            .setDescription('Player tag (e.g., #ABC123)')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('war')
        .setDescription('Get current war information')
        .addStringOption(option =>
          option.setName('tag')
            .setDescription('Clan tag (e.g., #2Y0YRGG0)')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('search')
        .setDescription('Search for clans')
        .addStringOption(option =>
          option.setName('name')
            .setDescription('Clan name to search for')
            .setRequired(true))
        .addIntegerOption(option =>
          option.setName('limit')
            .setDescription('Number of results (1-20)')
            .setMinValue(1)
            .setMaxValue(20)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('playersearch')
        .setDescription('Search for players')
        .addStringOption(option =>
          option.setName('name')
            .setDescription('Player name to search for')
            .setRequired(true))
        .addIntegerOption(option =>
          option.setName('limit')
            .setDescription('Number of results (1-20)')
            .setMinValue(1)
            .setMaxValue(20)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('compare')
        .setDescription('Compare two players')
        .addStringOption(option =>
          option.setName('player1')
            .setDescription('First player tag (e.g., #ABC123)')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('player2')
            .setDescription('Second player tag (e.g., #DEF456)')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('attacks')
        .setDescription('Show remaining war attacks')
        .addStringOption(option =>
          option.setName('tag')
            .setDescription('Clan tag (e.g., #2Y0YRGG0)')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('top')
        .setDescription('Show top players in clan')
        .addStringOption(option =>
          option.setName('tag')
            .setDescription('Clan tag (e.g., #2Y0YRGG0)')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('category')
            .setDescription('What to rank by')
            .addChoices(
              { name: 'Trophies', value: 'trophies' },
              { name: 'Donations', value: 'donations' },
              { name: 'Donations Received', value: 'received' },
              { name: 'Level', value: 'level' }
            )))
    .addSubcommand(subcommand =>
      subcommand
        .setName('stats')
        .setDescription('Show detailed player statistics')
        .addStringOption(option =>
          option.setName('tag')
            .setDescription('Player tag (e.g., #ABC123)')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('warlog')
        .setDescription('Show recent war history')
        .addStringOption(option =>
          option.setName('tag')
            .setDescription('Clan tag (e.g., #2Y0YRGG0)')
            .setRequired(true))
        .addIntegerOption(option =>
          option.setName('limit')
            .setDescription('Number of wars to show (1-10)')
            .setMinValue(1)
            .setMaxValue(10)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('watch')
        .setDescription('Add clan to monitoring (Admin only)')
        .addStringOption(option =>
          option.setName('tag')
            .setDescription('Clan tag (e.g., #2Y0YRGG0)')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('unwatch')
        .setDescription('Remove clan from monitoring (Admin only)')
        .addStringOption(option =>
          option.setName('tag')
            .setDescription('Clan tag (e.g., #2Y0YRGG0)')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('config')
        .setDescription('Show COC configuration (Admin only)'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('leaderboard')
        .setDescription('Generate donation leaderboard for a clan')
        .addStringOption(option =>
          option.setName('tag')
            .setDescription('Clan tag (e.g., #2Y0YRGG0)')
            .setRequired(true))),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    try {
      switch (subcommand) {
        case 'clan':
          await handleClanCommand(interaction);
          break;
        case 'player':
          await handlePlayerCommand(interaction);
          break;
        case 'war':
          await handleWarCommand(interaction);
          break;
        case 'search':
          await handleSearchCommand(interaction);
          break;
        case 'playersearch':
          await handlePlayerSearchCommand(interaction);
          break;
        case 'compare':
          await handleCompareCommand(interaction);
          break;
        case 'attacks':
          await handleAttacksCommand(interaction);
          break;
        case 'top':
          await handleTopCommand(interaction);
          break;
        case 'stats':
          await handleStatsCommand(interaction);
          break;
        case 'warlog':
          await handleWarLogCommand(interaction);
          break;
        case 'watch':
          await handleWatchCommand(interaction);
          break;
        case 'unwatch':
          await handleUnwatchCommand(interaction);
          break;
        case 'config':
          await handleConfigCommand(interaction);
          break;
        case 'leaderboard':
          await handleLeaderboardCommand(interaction);
          break;
        default:
          await interaction.reply({ content: 'Unknown subcommand!', ephemeral: true });
      }
    } catch (error) {
      console.error('COC command error:', error);
      
      let errorMessage = 'An error occurred while processing your request.';
      if (error.message === 'Not found') {
        errorMessage = 'The specified clan or player was not found.';
      } else if (error.message.includes('API token')) {
        errorMessage = 'Clash of Clans API is not properly configured.';
      } else if (error.message === 'Access denied - check API token') {
        errorMessage = 'Access denied - API token may be invalid.';
      }

      if (interaction.deferred) {
        await interaction.editReply({ content: errorMessage, ephemeral: true });
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true });
      }
    }
  },
};

// Clan information command
async function handleClanCommand(interaction) {
  await interaction.deferReply();
  
  const clanTag = cleanTag(interaction.options.getString('tag'));
  const clanData = await cocApiRequest(`/clans/%23${clanTag}`);

  const embed = new EmbedBuilder()
    .setTitle(`${clanData.name} (#${clanTag})`)
    .setColor('#87CEEB')
    .setThumbnail(clanData.badgeUrls?.medium || null)
    .addFields(
      { name: '📊 Level', value: clanData.clanLevel.toString(), inline: true },
      { name: '👥 Members', value: `${clanData.members}/50`, inline: true },
      { name: '🏆 Trophies', value: formatNumber(clanData.clanPoints), inline: true },
      { name: '🛡️ Required Trophies', value: formatNumber(clanData.requiredTrophies), inline: true },
      { name: '⚔️ War Wins', value: clanData.warWins?.toString() || 'N/A', inline: true },
      { name: '🎯 War Win Streak', value: clanData.warWinStreak?.toString() || 'N/A', inline: true }
    );

  if (clanData.description) {
    embed.setDescription(clanData.description.substring(0, 2048));
  }

  if (clanData.location) {
    embed.addFields({ name: '🌍 Location', value: clanData.location.name, inline: true });
  }

  await interaction.editReply({ embeds: [embed] });
}

// Player information command
async function handlePlayerCommand(interaction) {
  await interaction.deferReply();
  
  const playerTag = cleanTag(interaction.options.getString('tag'));
  const playerData = await cocApiRequest(`/players/%23${playerTag}`);

  const embed = new EmbedBuilder()
    .setTitle(`${playerData.name} (#${playerTag})`)
    .setColor('#FFD700')
    .addFields(
      { name: '📊 Level', value: playerData.expLevel.toString(), inline: true },
      { name: '🏆 Trophies', value: formatNumber(playerData.trophies), inline: true },
      { name: '🎯 Best Trophies', value: formatNumber(playerData.bestTrophies), inline: true },
      { name: '⚔️ Attack Wins', value: formatNumber(playerData.attackWins), inline: true },
      { name: '🛡️ Defense Wins', value: formatNumber(playerData.defenseWins), inline: true },
      { name: '⭐ War Stars', value: formatNumber(playerData.warStars), inline: true }
    );

  if (playerData.clan) {
    embed.addFields({ 
      name: '🏰 Clan', 
      value: `${playerData.clan.name} (#${playerData.clan.tag.substring(1)})`, 
      inline: true 
    });
  }

  if (playerData.league) {
    embed.addFields({ 
      name: `${getLeagueEmoji(playerData.league)} League`, 
      value: playerData.league.name, 
      inline: true 
    });
  }

  if (playerData.townHallLevel) {
    embed.addFields({ name: '🏘️ Town Hall', value: playerData.townHallLevel.toString(), inline: true });
  }

  await interaction.editReply({ embeds: [embed] });
}

// War information command
async function handleWarCommand(interaction) {
  await interaction.deferReply();
  
  const clanTag = cleanTag(interaction.options.getString('tag'));
  const warData = await cocApiRequest(`/clans/%23${clanTag}/currentwar`);

  if (warData.state === 'notInWar') {
    await interaction.editReply({ content: 'This clan is not currently in war.' });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(`${getWarStateEmoji(warData.state)} ${warData.clan.name} vs ${warData.opponent.name}`)
    .setColor('#FF6B6B')
    .addFields(
      { name: '📊 Team Size', value: `${warData.teamSize}v${warData.teamSize}`, inline: true },
      { name: '⭐ Stars', value: `${warData.clan.stars} - ${warData.opponent.stars}`, inline: true },
      { name: '💥 Destruction', value: `${warData.clan.destructionPercentage.toFixed(1)}% - ${warData.opponent.destructionPercentage.toFixed(1)}%`, inline: true }
    );

  if (warData.state === 'preparation') {
    const prepEndTime = new Date(warData.startTime);
    embed.addFields({ name: '⏰ War Starts', value: `<t:${Math.floor(prepEndTime.getTime() / 1000)}:R>` });
  } else if (warData.state === 'inWar') {
    const warEndTime = new Date(warData.endTime);
    embed.addFields({ name: '⏰ War Ends', value: `<t:${Math.floor(warEndTime.getTime() / 1000)}:R>` });
    
    // Calculate remaining attacks
    const clanAttacksUsed = warData.clan.members.reduce((total, member) => total + (member.attacks?.length || 0), 0);
    const opponentAttacksUsed = warData.opponent.members.reduce((total, member) => total + (member.attacks?.length || 0), 0);
    const maxAttacks = warData.teamSize * 2;
    
    embed.addFields({ 
      name: '🎯 Attacks Used', 
      value: `${clanAttacksUsed}/${maxAttacks} - ${opponentAttacksUsed}/${maxAttacks}`, 
      inline: true 
    });
  } else if (warData.state === 'warEnded') {
    const result = warData.clan.stars > warData.opponent.stars ? 'Victory!' : 
                   warData.clan.stars < warData.opponent.stars ? 'Defeat' : 'Draw';
    embed.addFields({ name: '🏆 Result', value: result, inline: true });
  }

  await interaction.editReply({ embeds: [embed] });
}

// Clan search command
async function handleSearchCommand(interaction) {
  await interaction.deferReply();
  
  const searchName = interaction.options.getString('name');
  const limit = interaction.options.getInteger('limit') || 5;
  
  const searchData = await cocApiRequest(`/clans?name=${encodeURIComponent(searchName)}&limit=${limit}`);

  if (!searchData.items || searchData.items.length === 0) {
    await interaction.editReply({ content: 'No clans found with that name.' });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(`🔍 Clan Search Results for "${searchName}"`)
    .setColor('#87CEEB')
    .setDescription('Here are the top matching clans:');

  searchData.items.forEach((clan, index) => {
    embed.addFields({
      name: `${index + 1}. ${clan.name} (#${clan.tag.substring(1)})`,
      value: `📊 Level ${clan.clanLevel} • 👥 ${clan.members}/50 • 🏆 ${formatNumber(clan.clanPoints)} trophies`,
      inline: false
    });
  });

  await interaction.editReply({ embeds: [embed] });
}

// Player search command (placeholder - COC API doesn't support player search by name)
async function handlePlayerSearchCommand(interaction) {
  await interaction.reply({ 
    content: 'Player search by name is not supported by the Clash of Clans API. Please use player tags instead with `/coc player`.',
    ephemeral: true 
  });
}

// Compare players command
async function handleCompareCommand(interaction) {
  await interaction.deferReply();
  
  const player1Tag = cleanTag(interaction.options.getString('player1'));
  const player2Tag = cleanTag(interaction.options.getString('player2'));
  
  const [player1Data, player2Data] = await Promise.all([
    cocApiRequest(`/players/%23${player1Tag}`),
    cocApiRequest(`/players/%23${player2Tag}`)
  ]);

  const embed = new EmbedBuilder()
    .setTitle('⚖️ Player Comparison')
    .setColor('#9B59B6')
    .addFields(
      { name: '👤 Players', value: `${player1Data.name} vs ${player2Data.name}`, inline: false },
      { name: '📊 Level', value: `${player1Data.expLevel} vs ${player2Data.expLevel}`, inline: true },
      { name: '🏆 Trophies', value: `${formatNumber(player1Data.trophies)} vs ${formatNumber(player2Data.trophies)}`, inline: true },
      { name: '🎯 Best Trophies', value: `${formatNumber(player1Data.bestTrophies)} vs ${formatNumber(player2Data.bestTrophies)}`, inline: true },
      { name: '⚔️ Attack Wins', value: `${formatNumber(player1Data.attackWins)} vs ${formatNumber(player2Data.attackWins)}`, inline: true },
      { name: '🛡️ Defense Wins', value: `${formatNumber(player1Data.defenseWins)} vs ${formatNumber(player2Data.defenseWins)}`, inline: true },
      { name: '⭐ War Stars', value: `${formatNumber(player1Data.warStars)} vs ${formatNumber(player2Data.warStars)}`, inline: true }
    );

  await interaction.editReply({ embeds: [embed] });
}

// Remaining attacks command
async function handleAttacksCommand(interaction) {
  await interaction.deferReply();
  
  const clanTag = cleanTag(interaction.options.getString('tag'));
  const warData = await cocApiRequest(`/clans/%23${clanTag}/currentwar`);

  if (warData.state === 'notInWar') {
    await interaction.editReply({ content: 'This clan is not currently in war.' });
    return;
  }

  if (warData.state === 'preparation') {
    await interaction.editReply({ content: 'War is still in preparation phase. Attacks will be available when war starts.' });
    return;
  }

  // Find members with remaining attacks
  const membersWithAttacks = warData.clan.members
    .filter(member => !member.attacks || member.attacks.length < 2)
    .map(member => {
      const attacksUsed = member.attacks ? member.attacks.length : 0;
      const attacksRemaining = 2 - attacksUsed;
      return `${member.name} - ${attacksRemaining} attack${attacksRemaining !== 1 ? 's' : ''} remaining`;
    });

  const embed = new EmbedBuilder()
    .setTitle(`🎯 Remaining Attacks - ${warData.clan.name}`)
    .setColor('#E74C3C');

  if (membersWithAttacks.length === 0) {
    embed.setDescription('All clan members have used their attacks! 🎉');
  } else {
    embed.setDescription(membersWithAttacks.join('\n'));
  }

  await interaction.editReply({ embeds: [embed] });
}

// Watch clan command (requires admin)
async function handleWatchCommand(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
    await interaction.reply({ content: 'You need "Manage Server" permission to use this command.', ephemeral: true });
    return;
  }

  await interaction.reply({ 
    content: 'Use the dashboard to configure clan monitoring: `/dashboard` → Games & Socials → Clash of Clans',
    ephemeral: true 
  });
}

// Unwatch clan command (requires admin)
async function handleUnwatchCommand(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
    await interaction.reply({ content: 'You need "Manage Server" permission to use this command.', ephemeral: true });
    return;
  }

  await interaction.reply({ 
    content: 'Use the dashboard to configure clan monitoring: `/dashboard` → Games & Socials → Clash of Clans',
    ephemeral: true 
  });
}

// Config command (requires admin)
async function handleConfigCommand(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
    await interaction.reply({ content: 'You need "Manage Server" permission to use this command.', ephemeral: true });
    return;
  }

  await interaction.reply({ 
    content: 'Use the dashboard to view and configure Clash of Clans settings: `/dashboard` → Games & Socials → Clash of Clans',
    ephemeral: true 
  });
}

// Top players in clan command
async function handleTopCommand(interaction) {
  await interaction.deferReply();
  
  const clanTag = cleanTag(interaction.options.getString('tag'));
  const category = interaction.options.getString('category') || 'trophies';
  
  const clanData = await cocApiRequest(`/clans/%23${clanTag}`);
  
  let sortedMembers;
  let categoryName;
  let categoryEmoji;
  
  switch (category) {
    case 'trophies':
      sortedMembers = [...clanData.memberList].sort((a, b) => b.trophies - a.trophies);
      categoryName = 'Trophies';
      categoryEmoji = '🏆';
      break;
    case 'donations':
      sortedMembers = [...clanData.memberList].sort((a, b) => b.donations - a.donations);
      categoryName = 'Donations';
      categoryEmoji = '💎';
      break;
    case 'received':
      sortedMembers = [...clanData.memberList].sort((a, b) => b.donationsReceived - a.donationsReceived);
      categoryName = 'Donations Received';
      categoryEmoji = '📦';
      break;
    case 'level':
      sortedMembers = [...clanData.memberList].sort((a, b) => b.expLevel - a.expLevel);
      categoryName = 'Level';
      categoryEmoji = '📊';
      break;
    default:
      sortedMembers = [...clanData.memberList].sort((a, b) => b.trophies - a.trophies);
      categoryName = 'Trophies';
      categoryEmoji = '🏆';
  }

  const topMembers = sortedMembers.slice(0, 10);
  
  const embed = new EmbedBuilder()
    .setTitle(`${categoryEmoji} Top ${categoryName} - ${clanData.name}`)
    .setColor('#F39C12')
    .setThumbnail(clanData.badgeUrls?.medium || null);

  const description = topMembers.map((member, index) => {
    const position = index + 1;
    const medal = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : `${position}.`;
    
    let value;
    switch (category) {
      case 'trophies':
        value = formatNumber(member.trophies);
        break;
      case 'donations':
        value = formatNumber(member.donations);
        break;
      case 'received':
        value = formatNumber(member.donationsReceived);
        break;
      case 'level':
        value = member.expLevel.toString();
        break;
    }
    
    return `${medal} **${member.name}** - ${value}`;
  }).join('\n');

  embed.setDescription(description);
  
  await interaction.editReply({ embeds: [embed] });
}

// Detailed player stats command
async function handleStatsCommand(interaction) {
  await interaction.deferReply();
  
  const playerTag = cleanTag(interaction.options.getString('tag'));
  const playerData = await cocApiRequest(`/players/%23${playerTag}`);

  const embed = new EmbedBuilder()
    .setTitle(`📊 ${playerData.name} (#${playerTag}) - Detailed Stats`)
    .setColor('#3498DB')
    .addFields(
      { name: '🏘️ Town Hall', value: playerData.townHallLevel?.toString() || 'N/A', inline: true },
      { name: '⚡ Builder Hall', value: playerData.builderHallLevel?.toString() || 'N/A', inline: true },
      { name: '📊 Level', value: playerData.expLevel.toString(), inline: true },
      { name: '🏆 Current Trophies', value: formatNumber(playerData.trophies), inline: true },
      { name: '🎯 Best Trophies', value: formatNumber(playerData.bestTrophies), inline: true },
      { name: '🔥 Versus Trophies', value: formatNumber(playerData.versusTrophies || 0), inline: true },
      { name: '⚔️ Attack Wins', value: formatNumber(playerData.attackWins), inline: true },
      { name: '🛡️ Defense Wins', value: formatNumber(playerData.defenseWins), inline: true },
      { name: '⭐ War Stars', value: formatNumber(playerData.warStars), inline: true }
    );

  // Add donation stats if available
  if (playerData.donations !== undefined || playerData.donationsReceived !== undefined) {
    embed.addFields(
      { name: '💎 Donations', value: formatNumber(playerData.donations || 0), inline: true },
      { name: '📦 Received', value: formatNumber(playerData.donationsReceived || 0), inline: true },
      { name: '⚖️ Ratio', value: playerData.donationsReceived > 0 ? 
        (playerData.donations / playerData.donationsReceived).toFixed(2) : '∞', inline: true }
    );
  }

  // Add clan info if available
  if (playerData.clan) {
    embed.addFields({ 
      name: '🏰 Clan', 
      value: `${playerData.clan.name}\n(#${playerData.clan.tag.substring(1)})`, 
      inline: true 
    });
    
    if (playerData.role) {
      embed.addFields({ name: '👑 Role', value: playerData.role, inline: true });
    }
  }

  // Add league info
  if (playerData.league) {
    embed.addFields({ 
      name: `${getLeagueEmoji(playerData.league)} League`, 
      value: playerData.league.name, 
      inline: true 
    });
  }

  // Add hero levels if available
  if (playerData.heroes && playerData.heroes.length > 0) {
    const heroInfo = playerData.heroes.map(hero => `${hero.name}: ${hero.level}`).join('\n');
    embed.addFields({ name: '🦸 Heroes', value: heroInfo, inline: true });
  }

  await interaction.editReply({ embeds: [embed] });
}

// War log command
async function handleWarLogCommand(interaction) {
  await interaction.deferReply();
  
  const clanTag = cleanTag(interaction.options.getString('tag'));
  const limit = interaction.options.getInteger('limit') || 5;
  
  const warLogData = await cocApiRequest(`/clans/%23${clanTag}/warlog`);

  if (!warLogData.items || warLogData.items.length === 0) {
    await interaction.editReply({ content: 'No war history found for this clan.' });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(`📜 War History - ${warLogData.items[0]?.clan?.name || 'Unknown Clan'}`)
    .setColor('#8E44AD');

  const wars = warLogData.items.slice(0, limit);
  
  wars.forEach((war, index) => {
    if (war.result === 'win') {
      var resultEmoji = '🟢';
    } else if (war.result === 'lose') {
      var resultEmoji = '🔴';
    } else {
      var resultEmoji = '🟡';
    }
    
    const warDate = new Date(war.endTime);
    const opponent = war.opponent?.name || 'Unknown';
    const stars = `${war.clan?.stars || 0}-${war.opponent?.stars || 0}`;
    const destruction = `${(war.clan?.destructionPercentage || 0).toFixed(1)}%-${(war.opponent?.destructionPercentage || 0).toFixed(1)}%`;
    
    embed.addFields({
      name: `${resultEmoji} vs ${opponent}`,
      value: `⭐ ${stars} • 💥 ${destruction}\n📅 ${warDate.toLocaleDateString()}`,
      inline: true
    });
  });

  // Calculate win rate
  const wins = wars.filter(war => war.result === 'win').length;
  const winRate = wars.length > 0 ? ((wins / wars.length) * 100).toFixed(1) : '0';
  
  embed.setFooter({ text: `Win Rate: ${winRate}% (${wins}/${wars.length} wars shown)` });

  await interaction.editReply({ embeds: [embed] });
}

// Donation leaderboard command
async function handleLeaderboardCommand(interaction) {
  await interaction.deferReply();
  
  const clanTag = cleanTag(interaction.options.getString('tag'));
  
  try {
    // Use the new LeaderboardInteractionHandler instead of old generateDonationLeaderboard
    const LeaderboardInteractionHandler = require('../handlers/LeaderboardInteractionHandler');
    const store = require('../../config/store');
    const handler = new LeaderboardInteractionHandler(store.sqlPool);
    
    // Get guild configuration for leaderboard
    const config = await handler.getLeaderboardConfig(interaction.guildId);
    
    if (!config || !config.track_donation_leaderboard) {
      await interaction.editReply({ 
        content: 'Donation leaderboard is not enabled for this server. Please enable it first using the dashboard.' 
      });
      return;
    }
    
    // Generate leaderboard page 1 using new canvas system
    await handler.generateLeaderboardPage(interaction, config, 1, true);
    
  } catch (error) {
    console.error('Leaderboard generation error:', error);
    await interaction.editReply({ 
      content: 'Failed to generate donation leaderboard. Please try again later.' 
    });
  }
}