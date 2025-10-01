const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// Enka.Network API base URL
const ENKA_API_BASE = 'https://enka.network/api';

/**
 * Helper function to make Enka.Network API requests
 * @param {string} endpoint - API endpoint
 * @returns {Promise<Object>} - API response data
 */
async function enkaApiRequest(endpoint) {
  try {
    const response = await fetch(`${ENKA_API_BASE}${endpoint}`, {
      headers: {
        'User-Agent': 'Discord Bot - Genshin Impact Integration'
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Player not found or profile not public');
      } else if (response.status === 424) {
        throw new Error('Player data is being refreshed, please try again in a moment');
      } else if (response.status === 429) {
        throw new Error('Rate limited, please try again later');
      } else if (response.status >= 500) {
        throw new Error('Enka.Network server error, please try again later');  
      } else {
        throw new Error(`API error: ${response.status}`);
      }
    }

    return await response.json();
  } catch (error) {
    if (error.message.includes('fetch')) {
      throw new Error('Failed to connect to Enka.Network API');
    }
    throw error;
  }
}

/**
 * Helper function to validate UID format
 * @param {string} uid - Player UID
 * @returns {boolean} - Whether UID is valid format
 */
function isValidUID(uid) {
  return /^[1-9]\d{8}$/.test(uid);
}

/**
 * Helper function to get element emoji
 * @param {string} element - Element name
 * @returns {string} - Element emoji
 */
function getElementEmoji(element) {
  const elementMap = {
    'Anemo': '💨',
    'Geo': '🗿', 
    'Electro': '⚡',
    'Dendro': '🌱',
    'Hydro': '💧',
    'Pyro': '🔥',
    'Cryo': '❄️'
  };
  return elementMap[element] || '⭐';
}

/**
 * Helper function to get weapon type emoji
 * @param {string} weaponType - Weapon type
 * @returns {string} - Weapon emoji
 */
function getWeaponEmoji(weaponType) {
  const weaponMap = {
    'WEAPON_SWORD_ONE_HAND': '⚔️',
    'WEAPON_CLAYMORE': '🗡️',
    'WEAPON_POLE': '🏹',
    'WEAPON_BOW': '🏹',
    'WEAPON_CATALYST': '📘'
  };
  return weaponMap[weaponType] || '⚔️';
}

/**
 * Helper function to get star rating emoji
 * @param {number} rarity - Star rating (1-5)
 * @returns {string} - Star emojis
 */
function getStarRating(rarity) {
  return '⭐'.repeat(rarity || 0);
}

/**
 * Helper function to format large numbers
 * @param {number} num - Number to format
 * @returns {string} - Formatted number
 */
function formatNumber(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'k';
  }
  return num.toString();
}

/**
 * Get character name from character ID (simplified mapping)
 * In a full implementation, you'd want to load this from Enka's data files
 */
function getCharacterName(characterId) {
  const characterMap = {
    10000002: 'Ayaka',
    10000003: 'Jean', 
    10000005: 'Aether',
    10000006: 'Lisa',
    10000007: 'Lumine',
    10000014: 'Barbara',
    10000015: 'Kaeya',
    10000016: 'Diluc',
    10000020: 'Razor',
    10000021: 'Amber',
    10000022: 'Venti',
    10000023: 'Xiangling',
    10000024: 'Beidou',
    10000025: 'Xingqiu',
    10000026: 'Xiao',
    10000027: 'Ningguang',
    10000029: 'Klee',
    10000030: 'Zhongli',
    10000031: 'Fischl',
    10000032: 'Bennett',
    10000033: 'Tartaglia',
    10000034: 'Noelle',
    10000035: 'Qiqi',
    10000036: 'Chongyun',
    10000037: 'Ganyu',
    10000038: 'Albedo',
    10000039: 'Diona',
    10000041: 'Mona',
    10000042: 'Keqing',
    10000043: 'Sucrose',
    10000044: 'Xinyan',
    10000045: 'Rosaria',
    10000046: 'Hutao',
    10000047: 'Kazuha',
    10000048: 'Yanfei',
    10000049: 'Yoimiya',
    10000050: 'Thoma',
    10000051: 'Eula',
    10000052: 'Raiden',
    10000053: 'Sayu',
    10000054: 'Kokomi',
    10000055: 'Gorou',
    10000056: 'Sara',
    10000057: 'Itto',
    10000058: 'Yae',
    10000059: 'Heizou',
    10000060: 'Yelan',
    10000062: 'Aloy',
    10000063: 'Shenhe',
    10000064: 'Yunjin',
    10000065: 'Shinobu',
    10000066: 'Ayato',
    10000067: 'Collei',
    10000068: 'Dori',
    10000069: 'Tighnari',
    10000070: 'Nilou',
    10000071: 'Cyno',
    10000072: 'Candace',
    10000073: 'Nahida',
    10000074: 'Layla',
    10000075: 'Wanderer',
    10000076: 'Faruzan',
    10000077: 'Yaoyao',
    10000078: 'Alhaitham',
    10000079: 'Baizhu',
    10000080: 'Kaveh',
    10000081: 'Mika',
    10000082: 'Lynette',
    10000083: 'Lyney',
    10000084: 'Freminet',
    10000085: 'Wriothesley',
    10000086: 'Neuvillette',
    10000087: 'Charlotte',
    10000088: 'Furina',
    10000089: 'Chevreuse',
    10000090: 'Navia',
    10000091: 'Gaming',
    10000092: 'Xianyun',
    10000093: 'Chiori',
    10000094: 'Arlecchino',
    10000095: 'Sethos',
    10000096: 'Sigewinne',
    10000097: 'Emilie',
    10000098: 'Kinich',
    10000099: 'Mualani'
  };
  return characterMap[characterId] || `Character ${characterId}`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('genshin')
    .setDescription('Genshin Impact player information via Enka.Network')
    .addSubcommand(subcommand =>
      subcommand
        .setName('profile')
        .setDescription('Get player profile and basic information')
        .addStringOption(option =>
          option.setName('uid')
            .setDescription('Player UID (9-digit number)')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('build')
        .setDescription('Get detailed character builds for a player')
        .addStringOption(option =>
          option.setName('uid')
            .setDescription('Player UID (9-digit number)')
            .setRequired(true))
        .addIntegerOption(option =>
          option.setName('character')
            .setDescription('Character slot number to show (1-8)')
            .setMinValue(1)
            .setMaxValue(8))),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const uid = interaction.options.getString('uid');

    // Validate UID format
    if (!isValidUID(uid)) {
      await interaction.reply({ 
        content: 'Invalid UID format. Please provide a 9-digit UID (e.g., 123456789).', 
        ephemeral: true 
      });
      return;
    }

    try {
      switch (subcommand) {
        case 'profile':
          await handleProfileCommand(interaction, uid);
          break;
        case 'build':
          await handleBuildCommand(interaction, uid);
          break;
        default:
          await interaction.reply({ content: 'Unknown subcommand!', ephemeral: true });
      }
    } catch (error) {
      console.error('Genshin command error:', error);
      
      let errorMessage = 'An error occurred while fetching player data.';
      if (error.message.includes('not found') || error.message.includes('not public')) {
        errorMessage = 'Player not found or profile is not public. Make sure the UID is correct and the player has logged into the game recently.';
      } else if (error.message.includes('refreshed')) {
        errorMessage = 'Player data is being refreshed. Please try again in a moment.';
      } else if (error.message.includes('Rate limited')) {
        errorMessage = 'Too many requests. Please try again in a few minutes.';
      } else if (error.message.includes('server error')) {
        errorMessage = 'The Enka.Network API is currently experiencing issues. Please try again later.';
      }

      if (interaction.deferred) {
        await interaction.editReply({ content: errorMessage });
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true });
      }
    }
  },
};

/**
 * Handle profile command - show basic player information
 */
async function handleProfileCommand(interaction, uid) {
  await interaction.deferReply();
  
  const playerData = await enkaApiRequest(`/uid/${uid}`);
  
  if (!playerData.playerInfo) {
    await interaction.editReply({ content: 'No player information found.' });
    return;
  }

  const playerInfo = playerData.playerInfo;
  
  const embed = new EmbedBuilder()
    .setTitle(`${playerInfo.nickname || 'Unknown Player'}`)
    .setColor('#74C0FC')
    .setFooter({ text: `UID: ${uid}` })
    .addFields(
      { name: '🎯 Adventure Rank', value: playerInfo.level?.toString() || 'Unknown', inline: true },
      { name: '🌍 World Level', value: playerInfo.worldLevel?.toString() || 'Unknown', inline: true },
      { name: '🏆 Achievements', value: playerInfo.finishAchievementNum?.toString() || 'Unknown', inline: true }
    );

  // Add signature if available
  if (playerInfo.signature) {
    embed.setDescription(playerInfo.signature.substring(0, 2048));
  }

  // Add profile picture if available
  if (playerInfo.profilePicture?.avatarId) {
    const characterName = getCharacterName(playerInfo.profilePicture.avatarId);
    embed.addFields({ name: '👤 Profile Character', value: characterName, inline: true });
  }

  // Add Spiral Abyss progress if available
  if (playerInfo.towerFloorIndex && playerInfo.towerLevelIndex) {
    embed.addFields({ 
      name: '🗼 Spiral Abyss', 
      value: `Floor ${playerInfo.towerFloorIndex}-${playerInfo.towerLevelIndex}`, 
      inline: true 
    });
  }

  // Add character showcase count
  const showcaseCount = playerData.avatarInfoList ? playerData.avatarInfoList.length : 0;
  embed.addFields({ name: '⭐ Characters Shown', value: showcaseCount.toString(), inline: true });

  // Show some of the showcased characters
  if (playerData.avatarInfoList && playerData.avatarInfoList.length > 0) {
    const showcasedChars = playerData.avatarInfoList.slice(0, 8).map(avatar => {
      const charName = getCharacterName(avatar.avatarId);
      const level = avatar.propMap?.[4001]?.val || '?';
      const constellation = avatar.talentIdList ? avatar.talentIdList.length : 0;
      return `${charName} C${constellation} (Lv.${level})`;
    });
    
    embed.addFields({ 
      name: '🎭 Character Showcase', 
      value: showcasedChars.join('\n') || 'No characters in showcase', 
      inline: false 
    });
  }

  await interaction.editReply({ embeds: [embed] });
}

/**
 * Handle build command - show detailed character information
 */
async function handleBuildCommand(interaction, uid) {
  await interaction.deferReply();
  
  const playerData = await enkaApiRequest(`/uid/${uid}`);
  
  if (!playerData.avatarInfoList || playerData.avatarInfoList.length === 0) {
    await interaction.editReply({ content: 'No character showcase data found for this player.' });
    return;
  }

  const characterIndex = (interaction.options.getInteger('character') || 1) - 1;
  
  if (characterIndex >= playerData.avatarInfoList.length) {
    await interaction.editReply({ 
      content: `Character slot ${characterIndex + 1} not found. This player has ${playerData.avatarInfoList.length} characters in their showcase.` 
    });
    return;
  }

  const avatar = playerData.avatarInfoList[characterIndex];
  const characterName = getCharacterName(avatar.avatarId);
  
  // Extract basic character stats
  const level = avatar.propMap?.[4001]?.val || 0;
  const ascension = avatar.propMap?.[1002]?.val || 0;
  const constellation = avatar.talentIdList ? avatar.talentIdList.length : 0;
  
  // Extract main stats
  const hp = avatar.fightPropMap?.[2000] ? Math.round(avatar.fightPropMap[2000]) : 0;
  const atk = avatar.fightPropMap?.[2001] ? Math.round(avatar.fightPropMap[2001]) : 0;
  const def = avatar.fightPropMap?.[2002] ? Math.round(avatar.fightPropMap[2002]) : 0;
  const critRate = avatar.fightPropMap?.[20] ? (avatar.fightPropMap[20] * 100).toFixed(1) : '0';
  const critDmg = avatar.fightPropMap?.[22] ? (avatar.fightPropMap[22] * 100).toFixed(1) : '0';
  const energyRecharge = avatar.fightPropMap?.[23] ? (avatar.fightPropMap[23] * 100).toFixed(1) : '100';

  const embed = new EmbedBuilder()
    .setTitle(`${characterName} - Character Build`)
    .setColor('#FFD700')
    .setFooter({ text: `UID: ${uid} | Character ${characterIndex + 1}/${playerData.avatarInfoList.length}` })
    .addFields(
      { name: '📊 Basic Info', value: `Level ${level}/90 (A${ascension})\nConstellation ${constellation}`, inline: true },
      { name: '❤️ HP', value: formatNumber(hp), inline: true },
      { name: '⚔️ ATK', value: formatNumber(atk), inline: true },
      { name: '🛡️ DEF', value: formatNumber(def), inline: true },
      { name: '💥 CRIT Rate', value: `${critRate}%`, inline: true },
      { name: '💎 CRIT DMG', value: `${critDmg}%`, inline: true },
      { name: '⚡ Energy Recharge', value: `${energyRecharge}%`, inline: true }
    );

  // Add weapon information if available
  if (avatar.equipList) {
    const weapon = avatar.equipList.find(equip => equip.weapon);
    if (weapon?.weapon) {
      const weaponInfo = weapon.weapon;
      const weaponLevel = weaponInfo.level || 1;
      const weaponRank = weaponInfo.promoteLevel || 0;
      const weaponRefinement = (weaponInfo.affixMap ? Object.keys(weaponInfo.affixMap).length : 0) + 1;
      
      // This would need weapon name mapping in a full implementation
      embed.addFields({ 
        name: '⚔️ Weapon', 
        value: `Lv.${weaponLevel}/90 (R${weaponRefinement})\nAscension ${weaponRank}`, 
        inline: true 
      });
    }
  }

  // Add talent levels if available
  if (avatar.skillLevelMap) {
    const talents = Object.entries(avatar.skillLevelMap)
      .map(([skillId, level]) => `Talent: Lv.${level}`)
      .slice(0, 3) // Usually Normal Attack, Elemental Skill, Elemental Burst
      .join('\n');
    
    if (talents) {
      embed.addFields({ name: '🎯 Talents', value: talents, inline: true });
    }
  }

  // Add artifact sets if available (simplified)
  if (avatar.equipList) {
    const artifacts = avatar.equipList.filter(equip => equip.reliquary);
    if (artifacts.length > 0) {
      embed.addFields({ 
        name: '🏺 Artifacts', 
        value: `${artifacts.length}/5 artifacts equipped`, 
        inline: true 
      });
    }
  }

  await interaction.editReply({ embeds: [embed] });
}