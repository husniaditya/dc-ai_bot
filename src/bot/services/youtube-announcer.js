// Shared YouTube announcement functionality
// Used by both polling and WebSub services
const store = require('../../config/store');

/**
 * Build role mention string from configuration
 */
function buildRoleMention(cfg) {
  const targets = Array.isArray(cfg.mentionTargets) ? cfg.mentionTargets : [];
  if (!targets.length) return '';
  
  const parts = targets.map(t => {
    if (t === 'everyone') return '@everyone';
    if (t === 'here') return '@here';
    if (/^[0-9]{5,32}$/.test(t)) return `<@&${t}>`;
    return null;
  }).filter(Boolean);
  
  // Deduplicate preserving order
  const seen = new Set();
  const uniq = parts.filter(p => { 
    if (seen.has(p)) return false; 
    seen.add(p); 
    return true; 
  });
  
  return uniq.join(' ');
}

/**
 * Announce a video/stream to Discord
 */
async function announce(guild, cfg, video, type) {
  const debug = process.env.YT_DEBUG === '1';
  
  // Determine which channel to use based on type
  let announceChannelId;
  if (type === 'live') {
    announceChannelId = cfg.liveAnnounceChannelId || cfg.announceChannelId;
  } else {
    announceChannelId = cfg.uploadAnnounceChannelId || cfg.announceChannelId;
  }
  
  if (!announceChannelId) {
    return;
  }
  
  const ch = guild.channels.cache.get(announceChannelId);
  if (!ch || !ch.isTextBased()) {
    return;
  }

  const memberOnlyFlag = video.isMemberOnly ? ' [MEMBER-ONLY]' : '';
  const sourceFlag = video.isFromWebSub ? ' [WEBSUB]' : ' [POLL]';
  
  if (debug) {
    console.log(`[YT] ANNOUNCE: ${type.toUpperCase()}${memberOnlyFlag}${sourceFlag} - ${video.title} (${video.videoId}) in guild ${guild.id}`);
  }
  
  // Template selection with member-only support
  let baseTemplate = '';
  if (type === 'live') {
    if (video.isMemberOnly && cfg.memberOnlyLiveTemplate) {
      baseTemplate = cfg.memberOnlyLiveTemplate;
    } else {
      baseTemplate = cfg.liveTemplate || '';
    }
  } else {
    if (video.isMemberOnly && cfg.memberOnlyUploadTemplate) {
      baseTemplate = cfg.memberOnlyUploadTemplate;
    } else {
      baseTemplate = cfg.uploadTemplate || '';
    }
  }
  
  const roleMention = buildRoleMention(cfg);
  const url = `https://youtu.be/${video.videoId}`;
  const memberBadge = video.isMemberOnly ? '👑 ' : '';
  const memberText = video.isMemberOnly ? ' (Members Only)' : '';
  
  let content = baseTemplate
    .replace(/\{roleMention\}/g, roleMention)
    .replace(/\{channelTitle\}/g, cfg.channelNames?.[video.channelId] || 'YouTube Channel')
    .replace(/\{title\}/g, video.title || 'Untitled')
    .replace(/\{url\}/g, url)
    .replace(/\{thumbnail\}/g, video.thumbnail || '')
    .replace(/\{memberBadge\}/g, memberBadge)
    .replace(/\{memberText\}/g, memberText)
    .replace(/\{publishedAt\}/g, video.publishedAt ? new Date(video.publishedAt).toISOString() : new Date().toISOString())
    .replace(/\{publishedAtRelative\}/g, 'just now');
  
  if (!cfg.embedEnabled) {
    if (content.length === 0) {
      content = `${memberBadge}${roleMention} ${url}${memberText}`.trim();
    }
    // If template didn't include {thumbnail} but we have one, append it so users still see the image link
    if (video.thumbnail && !/https?:\/\/.*(img\.youtube|ytimg|youtube)\./i.test(content)) {
      content = content + `\n${video.thumbnail}`;
    }
    await ch.send(content);
    return;
  }
  
  // Enhanced embed for member-only content
  const embedColor = video.isMemberOnly ? 0xFFD700 : (type === 'live' ? 0xE53935 : 0x1E88E5); // Gold for member-only
  const embed = {
    title: `${memberBadge}${video.title?.slice(0, 256) || 'New Video'}${memberText}`,
    url,
    description: content.slice(0, 4000),
    color: embedColor,
    // Add footer with YouTube logo and timestamp using publishedAt
    footer: {
      text: `YouTube${video.isFromWebSub ? ' • Real-time' : ''} • ${video.publishedAt ? new Date(video.publishedAt).toLocaleTimeString() : new Date().toLocaleTimeString()}`,
      icon_url: 'https://img.icons8.com/color/96/000000/youtube-play.png'
    }
  };
  
  if (video.thumbnail) { 
    embed.image = { url: video.thumbnail }; 
  }
  
  // Add member-only field to embed
  if (video.isMemberOnly) {
    embed.fields = [{
      name: '👑 Member Exclusive',
      value: 'This content is available to channel members only.',
      inline: false
    }];
  }
  
  // Add additional live stream info if available
  if (type === 'live' && video.concurrentViewers) {
    if (!embed.fields) embed.fields = [];
    embed.fields.push({
      name: '👀 Viewers',
      value: video.concurrentViewers.toString(),
      inline: true
    });
  }
  
  // Add WebSub indicator for debugging
  if (video.isFromWebSub && debug) {
    if (!embed.fields) embed.fields = [];
    embed.fields.push({
      name: '⚡ Source',
      value: 'Real-time notification',
      inline: true
    });
  }
  
  await ch.send({ content: roleMention || undefined, embeds: [embed] });
}

module.exports = {
  announce,
  buildRoleMention
};
