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

// Multiple API keys support with rotation
let apiKeys = [];
let currentKeyIndex = 0;

function initializeApiKeys() {
	// Check for multiple keys first, then fallback to single key
	const multipleKeys = process.env.YOUTUBE_API_KEYS;
	const singleKey = process.env.YOUTUBE_API_KEY;
	
	if (multipleKeys) {
		// Parse multiple keys (comma or whitespace separated)
		apiKeys = multipleKeys.split(/[,\s]+/).map(key => key.trim()).filter(key => key.length > 0);
	} else if (singleKey) {
		apiKeys = [singleKey];
	}
	
	if (apiKeys.length === 0) {
		console.warn('No YouTube API keys found in environment variables');
		return false;
	}
	
	console.log(`[YT] Initialized with ${apiKeys.length} API key(s)`);
	return true;
}

function getNextApiKey() {
	if (apiKeys.length === 0) return null;
	// Advance to next key first, then return it
	currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
	return apiKeys[currentKeyIndex];
}

function getCurrentApiKey() {
	if (apiKeys.length === 0) return null;
	return apiKeys[currentKeyIndex];
}

function rotateToNextApiKey() {
	if (apiKeys.length <= 1) return getCurrentApiKey();
	const nextKey = getNextApiKey();
	pushDebug(`KEY_ROTATION: Switched to API key ${currentKeyIndex + 1}/${apiKeys.length}`);
	return nextKey;
}

// Quota adaptive controls (in-memory)
const quotaState = {
	quotaErrors: 0,
	lastQuotaError: 0,
	suspendUntil: 0, // epoch ms while we skip API search calls
	threshold: parseInt(process.env.YT_QUOTA_ERROR_THRESHOLD || '3',10),
	cooldownMs: parseInt(process.env.YT_QUOTA_COOLDOWN_MINUTES || '120',10) * 60 * 1000,
	keyErrors: new Map() // Track errors per API key
};

// YouTube statistics and debug events (for /ytdebug command)
const ytStats = {
	totalPolls: 0,
	totalAnnouncements: 0,
	totalErrors: 0,
	apiCalls: 0,
	quotaErrors: 0,
	lastPoll: null,
	_debugEvents: [] // ring buffer of recent debug events
};

function pushDebug(evt){
	if(process.env.YT_DEBUG_EVENTS !== '1') return; // opt-in
	try {
		const line = `[${new Date().toISOString()}] ${evt}`.slice(0,500);
		ytStats._debugEvents.push(line);
		if(ytStats._debugEvents.length > 200) ytStats._debugEvents.splice(0, ytStats._debugEvents.length - 200);
	} catch {}
}

function noteQuotaExceeded(apiKey = null){
	quotaState.quotaErrors += 1;
	quotaState.lastQuotaError = Date.now();
	ytStats.quotaErrors += 1;
	
	// Track errors per API key
	if (apiKey) {
		const keyErrors = quotaState.keyErrors.get(apiKey) || 0;
		quotaState.keyErrors.set(apiKey, keyErrors + 1);
		const logMsg = `API key quota exceeded (key: ${apiKey.substring(0, 10)}..., errors: ${keyErrors + 1})`;
		console.log(`[YT] ${logMsg}`);
		pushDebug(`QUOTA_EXCEEDED: ${logMsg}`);
		
		// Automatically rotate to next key when quota is exceeded
		if (apiKeys.length > 1) {
			const newKey = rotateToNextApiKey();
			pushDebug(`AUTO_ROTATION: Switched from exhausted key to new key`);
		}
	}
	
	if(quotaState.quotaErrors >= quotaState.threshold){
		quotaState.suspendUntil = Date.now() + quotaState.cooldownMs;
		const suspendMsg = `Suspending API calls for ${quotaState.cooldownMs / 60000} minutes due to quota errors`;
		console.log(`[YT] ${suspendMsg}`);
		pushDebug(`SUSPENDED: ${suspendMsg}`);
	}
}

function inLowQuotaMode(){
	if(process.env.YT_DISABLE_SEARCH==='1') return true; // explicit override
	if(Date.now() < quotaState.suspendUntil) return true;
	return false;
}

// Video age filtering function
function isVideoTooOld(publishedAt) {
	if (!publishedAt) return false;
	
	const maxAgeHours = parseInt(process.env.YT_MAX_VIDEO_AGE_HOURS || '24', 10);
	const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
	const videoAge = Date.now() - new Date(publishedAt).getTime();
	
	return videoAge > maxAgeMs;
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
	ytStats.apiCalls += 1;
	
	if(disableSearch){
		pushDebug(`SEARCH_DISABLED: Using playlist fallback for channel ${channelId}`);
		return fetchChannelUploadsViaPlaylist(channelId, apiKey);
	}
	
	pushDebug(`API_CALL: Fetching uploads for channel ${channelId}`);
	const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&maxResults=5&order=date&type=video&key=${apiKey}`;
	let res, js;
	try {
		res = await fetchFn(url);
		const txt = await res.text();
		try { js = JSON.parse(txt); } catch { js = { _raw: txt }; }
		if(res.status === 403){
			const reason = js?.error?.errors?.[0]?.reason || js?.error?.code;
			// If quotaExceeded or dailyLimitExceeded -> try next API key or fallback to playlist
			if(/quota|daily/i.test(reason||'')){
				noteQuotaExceeded(apiKey);
				// Try with the newly rotated API key if available
				const currentKey = getCurrentApiKey();
				if (currentKey && currentKey !== apiKey && apiKeys.length > 1) {
					if(debug) console.log(`[YT] Retrying with rotated API key for channel ${channelId}`);
					pushDebug(`KEY_RETRY: Using rotated API key for channel ${channelId}`);
					return fetchChannelUploads(channelId, currentKey);
				}
				pushDebug(`FALLBACK: Using playlist method for channel ${channelId} due to quota`);
				return fetchChannelUploadsViaPlaylist(channelId, apiKey);
			}
		}
	} catch(e){ 
		ytStats.totalErrors += 1;
		if(debug) console.log('[YT] search uploads error', channelId, e.message); 
		pushDebug(`ERROR: Search uploads failed for ${channelId} - ${e.message}`);
		return []; 
	}
	let items = Array.isArray(js?.items)? js.items: [];
	if(!items.length){
		pushDebug(`NO_RESULTS: No items from search, trying playlist for ${channelId}`);
		const alt = await fetchChannelUploadsViaPlaylist(channelId, apiKey);
		return alt;
	}
	
	// Filter videos by age and apply other filtering
	const filteredItems = items.map(it => ({
		videoId: it.id?.videoId,
		title: it.snippet?.title,
		publishedAt: it.snippet?.publishedAt,
		thumbnail: it.snippet?.thumbnails?.high?.url || it.snippet?.thumbnails?.default?.url || null,
		liveBroadcastContent: it.snippet?.liveBroadcastContent || 'none'
	})).filter(v => {
		if (!v.videoId) return false;
		// Skip videos that are too old
		if (isVideoTooOld(v.publishedAt)) {
			if(debug) console.log(`[YT] Skipping old video: ${v.videoId} (${v.publishedAt})`);
			pushDebug(`AGE_FILTER: Skipped old video ${v.videoId} from ${v.publishedAt}`);
			return false;
		}
		return true;
	});
	
	pushDebug(`UPLOADS_FOUND: ${filteredItems.length} videos for channel ${channelId}`);
	return filteredItems;
}

// Explicit live search (eventType=live) tends to be more reliable for currently active streams than relying only on order=date search.
async function fetchChannelLiveNow(channelId, apiKey){
	const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&eventType=live&type=video&maxResults=3&key=${apiKey}`;
	ytStats.apiCalls += 1;
	pushDebug(`LIVE_SEARCH: Checking for live streams on channel ${channelId}`);
	
	try {
		if(inLowQuotaMode()) {
			pushDebug(`LIVE_DISABLED: Low quota mode, skipping live search for ${channelId}`);
			return []; // cannot do live detection without search
		}
		const res = await fetchFn(url);
		const txt = await res.text();
		let js; try { js = JSON.parse(txt); } catch { js = { _raw: txt }; }
		if(res.status === 403){
			const reason = js?.error?.errors?.[0]?.reason || js?.error?.code;
			if(/quota|daily/i.test(reason||'')){
				noteQuotaExceeded(apiKey);
				// Try with the newly rotated API key if available
				const currentKey = getCurrentApiKey();
				if (currentKey && currentKey !== apiKey && apiKeys.length > 1) {
					const debug = process.env.YT_DEBUG === '1';
					if(debug) console.log(`[YT] Retrying live search with rotated API key for channel ${channelId}`);
					pushDebug(`LIVE_KEY_RETRY: Using rotated API key for live search ${channelId}`);
					return fetchChannelLiveNow(channelId, currentKey);
				}
				return []; // silent skip on quota
			}
		}
		if(!js || !Array.isArray(js.items)) {
			pushDebug(`LIVE_NO_RESULTS: No live streams found for ${channelId}`);
			return [];
		}
		const liveItems = js.items.map(it => ({
			videoId: it.id?.videoId,
			title: it.snippet?.title,
			publishedAt: it.snippet?.publishedAt,
			thumbnail: it.snippet?.thumbnails?.high?.url || it.snippet?.thumbnails?.default?.url || null,
			liveBroadcastContent: 'live' // force classify
		})).filter(v=>v.videoId);
		
		if(liveItems.length > 0) {
			pushDebug(`LIVE_FOUND: ${liveItems.length} live stream(s) for channel ${channelId}`);
		}
		return liveItems;
	} catch(e) { 
		ytStats.totalErrors += 1;
		pushDebug(`LIVE_ERROR: Live search failed for ${channelId} - ${e.message}`);
		return []; 
	}
}

// Fallback: get channel uploads playlist and then grab latest items.
async function fetchChannelUploadsViaPlaylist(channelId, apiKey){
	try {
		const debug = process.env.YT_DEBUG === '1';
		const cUrl = `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelId}&key=${apiKey}`;
		const cRes = await fetchFn(cUrl);
		const cTxt = await cRes.text();
		let cJs; try { cJs = JSON.parse(cTxt); } catch { cJs = { _raw: cTxt }; }
		if(cRes.status === 403){
			const reason = cJs?.error?.errors?.[0]?.reason || cJs?.error?.code;
			if(/quota|daily/i.test(reason||'')){
				noteQuotaExceeded(apiKey);
				// Try with the newly rotated API key if available
				const currentKey = getCurrentApiKey();
				if (currentKey && currentKey !== apiKey && apiKeys.length > 1) {
					if(debug) console.log(`[YT] Retrying playlist fetch with rotated API key for channel ${channelId}`);
					pushDebug(`PLAYLIST_KEY_RETRY: Using rotated API key for channel ${channelId}`);
					return fetchChannelUploadsViaPlaylist(channelId, currentKey);
				}
			}
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
		if(pRes.status === 403){
			const reason = pJs?.error?.errors?.[0]?.reason || pJs?.error?.code;
			if(/quota|daily/i.test(reason||'')){
				noteQuotaExceeded(apiKey);
				// Try with the newly rotated API key if available
				const currentKey = getCurrentApiKey();
				if (currentKey && currentKey !== apiKey && apiKeys.length > 1) {
					if(debug) console.log(`[YT] Retrying playlist items with rotated API key for channel ${channelId}`);
					pushDebug(`PLAYLIST_ITEMS_RETRY: Using rotated API key for channel ${channelId}`);
					return fetchChannelUploadsViaPlaylist(channelId, currentKey);
				}
			}
			if(process.env.YT_ENABLE_RSS_FALLBACK==='1'){
				return fetchChannelUploadsViaRSS(channelId);
			}
			return [];
		}
		const items = Array.isArray(pJs?.items)? pJs.items: [];
		
		// Filter videos by age
		const filteredItems = items.map(it=> ({
			videoId: it.snippet?.resourceId?.videoId,
			title: it.snippet?.title,
			publishedAt: it.snippet?.publishedAt,
			thumbnail: it.snippet?.thumbnails?.high?.url || it.snippet?.thumbnails?.default?.url || null,
			liveBroadcastContent: 'none'
		})).filter(v => {
			if (!v.videoId) return false;
			// Skip videos that are too old
			if (isVideoTooOld(v.publishedAt)) {
				if(debug) console.log(`[YT] Skipping old video from playlist: ${v.videoId} (${v.publishedAt})`);
				return false;
			}
			return true;
		});
		
		return filteredItems;
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
		}).filter(v => {
			if (!v) return false;
			// Skip videos that are too old
			if (isVideoTooOld(v.publishedAt)) {
				if(debug) console.log(`[YT] Skipping old video from RSS: ${v.videoId} (${v.publishedAt})`);
				return false;
			}
			return true;
		});
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
	
	ytStats.totalAnnouncements += 1;
	pushDebug(`ANNOUNCE: ${type.toUpperCase()} - ${video.title} (${video.videoId}) in guild ${guild.id}`);
	
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
	
	ytStats.totalPolls += 1;
	ytStats.lastPoll = new Date().toISOString();
	
	const debug = process.env.YT_DEBUG === '1';
	if(debug) console.log('[YT] poll guild', guild.id, 'channels', cfg.channels.length);
	pushDebug(`POLL_START: Guild ${guild.id} with ${cfg.channels.length} channels`);
	
	for (const channelId of cfg.channels){
		try {
			// Use the current API key for this request
			const currentKey = apiKey || getCurrentApiKey();
			if (!currentKey) {
				if(debug) console.log('[YT] No API key available for polling');
				pushDebug(`ERROR: No API key available for polling`);
				continue;
			}
			
			// Fetch uploads and live streams in parallel
			let [uploads, liveNow] = await Promise.all([
				fetchChannelUploads(channelId, currentKey),
				fetchChannelLiveNow(channelId, currentKey)
			]);
			// If no live via API and scraping enabled, try scrape
			if(!liveNow.length){
				const scraped = await fetchLiveViaScrape(channelId);
				if(scraped.length) {
					liveNow = scraped;
					pushDebug(`LIVE_SCRAPE: Found ${scraped.length} live stream(s) via scraping for ${channelId}`);
				}
			}
			// Merge, prefer marking item live if appears in live list
			const map = new Map();
			for(const u of uploads){ map.set(u.videoId, u); }
			for(const l of liveNow){
				if(map.has(l.videoId)) map.get(l.videoId).liveBroadcastContent = 'live'; else map.set(l.videoId, l);
			}
			const vids = Array.from(map.values());
			if(!vids.length){ 
				if(debug) console.log('[YT] no items after fallback', channelId); 
				pushDebug(`NO_VIDEOS: No videos found for channel ${channelId}`);
				continue; 
			}
			const k = key(guild.id, channelId);
			if(!state.channels[k]) state.channels[k] = { knownUploads: [], knownLives: [] };
			// Normalize arrays (legacy safety)
			state.channels[k].knownUploads ||= [];
			state.channels[k].knownLives ||= [];
			if(debug) console.log('[YT] channel', channelId, 'items', vids.map(v=> v.videoId + (v.liveBroadcastContent==='live'? '[LIVE]':'' )).join(', '));
			
			let newUploads = 0, newLives = 0;
			for (const v of vids){
				v.channelId = channelId;
				const isLive = v.liveBroadcastContent === 'live';
				if(isLive){
					if(!state.channels[k].knownLives.includes(v.videoId)){
						state.channels[k].knownLives.push(v.videoId);
						pruneOld(state.channels[k].knownLives);
						await announce(guild, cfg, v, 'live');
						newLives += 1;
					}
				} else {
					if(!state.channels[k].knownUploads.includes(v.videoId)){
						state.channels[k].knownUploads.push(v.videoId);
						pruneOld(state.channels[k].knownUploads);
						await announce(guild, cfg, v, 'upload');
						newUploads += 1;
					}
				}
			}
			
			if(newUploads > 0 || newLives > 0) {
				pushDebug(`NEW_CONTENT: Channel ${channelId} - ${newUploads} uploads, ${newLives} live streams`);
			}
		} catch(e){ 
			ytStats.totalErrors += 1;
			if(debug) console.log('[YT] channel error', channelId, e.message); 
			pushDebug(`CHANNEL_ERROR: ${channelId} - ${e.message}`);
		}
	}
	saveStateDebounced();
	pushDebug(`POLL_END: Guild ${guild.id} completed`);
}

function startYouTubeWatcher(client){
	// Initialize API keys
	if (!initializeApiKeys()) {
		console.warn('YouTube watcher disabled: No API keys found');
		return;
	}
	
	pushDebug(`STARTUP: YouTube watcher started with ${apiKeys.length} API key(s)`);
	
	// Set up periodic key rotation (every 30 minutes) to distribute load
	if (apiKeys.length > 1) {
		setInterval(() => {
			const oldKey = getCurrentApiKey();
			const newKey = rotateToNextApiKey();
			pushDebug(`SCHEDULED_ROTATION: Rotated from key ${currentKeyIndex === 0 ? apiKeys.length : currentKeyIndex} to key ${currentKeyIndex + 1}`);
		}, 30 * 60 * 1000); // 30 minutes
	}
	
	async function tick(){
		try {
			for (const guild of client.guilds.cache.values()){
				// Get the current API key for this polling cycle
				const currentKey = getCurrentApiKey();
				await pollGuild(guild, currentKey);
			}
		} catch(e){ 
			ytStats.totalErrors += 1;
			pushDebug(`TICK_ERROR: ${e.message}`);
		}
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
	console.log(`YouTube watcher started with ${apiKeys.length} API key(s), max video age: ${process.env.YT_MAX_VIDEO_AGE_HOURS || '24'} hours`);
}

module.exports = { startYouTubeWatcher, ytStats };