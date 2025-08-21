// Auto reply module: attaches messageCreate listener when initialized.
// Exported as a function so index.js dynamic loader can pass client.
const responses = require('../auto-responses');

module.exports = (client) => {
  const enable = process.env.AUTOREPLY_ENABLED === '1';
  if (!enable) return { name: 'autoreply', execute: ()=>{} };
  const cooldownMs = parseInt(process.env.AUTOREPLY_COOLDOWN_MS || '30000', 10);
  const lastSent = new Map(); // key(channel+pattern) -> timestamp
  client.on('messageCreate', async (msg) => {
    if (!msg.guild || msg.author.bot) return;
    const content = (msg.content || '').trim();
    if (!content) return;
    for (const def of responses) {
      if (def.pattern.test(content)) {
        const key = def.key + ':' + msg.channel.id;
        const now = Date.now();
        if ((lastSent.get(key) || 0) + cooldownMs > now) return;
        lastSent.set(key, now);
        let reply = def.replies[Math.floor(Math.random()*def.replies.length)];
        try {
          if (typeof reply === 'function') {
            reply = await Promise.resolve(reply(msg));
          }
        } catch(e){ reply = null; }
        if (typeof reply === 'string' && reply.trim().length) {
          msg.reply(reply).catch(()=>{});
        }
        break;
      }
    }
  });
  return { name: 'autoreply', execute: ()=>{} };
};
