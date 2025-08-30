// YouTube WebSub (PubSubHubbub) service for real-time notifications
// Replaces polling with push notifications from YouTube
const crypto = require('crypto');
const express = require('express');
const store = require('../../config/store');

// Use global fetch (Node 18+) with fallback
let fetchFn;
if (typeof globalThis.fetch === 'function') fetchFn = (...a) => globalThis.fetch(...a);
else {
  try { fetchFn = (...a) => require('node-fetch')(...a); } catch { fetchFn = () => { throw new Error('fetch not available'); }; }
}

// WebSub configuration
const WEBSUB_HUB_URL = 'https://pubsubhubbub.appspot.com/subscribe';
const WEBSUB_TOPIC_BASE = 'https://www.youtube.com/xml/feeds/videos.xml?channel_id=';
const WEBSUB_CALLBACK_BASE = process.env.WEBSUB_CALLBACK_BASE || 'https://chocomaid.xyz/api/youtube/websub';
const WEBSUB_SECRET = process.env.WEBSUB_SECRET || crypto.randomBytes(32).toString('hex');

// Subscription state management
const subscriptions = new Map(); // channelId -> { subscribers: Set(guildIds), subscribed: boolean, expiresAt: Date }
const pendingSubscriptions = new Set(); // channelIds being processed

// Stats for monitoring
const websubStats = {
  subscriptions: 0,
  unsubscriptions: 0,
  notifications: 0,
  errors: 0,
  lastNotification: null,
  verifications: 0,
  denials: 0
};

// Debug logging
function debugLog(message, data = null) {
  if (process.env.WEBSUB_DEBUG === '1') {
    console.log(`[WEBSUB] ${message}`, data || '');
  }
}

/**
 * Subscribe to YouTube channel notifications via WebSub
 */
async function subscribeToChannel(channelId, guildId) {
  if (!channelId || !guildId) {
    throw new Error('Channel ID and Guild ID are required');
  }

  debugLog(`Subscribe request for channel ${channelId} from guild ${guildId}`);

  // Update local subscription tracking
  if (!subscriptions.has(channelId)) {
    subscriptions.set(channelId, {
      subscribers: new Set(),
      subscribed: false,
      expiresAt: null,
      lastAttempt: null
    });
  }

  const sub = subscriptions.get(channelId);
  sub.subscribers.add(guildId);

  // If already subscribed or pending, just add the guild
  if (sub.subscribed || pendingSubscriptions.has(channelId)) {
    debugLog(`Channel ${channelId} already subscribed or pending`);
    return { success: true, status: 'already_subscribed' };
  }

  return await performWebSubOperation(channelId, 'subscribe');
}

/**
 * Unsubscribe from YouTube channel notifications
 */
async function unsubscribeFromChannel(channelId, guildId) {
  if (!subscriptions.has(channelId)) {
    return { success: true, status: 'not_subscribed' };
  }

  const sub = subscriptions.get(channelId);
  sub.subscribers.delete(guildId);

  debugLog(`Unsubscribe request for channel ${channelId} from guild ${guildId}`);

  // If other guilds still need this subscription, keep it
  if (sub.subscribers.size > 0) {
    debugLog(`Channel ${channelId} still has ${sub.subscribers.size} subscribers`);
    return { success: true, status: 'still_needed' };
  }

  // No more subscribers, unsubscribe from WebSub
  subscriptions.delete(channelId);
  return await performWebSubOperation(channelId, 'unsubscribe');
}

/**
 * Perform the actual WebSub subscription/unsubscription
 */
async function performWebSubOperation(channelId, mode) {
  const topic = WEBSUB_TOPIC_BASE + channelId;
  const callback = `${WEBSUB_CALLBACK_BASE}/${channelId}`;
  
  if (mode === 'subscribe') {
    pendingSubscriptions.add(channelId);
  }

  const params = new URLSearchParams({
    'hub.callback': callback,
    'hub.topic': topic,
    'hub.mode': mode,
    'hub.verify': 'async',
    'hub.secret': WEBSUB_SECRET,
    'hub.lease_seconds': '864000' // 10 days
  });

  try {
    debugLog(`Sending ${mode} request for channel ${channelId}`);
    
    const response = await fetchFn(WEBSUB_HUB_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Discord-YouTube-Bot/1.0'
      },
      body: params.toString()
    });

    const responseText = await response.text();
    debugLog(`WebSub ${mode} response:`, { 
      status: response.status, 
      statusText: response.statusText,
      body: responseText.slice(0, 500)
    });

    if (response.status === 202 || response.status === 204) {
      if (mode === 'subscribe') {
        websubStats.subscriptions++;
      } else {
        websubStats.unsubscriptions++;
      }
      
      const sub = subscriptions.get(channelId);
      if (sub) {
        sub.lastAttempt = new Date();
      }
      
      return { 
        success: true, 
        status: 'pending_verification',
        response: responseText 
      };
    } else {
      throw new Error(`WebSub ${mode} failed: ${response.status} ${response.statusText} - ${responseText}`);
    }

  } catch (error) {
    websubStats.errors++;
    pendingSubscriptions.delete(channelId);
    
    debugLog(`WebSub ${mode} error:`, error.message);
    throw error;
  }
}

/**
 * Handle WebSub verification challenges
 */
function handleVerification(req, res, channelId) {
  const mode = req.query['hub.mode'];
  const topic = req.query['hub.topic'];
  const challenge = req.query['hub.challenge'];
  const leaseSeconds = req.query['hub.lease_seconds'];

  debugLog(`Verification request for channel ${channelId}:`, {
    mode,
    topic,
    challenge: challenge?.slice(0, 20) + '...',
    leaseSeconds
  });

  // Verify the topic matches our expected format
  const expectedTopic = WEBSUB_TOPIC_BASE + channelId;
  if (topic !== expectedTopic) {
    debugLog(`Topic mismatch: expected ${expectedTopic}, got ${topic}`);
    websubStats.denials++;
    return res.status(404).send('Topic not found');
  }

  if (mode === 'subscribe') {
    const sub = subscriptions.get(channelId);
    if (sub) {
      sub.subscribed = true;
      sub.expiresAt = new Date(Date.now() + (parseInt(leaseSeconds) * 1000));
      pendingSubscriptions.delete(channelId);
      
      debugLog(`Subscription verified for channel ${channelId}, expires at ${sub.expiresAt}`);
    }
    websubStats.verifications++;
  } else if (mode === 'unsubscribe') {
    subscriptions.delete(channelId);
    debugLog(`Unsubscription verified for channel ${channelId}`);
    websubStats.verifications++;
  }

  // Return the challenge to confirm the verification
  res.status(200).send(challenge);
}

/**
 * Handle incoming WebSub notifications
 */
async function handleNotification(req, res, channelId, client) {
  try {
    // Verify the signature if secret is configured
    if (WEBSUB_SECRET && req.headers['x-hub-signature']) {
      const signature = req.headers['x-hub-signature'];
      const bodyString = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      const expectedSignature = 'sha1=' + crypto
        .createHmac('sha1', WEBSUB_SECRET)
        .update(bodyString, 'utf8')
        .digest('hex');

      if (signature !== expectedSignature) {
        debugLog(`Signature verification failed for channel ${channelId}`);
        return res.status(401).send('Unauthorized');
      }
    }

    debugLog(`Notification received for channel ${channelId}`);
    websubStats.notifications++;
    websubStats.lastNotification = new Date().toISOString();

    // Parse the Atom XML feed
    const feedXml = typeof req.body === 'string' ? req.body : req.body.toString();
    const videos = await parseAtomFeed(feedXml, channelId);

    if (videos.length > 0) {
      debugLog(`Parsed ${videos.length} videos from notification`);
      
      // Process videos for all guilds subscribed to this channel
      const sub = subscriptions.get(channelId);
      if (sub && sub.subscribers.size > 0) {
        await processNotificationVideos(videos, channelId, Array.from(sub.subscribers), client);
      }
    }

    res.status(200).send('OK');

  } catch (error) {
    websubStats.errors++;
    debugLog(`Notification processing error:`, error.message);
    console.error('WebSub notification error:', error);
    res.status(500).send('Processing error');
  }
}

/**
 * Parse Atom XML feed from YouTube WebSub notification
 */
async function parseAtomFeed(xml, channelId) {
  try {
    const videos = [];
    
    // Extract entry elements
    const entryMatches = xml.matchAll(/<entry>(.*?)<\/entry>/gs);
    
    for (const match of entryMatches) {
      const entryXml = match[1];
      
      // Extract video information
      const videoId = extractXmlValue(entryXml, 'yt:videoId');
      const title = extractXmlValue(entryXml, 'title');
      const published = extractXmlValue(entryXml, 'published');
      const updated = extractXmlValue(entryXml, 'updated');
      
      if (videoId) {
        const video = {
          videoId,
          title: title || 'Unknown Title',
          publishedAt: published || updated || new Date().toISOString(),
          thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
          channelId,
          liveBroadcastContent: 'none', // Will be determined later if needed
          isFromWebSub: true
        };
        
        videos.push(video);
        debugLog(`Parsed video: ${videoId} - ${title}`);
      }
    }
    
    return videos;
    
  } catch (error) {
    debugLog(`Feed parsing error:`, error.message);
    return [];
  }
}

/**
 * Extract value from XML using simple regex (good enough for Atom feeds)
 */
function extractXmlValue(xml, tagName) {
  const match = xml.match(new RegExp(`<${tagName}[^>]*>([^<]*)<\/${tagName}>`));
  return match ? match[1].trim() : null;
}

/**
 * Process videos from WebSub notification
 */
async function processNotificationVideos(videos, channelId, guildIds, client) {
  // Import the announce function from the shared announcer
  const { announce } = require('./youtube-announcer');
  
  for (const guildId of guildIds) {
    try {
      const guild = client.guilds.cache.get(guildId);
      if (!guild) {
        debugLog(`Guild ${guildId} not found, removing from subscriptions`);
        const sub = subscriptions.get(channelId);
        if (sub) {
          sub.subscribers.delete(guildId);
        }
        continue;
      }

      const config = await store.getGuildYouTubeConfig(guildId);
      if (!config.enabled || !config.channels.includes(channelId)) {
        debugLog(`Guild ${guildId} has disabled YouTube or removed channel ${channelId}`);
        const sub = subscriptions.get(channelId);
        if (sub) {
          sub.subscribers.delete(guildId);
        }
        continue;
      }

      // Process each video
      for (const video of videos) {
        // Check if we've already announced this video using simple in-memory tracking
        // In production, you might want to integrate this with your existing state system
        const stateKey = `${guildId}:${channelId}`;
        if (!this.processedVideos) this.processedVideos = new Map();
        if (!this.processedVideos.has(stateKey)) {
          this.processedVideos.set(stateKey, new Set());
        }
        
        const processedSet = this.processedVideos.get(stateKey);
        
        if (!processedSet.has(video.videoId)) {
          // Add to processed videos
          processedSet.add(video.videoId);
          
          // Prune old entries (keep last 100)
          if (processedSet.size > 100) {
            const arr = Array.from(processedSet);
            processedSet.clear();
            arr.slice(-100).forEach(id => processedSet.add(id));
          }
          
          // Determine if it's live (we could check via API but for WebSub, assume upload unless indicated)
          const isLive = await checkIfVideoIsLive(video.videoId);
          video.liveBroadcastContent = isLive ? 'live' : 'none';
          
          // Announce the video
          const videoType = isLive ? 'live' : 'upload';
          await announce(guild, config, video, videoType);
          
          debugLog(`Announced ${videoType}: ${video.title} in guild ${guildId}`);
        }
      }

    } catch (error) {
      debugLog(`Error processing videos for guild ${guildId}:`, error.message);
    }
  }
}

/**
 * Check if a video is currently live (simple check)
 */
async function checkIfVideoIsLive(videoId) {
  try {
    const apiKey = process.env.YOUTUBE_API_KEY || process.env.YOUTUBE_API_KEYS?.split(',')[0];
    if (!apiKey) return false;

    const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${apiKey}`;
    const response = await fetchFn(url);
    
    if (response.ok) {
      const data = await response.json();
      if (data.items && data.items.length > 0) {
        return data.items[0].snippet.liveBroadcastContent === 'live';
      }
    }
    
    return false;
  } catch (error) {
    debugLog(`Error checking live status for ${videoId}:`, error.message);
    return false;
  }
}

/**
 * Synchronize subscriptions based on current guild configurations
 */
async function syncSubscriptions(client) {
  debugLog('Starting subscription sync');
  
  const activeChannels = new Set();
  
  // Collect all channels that should be subscribed
  for (const guild of client.guilds.cache.values()) {
    try {
      const config = await store.getGuildYouTubeConfig(guild.id);
      if (config.enabled && Array.isArray(config.channels)) {
        for (const channelId of config.channels) {
          activeChannels.add(channelId);
          await subscribeToChannel(channelId, guild.id);
        }
      }
    } catch (error) {
      debugLog(`Error syncing subscriptions for guild ${guild.id}:`, error.message);
    }
  }

  // Unsubscribe from channels no longer needed
  for (const [channelId, sub] of subscriptions.entries()) {
    if (!activeChannels.has(channelId)) {
      debugLog(`Unsubscribing from unused channel: ${channelId}`);
      subscriptions.delete(channelId);
      await performWebSubOperation(channelId, 'unsubscribe').catch(err => {
        debugLog(`Failed to unsubscribe from ${channelId}:`, err.message);
      });
    }
  }

  debugLog(`Subscription sync complete. Active channels: ${activeChannels.size}`);
}

/**
 * Renew subscriptions that are about to expire
 */
async function renewSubscriptions() {
  const renewThreshold = 24 * 60 * 60 * 1000; // 24 hours before expiry
  const now = new Date();

  for (const [channelId, sub] of subscriptions.entries()) {
    if (sub.subscribed && sub.expiresAt && (sub.expiresAt.getTime() - now.getTime()) < renewThreshold) {
      debugLog(`Renewing subscription for channel ${channelId}`);
      try {
        await performWebSubOperation(channelId, 'subscribe');
      } catch (error) {
        debugLog(`Failed to renew subscription for ${channelId}:`, error.message);
      }
    }
  }
}

/**
 * Get current WebSub statistics
 */
function getWebSubStats() {
  return {
    ...websubStats,
    activeSubscriptions: Array.from(subscriptions.entries()).filter(([_, sub]) => sub.subscribed).length,
    totalChannels: subscriptions.size,
    pendingSubscriptions: pendingSubscriptions.size
  };
}

/**
 * Initialize WebSub service
 */
function initializeWebSub(client) {
  // Check if callback base is properly configured
  if (!WEBSUB_CALLBACK_BASE) {
    console.warn('WebSub service disabled: WEBSUB_CALLBACK_BASE not set');
    return false;
  }
  
  // Disable for localhost/development URLs
  if (WEBSUB_CALLBACK_BASE.includes('localhost') || WEBSUB_CALLBACK_BASE.includes('127.0.0.1')) {
    console.warn('WebSub service disabled: localhost URLs not supported by YouTube WebSub');
    return false;
  }
  
  // Check for placeholder values
  if (WEBSUB_CALLBACK_BASE.includes('yourdomain.com') || WEBSUB_CALLBACK_BASE.includes('example.com')) {
    console.warn('WebSub service disabled: placeholder domain detected');
    return false;
  }

  debugLog('Initializing WebSub service');

  // Sync subscriptions on startup
  setTimeout(() => syncSubscriptions(client), 5000);

  // Set up periodic subscription renewal (every 6 hours)
  setInterval(() => renewSubscriptions(), 6 * 60 * 60 * 1000);

  // Set up periodic sync (every hour)
  setInterval(() => syncSubscriptions(client), 60 * 60 * 1000);

  console.log('YouTube WebSub service initialized');
  return true;
}

module.exports = {
  subscribeToChannel,
  unsubscribeFromChannel,
  handleVerification,
  handleNotification,
  syncSubscriptions,
  getWebSubStats,
  initializeWebSub,
  subscriptions,
  WEBSUB_CALLBACK_BASE
};
