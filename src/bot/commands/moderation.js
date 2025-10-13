const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { checkCommandAndReply } = require('../../utils/validation');

function parseDuration(input) {
  if (!input) return null;
  if (/^\d+$/.test(input)) return Math.max(1, Math.min(28 * 24 * 60, parseInt(input, 10))) * 60 * 1000; // minutes -> ms
  const m = String(input).trim().match(/^(\d+)([smhdw])$/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  const unit = m[2].toLowerCase();
  const mult = unit === 's' ? 1000 : unit === 'm' ? 60_000 : unit === 'h' ? 3_600_000 : unit === 'd' ? 86_400_000 : 604_800_000;
  const ms = n * mult;
  // Discord timeout max is 28 days
  return Math.min(ms, 28 * 24 * 60 * 60 * 1000);
}

module.exports = {
  name: 'moderation',
  data: new SlashCommandBuilder()
    .setName('moderation')
    .setDescription('Moderation commands')
    .setDMPermission(false)
    // ban
    .addSubcommand(sc => sc.setName('ban').setDescription('Ban a user')
      .addUserOption(o => o.setName('user').setDescription('User to ban').setRequired(true))
      .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false))
      .addIntegerOption(o => o.setName('del_days').setDescription('Delete message history (0-7 days)').setMinValue(0).setMaxValue(7)))
    // unban
    .addSubcommand(sc => sc.setName('unban').setDescription('Unban a user by ID')
      .addStringOption(o => o.setName('user_id').setDescription('User ID to unban').setRequired(true))
      .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false)))
    // kick
    .addSubcommand(sc => sc.setName('kick').setDescription('Kick a user')
      .addUserOption(o => o.setName('user').setDescription('User to kick').setRequired(true))
      .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false)))
    // mute (timeout)
    .addSubcommand(sc => sc.setName('mute').setDescription('Timeout (mute) a user')
      .addUserOption(o => o.setName('user').setDescription('User to mute').setRequired(true))
      .addStringOption(o => o.setName('duration').setDescription('Duration (e.g., 10m, 2h, 1d)').setRequired(true))
      .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false)))
    // unmute (clear timeout)
    .addSubcommand(sc => sc.setName('unmute').setDescription('Remove timeout (unmute) a user')
      .addUserOption(o => o.setName('user').setDescription('User to unmute').setRequired(true))
      .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false)))
    // slowmode
    .addSubcommand(sc => sc.setName('slowmode').setDescription('Set channel slowmode')
      .addIntegerOption(o => o.setName('seconds').setDescription('Seconds between messages (0-21600)').setMinValue(0).setMaxValue(21600).setRequired(true))
      .addChannelOption(o => o.setName('channel').setDescription('Channel to apply slowmode to').setRequired(false))
      .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const store = require('../../config/store');

    // Validate per-subcommand toggle (ephemeral replies to avoid clutter)
    const commandName = `moderation ${sub}`;
    const canExecute = await checkCommandAndReply(interaction, commandName, store, true);
    if (!canExecute) return;

    try {
      switch (sub) {
        case 'ban': {
          if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
            return interaction.reply({ content: '❌ You need the Ban Members permission.', flags: 64 });
          }
          const user = interaction.options.getUser('user');
          const reason = interaction.options.getString('reason') || 'No reason provided';
          const delDays = interaction.options.getInteger('del_days') || 0;
          const member = await interaction.guild.members.fetch(user.id).catch(() => null);
          if (member && member.bannable === false) {
            return interaction.reply({ content: '❌ I cannot ban this member (role hierarchy).', flags: 64 });
          }
          await interaction.deferReply({ flags: 64 });
          await interaction.guild.members.ban(user.id, { deleteMessageDays: delDays, reason }).catch(async (e) => {
            throw new Error(e.message || 'Failed to ban user');
          });
          return interaction.editReply(`✅ Banned <@${user.id}>${delDays ? ` and deleted ${delDays} day(s) of messages` : ''}. Reason: ${reason}`);
        }
        case 'unban': {
          if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
            return interaction.reply({ content: '❌ You need the Ban Members permission.', flags: 64 });
          }
          const userId = interaction.options.getString('user_id');
          const reason = interaction.options.getString('reason') || 'No reason provided';
          await interaction.deferReply({ flags: 64 });
          await interaction.guild.bans.remove(userId, reason).catch(async (e) => {
            throw new Error(e.message || 'Failed to unban user');
          });
          return interaction.editReply(`✅ Unbanned <@${userId}>. Reason: ${reason}`);
        }
        case 'kick': {
          if (!interaction.member.permissions.has(PermissionFlagsBits.KickMembers)) {
            return interaction.reply({ content: '❌ You need the Kick Members permission.', flags: 64 });
          }
          const user = interaction.options.getUser('user');
          const reason = interaction.options.getString('reason') || 'No reason provided';
          await interaction.deferReply({ flags: 64 });
          const member = await interaction.guild.members.fetch(user.id).catch(() => null);
          if (!member) return interaction.editReply('❌ User is not in this server.');
          if (!member.kickable) return interaction.editReply('❌ I cannot kick this member (role hierarchy).');
          await member.kick(reason).catch(async (e) => { throw new Error(e.message || 'Failed to kick user'); });
          return interaction.editReply(`✅ Kicked <@${user.id}>. Reason: ${reason}`);
        }
        case 'mute': {
          if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
            return interaction.reply({ content: '❌ You need the Moderate Members permission.', flags: 64 });
          }
          const user = interaction.options.getUser('user');
          const durationStr = interaction.options.getString('duration');
          const reason = interaction.options.getString('reason') || 'No reason provided';
          const ms = parseDuration(durationStr);
          if (!ms) return interaction.reply({ content: '❌ Invalid duration. Use formats like 10m, 2h, 1d or minutes as a number.', flags: 64 });
          await interaction.deferReply({ flags: 64 });
          const member = await interaction.guild.members.fetch(user.id).catch(() => null);
          if (!member) return interaction.editReply('❌ User is not in this server.');
          await member.timeout(ms, reason).catch(async (e) => { throw new Error(e.message || 'Failed to mute (timeout) user'); });
          return interaction.editReply(`✅ Muted (timed out) <@${user.id}> for ${durationStr}. Reason: ${reason}`);
        }
        case 'unmute': {
          if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
            return interaction.reply({ content: '❌ You need the Moderate Members permission.', flags: 64 });
          }
          const user = interaction.options.getUser('user');
          const reason = interaction.options.getString('reason') || 'No reason provided';
          await interaction.deferReply({ flags: 64 });
          const member = await interaction.guild.members.fetch(user.id).catch(() => null);
          if (!member) return interaction.editReply('❌ User is not in this server.');
          await member.timeout(null, reason).catch(async (e) => { throw new Error(e.message || 'Failed to unmute user'); });
          return interaction.editReply(`✅ Unmuted <@${user.id}>. Reason: ${reason}`);
        }
        case 'slowmode': {
          if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return interaction.reply({ content: '❌ You need the Manage Channels permission.', flags: 64 });
          }
          const seconds = interaction.options.getInteger('seconds');
          const channel = interaction.options.getChannel('channel') || interaction.channel;
          const reason = interaction.options.getString('reason') || 'No reason provided';
          await interaction.deferReply({ flags: 64 });
          if (!('setRateLimitPerUser' in channel)) return interaction.editReply('❌ Slowmode can only be set on text channels.');
          await channel.setRateLimitPerUser(seconds, reason).catch(async (e) => { throw new Error(e.message || 'Failed to set slowmode'); });
          return interaction.editReply(`✅ Set slowmode in ${channel} to ${seconds}s.`);
        }
        default:
          return interaction.reply({ content: 'Unknown subcommand.', flags: 64 });
      }
    } catch (err) {
      console.error('[moderation] error:', err);
      if (interaction.deferred) {
        return interaction.editReply('❌ An error occurred while processing the command.');
      } else {
        return interaction.reply({ content: '❌ An error occurred while processing the command.', flags: 64 });
      }
    }
  }
};
