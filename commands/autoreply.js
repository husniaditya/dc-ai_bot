// Auto reply module dynamic settings via config store
const store = require('../config/store');

module.exports = (client) => {
  const lastSent = new Map(); // key(channel+pattern) -> timestamp
  client.on('messageCreate', async (msg) => {
    if (!msg.guild || msg.author.bot) return;
    const guildId = msg.guild.id;
    let gSettings;
    try { gSettings = await store.getGuildSettings(guildId); } catch { gSettings = store.getSettings(); }
    if (!gSettings) gSettings = store.getSettings();
    const { autoReplyEnabled, autoReplyCooldownMs } = gSettings;
    if (!autoReplyEnabled) return;
    let compiled = [];
    try { compiled = await store.getCompiledGuildAutoResponses(guildId); } catch {}
    if (!compiled || !compiled.length) compiled = store.getCompiledAutoResponses();
    const content = (msg.content || '').trim();
    if (!content) return;
    for (const def of compiled) {
      if (def.pattern.test(content)) {
  // Cooldown key: per-user (all patterns share one cooldown window per user)
  const key = 'u:' + msg.author.id;
        const now = Date.now();
  const last = lastSent.get(key) || 0;
  if (last && now - last < autoReplyCooldownMs) return; // still cooling down
        lastSent.set(key, now);
  if (process.env.AUTOREPLY_DEBUG === '1') console.log('[autoreply] matched', def.key, 'cooldown ms', autoReplyCooldownMs);
        let reply = def.replies[Math.floor(Math.random()*def.replies.length)];
        try {
          if (typeof reply === 'function') reply = await Promise.resolve(reply(msg));
        } catch(e){ reply = null; }
        if (typeof reply === 'string' && reply.trim().length) msg.reply(reply).catch(()=>{});
        break;
      }
    }
  });
  return { name: 'autoreply', execute: ()=>{} };
};
