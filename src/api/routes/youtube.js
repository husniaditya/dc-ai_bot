const express = require('express');
const { PermissionsBitField } = require('discord.js');
const { audit } = require('../middleware/audit');

// Use built-in global fetch (Node 18+) to avoid ESM require issues
const fetchFn = (...args) => globalThis.fetch(...args);

function createYouTubeRoutes(client, store) {
  const router = express.Router();

  // Get YouTube config
  router.get('/config', async (req, res) => {
    try {
      const guildId = req.query.guildId || (req.user.type === 'discord' ? 
        (await store.getUser(req.user.userId))?.selected_guild_id : null);
      
      if (!guildId) return res.status(400).json({ error: 'guild_required' });
      
      const cfg = await store.getGuildYouTubeConfig(guildId);
      res.json(cfg);
    } catch(e) { 
      res.status(500).json({ error: 'load_failed' }); 
    }
  });

  // Update YouTube config
  router.put('/config', async (req, res) => {
    try {
      const guildId = req.query.guildId || (req.user.type === 'discord' ? 
        (await store.getUser(req.user.userId))?.selected_guild_id : null);
      
      if (!guildId) return res.status(400).json({ error: 'guild_required' });

      // Permissions: require Manage Guild if discord user
      if (req.user.type === 'discord') {
        try {
          const guild = client.guilds.cache.get(guildId);
          if (!guild) return res.status(400).json({ error: 'bot_not_in_guild' });
          
          const member = await guild.members.fetch(req.user.userId).catch(() => null);
          if (!member) return res.status(403).json({ error: 'not_in_guild' });
          
          if (!member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return res.status(403).json({ error: 'insufficient_permissions' });
          }
        } catch { 
          return res.status(403).json({ error: 'permission_check_failed' }); 
        }
      }

      const partial = {
        channels: Array.isArray(req.body.channels) ? req.body.channels : undefined,
        announceChannelId: req.body.announceChannelId,
        mentionRoleId: req.body.mentionRoleId,
        mentionTargets: Array.isArray(req.body.mentionTargets) ? req.body.mentionTargets : undefined,
        enabled: req.body.enabled,
        intervalSec: req.body.intervalSec,
        uploadTemplate: req.body.uploadTemplate,
        liveTemplate: req.body.liveTemplate,
        memberOnlyUploadTemplate: req.body.memberOnlyUploadTemplate,
        memberOnlyLiveTemplate: req.body.memberOnlyLiveTemplate,
        embedEnabled: req.body.embedEnabled,
        channelMessages: req.body.channelMessages,
        channelNames: req.body.channelNames
      };

      const cfg = await store.setGuildYouTubeConfig(guildId, partial);
      
      if (store.invalidateGuildYouTubeConfig) { 
        store.invalidateGuildYouTubeConfig(guildId); 
      }
      
      audit(req, { action: 'update-youtube-config', guildId });

      // Re-fetch to ensure values (mention/flags) reflect DB authoritative columns
      const fresh = await store.getGuildYouTubeConfig(guildId);
      res.json(fresh);
    } catch(e) { 
      res.status(500).json({ error: 'persist_failed' }); 
    }
  });

  // Resolve YouTube channel input (ID / URL / handle) -> channelId
  router.post('/resolve-channel', async (req, res) => {
    try {
      const { input } = req.body || {};
      if (!input || typeof input !== 'string') {
        return res.status(400).json({ error: 'input_required' });
      }

      const raw = input.trim();
      const idMatch = raw.match(/(UC[0-9A-Za-z_-]{21,})/);
      
      if (idMatch) { 
        return res.json({ channelId: idMatch[1], source: 'direct' }); 
      }

      // Extract handle or path component
      let handle = null;
      let originalHandle = null;
      
      if (raw.startsWith('@')) {
        handle = raw.slice(1);
      } else {
        try {
          const u = new URL(raw.startsWith('http') ? raw : ('https://www.youtube.com/' + raw));
          const parts = u.pathname.split('/').filter(Boolean);
          
          if (parts.length) {
            if (parts[0].startsWith('@')) {
              handle = parts[0].slice(1);
            } else if (['c', 'user'].includes(parts[0]) && parts[1]) {
              handle = parts[1];
            } else if (parts[0]) {
              handle = parts[0].startsWith('@') ? parts[0].slice(1) : parts[0];
            }
          }
        } catch {}
      }

      if (!handle) return res.status(400).json({ error: 'unrecognized_format' });
      
      originalHandle = handle;

      // Attempt HTML scrape first
      async function scrapeVariants(h) {
        const bases = [
          'https://www.youtube.com/@' + encodeURIComponent(h),
          'https://www.youtube.com/@' + encodeURIComponent(h) + '/about',
          'https://www.youtube.com/@' + encodeURIComponent(h) + '/videos',
          'https://www.youtube.com/@' + encodeURIComponent(h) + '/streams',
          'https://www.youtube.com/c/' + encodeURIComponent(h),
          'https://www.youtube.com/c/' + encodeURIComponent(h) + '/about',
          'https://www.youtube.com/user/' + encodeURIComponent(h),
          'https://www.youtube.com/user/' + encodeURIComponent(h) + '/about'
        ];
        
        const idRegexes = [
          /"channelId":"(UC[0-9A-Za-z_-]{21,})"/,
          /\\"channelId\\":\\"(UC[0-9A-Za-z_-]{21,})\\"/,
          /data-channel-external-id=\"(UC[0-9A-Za-z_-]{21,})\"/,
          /(UC[0-9A-Za-z_-]{21,})/ // broad fallback
        ];

        for (const url of bases) {
          try {
            const resp = await fetchFn(url, { 
              headers: { 
                'User-Agent': 'Mozilla/5.0',
                'Accept-Language': 'en-US,en;q=0.8' 
              }
            });
            
            if (!resp.ok) continue;
            
            const html = await resp.text();
            let channelId = null;
            
            for (const r of idRegexes) { 
              const m = html.match(r); 
              if (m) { 
                channelId = m[1]; 
                break; 
              } 
            }
            
            if (channelId) {
              // Avoid false positives: ensure UC id appears multiple times if matched only by broad regex
              if (/^(UC[0-9A-Za-z_-]{21,})$/.test(channelId)) {
                const count = html.split(channelId).length - 1;
                if (count < 2 && !html.includes('channelId')) { 
                  continue; 
                }
              }
              
              const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/);
              if (process.env.YT_DEBUG === '1') {
                console.log('[YT-RESOLVE] success via', url, '->', channelId);
              }
              return { 
                channelId, 
                title: titleMatch ? titleMatch[1] : null, 
                source: 'scrape' 
              };
            }
            
            if (process.env.YT_DEBUG === '1') {
              console.log('[YT-RESOLVE] no id in', url);
            }
          } catch(e) { 
            if (process.env.YT_DEBUG === '1') {
              console.log('[YT-RESOLVE] error', url, e.message);
            }
          }
        }
        return null;
      }

      let out = await scrapeVariants(handle);

      // Fallback: use YouTube Data API search if key available
      if (!out) {
        const apiKey = process.env.YOUTUBE_API_KEY;
        if (apiKey) {
          try {
            const q = encodeURIComponent(handle);
            const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&maxResults=5&q=${q}&key=${apiKey}`;
            const js = await (await fetchFn(url)).json();
            
            if (js && Array.isArray(js.items)) {
              const best = js.items.find(it => 
                it.snippet?.channelTitle?.toLowerCase().includes(handle.toLowerCase())
              ) || js.items[0];
              
              if (best && best.snippet && best.id && best.id.channelId) {
                out = { 
                  channelId: best.id.channelId, 
                  title: best.snippet.channelTitle, 
                  source: 'api-search' 
                };
              }
            }
          } catch {}
        }
      }

      // Final fallback: parse public search results HTML (no API key)
      if (!out) {
        try {
          const q = encodeURIComponent(originalHandle.startsWith('@') ? 
            originalHandle.slice(1) : originalHandle);
          
          const searchUrls = [
            'https://www.youtube.com/results?search_query=' + q,
            'https://www.youtube.com/results?search_query=%40' + q // explicit @ query
          ];

          for (const sUrl of searchUrls) {
            try {
              const searchResp = await fetchFn(sUrl, { 
                headers: { 
                  'User-Agent': 'Mozilla/5.0',
                  'Accept-Language': 'en-US,en;q=0.8' 
                }
              });
              
              if (!searchResp.ok) continue;
              
              const html = await searchResp.text();
              const m = html.match(/"channelId":"(UC[0-9A-Za-z_-]{21,})"/);
              
              if (m) {
                let title = null;
                const titleMatch = html.match(/"title":\{"runs":\[\{"text":"([^"\\]{1,80})"/);
                if (titleMatch) title = titleMatch[1];
                
                out = { channelId: m[1], title, source: 'html-search' };
                
                if (process.env.YT_DEBUG === '1') {
                  console.log('[YT-RESOLVE] html-search success', sUrl, '->', out.channelId);
                }
                break;
              }
            } catch(e) { 
              if (process.env.YT_DEBUG === '1') {
                console.log('[YT-RESOLVE] html-search error', sUrl, e.message);
              }
            }
          }
        } catch {}
      }

      if (!out) return res.status(404).json({ error: 'not_found' });
      
      res.json(out);
    } catch(e) { 
      res.status(500).json({ error: 'resolve_failed' }); 
    }
  });

  return router;
}

module.exports = createYouTubeRoutes;
