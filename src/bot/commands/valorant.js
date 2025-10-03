const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

// Henrik Dev Valorant API base URL
const VALORANT_API_BASE = 'https://api.henrikdev.xyz/valorant';

// Helper function to make Valorant API requests
async function valorantApiRequest(endpoint) {
  const apiKey = process.env.VALORANT_API_KEY;
  if (!apiKey) {
    throw new Error('Valorant API key not configured');
  }

  const response = await fetch(`${VALORANT_API_BASE}${endpoint}`, {
    headers: {
      'Authorization': apiKey,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Player not found');
    } else if (response.status === 429) {
      throw new Error('Rate limited - please try again later');
    } else if (response.status === 403) {
      throw new Error('Access denied - check API key');
    } else {
      throw new Error(`API error: ${response.status}`);
    }
  }

  return await response.json();
}

// Helper function to get rank emoji
function getRankEmoji(tier) {
  const rankMap = {
    'Unrated': '⚪',
    'Iron': '🟤',
    'Bronze': '🟫',
    'Silver': '⚪',
    'Gold': '🟨',
    'Platinum': '🟦',
    'Diamond': '💎',
    'Ascendant': '🟢',
    'Immortal': '🔴',
    'Radiant': '🌟'
  };
  
  if (!tier) return '⚪';
  
  for (const [rank, emoji] of Object.entries(rankMap)) {
    if (tier.includes(rank)) return emoji;
  }
  
  return '⚪';
}

// Helper function to format numbers
function formatNumber(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'k';
  }
  return num?.toString() || '0';
}

// Helper function to calculate K/D ratio
function calculateKD(kills, deaths) {
  if (deaths === 0) return kills.toFixed(2);
  return (kills / deaths).toFixed(2);
}

// Helper function to format match result
function getMatchResultEmoji(result) {
  switch (result?.toLowerCase()) {
    case 'victory':
    case 'win':
      return '🟢';
    case 'defeat':
    case 'loss':
      return '🔴';
    case 'draw':
      return '🟡';
    default:
      return '⚪';
  }
}

// Helper function to get map emoji
function getMapEmoji(mapName) {
  const mapEmojis = {
    'Ascent': '🏔️',
    'Bind': '🏜️',
    'Haven': '🏛️',
    'Split': '🌆',
    'Icebox': '🧊',
    'Breeze': '🏖️',
    'Fracture': '⚡',
    'Pearl': '🌊',
    'Lotus': '🪷',
    'Sunset': '🌅',
    'Abyss': '🌌'
  };
  return mapEmojis[mapName] || '🗺️';
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('valorant')
    .setDescription('Valorant player stats and information')
    .addSubcommand(subcommand =>
      subcommand
        .setName('profile')
        .setDescription('Get player profile and stats')
        .addStringOption(option =>
          option.setName('name')
            .setDescription('Riot ID (e.g., PlayerName#TAG)')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('region')
            .setDescription('Region')
            .addChoices(
              { name: 'North America', value: 'na' },
              { name: 'Europe', value: 'eu' },
              { name: 'Asia Pacific', value: 'ap' },
              { name: 'Korea', value: 'kr' },
              { name: 'Latin America', value: 'latam' },
              { name: 'Brazil', value: 'br' }
            )))
    .addSubcommand(subcommand =>
      subcommand
        .setName('matches')
        .setDescription('Get recent match history')
        .addStringOption(option =>
          option.setName('name')
            .setDescription('Riot ID (e.g., PlayerName#TAG)')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('region')
            .setDescription('Region')
            .addChoices(
              { name: 'North America', value: 'na' },
              { name: 'Europe', value: 'eu' },
              { name: 'Asia Pacific', value: 'ap' },
              { name: 'Korea', value: 'kr' },
              { name: 'Latin America', value: 'latam' },
              { name: 'Brazil', value: 'br' }
            ))
        .addIntegerOption(option =>
          option.setName('limit')
            .setDescription('Number of matches to show (1-5)')
            .setMinValue(1)
            .setMaxValue(5)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('leaderboard')
        .setDescription('Get competitive leaderboard')
        .addStringOption(option =>
          option.setName('region')
            .setDescription('Region')
            .setRequired(true)
            .addChoices(
              { name: 'North America', value: 'na' },
              { name: 'Europe', value: 'eu' },
              { name: 'Asia Pacific', value: 'ap' },
              { name: 'Korea', value: 'kr' },
              { name: 'Latin America', value: 'latam' },
              { name: 'Brazil', value: 'br' }
            ))
        .addIntegerOption(option =>
          option.setName('limit')
            .setDescription('Number of players to show (1-20)')
            .setMinValue(1)
            .setMaxValue(20)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('mmr')
        .setDescription('Get competitive rank and MMR')
        .addStringOption(option =>
          option.setName('name')
            .setDescription('Riot ID (e.g., PlayerName#TAG)')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('region')
            .setDescription('Region')
            .addChoices(
              { name: 'North America', value: 'na' },
              { name: 'Europe', value: 'eu' },
              { name: 'Asia Pacific', value: 'ap' },
              { name: 'Korea', value: 'kr' },
              { name: 'Latin America', value: 'latam' },
              { name: 'Brazil', value: 'br' }
            )))
    .addSubcommand(subcommand =>
      subcommand
        .setName('stats')
        .setDescription('Get detailed player statistics')
        .addStringOption(option =>
          option.setName('name')
            .setDescription('Riot ID (e.g., PlayerName#TAG)')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('region')
            .setDescription('Region')
            .addChoices(
              { name: 'North America', value: 'na' },
              { name: 'Europe', value: 'eu' },
              { name: 'Asia Pacific', value: 'ap' },
              { name: 'Korea', value: 'kr' },
              { name: 'Latin America', value: 'latam' },
              { name: 'Brazil', value: 'br' }
            ))
        .addStringOption(option =>
          option.setName('mode')
            .setDescription('Game mode')
            .addChoices(
              { name: 'Competitive', value: 'competitive' },
              { name: 'Unrated', value: 'unrated' },
              { name: 'Deathmatch', value: 'deathmatch' },
              { name: 'Spike Rush', value: 'spikerush' }
            )))
    .addSubcommand(subcommand =>
      subcommand
        .setName('config')
        .setDescription('Show Valorant configuration (Admin only)'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('esports')
        .setDescription('Get upcoming Valorant esports matches')
        .addStringOption(option =>
          option.setName('region')
            .setDescription('Filter by region')
            .addChoices(
              { name: 'All Regions', value: 'all' },
              { name: 'International', value: 'international' },
              { name: 'North America', value: 'na' },
              { name: 'Europe', value: 'emea' },
              { name: 'Asia Pacific', value: 'apac' },
              { name: 'Brazil', value: 'br' },
              { name: 'Latin America', value: 'latam' },
              { name: 'Korea', value: 'kr' },
              { name: 'Japan', value: 'jp' },
              { name: 'China', value: 'cn' }
            ))
        .addIntegerOption(option =>
          option.setName('days')
            .setDescription('Number of days to show (1-14)')
            .setMinValue(1)
            .setMaxValue(14))),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    try {
      switch (subcommand) {
        case 'profile':
          await handleProfileCommand(interaction);
          break;
        case 'matches':
          await handleMatchesCommand(interaction);
          break;
        case 'leaderboard':
          await handleLeaderboardCommand(interaction);
          break;
        case 'mmr':
          await handleMMRCommand(interaction);
          break;
        case 'stats':
          await handleStatsCommand(interaction);
          break;
        case 'esports':
          await handleEsportsCommand(interaction);
          break;
        case 'config':
          await handleConfigCommand(interaction);
          break;
        default:
          await interaction.reply({ content: 'Unknown subcommand!', ephemeral: true });
      }
    } catch (error) {
      console.error('Valorant command error:', error);
      
      let errorMessage = 'An error occurred while processing your request.';
      if (error.message === 'Player not found') {
        errorMessage = 'Player not found. Please check the Riot ID format (Name#TAG) and region.';
      } else if (error.message.includes('API key')) {
        errorMessage = 'Valorant API is not properly configured.';
      } else if (error.message.includes('Rate limited')) {
        errorMessage = 'Too many requests. Please try again in a moment.';
      } else if (error.message === 'Access denied - check API key') {
        errorMessage = 'Access denied - API key may be invalid.';
      }

      if (interaction.deferred) {
        await interaction.editReply({ content: errorMessage, ephemeral: true });
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true });
      }
    }
  },
};

// Profile command handler
async function handleProfileCommand(interaction) {
  await interaction.deferReply();
  
  const riotId = interaction.options.getString('name');
  const region = interaction.options.getString('region') || 'na';
  
  // Parse Riot ID
  const [name, tag] = riotId.split('#');
  if (!name || !tag) {
    await interaction.editReply({ content: 'Invalid Riot ID format. Please use: Name#TAG', ephemeral: true });
    return;
  }

  // Get account info
  const accountData = await valorantApiRequest(`/v1/account/${name}/${tag}`);
  
  if (!accountData || accountData.status !== 200) {
    await interaction.editReply({ content: 'Player not found.', ephemeral: true });
    return;
  }

  const account = accountData.data;
  
  // Get MMR data
  let mmrData = null;
  try {
    const mmrResponse = await valorantApiRequest(`/v2/mmr/${region}/${name}/${tag}`);
    if (mmrResponse && mmrResponse.status === 200) {
      mmrData = mmrResponse.data;
    }
  } catch (err) {
    console.log('Could not fetch MMR data:', err.message);
  }

  const embed = new EmbedBuilder()
    .setTitle(`${account.name}#${account.tag}`)
    .setColor('#FF4655')
    .setThumbnail(account.card?.small || null)
    .addFields(
      { name: '🆔 PUUID', value: `\`${account.puuid.substring(0, 20)}...\``, inline: false },
      { name: '🌍 Region', value: account.region?.toUpperCase() || region.toUpperCase(), inline: true },
      { name: '📊 Account Level', value: account.account_level?.toString() || 'N/A', inline: true }
    );

  if (mmrData) {
    const currentRank = mmrData.current_data;
    if (currentRank) {
      const rankEmoji = getRankEmoji(currentRank.currenttierpatched);
      embed.addFields(
        { name: `${rankEmoji} Current Rank`, value: currentRank.currenttierpatched || 'Unrated', inline: true },
        { name: '🎯 RR', value: currentRank.ranking_in_tier?.toString() || '0', inline: true },
        { name: '📈 MMR', value: currentRank.elo?.toString() || 'N/A', inline: true }
      );
      
      if (currentRank.mmr_change_to_last_game !== undefined) {
        const change = currentRank.mmr_change_to_last_game;
        const changeStr = change > 0 ? `+${change}` : change.toString();
        embed.addFields({ name: '📊 Last Game', value: changeStr, inline: true });
      }
    }
    
    // Add season peak
    if (mmrData.highest_rank) {
      const peakEmoji = getRankEmoji(mmrData.highest_rank.patched_tier);
      embed.addFields({ 
        name: `${peakEmoji} Peak Rank`, 
        value: `${mmrData.highest_rank.patched_tier || 'N/A'} (${mmrData.highest_rank.season || 'Unknown Season'})`, 
        inline: true 
      });
    }
  }

  if (account.card?.wide) {
    embed.setImage(account.card.wide);
  }

  await interaction.editReply({ embeds: [embed] });
}

// Match history command handler
async function handleMatchesCommand(interaction) {
  await interaction.deferReply();
  
  const riotId = interaction.options.getString('name');
  const region = interaction.options.getString('region') || 'na';
  const limit = interaction.options.getInteger('limit') || 3;
  
  // Parse Riot ID
  const [name, tag] = riotId.split('#');
  if (!name || !tag) {
    await interaction.editReply({ content: 'Invalid Riot ID format. Please use: Name#TAG', ephemeral: true });
    return;
  }

  // Get match history
  const matchData = await valorantApiRequest(`/v3/matches/${region}/${name}/${tag}?size=${limit}`);
  
  if (!matchData || matchData.status !== 200 || !matchData.data || matchData.data.length === 0) {
    await interaction.editReply({ content: 'No recent matches found.', ephemeral: true });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(`📜 Recent Matches - ${name}#${tag}`)
    .setColor('#FF4655');

  matchData.data.slice(0, limit).forEach((match, index) => {
    // Add null checks for match structure
    if (!match || !match.players || !match.players.all_players) {
      console.warn('Invalid match data structure in matches command:', match);
      return;
    }
    
    const player = match.players.all_players.find(p => p.name === name && p.tag === tag);
    if (!player) return;

    const result = player.team?.toLowerCase() === match.teams?.red?.has_won ? 'red' : 'blue';
    const won = result === (player.team?.toLowerCase() === 'red' ? 'red' : 'blue');
    const resultEmoji = won ? '🟢' : '🔴';
    const mapEmoji = getMapEmoji(match.metadata?.map);
    
    const kda = `${player.stats?.kills || 0}/${player.stats?.deaths || 0}/${player.stats?.assists || 0}`;
    const kdRatio = calculateKD(player.stats?.kills || 0, player.stats?.deaths || 0);
    const score = `${match.teams?.red?.rounds_won || 0}-${match.teams?.blue?.rounds_won || 0}`;
    
    embed.addFields({
      name: `${resultEmoji} ${mapEmoji} ${match.metadata?.map || 'Unknown'} - ${match.metadata?.mode || 'Unknown'}`,
      value: `**Agent:** ${player.character || 'Unknown'}\n**K/D/A:** ${kda} (${kdRatio} K/D)\n**Score:** ${score}\n**ACS:** ${player.stats?.score || 0}`,
      inline: false
    });
  });

  await interaction.editReply({ embeds: [embed] });
}

// Leaderboard command handler
async function handleLeaderboardCommand(interaction) {
  await interaction.deferReply();
  
  const region = interaction.options.getString('region');
  const limit = interaction.options.getInteger('limit') || 10;
  
  // Get leaderboard
  const leaderboardData = await valorantApiRequest(`/v2/leaderboard/${region}`);
  
  if (!leaderboardData || leaderboardData.status !== 200 || !leaderboardData.data) {
    await interaction.editReply({ content: 'Failed to fetch leaderboard data.', ephemeral: true });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(`🏆 Competitive Leaderboard - ${region.toUpperCase()}`)
    .setColor('#FF4655')
    .setDescription('Top players in the region');

  const players = leaderboardData.data.slice(0, limit);
  
  const description = players.map((player, index) => {
    const position = index + 1;
    const medal = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : `${position}.`;
    const leaderboardRank = player.leaderboardRank || position;
    const rankEmoji = getRankEmoji(player.currenttierpatched);
    
    return `${medal} **${player.gameName}#${player.tagLine}**\n${rankEmoji} ${player.currenttierpatched} • ${formatNumber(player.rankedRating)} RR`;
  }).join('\n\n');

  embed.setDescription(description);
  
  await interaction.editReply({ embeds: [embed] });
}

// MMR command handler
async function handleMMRCommand(interaction) {
  await interaction.deferReply();
  
  const riotId = interaction.options.getString('name');
  const region = interaction.options.getString('region') || 'na';
  
  // Parse Riot ID
  const [name, tag] = riotId.split('#');
  if (!name || !tag) {
    await interaction.editReply({ content: 'Invalid Riot ID format. Please use: Name#TAG', ephemeral: true });
    return;
  }

  // Get MMR data
  const mmrData = await valorantApiRequest(`/v2/mmr/${region}/${name}/${tag}`);
  
  if (!mmrData || mmrData.status !== 200 || !mmrData.data) {
    await interaction.editReply({ content: 'MMR data not found.', ephemeral: true });
    return;
  }

  const data = mmrData.data;
  const current = data.current_data;
  
  const embed = new EmbedBuilder()
    .setTitle(`📊 Competitive Rank - ${name}#${tag}`)
    .setColor('#FF4655');

  if (current) {
    const rankEmoji = getRankEmoji(current.currenttierpatched);
    embed.addFields(
      { name: `${rankEmoji} Current Rank`, value: current.currenttierpatched || 'Unrated', inline: true },
      { name: '🎯 Ranked Rating', value: current.ranking_in_tier?.toString() || '0', inline: true },
      { name: '📈 MMR/ELO', value: current.elo?.toString() || 'N/A', inline: true }
    );
    
    if (current.mmr_change_to_last_game !== undefined) {
      const change = current.mmr_change_to_last_game;
      const changeStr = change > 0 ? `+${change}` : change.toString();
      const emoji = change > 0 ? '📈' : change < 0 ? '📉' : '➖';
      embed.addFields({ name: `${emoji} Last Game Change`, value: changeStr, inline: true });
    }
    
    if (current.games_needed_for_rating !== undefined) {
      embed.addFields({ 
        name: '🎮 Placement', 
        value: `${current.games_needed_for_rating} games until ranked`, 
        inline: true 
      });
    }
  }

  // Add peak rank
  if (data.highest_rank) {
    const peakEmoji = getRankEmoji(data.highest_rank.patched_tier);
    embed.addFields({ 
      name: `${peakEmoji} Peak Rank (${data.highest_rank.season || 'Unknown'})`, 
      value: data.highest_rank.patched_tier || 'N/A', 
      inline: true 
    });
  }

  // Add by season if available
  if (data.by_season && Object.keys(data.by_season).length > 0) {
    const seasons = Object.entries(data.by_season)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 3);
    
    const seasonInfo = seasons.map(([season, seasonData]) => {
      const wins = seasonData.wins || 0;
      const games = seasonData.number_of_games || 0;
      const rankEmoji = getRankEmoji(seasonData.final_rank_patched);
      return `${rankEmoji} **${season}**: ${seasonData.final_rank_patched || 'Unrated'} (${wins}W/${games}G)`;
    }).join('\n');
    
    if (seasonInfo) {
      embed.addFields({ name: '📅 Recent Seasons', value: seasonInfo, inline: false });
    }
  }

  await interaction.editReply({ embeds: [embed] });
}

// Stats command handler
async function handleStatsCommand(interaction) {
  await interaction.deferReply();
  
  const riotId = interaction.options.getString('name');
  const region = interaction.options.getString('region') || 'na';
  const mode = interaction.options.getString('mode') || 'competitive';
  
  // Parse Riot ID
  const [name, tag] = riotId.split('#');
  if (!name || !tag) {
    await interaction.editReply({ content: 'Invalid Riot ID format. Please use: Name#TAG', ephemeral: true });
    return;
  }

  // Get match history for stats calculation
  const matchData = await valorantApiRequest(`/v3/matches/${region}/${name}/${tag}?mode=${mode}&size=10`);
  
  if (!matchData || matchData.status !== 200 || !matchData.data || matchData.data.length === 0) {
    await interaction.editReply({ content: 'No match data found for statistics.', ephemeral: true });
    return;
  }

  // Calculate statistics
  let totalKills = 0;
  let totalDeaths = 0;
  let totalAssists = 0;
  let totalScore = 0;
  let wins = 0;
  let games = 0;
  const agentUsage = {};
  
  matchData.data.forEach(match => {
    // Add null checks for match structure
    if (!match || !match.players || !match.players.all_players) {
      console.warn('Invalid match data structure:', match);
      return;
    }
    
    const player = match.players.all_players.find(p => p.name === name && p.tag === tag);
    if (!player) return;
    
    // Increment games counter only for valid matches
    games++;
    
    totalKills += player.stats?.kills || 0;
    totalDeaths += player.stats?.deaths || 0;
    totalAssists += player.stats?.assists || 0;
    totalScore += player.stats?.score || 0;
    
    // Check if won
    const playerTeam = player.team?.toLowerCase();
    if (playerTeam && match.teams && match.teams[playerTeam]) {
      const won = match.teams[playerTeam].has_won || false;
      if (won) wins++;
    }
    
    // Track agent usage
    if (player.character) {
      agentUsage[player.character] = (agentUsage[player.character] || 0) + 1;
    }
  });

  // Check if we have any valid games
  if (games === 0) {
    await interaction.editReply({ content: 'No valid match data found for statistics. The player might not have played any matches in this mode.', ephemeral: true });
    return;
  }

  const avgKills = (totalKills / games).toFixed(1);
  const avgDeaths = (totalDeaths / games).toFixed(1);
  const avgAssists = (totalAssists / games).toFixed(1);
  const avgScore = Math.round(totalScore / games);
  const kd = calculateKD(totalKills, totalDeaths);
  const winRate = ((wins / games) * 100).toFixed(1);
  
  // Most played agent
  const mostPlayed = Object.entries(agentUsage).sort((a, b) => b[1] - a[1])[0];

  const embed = new EmbedBuilder()
    .setTitle(`📊 Player Statistics - ${name}#${tag}`)
    .setColor('#FF4655')
    .setDescription(`**Mode:** ${mode.charAt(0).toUpperCase() + mode.slice(1)} | **Games:** ${games}`)
    .addFields(
      { name: '⚔️ Avg Kills', value: avgKills, inline: true },
      { name: '💀 Avg Deaths', value: avgDeaths, inline: true },
      { name: '🤝 Avg Assists', value: avgAssists, inline: true },
      { name: '📈 K/D Ratio', value: kd, inline: true },
      { name: '🎯 Avg ACS', value: avgScore.toString(), inline: true },
      { name: '🏆 Win Rate', value: `${winRate}%`, inline: true }
    );

  if (mostPlayed) {
    embed.addFields({ 
      name: '👤 Most Played Agent', 
      value: `${mostPlayed[0]} (${mostPlayed[1]} games)`, 
      inline: false 
    });
  }

  await interaction.editReply({ embeds: [embed] });
}

// Config command handler (requires admin)
async function handleConfigCommand(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
    await interaction.reply({ content: 'You need "Manage Server" permission to use this command.', ephemeral: true });
    return;
  }

  await interaction.reply({ 
    content: 'Use the dashboard to view and configure Valorant settings: `/dashboard` → Games & Socials → Valorant',
    ephemeral: true 
  });
}

// Esports schedule command handler
async function handleEsportsCommand(interaction) {
  await interaction.deferReply();
  
  const regionFilter = interaction.options.getString('region') || 'all';
  const daysAhead = interaction.options.getInteger('days') || 7;
  
  // Get esports matches
  const esportsData = await valorantApiRequest('/v1/esports/schedule');
  
  if (!esportsData || esportsData.status !== 200 || !esportsData.data) {
    await interaction.editReply({ content: 'Failed to fetch esports schedule.', ephemeral: true });
    return;
  }

  const now = new Date();
  const futureDate = new Date(now.getTime() + (daysAhead * 24 * 60 * 60 * 1000));

  // Filter matches
  let matches = esportsData.data.filter(match => {
    if (!match || !match.date) return false;
    
    const matchDate = new Date(match.date);
    if (matchDate < now || matchDate > futureDate) return false;
    
    // Filter by region if specified
    if (regionFilter !== 'all') {
      const matchRegion = match.league?.region?.toLowerCase() || '';
      const leagueName = match.league?.name?.toLowerCase() || '';
      
      // Check if match is in the selected region
      if (regionFilter === 'international') {
        return leagueName.includes('champions') || leagueName.includes('masters') || leagueName.includes('vct international');
      } else {
        return matchRegion.includes(regionFilter) || leagueName.includes(regionFilter);
      }
    }
    
    return true;
  });

  if (matches.length === 0) {
    const regionText = regionFilter === 'all' ? '' : ` in ${regionFilter.toUpperCase()}`;
    await interaction.editReply({ 
      content: `No upcoming esports matches found${regionText} in the next ${daysAhead} days.`, 
      ephemeral: true 
    });
    return;
  }

  // Sort by date
  matches.sort((a, b) => new Date(a.date) - new Date(b.date));
  
  // Limit to 10 matches
  matches = matches.slice(0, 10);

  const embed = new EmbedBuilder()
    .setTitle('🏆 Upcoming Valorant Esports Matches')
    .setColor('#FF4655')
    .setDescription(`Showing next ${matches.length} matches${regionFilter !== 'all' ? ` (${regionFilter.toUpperCase()})` : ''}`)
    .setFooter({ text: `Next ${daysAhead} days` });

  matches.forEach(match => {
    const matchDate = new Date(match.date);
    const dateStr = matchDate.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });
    
    const team1 = match.team1?.name || 'TBD';
    const team2 = match.team2?.name || 'TBD';
    const league = match.league?.name || 'Unknown League';
    const stage = match.stage ? ` - ${match.stage}` : '';
    const matchType = match.type ? ` (${match.type})` : '';
    
    // Calculate time until match
    const hoursUntil = Math.floor((matchDate - now) / (1000 * 60 * 60));
    const timeUntil = hoursUntil < 24 
      ? `${hoursUntil}h` 
      : `${Math.floor(hoursUntil / 24)}d`;
    
    const matchInfo = [
      `**${team1}** vs **${team2}**`,
      `📅 ${dateStr}`,
      `⏰ In ${timeUntil}`,
      `🏟️ ${league}${stage}${matchType}`
    ].join('\n');
    
    embed.addFields({
      name: `${match.league?.region || 'INT'} • Match ${matches.indexOf(match) + 1}`,
      value: matchInfo,
      inline: false
    });
  });

  await interaction.editReply({ embeds: [embed] });
}
