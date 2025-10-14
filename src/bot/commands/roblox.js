const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// Roblox public API endpoints
const ROBLOX_USERS_API = 'https://users.roblox.com';
const ROBLOX_THUMBS_API = 'https://thumbnails.roblox.com';
const ROBLOX_FRIENDS_API = 'https://friends.roblox.com';
const ROBLOX_GROUPS_API = 'https://groups.roblox.com';

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json', ...(opts.headers || {}) },
    method: opts.method || 'GET',
    body: opts.body ? (typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body)) : undefined,
  });
  if (!res.ok) {
    // Try to parse error
    let detail = '';
    try { const j = await res.json(); detail = j?.errors?.[0]?.message || j?.message || ''; } catch {}
    const msg = `HTTP ${res.status}${detail ? ` - ${detail}` : ''}`;
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

// Map username -> userId via Roblox Users API (bulk username resolver)
async function resolveUsernameToId(username) {
  const payload = { usernames: [username], excludeBannedUsers: true }; 
  const data = await fetchJson(`${ROBLOX_USERS_API}/v1/usernames/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
  });
  const id = data?.data?.[0]?.id;
  if (!id) throw new Error('User not found');
  return id;
}

async function getUserProfile(userId) {
  return fetchJson(`${ROBLOX_USERS_API}/v1/users/${userId}`);
}

async function getAvatarThumb(userId, size = '720x720') {
  const qs = new URLSearchParams({ userIds: String(userId), size, format: 'Png', isCircular: 'false' });
  const data = await fetchJson(`${ROBLOX_THUMBS_API}/v1/users/avatar?${qs.toString()}`);
  const url = data?.data?.[0]?.imageUrl || null;
  return url;
}

async function getSocialCounts(userId) {
  const [friends, followers, followings] = await Promise.all([
    fetchJson(`${ROBLOX_FRIENDS_API}/v1/users/${userId}/friends/count`).catch(() => ({ count: 0 })),
    fetchJson(`${ROBLOX_FRIENDS_API}/v1/users/${userId}/followers/count`).catch(() => ({ count: 0 })),
    fetchJson(`${ROBLOX_FRIENDS_API}/v1/users/${userId}/followings/count`).catch(() => ({ count: 0 })),
  ]);
  return {
    friends: friends?.count ?? 0,
    followers: followers?.count ?? 0,
    following: followings?.count ?? 0,
  };
}

async function getUserGroups(userId) {
  const data = await fetchJson(`${ROBLOX_GROUPS_API}/v1/users/${userId}/groups/roles`).catch(() => ({ data: [] }));
  return Array.isArray(data?.data) ? data.data : [];
}

function truncate(text, max = 300) {
  if (!text) return '';
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + '…';
}

function formatDate(iso) {
  try {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? 'N/A' : d.toLocaleDateString();
  } catch {
    return 'N/A';
  }
}

async function resolveUserIdFromOptions(interaction) {
  const idOpt = interaction.options.getInteger('id');
  const usernameOpt = interaction.options.getString('username');

  if (idOpt) return idOpt;
  if (!usernameOpt) throw new Error('Please provide a username or id');
  return resolveUsernameToId(usernameOpt);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roblox')
    .setDescription('Roblox user info and utilities')
    .addSubcommand(sub =>
      sub.setName('user')
        .setDescription('Get Roblox user profile')
        .addStringOption(o => o.setName('username').setDescription('Roblox username'))
        .addIntegerOption(o => o.setName('id').setDescription('Roblox user ID'))
    )
    .addSubcommand(sub =>
      sub.setName('avatar')
        .setDescription('Get Roblox user avatar')
        .addStringOption(o => o.setName('username').setDescription('Roblox username'))
        .addIntegerOption(o => o.setName('id').setDescription('Roblox user ID'))
        .addStringOption(o => o
          .setName('size')
          .setDescription('Avatar size')
          .addChoices(
            { name: '150x150', value: '150x150' },
            { name: '352x352', value: '352x352' },
            { name: '420x420', value: '420x420' },
            { name: '720x720', value: '720x720' },
          ))
    )
    .addSubcommand(sub =>
      sub.setName('groups')
        .setDescription('List user groups and roles')
        .addStringOption(o => o.setName('username').setDescription('Roblox username'))
        .addIntegerOption(o => o.setName('id').setDescription('Roblox user ID'))
        .addIntegerOption(o => o.setName('limit').setDescription('How many groups to show (1-10)').setMinValue(1).setMaxValue(10))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    try {
      switch (sub) {
        case 'user':
          await handleUser(interaction);
          break;
        case 'avatar':
          await handleAvatar(interaction);
          break;
        case 'groups':
          await handleGroups(interaction);
          break;
        default:
          await interaction.reply({ content: 'Unknown subcommand', ephemeral: true });
      }
    } catch (err) {
      console.error('Roblox command error:', err);
      const content = err?.message?.includes('not found')
        ? 'User not found. Double-check the username/ID.'
        : err?.status === 429
          ? 'Roblox API rate limited. Please try again shortly.'
          : 'Failed to process Roblox command.';

      if (interaction.deferred) {
        await interaction.editReply({ content, ephemeral: true });
      } else {
        await interaction.reply({ content, ephemeral: true });
      }
    }
  }
};

async function handleUser(interaction) {
  await interaction.deferReply();
  const userId = await resolveUserIdFromOptions(interaction);

  const [profile, avatarUrl, counts] = await Promise.all([
    getUserProfile(userId),
    getAvatarThumb(userId),
    getSocialCounts(userId),
  ]);

  const embed = new EmbedBuilder()
    .setTitle(`Roblox: ${profile.name} ${profile.displayName && profile.displayName !== profile.name ? `(${profile.displayName})` : ''}`.trim())
    .setURL(`https://www.roblox.com/users/${userId}/profile`)
    .setColor('#00A2FF')
    .setThumbnail(avatarUrl || null)
    .setDescription(truncate(profile.description || 'No description'))
    .addFields(
      { name: 'User ID', value: String(userId), inline: true },
      { name: 'Created', value: formatDate(profile.created), inline: true },
      { name: '\u200B', value: '\u200B', inline: true },
      { name: 'Friends', value: String(counts.friends), inline: true },
      { name: 'Followers', value: String(counts.followers), inline: true },
      { name: 'Following', value: String(counts.following), inline: true },
    );

  await interaction.editReply({ embeds: [embed] });
}

async function handleAvatar(interaction) {
  await interaction.deferReply();
  const userId = await resolveUserIdFromOptions(interaction);
  const size = interaction.options.getString('size') || '720x720';

  const [profile, avatarUrl] = await Promise.all([
    getUserProfile(userId),
    getAvatarThumb(userId, size),
  ]);

  const embed = new EmbedBuilder()
    .setTitle(`Avatar: ${profile.name}`)
    .setURL(`https://www.roblox.com/users/${userId}/profile`)
    .setColor('#00A2FF')
    .setImage(avatarUrl || null);

  await interaction.editReply({ embeds: [embed] });
}

async function handleGroups(interaction) {
  await interaction.deferReply();
  const userId = await resolveUserIdFromOptions(interaction);
  const limit = interaction.options.getInteger('limit') || 6;

  const [profile, groups] = await Promise.all([
    getUserProfile(userId),
    getUserGroups(userId),
  ]);

  if (!groups || groups.length === 0) {
    await interaction.editReply({ content: 'This user is not in any groups or groups are private.', ephemeral: true });
    return;
  }

  // sort: show groups where the user has a higher rank first
  const sorted = groups.sort((a, b) => (b?.role?.rank || 0) - (a?.role?.rank || 0)).slice(0, limit);

  const embed = new EmbedBuilder()
    .setTitle(`Groups: ${profile.name}`)
    .setURL(`https://www.roblox.com/users/${userId}/profile`)
    .setColor('#00A2FF');

  sorted.forEach(g => {
    const name = g?.group?.name || 'Unknown Group';
    const role = g?.role?.name || 'Member';
    const rank = g?.role?.rank ?? 0;
    const groupId = g?.group?.id;
    const memberCount = g?.group?.memberCount;
    const value = [
      groupId ? `[View Group](https://www.roblox.com/groups/${groupId})` : null,
      `Role: ${role} (Rank ${rank})`,
      typeof memberCount === 'number' ? `Members: ${memberCount}` : null,
    ].filter(Boolean).join(' \u2022 ');
    embed.addFields({ name, value: value || '—', inline: false });
  });

  await interaction.editReply({ embeds: [embed] });
}
