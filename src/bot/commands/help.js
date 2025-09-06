module.exports = {
  name: 'help',
  execute: async (interaction) => {
    const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
    const categories = {
      core: '**Core**\n/ping\n/whoami\n/uptime\n/echo <text>\n/help',
      ai: '**AI**\n/ask\n/askfollow\n/explain_image (1-3 images)\n/summarize [count]\n/translate text target',
      polls: '**Polls**\n/poll create question options\n/poll results id',
      util: '**Utilities**\n/user info [target]\n/math add|sub|mul|div a b\n/remind minutes text',
      roles: '**Roles & XP**\n/role list|menu|add|remove\n/level [user]\n/rank [user]\n/xp check|leaderboard',
      scheduler: '**Scheduler**\n/scheduler list|info|enable|disable|run',
      moderation: '**Moderation & Security**\n/automod list|info|toggle\n/antiraid status|toggle\n/audit recent',
      welcome: '**Welcome System**\n/welcome preview|toggle',
      streaming: '**Streaming (Requires Manage Server)**\n/ytwatch\n/ytstats\n/ytdebug\n/twitchstats\n/twitchdebug',
      notes: '**Notes**\nOutputs chunked. Images >8MB skipped. Data in-memory.'
    };
    const select = new StringSelectMenuBuilder().setCustomId('help_select').setPlaceholder('Select category').addOptions(
      Object.keys(categories).map(k=>({ label: k, value: k }))
    );
    await interaction.reply({
      flags: 64,
      embeds: [{ title: 'Help', description: categories.core, color: 0x5865F2 }],
      components: [ new ActionRowBuilder().addComponents(select) ]
    });
  }
};
