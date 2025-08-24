// YouTube watcher: polls configured channels per guild and announces new uploads / live streams.
// Stores seen video IDs in youtube-state.json (simple JSON persistence).
// Multi-role mention support: config.mentionTargets array -> builds {roleMention} placeholder.
const fs = require('fs');
const path = require('path');
// Use global fetch (Node 18+) with fallback to dynamic import if unavailable
let fetchFn;
if (typeof globalThis.fetch === 'function') fetchFn = (...a)=> globalThis.fetch(...a);
else {
	try { fetchFn = (...a)=> require('node-fetch')(...a); } catch { fetchFn = ()=> { throw new Error('fetch not available'); }; }
}
const store = require('./config/store');

const STATE_PATH = path.join(__dirname, 'youtube-state.json');
let state = { channels:{} };
try { state = JSON.parse(fs.readFileSync(STATE_PATH,'utf8')); } catch { /* ignore */ }

// Quota adaptive controls (in-memory)
const quotaState = {
	quotaErrors: 0,
	lastQuotaError: 0,
	suspendUntil: 0, // epoch ms while we skip API search calls
	threshold: parseInt(process.env.YT_QUOTA_ERROR_THRESHOLD || '3',10),
	cooldownMs: parseInt(process.env.YT_QUOTA_COOLDOWN_MINUTES || '120',10) * 60 * 1000
};

function noteQuotaExceeded(){
	quotaState.quotaErrors += 1;
	quotaState.lastQuotaError = Date.now();
	if(quotaState.quotaErrors >= quotaState.threshold){
		quotaState.suspendUntil = Date.now() + quotaState.cooldownMs;
	}
}

function inLowQuotaMode(){
	if(process.env.YT_DISABLE_SEARCH==='1') return true; // explicit override
	if(Date.now() < quotaState.suspendUntil) return true;
	return false;
}

function saveStateDebounced(){
	if(saveStateDebounced._t) clearTimeout(saveStateDebounced._t);
	saveStateDebounced._t = setTimeout(()=>{
		try { fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2)); } catch {}
	}, 500);
}

function key(guildId, channelId){ return guildId + ':' + channelId; }

async function fetchChannelUploads(channelId, apiKey){
	// Use search endpoint (most recent), fallback gracefully.
	const debug = process.env.YT_DEBUG === '1';
	const disableSearch = inLowQuotaMode();
	if(disableSearch){
		return fetchChannelUploadsViaPlaylist(channelId, apiKey);
	}
	const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&maxResults=5&order=date&type=video&key=${apiKey}`;
	let res, js;
	try {
		res = await fetchFn(url);
		const txt = await res.text();
		try { js = JSON.parse(txt); } catch { js = { _raw: txt }; }
		if(res.status === 403){
			const reason = js?.error?.errors?.[0]?.reason || js?.error?.code;
			// If quotaExceeded or dailyLimitExceeded -> fallback directly to playlist
			if(/quota|daily/i.test(reason||'')){
				noteQuotaExceeded();
				return fetchChannelUploadsViaPlaylist(channelId, apiKey);
			}
		}
	} catch(e){ if(debug) console.log('[YT] search uploads error', channelId, e.message); return []; }
	let items = Array.isArray(js?.items)? js.items: [];
	if(!items.length){
		const alt = await fetchChannelUploadsViaPlaylist(channelId, apiKey);
		return alt;
	}
	return items.map(it => ({
		videoId: it.id?.videoId,
		title: it.snippet?.title,
		publishedAt: it.snippet?.publishedAt,
		thumbnail: it.snippet?.thumbnails?.high?.url || it.snippet?.thumbnails?.default?.url || null,
		liveBroadcastContent: it.snippet?.liveBroadcastContent || 'none'
	})).filter(v=>v.videoId);
}

// Explicit live search (eventType=live) tends to be more reliable for currently active streams than relying only on order=date search.
async function fetchChannelLiveNow(channelId, apiKey){
	const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&eventType=live&type=video&maxResults=3&key=${apiKey}`;
	try {
		if(inLowQuotaMode()) return []; // cannot do live detection without search
		const res = await fetchFn(url);
		const txt = await res.text();
		let js; try { js = JSON.parse(txt); } catch { js = { _raw: txt }; }
		if(res.status === 403 && process.env.YT_DEBUG === '1'){
			const reason = js?.error?.errors?.[0]?.reason || js?.error?.code;
			if(/quota|daily/i.test(reason||'')) { noteQuotaExceeded(); return []; } // silent skip on quota
		}
		if(!js || !Array.isArray(js.items)) return [];
		return js.items.map(it => ({
			videoId: it.id?.videoId,
			title: it.snippet?.title,
			publishedAt: it.snippet?.publishedAt,
			thumbnail: it.snippet?.thumbnails?.high?.url || it.snippet?.thumbnails?.default?.url || null,
			liveBroadcastContent: 'live' // force classify
		})).filter(v=>v.videoId);
	} catch { return []; }
}

// Fallback: get channel uploads playlist and then grab latest items.
async function fetchChannelUploadsViaPlaylist(channelId, apiKey){
	try {
		const debug = process.env.YT_DEBUG === '1';
		const cUrl = `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelId}&key=${apiKey}`;
		const cRes = await fetchFn(cUrl);
		const cTxt = await cRes.text();
		let cJs; try { cJs = JSON.parse(cTxt); } catch { cJs = { _raw: cTxt }; }
		if(cRes.status === 403 && debug){
			const reason = cJs?.error?.errors?.[0]?.reason || cJs?.error?.code;
			if(process.env.YT_ENABLE_RSS_FALLBACK==='1'){
				return fetchChannelUploadsViaRSS(channelId);
			}
			return []; // cannot proceed without playlist id
		}
		const uploadsPlaylist = cJs?.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
		if(!uploadsPlaylist){ if(debug) console.log('[YT] no uploads playlist', channelId); return []; }
		const pUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsPlaylist}&maxResults=5&key=${apiKey}`;
		const pRes = await fetchFn(pUrl);
		const pTxt = await pRes.text();
		let pJs; try { pJs = JSON.parse(pTxt); } catch { pJs = { _raw: pTxt }; }
		if(pRes.status === 403 && debug){
			const reason = pJs?.error?.errors?.[0]?.reason || pJs?.error?.code;
			if(process.env.YT_ENABLE_RSS_FALLBACK==='1'){
				return fetchChannelUploadsViaRSS(channelId);
			}
			return [];
		}
		const items = Array.isArray(pJs?.items)? pJs.items: [];
		return items.map(it=> ({
			videoId: it.snippet?.resourceId?.videoId,
			title: it.snippet?.title,
			publishedAt: it.snippet?.publishedAt,
			thumbnail: it.snippet?.thumbnails?.high?.url || it.snippet?.thumbnails?.default?.url || null,
			liveBroadcastContent: 'none'
		})).filter(v=>v.videoId);
	} catch { return []; }
}

// RSS fallback (no API quota required). Only public uploads, no live state flag.
async function fetchChannelUploadsViaRSS(channelId){
	const debug = process.env.YT_DEBUG === '1';
	const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
	try {
		const res = await fetchFn(url);
		if(debug) console.log('[YT] rss status', channelId, res.status);
		if(!res.ok) return [];
		const xml = await res.text();
		const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].slice(0,5).map(m=>m[1]);
		const vids = entries.map(e=>{
			const id = (e.match(/<yt:videoId>(.*?)<\/yt:videoId>/) || [])[1];
			if(!id) return null;
			const title = (e.match(/<title>([\s\S]*?)<\/title>/) || [])[1];
			const published = (e.match(/<published>(.*?)<\/published>/) || [])[1];
			const thumb = (e.match(/media:thumbnail url="(.*?)"/) || [])[1] || null;
			return { videoId:id, title, publishedAt:published, thumbnail:thumb, liveBroadcastContent:'none' };
		}).filter(Boolean);
		if(debug) console.log('[YT] rss entries', channelId, vids.map(v=>v.videoId).join(','));
		return vids;
	} catch(e){ if(debug) console.log('[YT] rss error', channelId, e.message); return []; }
}

// HTML live scrape fallback. Lightweight heuristic; may break if YouTube layout changes.
async function fetchLiveViaScrape(channelId){
	if(process.env.YT_ENABLE_LIVE_SCRAPE !== '1') return [];
	const debug = process.env.YT_DEBUG === '1';
	const url = `https://www.youtube.com/channel/${channelId}/live`;
	try {
		const res = await fetchFn(url, { headers:{ 'User-Agent':'Mozilla/5.0' }});
		if(!res.ok) return [];
		const html = await res.text();
		// Detect live flag & videoId in initial data JSON
		if(!/isLiveNow"\s*:\s*true/.test(html)) return [];
		const idMatch = html.match(/"videoId"\s*:\s*"([a-zA-Z0-9_-]{6,})"/);
		const videoId = idMatch ? idMatch[1] : null;
		if(!videoId) return [];
		// Try to extract title
		const titleMatch = html.match(/<meta itemprop="name" content="([^"]+)"/);
		const title = titleMatch ? titleMatch[1] : 'Live Stream';
		const thumb = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
		return [{ videoId, title, publishedAt: new Date().toISOString(), thumbnail: thumb, liveBroadcastContent:'live' }];
	} catch(e){ if(debug) console.log('[YT] live scrape error', channelId, e.message); return []; }
}

function buildRoleMention(cfg){
	const targets = Array.isArray(cfg.mentionTargets)? cfg.mentionTargets: [];
	if(!targets.length) return '';
	const parts = targets.map(t => {
		if(t==='everyone') return '@everyone';
		if(t==='here') return '@here';
		if(/^[0-9]{5,32}$/.test(t)) return `<@&${t}>`;
		return null;
	}).filter(Boolean);
	// Deduplicate preserving order
	const seen = new Set();
	const uniq = parts.filter(p=>{ if(seen.has(p)) return false; seen.add(p); return true; });
	return uniq.join(' ');
}

async function announce(guild, cfg, video, type){
	if(!cfg.announceChannelId) return;
	const ch = guild.channels.cache.get(cfg.announceChannelId);
	if(!ch || !ch.isTextBased()) return;
	// Template selection
	const baseTemplate = type==='live' ? (cfg.liveTemplate || '') : (cfg.uploadTemplate || '');
	const roleMention = buildRoleMention(cfg);
	const url = `https://youtu.be/${video.videoId}`;
	let content = baseTemplate
		.replace(/\{roleMention\}/g, roleMention)
		.replace(/\{channelTitle\}/g, cfg.channelNames?.[video.channelId] || 'YouTube Channel')
		.replace(/\{title\}/g, video.title || 'Untitled')
		.replace(/\{url\}/g, url)
		.replace(/\{thumbnail\}/g, video.thumbnail || '');
	if(!cfg.embedEnabled){
		if(content.length === 0) content = `${roleMention} ${url}`.trim();
		// If template didn't include {thumbnail} but we have one, append it so users still see the image link
		if(video.thumbnail && !/https?:\/\/.*(img\.youtube|ytimg|youtube)\./i.test(content)){
			content = content + `\n${video.thumbnail}`;
		}
		await ch.send(content);
		return;
	}
	const embed = {
		title: video.title?.slice(0,256) || 'New Video',
		url,
		description: content.slice(0, 4000),
		color: type==='live'? 0xE53935 : 0x1E88E5
	};
	if(video.thumbnail){ embed.image = { url: video.thumbnail }; }
	await ch.send({ content: roleMention || undefined, embeds:[embed] });
}

function pruneOld(stateList){
	if(stateList.length > 50) stateList.splice(0, stateList.length - 50);
}

async function pollGuild(guild, apiKey){
	let cfg;
	try { cfg = await store.getGuildYouTubeConfig(guild.id); } catch { return; }
	if(!cfg.enabled) return;
	if(!Array.isArray(cfg.channels) || !cfg.channels.length) return;
	const debug = process.env.YT_DEBUG === '1';
	if(debug) console.log('[YT] poll guild', guild.id, 'channels', cfg.channels.length);
	for (const channelId of cfg.channels){
		try {
			// Fetch uploads and live streams in parallel
			let [uploads, liveNow] = await Promise.all([
				fetchChannelUploads(channelId, apiKey),
				fetchChannelLiveNow(channelId, apiKey)
			]);
			// If no live via API and scraping enabled, try scrape
			if(!liveNow.length){
				const scraped = await fetchLiveViaScrape(channelId);
				if(scraped.length) liveNow = scraped;
			}
			// Merge, prefer marking item live if appears in live list
			const map = new Map();
			for(const u of uploads){ map.set(u.videoId, u); }
			for(const l of liveNow){
				if(map.has(l.videoId)) map.get(l.videoId).liveBroadcastContent = 'live'; else map.set(l.videoId, l);
			}
			const vids = Array.from(map.values());
			if(!vids.length){ if(debug) console.log('[YT] no items after fallback', channelId); continue; }
			const k = key(guild.id, channelId);
			if(!state.channels[k]) state.channels[k] = { knownUploads: [], knownLives: [] };
			// Normalize arrays (legacy safety)
			state.channels[k].knownUploads ||= [];
			state.channels[k].knownLives ||= [];
			if(debug) console.log('[YT] channel', channelId, 'items', vids.map(v=> v.videoId + (v.liveBroadcastContent==='live'? '[LIVE]':'' )).join(', '));
			for (const v of vids){
				v.channelId = channelId;
				const isLive = v.liveBroadcastContent === 'live';
				if(isLive){
					if(!state.channels[k].knownLives.includes(v.videoId)){
						state.channels[k].knownLives.push(v.videoId);
						pruneOld(state.channels[k].knownLives);
						await announce(guild, cfg, v, 'live');
					}
				} else {
					if(!state.channels[k].knownUploads.includes(v.videoId)){
						state.channels[k].knownUploads.push(v.videoId);
						pruneOld(state.channels[k].knownUploads);
						await announce(guild, cfg, v, 'upload');
					}
				}
			}
		} catch(e){ if(debug) console.log('[YT] channel error', channelId, e.message); }
	}
	saveStateDebounced();
}

function startYouTubeWatcher(client){
	const apiKey = process.env.YOUTUBE_API_KEY;
	if(!apiKey){ console.warn('YouTube watcher disabled: YOUTUBE_API_KEY missing'); return; }
	async function tick(){
		try {
			for (const guild of client.guilds.cache.values()){
				await pollGuild(guild, apiKey);
			}
		} catch(e){ /* ignore loop errors */ }
		// Dynamic interval: choose smallest interval among enabled guilds, else default 300
		let minInterval = 300;
		try {
			for (const guild of client.guilds.cache.values()){
				const cfg = await store.getGuildYouTubeConfig(guild.id);
				if(cfg.enabled && cfg.intervalSec && cfg.intervalSec < minInterval) minInterval = cfg.intervalSec;
			}
		} catch{}
		setTimeout(tick, Math.max(60, minInterval) * 1000);
	}
	// Initial delay
	setTimeout(tick, 5000);
	console.log('YouTube watcher started');
}

module.exports = { startYouTubeWatcher };
