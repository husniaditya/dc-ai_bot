import React, { useEffect, useState, useRef } from 'react';
import { getYouTubeConfig, updateYouTubeConfig, getChannels, getRoles, extractYouTubeChannelId, getTwitchConfig, updateTwitchConfig, resolveTwitchStreamer, resolveYouTubeChannel } from '../api';
import LoadingOverlay from '../components/LoadingOverlay';

// icon retained only as a fallback if an image asset is missing
const SERVICES = [
  { key:'youtube', label:'YouTube', image:'youtube.png', icon:'fa-brands fa-youtube', color:'#FF0000', desc:'Video uploads & live notifications.' },
  { key:'twitch', label:'Twitch', image:'twitch.png', icon:'fa-brands fa-twitch', color:'#9146FF', desc:'Streamer live alerts.' },
  { key:'pubg', label:'PUBG', image:'pubg.png', icon:'fa-solid fa-crosshairs', color:'#f59e0b', desc:'Player / match stats (planned).' },
  { key:'valorant', label:'Valorant', image:'valorant.png', icon:'fa-solid fa-bullseye', color:'#e11d48', desc:'Match & agent stats (planned).' },
  { key:'apex', label:'Apex', image:'apexlegends.png', icon:'fa-solid fa-mountain', color:'#7c3aed', desc:'Legend stats & map rotation (planned).' },
  { key:'mobilelegends', label:'Mobile Legends', image:'mobilelegends.png', icon:'fa-solid fa-mobile-screen-button', color:'#0ea5e9', desc:'Hero stats & live matches (planned).' },
  { key:'clashofclans', label:'Clash of Clans', image:'clashofclans.png', icon:'fa-solid fa-shield', color:'#16a34a', desc:'Clan & war stats (planned).' },
  { key:'fortnite', label:'Fortnite', image:'fornite.png', icon:'fa-solid fa-flag', color:'#6366f1', desc:'Player stats & shop rotation (planned).' },
  { key:'genshin', label:'Genshin Impact', image:'genshinimpact.png', icon:'fa-solid fa-flag', color:'#6366f1', desc:'Player details & showcases (planned).' },
];

export default function GamesSocialsSection({ guildId, pushToast }){
  const [active, setActive] = useState('youtube');
  const [ytCfg, setYtCfg] = useState(null);
  const [ytOrig, setYtOrig] = useState(null);
  const [ytLoading, setYtLoading] = useState(false);
  const [ytSaving, setYtSaving] = useState(false);
  const [twitchCfg, setTwitchCfg] = useState(null);
  const [twitchOrig, setTwitchOrig] = useState(null);
  const [twitchLoading, setTwitchLoading] = useState(false);
  const [twitchSaving, setTwitchSaving] = useState(false);
  const [discordChannels, setDiscordChannels] = useState([]);
  const [newChannelId, setNewChannelId] = useState('');
  const [newStreamerId, setNewStreamerId] = useState('');
  const [resolving, setResolving] = useState(false);
  const [guildRoles, setGuildRoles] = useState([]);
  const [editingChannel, setEditingChannel] = useState(null);
  const [editingStreamer, setEditingStreamer] = useState(null);

  // Helper to clean up malformed channel IDs from database
  function cleanChannelIds(channels) {
    if (!Array.isArray(channels)) return [];
    return channels.map(cid => {
      if (typeof cid !== 'string') return cid;
      
      // Remove extra quotes and JSON stringification
      let clean = cid;
      
      // Handle various malformed patterns
      // Pattern: ["UCwOygeWv6P6wnjBpTh5mUzQ"]
      if (clean.startsWith('[') && clean.endsWith(']')) {
        try {
          clean = JSON.parse(clean);
          if (Array.isArray(clean) && clean.length > 0) clean = clean[0];
        } catch (e) {
          // If JSON parsing fails, manually extract
          clean = clean.slice(1, -1); // Remove [ and ]
        }
      }
      
      // Pattern: "UCwOygeWv6P6wnjBpTh5mUzQ"]
      if (clean.endsWith(']')) {
        clean = clean.slice(0, -1); // Remove trailing ]
      }
      
      // Pattern: ["UCwOygeWv6P6wnjBpTh5mUzQ"
      if (clean.startsWith('[')) {
        clean = clean.slice(1); // Remove leading [
      }
      
      // Pattern: "UCwOygeWv6P6wnjBpTh5mUzQ"
      if (clean.startsWith('"') && clean.endsWith('"')) {
        clean = clean.slice(1, -1);
      }
      
      // Remove any remaining quotes
      clean = clean.replace(/['"]/g, '');
      
      return clean;
    });
  }

  // Helper to clean up malformed streamer usernames from database
  function cleanStreamerUsernames(streamers) {
    if (!Array.isArray(streamers)) return [];
    return streamers.map(username => {
      if (typeof username !== 'string') return username;
      
      // Remove extra quotes and JSON stringification
      let clean = username;
      
      // Handle various malformed patterns
      // Pattern: ["username"]
      if (clean.startsWith('[') && clean.endsWith(']')) {
        try {
          clean = JSON.parse(clean);
          if (Array.isArray(clean) && clean.length > 0) clean = clean[0];
        } catch (e) {
          // If JSON parsing fails, manually extract
          clean = clean.slice(1, -1); // Remove [ and ]
        }
      }
      
      // Pattern: "username"]
      if (clean.endsWith(']')) {
        clean = clean.slice(0, -1); // Remove trailing ]
      }
      
      // Pattern: ["username"
      if (clean.startsWith('[')) {
        clean = clean.slice(1); // Remove leading [
      }
      
      // Pattern: "username"
      if (clean.startsWith('"') && clean.endsWith('"')) {
        clean = clean.slice(1, -1);
      }
      
      // Remove any remaining quotes
      clean = clean.replace(/['"]/g, '');
      
      return clean;
    });
  }

  // Helper to build a preview string from a template
  function buildPreview(tpl, channelId, type = 'youtube'){
    if(!tpl) return '';
    
    if(type === 'twitch') {
      const streamerNames = twitchCfg?.streamerNames || {};
      const streamerName = channelId ? (streamerNames[channelId] || 'StreamerName') : (streamerNames[twitchCfg?.streamers?.[0]] || 'StreamerName');
      const streamTitle = 'Amazing Live Stream';
      const url = `https://twitch.tv/${channelId || 'streamername'}`;
      const thumbnail = `https://static-cdn.jtvnw.net/previews-ttv/live_user_${channelId || 'streamername'}-1920x1080.jpg`;
      const list = twitchCfg?.mentionTargets && twitchCfg.mentionTargets.length? twitchCfg.mentionTargets : (twitchCfg?.mentionRoleId? [twitchCfg.mentionRoleId]:[]);
      const roleMention = list.map(id=> id==='everyone'? '@everyone' : id==='here'? '@here' : (/^[0-9]{5,32}$/.test(id)? `<@&${id}>` : id)).join(' ');
      const rolesById = Object.fromEntries((guildRoles||[]).map(r=> [r.id, r.name]));
      const roleNames = list.map(id=>{
        if(id==='everyone') return '@everyone';
        if(id==='here') return '@here';
        if(rolesById[id]) {
          const n = rolesById[id];
          return n.startsWith('@') ? n : '@'+n;
        }
        return id.startsWith('@') ? id : '@'+id;
      }).join(', ');
      return tpl
        .replace(/\{streamerName\}/g, streamerName)
        .replace(/\{title\}/g, streamTitle)
        .replace(/\{url\}/g, url)
        .replace(/\{roleMention\}/g, roleMention)
        .replace(/\{roleNames\}/g, roleNames)
        .replace(/\{thumbnail\}/g, thumbnail)
        .replace(/\{game\}/g, 'Just Chatting')
        .replace(/\{viewers\}/g, '1337')
        .replace(/\{startedAt\}/g, new Date().toISOString())
        .replace(/\{startedAtRelative\}/g, 'just now');
    }
    
    // YouTube preview (original code)
    const sampleVideoId = 'VIDEO12345';
    const channelNames = ytCfg?.channelNames || {};
    const channelTitle = channelId ? (channelNames[channelId] || 'Channel Name') : (channelNames[ytCfg?.channels?.[0]] || 'Channel Name');
    const videoTitle = 'Amazing New Upload';
    const url = `https://youtu.be/${sampleVideoId}`;
    const thumbnail = `https://img.youtube.com/vi/${sampleVideoId}/hqdefault.jpg`;
    const list = ytCfg?.mentionTargets && ytCfg.mentionTargets.length? ytCfg.mentionTargets : (ytCfg?.mentionRoleId? [ytCfg.mentionRoleId]:[]);
    const roleMention = list.map(id=> id==='everyone'? '@everyone' : id==='here'? '@here' : (/^[0-9]{5,32}$/.test(id)? `<@&${id}>` : id)).join(' ');
    const rolesById = Object.fromEntries((guildRoles||[]).map(r=> [r.id, r.name]));
    const roleNames = list.map(id=>{
      if(id==='everyone') return '@everyone';
      if(id==='here') return '@here';
      if(rolesById[id]) {
        const n = rolesById[id];
        return n.startsWith('@') ? n : '@'+n;
      }
      return id.startsWith('@') ? id : '@'+id;
    }).join(', ');
    return tpl
      .replace(/\{channelTitle\}/g, channelTitle)
      .replace(/\{title\}/g, videoTitle)
      .replace(/\{url\}/g, url)
      .replace(/\{roleMention\}/g, roleMention)
      .replace(/\{roleNames\}/g, roleNames)
      .replace(/\{thumbnail\}/g, thumbnail)
      .replace(/\{publishedAt\}/g, new Date().toISOString())
      .replace(/\{publishedAtRelative\}/g, 'just now')
      .replace(/\{memberText\}/g, ' (Members Only)');
  }
  function TemplatePreview({ template, channelId, size, type = 'youtube' }){
    const result = buildPreview(template, channelId, type);
    const cls = 'template-preview'+(size? ' size-'+size:'');
    if(!template) return <div className={cls+" empty"}>No template set.</div>;
    return <div className={cls}><div className="preview-label small text-muted">Preview</div><div className="preview-body">{result}</div></div>;
  }

  // Load configuration only when guildId and active service changes
  // Load configurations when guildId changes or component mounts
  useEffect(()=>{
    if(!guildId) return;
    
    // Load both YouTube and Twitch configs on mount
    (async() => {
      try {
        setYtLoading(true);
        setTwitchLoading(true);
        
        const [ytCfg, twitchCfg, ch, roles] = await Promise.all([
          getYouTubeConfig(guildId).catch(()=>null),
          getTwitchConfig(guildId).catch(()=>null),
          getChannels(guildId).catch(()=>null),
          getRoles(guildId).catch(()=>null)
        ]);
        
        // Set YouTube config
        if(ytCfg){ 
          const cleanedYtCfg = {
            ...ytCfg,
            channels: cleanChannelIds(ytCfg.channels || [])
          };
          setYtCfg(cleanedYtCfg); 
          setYtOrig(cleanedYtCfg); 
        }
        
        // Set Twitch config
        if(twitchCfg){ 
          const cleanedTwitchCfg = {
            ...twitchCfg,
            streamers: cleanStreamerUsernames(twitchCfg.streamers || [])
          };
          setTwitchCfg(cleanedTwitchCfg); 
          setTwitchOrig(cleanedTwitchCfg); 
        }
        
        // Set shared data
        if(ch && Array.isArray(ch.channels)) setDiscordChannels(ch.channels);
        if(roles && Array.isArray(roles.roles)) setGuildRoles(roles.roles);
        
      } finally { 
        setYtLoading(false); 
        setTwitchLoading(false);
      }
    })();
  }, [guildId]);

  // Load individual config when switching services (if not already loaded)
  useEffect(()=>{
    if(!guildId) return;
    
    if(active === 'youtube' && !ytCfg) {
      (async() => {
        try {
          setYtLoading(true);
          const [cfg, ch, roles] = await Promise.all([
            getYouTubeConfig(guildId).catch(()=>null),
            getChannels(guildId).catch(()=>null),
            getRoles(guildId).catch(()=>null)
          ]);
          if(cfg){ 
            const cleanedCfg = {
              ...cfg,
              channels: cleanChannelIds(cfg.channels || [])
            };
            setYtCfg(cleanedCfg); 
            setYtOrig(cleanedCfg); 
          }
          if(ch && Array.isArray(ch.channels)) setDiscordChannels(ch.channels);
          if(roles && Array.isArray(roles.roles)) setGuildRoles(roles.roles);
        } finally { setYtLoading(false); }
      })();
    } else if(active === 'twitch' && !twitchCfg) {
      (async() => {
        try {
          setTwitchLoading(true);
          const [cfg, ch, roles] = await Promise.all([
            getTwitchConfig(guildId).catch(()=>null),
            getChannels(guildId).catch(()=>null),
            getRoles(guildId).catch(()=>null)
          ]);
          if(cfg){ 
            const cleanedCfg = {
              ...cfg,
              streamers: cleanStreamerUsernames(cfg.streamers || [])
            };
            setTwitchCfg(cleanedCfg); 
            setTwitchOrig(cleanedCfg); 
          }
          if(ch && Array.isArray(ch.channels)) setDiscordChannels(ch.channels);
          if(roles && Array.isArray(roles.roles)) setGuildRoles(roles.roles);
        } finally { setTwitchLoading(false); }
      })();
    }
  }, [guildId, active]);

  function ytDirty(){ if(!ytCfg||!ytOrig) return false; return JSON.stringify(ytCfg) !== JSON.stringify(ytOrig); }
  function ytReset(){ if(ytOrig) setYtCfg(ytOrig); }
  
  function twitchDirty(){ if(!twitchCfg||!twitchOrig) return false; return JSON.stringify(twitchCfg) !== JSON.stringify(twitchOrig); }
  function twitchReset(){ if(twitchOrig) setTwitchCfg(twitchOrig); }
  async function ytSave(){
    if(!ytCfg) return;
    try { 
      setYtSaving(true); 
      const updated = await updateYouTubeConfig(ytCfg, guildId); 
      // Use the complete response from backend, ensuring arrays are properly initialized
      const safe = {
        ...updated,
        channels: Array.isArray(updated?.channels)? updated.channels : [],
        mentionTargets: Array.isArray(updated?.mentionTargets)? updated.mentionTargets : (updated?.mentionRoleId ? [updated.mentionRoleId] : []),
        channelMessages: updated?.channelMessages || {},
        channelNames: updated?.channelNames || {}
      }; 
      setYtCfg(safe); 
      setYtOrig(safe); 
      pushToast && pushToast('success','YouTube config saved'); 
    }
    catch(e){ 
      console.error('YouTube save error:', e);
      pushToast && pushToast('error','Save failed'); 
    }
    finally { setYtSaving(false); }
  }
  
  async function twitchSave(){
    if(!twitchCfg) return;
    try { 
      setTwitchSaving(true); 
      const updated = await updateTwitchConfig(twitchCfg, guildId); 
      // Use the complete response from backend, ensuring arrays are properly initialized
      const safe = {
        ...updated,
        streamers: Array.isArray(updated?.streamers)? updated.streamers : [],
        mentionTargets: Array.isArray(updated?.mentionTargets)? updated.mentionTargets : (updated?.mentionRoleId ? [updated.mentionRoleId] : []),
        streamerMessages: updated?.streamerMessages || {},
        streamerNames: updated?.streamerNames || {}
      }; 
      setTwitchCfg(safe); 
      setTwitchOrig(safe); 
      pushToast && pushToast('success','Twitch config saved'); 
    } catch(e){ 
      console.error('Twitch save error:', e);
      pushToast && pushToast('error','Save failed'); 
    } finally { 
      setTwitchSaving(false); 
    }
  }
  async function addChannel(){
    const raw = newChannelId.trim(); 
    if(!raw) return;
    
    setResolving(true);
    try {
      // Use the new authenticated API function
      const result = await extractYouTubeChannelId(raw);
      
      const cid = result.channelId;
      const resolvedName = result.channelName || null;
      
      if (ytCfg.channels.includes(cid)) {
        pushToast && pushToast('error', `Channel ${cid} is already being watched`);
        return;
      }
      
      // Show extraction info if URL was converted
      if (result.extracted) {
        pushToast && pushToast('success', `Extracted channel ID: ${cid}${resolvedName ? ` (${resolvedName})` : ''}`);
      } else if (resolvedName) {
        pushToast && pushToast('success', `Added channel: ${resolvedName}`);
      }
      
      setYtCfg(c => ({ 
        ...c, 
        channels: [...c.channels, cid],
        channelNames: resolvedName ? { ...(c.channelNames||{}), [cid]: resolvedName } : (c.channelNames||{})
      }));
      setNewChannelId('');
      
    } catch (e) {
      console.error('Channel extraction error:', e);
      pushToast && pushToast('error', e.message || 'Failed to add channel');
    } finally {
      setResolving(false);
    }
  }
  function removeChannel(cid){ setYtCfg(c => ({ ...c, channels: c.channels.filter(x=>x!==cid) })); }
  
  async function addStreamer(){
    const raw = newStreamerId.trim(); if(!raw) return;
    let username = null;
    let resolvedName = null;
    setResolving(true);
    try {
      const r = await resolveTwitchStreamer(raw);
      username = r?.username || null;
      resolvedName = r?.displayName || null;
      if(!username) throw new Error('not resolved');
      pushToast && pushToast('success', `Resolved to ${username}`);
    } catch(e){
      pushToast && pushToast('error','Could not resolve streamer');
    } finally { setResolving(false); }
    
    if(username){
      setTwitchCfg(c => ({ 
        ...c, 
        streamers: c.streamers.includes(username)? c.streamers : [...c.streamers, username], 
        streamerNames: resolvedName ? { ...(c.streamerNames||{}), [username]: resolvedName } : (c.streamerNames||{}) 
      }));
      setNewStreamerId('');
    }
  }
  function removeStreamer(username){ setTwitchCfg(c => ({ ...c, streamers: c.streamers.filter(x=>x!==username) })); }

  function renderYouTube(){
    if(ytLoading || !ytCfg){ return <div className="text-muted small">Loading YouTube config…</div>; }
    return <>
      <div className="yt-config-grid mt-2">
        {/* MAIN CONFIG */}
        <div className="yt-config-block">
          <div className="d-flex justify-content-between align-items-start mb-2">
            <div>
              <div className="small text-uppercase text-muted fw-semibold mb-1">Announcement</div>
              <div className="form-check form-switch m-0">
                <input className="form-check-input" type="checkbox" checked={ytCfg.enabled} onChange={e=> setYtCfg(c=> ({ ...c, enabled: e.target.checked }))} />
                <label className="form-check-label ms-2">{ytCfg.enabled? 'Enabled':'Disabled'}</label>
              </div>
            </div>
          </div>
          <div className="mb-3">
            <label className="form-label small fw-semibold mb-1">Upload Announce Channel</label>
            <select className="form-select form-select-sm" value={ytCfg.uploadAnnounceChannelId||ytCfg.announceChannelId||''} onChange={e=> setYtCfg(c=> ({ ...c, uploadAnnounceChannelId: e.target.value || null }))}>
              <option value="">Select…</option>
              {discordChannels.map(ch=> <option key={ch.id} value={ch.id}>{ch.name}</option>)}
            </select>
          </div>
          <div className="mb-3">
            <label className="form-label small fw-semibold mb-1">Live Announce Channel</label>
            <select className="form-select form-select-sm" value={ytCfg.liveAnnounceChannelId||ytCfg.announceChannelId||''} onChange={e=> setYtCfg(c=> ({ ...c, liveAnnounceChannelId: e.target.value || null }))}>
              <option value="">Select…</option>
              {discordChannels.map(ch=> <option key={ch.id} value={ch.id}>{ch.name}</option>)}
            </select>
          </div>
          <div className="mb-3">
            <label className="form-label small fw-semibold d-flex align-items-center gap-2 mb-1">Mention Targets {ytCfg.mentionTargets?.length ? <span className="badge-soft" style={{fontSize:'.55rem'}}>{ytCfg.mentionTargets.length}</span>: null}</label>
            <MentionTargetsPicker
              value={ytCfg.mentionTargets && ytCfg.mentionTargets.length? ytCfg.mentionTargets : (ytCfg.mentionRoleId? [ytCfg.mentionRoleId] : [])}
              roles={guildRoles}
              onChange={(list)=> setYtCfg(c=> ({ ...c, mentionTargets:list, mentionRoleId: (list.length===1 && /^[0-9]{5,32}$/.test(list[0])) ? list[0] : null }))}
            />
            <div className="form-text tiny text-muted mt-1">Enter to add • Backspace to remove • Order preserved</div>
          </div>
          <div className="mb-3">
            <div>
              <label className="form-label small fw-semibold mb-1">Interval (sec)</label>
              <input type="number" min={30} className="form-control form-control-sm" style={{width:110}} value={ytCfg.intervalSec} onChange={e=> setYtCfg(c=> ({ ...c, intervalSec: Math.max(30, parseInt(e.target.value)||300) }))} />
            </div>
          </div>
          <div className="mb-3">
            <div>
              <label className="form-label small fw-semibold mb-1">Embeds</label>
              <div className="form-check form-switch m-0">
                <input className="form-check-input" type="checkbox" checked={ytCfg.embedEnabled!==false} onChange={e=> setYtCfg(c=> ({ ...c, embedEnabled: e.target.checked }))} />
                <label className="form-check-label ms-2">{ytCfg.embedEnabled!==false ? 'Enabled':'Plain'}</label>
              </div>
            </div>
          </div>
        </div>
        {/* GLOBAL TEMPLATES */}
        <div className="yt-config-block">
          <div className="small text-uppercase text-muted fw-semibold mb-2">Regular Template</div>
          <div className="mb-2">
            <label className="form-label small fw-semibold mb-1">Upload</label>
            <textarea rows={7} className="form-control form-control-sm" value={ytCfg.uploadTemplate||''} onChange={e=> setYtCfg(c=> ({ ...c, uploadTemplate: e.target.value }))}></textarea>
          </div>
          <div className="mb-2">
            <label className="form-label small fw-semibold mb-1">Live</label>
            <textarea rows={7} className="form-control form-control-sm" value={ytCfg.liveTemplate||''} onChange={e=> setYtCfg(c=> ({ ...c, liveTemplate: e.target.value }))}></textarea>
          </div>
          <br />
          <div className="small text-uppercase text-muted fw-semibold mb-2">Member Template</div>
          <div className="mb-2">
            <label className="form-label small fw-semibold mb-1">Member Upload</label>
            <textarea rows={7} className="form-control form-control-sm" value={ytCfg.memberOnlyUploadTemplate||''} onChange={e=> setYtCfg(c=> ({ ...c, memberOnlyUploadTemplate: e.target.value }))}></textarea>
          </div>
          <div>
            <label className="form-label small fw-semibold mb-1">Member Live</label>
            <textarea rows={7} className="form-control form-control-sm" value={ytCfg.memberOnlyLiveTemplate||''} onChange={e=> setYtCfg(c=> ({ ...c, memberOnlyLiveTemplate: e.target.value }))}></textarea>
          </div>
          <div className="form-text tiny mt-2">Placeholders: {'{channelTitle} {title} {url} {roleNames} {thumbnail} {publishedAt} {publishedAtRelative} {memberText}'}</div>
        </div>
        {/* TEMPLATE PREVIEW */}
        <div className="yt-config-block">
          <div className="small text-uppercase text-muted fw-semibold mb-2">Regular Template Preview</div>
          <div className="mb-2">
            <div className="small fw-semibold mb-1">Regular Upload</div>
            <TemplatePreview template={ytCfg.uploadTemplate} size="lg" />
          </div>
          <div className="mb-2">
            <div className="small fw-semibold mb-1">Regular Live</div>
            <TemplatePreview template={ytCfg.liveTemplate} size="lg" />
          </div>
          <br />
          <div className="small text-uppercase text-muted fw-semibold mb-2">Member Template Preview</div>
          <div className="mb-2">
            <div className="small fw-semibold mb-1">Member Upload</div>
            <TemplatePreview template={ytCfg.memberOnlyUploadTemplate} size="lg" />
          </div>
          <div className="mb-2">
            <div className="small fw-semibold mb-1">Member Live</div>
            <TemplatePreview template={ytCfg.memberOnlyLiveTemplate} size="lg" />
          </div>
          <div className="form-text tiny mt-2">Placeholders: {'{channelTitle} {title} {url} {roleNames} {thumbnail} {publishedAt} {publishedAtRelative} {memberText}'}</div>
        </div>
      </div>
      <div className="yt-config-block mt-3">
        <div className="d-flex flex-wrap align-items-end gap-2 mb-3">
          <div style={{flex:'1 1 260px'}}>
            <label className="form-label small fw-semibold mb-1">Add Channel (URL)</label>
            &nbsp;{active==='youtube' && ytCfg && ytOrig && ytCfg && (JSON.stringify(ytCfg)!==JSON.stringify(ytOrig)) && <span className="dirty-badge">Unsaved</span>}
            <input className="form-control form-control-sm" placeholder="https://youtube.com/@handle" value={newChannelId} onChange={e=> setNewChannelId(e.target.value)} onKeyDown={e=> { if(e.key==='Enter'){ e.preventDefault(); addChannel(); } }} />
          </div>
          <button type="button" className="btn btn-sm btn-accent" onClick={addChannel} disabled={!newChannelId.trim()||resolving}><i className="fa-solid fa-plus" /> {resolving? 'Resolving...':'Add'}</button>
        </div>
        <ul className="yt-channel-list list-unstyled m-0 p-0">
          {(!Array.isArray(ytCfg.channels) || ytCfg.channels.length===0) && <li className="text-muted small py-2">No channels added yet.</li>}
          {Array.isArray(ytCfg.channels) && ytCfg.channels.map(cid => {
            const override = (ytCfg.channelMessages||{})[cid] || {};
            const name = (ytCfg.channelNames||{})[cid] || '';
            const isEditing = editingChannel===cid;
            return <li key={cid} className={"yt-channel-item "+(isEditing? 'editing':'')}>
              <div className="yt-channel-row">
                <div className="flex-grow-1">
                  <div className="d-flex align-items-center gap-2 flex-wrap">
                    <code className="small text-muted">{cid}</code>
                    <input className="form-control form-control-sm flex-grow-1" placeholder="Name" value={name} onChange={e=> setYtCfg(c=> ({ ...c, channelNames: { ...(c.channelNames||{}), [cid]: e.target.value.slice(0,120) } }))} />
                  </div>
                </div>
                <div className="d-flex align-items-center gap-2 ms-2">
                  <button type="button" className="btn btn-icon btn-xs" title="Edit per-channel templates" onClick={()=> setEditingChannel(p=> p===cid? null: cid)}><i className="fa-solid fa-pen" /></button>
                  {(!name || name.trim()==='') && <button type="button" className="btn btn-icon btn-xs" title="Fetch channel name" onClick={async ()=>{ try { setResolving(true); const r = await resolveYouTubeChannel(cid); if(r?.channelId){ setYtCfg(c=> ({ ...c, channelNames: { ...(c.channelNames||{}), [cid]: r.title || c.channelNames?.[cid] || '' } })); } } catch{} finally { setResolving(false); } }} disabled={resolving}><i className="fa-solid fa-download" /></button>}
                  <button type="button" className="btn btn-icon btn-xs text-danger" title="Remove" onClick={()=> removeChannel(cid)}><i className="fa-solid fa-trash" /></button>
                </div>
              </div>
              {isEditing && <div className="yt-channel-edit mt-2">
                <div className="row g-2">
                  <div className="col-md-6">
                    <label className="form-label tiny fw-semibold mb-1">Upload Template</label>
                    <textarea rows={2} className="form-control form-control-sm" value={override.uploadTemplate||''} onChange={e=> setYtCfg(c=> ({ ...c, channelMessages: { ...(c.channelMessages||{}), [cid]: { ...(c.channelMessages?.[cid]||{}), uploadTemplate: e.target.value } } }))}></textarea>
                    <TemplatePreview template={override.uploadTemplate || ytCfg.uploadTemplate} channelId={cid} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label tiny fw-semibold mb-1">Member Upload Template</label>
                    <textarea rows={2} className="form-control form-control-sm" value={override.memberOnlyUploadTemplate||''} onChange={e=> setYtCfg(c=> ({ ...c, channelMessages: { ...(c.channelMessages||{}), [cid]: { ...(c.channelMessages?.[cid]||{}), memberOnlyUploadTemplate: e.target.value } } }))}></textarea>
                    <TemplatePreview template={override.memberOnlyUploadTemplate || ytCfg.memberOnlyUploadTemplate} channelId={cid} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label tiny fw-semibold mb-1">Live Template</label>
                    <textarea rows={2} className="form-control form-control-sm" value={override.liveTemplate||''} onChange={e=> setYtCfg(c=> ({ ...c, channelMessages: { ...(c.channelMessages||{}), [cid]: { ...(c.channelMessages?.[cid]||{}), liveTemplate: e.target.value } } }))}></textarea>
                    <TemplatePreview template={override.liveTemplate || ytCfg.liveTemplate} channelId={cid} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label tiny fw-semibold mb-1">Member Live Template</label>
                    <textarea rows={2} className="form-control form-control-sm" value={override.memberOnlyLiveTemplate||''} onChange={e=> setYtCfg(c=> ({ ...c, channelMessages: { ...(c.channelMessages||{}), [cid]: { ...(c.channelMessages?.[cid]||{}), memberOnlyLiveTemplate: e.target.value } } }))}></textarea>
                    <TemplatePreview template={override.memberOnlyLiveTemplate || ytCfg.memberOnlyLiveTemplate} channelId={cid} />
                  </div>
                </div>
                <div className="d-flex gap-2 mt-2">
                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={()=> setYtCfg(c=> { const cm = { ...(c.channelMessages||{}) }; delete cm[cid]; return { ...c, channelMessages: cm }; })}>Clear Overrides</button>
                  <button type="button" className="btn btn-sm btn-outline-light" onClick={()=> setEditingChannel(null)}>Close</button>
                </div>
              </div>}
            </li>;
          })}
        </ul>
      </div>
      <div className="d-flex gap-2 mt-3">
        <button className="btn btn-outline-secondary" disabled={!ytDirty()||ytSaving} onClick={ytReset}><i className="fa-solid fa-rotate-left me-2"/>Reset</button>
        <button className="btn btn-primary" disabled={!ytDirty()||ytSaving} onClick={ytSave}><i className="fa-solid fa-floppy-disk me-2"/>{ytSaving? 'Saving…':'Save'}</button>
      </div>
    </>;
  }

  function renderTwitch(){
    if(twitchLoading || !twitchCfg){ return <div className="text-muted small">Loading Twitch config…</div>; }
    return <>
      <div className="yt-config-grid mt-2">
        {/* MAIN CONFIG */}
        <div className="yt-config-block">
          <div className="d-flex justify-content-between align-items-start mb-2">
            <div>
              <div className="small text-uppercase text-muted fw-semibold mb-1">Announcement</div>
              <div className="form-check form-switch m-0">
                <input className="form-check-input" type="checkbox" checked={twitchCfg.enabled} onChange={e=> setTwitchCfg(c=> ({ ...c, enabled: e.target.checked }))} />
                <label className="form-check-label ms-2">{twitchCfg.enabled? 'Enabled':'Disabled'}</label>
              </div>
            </div>
          </div>
          <div className="mb-3">
            <label className="form-label small fw-semibold mb-1">Announce Channel</label>
            <select className="form-select form-select-sm" value={twitchCfg.announceChannelId||''} onChange={e=> setTwitchCfg(c=> ({ ...c, announceChannelId: e.target.value || null }))}>
              <option value="">Select…</option>
              {discordChannels.map(ch=> <option key={ch.id} value={ch.id}>{ch.name}</option>)}
            </select>
          </div>
          <div className="mb-3">
            <label className="form-label small fw-semibold d-flex align-items-center gap-2 mb-1">Mention Targets {twitchCfg.mentionTargets?.length ? <span className="badge-soft" style={{fontSize:'.55rem'}}>{twitchCfg.mentionTargets.length}</span>: null}</label>
            <MentionTargetsPicker
              value={twitchCfg.mentionTargets && twitchCfg.mentionTargets.length? twitchCfg.mentionTargets : (twitchCfg.mentionRoleId? [twitchCfg.mentionRoleId] : [])}
              roles={guildRoles}
              onChange={(list)=> setTwitchCfg(c=> ({ ...c, mentionTargets:list, mentionRoleId: (list.length===1 && /^[0-9]{5,32}$/.test(list[0])) ? list[0] : null }))}
            />
            <div className="form-text tiny text-muted mt-1">Enter to add • Backspace to remove • Order preserved</div>
          </div>
          <div className="mb-3">
            <div>
              <label className="form-label small fw-semibold mb-1">Interval (sec)</label>
              <input type="number" min={60} className="form-control form-control-sm" style={{width:110}} value={twitchCfg.intervalSec} onChange={e=> setTwitchCfg(c=> ({ ...c, intervalSec: Math.max(60, parseInt(e.target.value)||300) }))} />
            </div>
          </div>
          <div className="mb-3">
            <div>
              <label className="form-label small fw-semibold mb-1">Embeds</label>
              <div className="form-check form-switch m-0">
                <input className="form-check-input" type="checkbox" checked={twitchCfg.embedEnabled!==false} onChange={e=> setTwitchCfg(c=> ({ ...c, embedEnabled: e.target.checked }))} />
                <label className="form-check-label ms-2">{twitchCfg.embedEnabled!==false ? 'Enabled':'Plain'}</label>
              </div>
            </div>
          </div>
        </div>
        {/* GLOBAL TEMPLATES */}
        <div className="yt-config-block">
          <div className="small text-uppercase text-muted fw-semibold mb-2">Global Template</div>
          <div className="mb-2">
            <label className="form-label small fw-semibold mb-1">Live Stream</label>
            <textarea rows={7} className="form-control form-control-sm" value={twitchCfg.liveTemplate||''} onChange={e=> setTwitchCfg(c=> ({ ...c, liveTemplate: e.target.value }))}></textarea>
          </div>
          <div className="form-text tiny mt-2">Placeholders: {'{streamerName} {title} {url} {roleNames} {game} {viewers} {thumbnail} {startedAt} {startedAtRelative}'}</div>
        </div>
        {/* TEMPLATE PREVIEW */}
        <div className="yt-config-block">
          <div className="small text-uppercase text-muted fw-semibold mb-2">Template Preview</div>
          <div className="mb-2">
            <TemplatePreview template={twitchCfg.liveTemplate} size="lg" type="twitch" />
          </div>
          <div className="form-text tiny mt-2">Placeholders: {'{streamerName} {title} {url} {roleNames} {game} {viewers} {thumbnail} {startedAt} {startedAtRelative}'}</div>
        </div>
      </div>
      <div className="yt-config-block mt-3">
        <div className="d-flex flex-wrap align-items-end gap-2 mb-3">
          <div style={{flex:'1 1 260px'}}>
            <label className="form-label small fw-semibold mb-1">Add Streamer (username / URL)</label>
            &nbsp;{active==='twitch' && twitchCfg && twitchOrig && twitchCfg && (JSON.stringify(twitchCfg)!==JSON.stringify(twitchOrig)) && <span className="dirty-badge">Unsaved</span>}
            <input className="form-control form-control-sm" placeholder="username, https://twitch.tv/username" value={newStreamerId} onChange={e=> setNewStreamerId(e.target.value)} onKeyDown={e=> { if(e.key==='Enter'){ e.preventDefault(); addStreamer(); } }} />
          </div>
          <button type="button" className="btn btn-sm btn-accent" onClick={addStreamer} disabled={!newStreamerId.trim()||resolving}><i className="fa-solid fa-plus" /> {resolving? 'Resolving...':'Add'}</button>
        </div>
        <ul className="yt-channel-list list-unstyled m-0 p-0">
          {(!Array.isArray(twitchCfg.streamers) || twitchCfg.streamers.length===0) && <li className="text-muted small py-2">No streamers added yet.</li>}
          {Array.isArray(twitchCfg.streamers) && twitchCfg.streamers.map(username => {
            const override = (twitchCfg.streamerMessages||{})[username] || {};
            const name = (twitchCfg.streamerNames||{})[username] || '';
            const isEditing = editingStreamer===username;
            return <li key={username} className={"yt-channel-item "+(isEditing? 'editing':'')}>
              <div className="yt-channel-row">
                <div className="flex-grow-1">
                  <div className="d-flex align-items-center gap-2 flex-wrap">
                    <code className="small text-muted">{username}</code>
                    <input className="form-control form-control-sm flex-grow-1" placeholder="Display Name" value={name} onChange={e=> setTwitchCfg(c=> ({ ...c, streamerNames: { ...(c.streamerNames||{}), [username]: e.target.value.slice(0,120) } }))} />
                  </div>
                </div>
                <div className="d-flex align-items-center gap-2 ms-2">
                  <button type="button" className="btn btn-icon btn-xs" title="Edit per-streamer templates" onClick={()=> setEditingStreamer(p=> p===username? null: username)}><i className="fa-solid fa-pen" /></button>
                  {(!name || name.trim()==='') && <button type="button" className="btn btn-icon btn-xs" title="Fetch streamer name" onClick={async ()=>{ try { setResolving(true); const r = await resolveTwitchStreamer(username); if(r?.username){ setTwitchCfg(c=> ({ ...c, streamerNames: { ...(c.streamerNames||{}), [username]: r.displayName || c.streamerNames?.[username] || '' } })); } } catch{} finally { setResolving(false); } }} disabled={resolving}><i className="fa-solid fa-download" /></button>}
                  <button type="button" className="btn btn-icon btn-xs text-danger" title="Remove" onClick={()=> removeStreamer(username)}><i className="fa-solid fa-trash" /></button>
                </div>
              </div>
              {isEditing && <div className="yt-channel-edit mt-2">
                <div className="row g-2">
                  <div className="col-md-12">
                    <label className="form-label tiny fw-semibold mb-1">Live Template</label>
                    <textarea rows={2} className="form-control form-control-sm" value={override.liveTemplate||''} onChange={e=> setTwitchCfg(c=> ({ ...c, streamerMessages: { ...(c.streamerMessages||{}), [username]: { ...(c.streamerMessages?.[username]||{}), liveTemplate: e.target.value } } }))}></textarea>
                    <TemplatePreview template={override.liveTemplate || twitchCfg.liveTemplate} channelId={username} type="twitch" />
                  </div>
                </div>
                <div className="d-flex gap-2 mt-2">
                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={()=> setTwitchCfg(c=> { const sm = { ...(c.streamerMessages||{}) }; delete sm[username]; return { ...c, streamerMessages: sm }; })}>Clear Overrides</button>
                  <button type="button" className="btn btn-sm btn-outline-light" onClick={()=> setEditingStreamer(null)}>Close</button>
                </div>
              </div>}
            </li>;
          })}
        </ul>
      </div>
      <div className="d-flex gap-2 mt-3">
        <button className="btn btn-outline-secondary" disabled={!twitchDirty()||twitchSaving} onClick={twitchReset}><i className="fa-solid fa-rotate-left me-2"/>Reset</button>
        <button className="btn btn-primary" disabled={!twitchDirty()||twitchSaving} onClick={twitchSave}><i className="fa-solid fa-floppy-disk me-2"/>{twitchSaving? 'Saving…':'Save'}</button>
      </div>
    </>;
  }

  function renderPlaceholder(service){
    return <div className="text-muted small p-3">
      <p className="mb-1"><strong>{service.label}</strong> integration is not configured yet.</p>
      <p className="mb-2">Planned features: {service.desc}</p>
      <p className="mb-0">If you need this sooner, let us know.</p>
    </div>;
  }

  const showOverlay = (active==='youtube' && (ytLoading || (!ytCfg && guildId))) || (active==='twitch' && (twitchLoading || (!twitchCfg && guildId)));
  return <div className="p-4 games-socials-wrapper position-relative" style={{ minHeight: '600px' }}>
    {showOverlay && (
      <LoadingOverlay 
        title="Loading Integration Settings"
        message="Fetching your integration configuration and server data..."
        fullHeight={false}
      />
    )}
    <div className="d-flex align-items-center gap-2 mb-3">
      <h5 className="mb-0">Games & Socials</h5>
      {active==='youtube' && ytCfg && ytOrig && ytCfg && (JSON.stringify(ytCfg)!==JSON.stringify(ytOrig)) && <span className="dirty-badge">Unsaved</span>}
      {active==='twitch' && twitchCfg && twitchOrig && twitchCfg && (JSON.stringify(twitchCfg)!==JSON.stringify(twitchOrig)) && <span className="dirty-badge">Unsaved</span>}
    </div>
    <div className="services-grid d-flex flex-wrap gap-3 mb-3">
      {SERVICES.map(s => {
        const activeCls = s.key===active? 'active':'';
        const isYouTube = s.key==='youtube';
        const isTwitch = s.key==='twitch';
        // Determine enabled state (YouTube and Twitch implemented)
        const enabled = isYouTube ? (ytCfg?.enabled ?? false) : isTwitch ? (twitchCfg?.enabled ?? false) : false;
        function toggleEnabled(e){
          e.stopPropagation();
          if(isYouTube) {
            if(!ytCfg) return;
            const prev = ytCfg;
            const newVal = !prev.enabled;
            setYtCfg(c=> ({ ...c, enabled: newVal }));
            // Auto-save for quick toggle
            (async()=>{
              try {
                await updateYouTubeConfig({ ...prev, enabled: newVal }, guildId);
                // Fetch again to ensure DB flag authoritative
                const fresh = await getYouTubeConfig(guildId);
                setYtCfg(fresh); setYtOrig(fresh);
                pushToast && pushToast('success', 'YouTube '+(newVal? 'enabled':'disabled'));
              } catch(err){
                pushToast && pushToast('error','Toggle failed');
                setYtCfg(prev); // revert
              }
            })();
          } else if(isTwitch) {
            if(!twitchCfg) return;
            const prev = twitchCfg;
            const newVal = !prev.enabled;
            setTwitchCfg(c=> ({ ...c, enabled: newVal }));
            // Auto-save for quick toggle
            (async()=>{
              try {
                await updateTwitchConfig({ ...prev, enabled: newVal }, guildId);
                // Fetch again to ensure DB flag authoritative
                const fresh = await getTwitchConfig(guildId);
                setTwitchCfg(fresh); setTwitchOrig(fresh);
                pushToast && pushToast('success', 'Twitch '+(newVal? 'enabled':'disabled'));
              } catch(err){
                pushToast && pushToast('error','Toggle failed');
                setTwitchCfg(prev); // revert
              }
            })();
          }
        }
  return <button key={s.key} type="button" className={'service-card card-glass p-3 pt-4 text-start position-relative '+activeCls} onClick={()=> setActive(s.key)} style={{width:170, border: s.key===active? '2px solid var(--accent)': '1px solid rgba(255,255,255,0.08)'}}>
          <div className="position-absolute top-0 end-0 p-1" onClick={e=> e.stopPropagation()}>
            <div className="form-check form-switch m-0">
              <input className="form-check-input" style={{cursor: (isYouTube || isTwitch)? 'pointer':'not-allowed'}} disabled={!(isYouTube || isTwitch) || (isYouTube && !ytCfg) || (isTwitch && !twitchCfg)} type="checkbox" checked={enabled} onChange={toggleEnabled} />
            </div>
          </div>
          <div className="d-flex align-items-center gap-2 mb-2">
            {s.image ? (
              <img src={`/images/${s.image}`} alt={s.label} style={{height:44, width:44, objectFit:'contain', borderRadius:8}} />
            ) : (
              <span className="service-icon" style={{color:s.color, fontSize: '1.4rem'}}><i className={s.icon}></i></span>
            )}
            <span className="fw-semibold" style={{fontSize:'0.85rem'}}>{s.label}</span>
          </div>
          <div className="small text-muted" style={{fontSize:'0.65rem', lineHeight:1.1}}>{s.desc}</div>
        </button>;
      })}
    </div>
    <hr />
    {(() => { const svc = SERVICES.find(s=> s.key===active); if(!svc) return null; return (
      <div className="app-config-header d-flex align-items-center gap-3 mb-3">
        {svc.image ? <img src={`/images/${svc.image}`} alt={svc.label} className="app-config-icon" /> : <span className="service-icon" style={{color:svc.color}}><i className={svc.icon}></i></span>}
        <div className="flex-grow-1">
          <div className="fw-semibold" style={{fontSize:'.9rem'}}>{svc.label} Configuration</div>
          {active==='youtube' && ytCfg && <div className="small text-muted" style={{fontSize:'.6rem'}}>{ytCfg.enabled? 'Announcements enabled':'Announcements disabled'}</div>}
          {active==='twitch' && twitchCfg && <div className="small text-muted" style={{fontSize:'.6rem'}}>{twitchCfg.enabled? 'Announcements enabled':'Announcements disabled'}</div>}
        </div>
        {active==='youtube' && ytCfg && <span className={`status-dot ${ytCfg.enabled? 'on':'off'}`}></span>}
        {active==='twitch' && twitchCfg && <span className={`status-dot ${twitchCfg.enabled? 'on':'off'}`}></span>}
      </div> ); })()}
    {active==='youtube' ? renderYouTube() : active==='twitch' ? renderTwitch() : renderPlaceholder(SERVICES.find(s=>s.key===active))}
  </div>;
}

function MentionTargetsPicker({ value, onChange, roles }){
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const boxRef = useRef(null);
  const inputRef = useRef(null);
  const list = value || [];
  useEffect(()=>{
    function onDoc(e){ if(!boxRef.current) return; if(!boxRef.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onDoc);
    return ()=> document.removeEventListener('mousedown', onDoc);
  },[]);
  const baseOptions = [
    { id:'everyone', label:'@everyone', type:'meta' },
    { id:'here', label:'@here', type:'meta' },
    ...((roles||[]).map(r=> ({ id:r.id, label:r.name, type:'role' })))
  ];
  const filtered = baseOptions.filter(o=> !query || o.label.toLowerCase().includes(query.toLowerCase())).filter(o=> !list.includes(o.id));
  const [activeIdx, setActiveIdx] = useState(0);
  useEffect(()=>{ setActiveIdx(0); }, [query, open]);
  function add(id){ if(!list.includes(id)) onChange([ ...list, id ]); setQuery(''); setOpen(false); setTimeout(()=> inputRef.current && inputRef.current.focus(), 0); }
  function remove(id){ onChange(list.filter(x=> x!==id)); }
  function handleKey(e){
    if(e.key==='Backspace' && !query){ onChange(list.slice(0,-1)); }
    else if(e.key==='Enter') { e.preventDefault(); if(open && filtered[activeIdx]) add(filtered[activeIdx].id); }
    else if(e.key==='ArrowDown'){ e.preventDefault(); setOpen(true); setActiveIdx(i=> Math.min(filtered.length-1, i+1)); }
    else if(e.key==='ArrowUp'){ e.preventDefault(); setActiveIdx(i=> Math.max(0, i-1)); }
  }
  return <div className="mention-targets-picker" ref={boxRef}>
    <div className="mention-targets-box" onClick={()=> { setOpen(true); inputRef.current && inputRef.current.focus(); }}>
      {list.map(id=> {
        const opt = baseOptions.find(o=> o.id===id);
        const label = opt ? opt.label : (id.startsWith('@')? id : `<@&${id}>`);
        return <span key={id} className={"mention-chip "+(opt?.type==='role'? 'role':'')}>{label}<button type="button" onClick={e=> { e.stopPropagation(); remove(id); }}>&times;</button></span>;
      })}
      <input ref={inputRef} value={query} placeholder={list.length? '' : 'Add @everyone, @here or role…'} onFocus={()=> setOpen(true)} onChange={e=> { setQuery(e.target.value); setOpen(true); }} onKeyDown={handleKey} />
    </div>
    {open && filtered.length>0 && <div className="mention-targets-suggestions">
      {filtered.slice(0,40).map((o,idx)=> <button type="button" key={o.id} className={idx===activeIdx? 'active':''} onMouseEnter={()=> setActiveIdx(idx)} onClick={()=> add(o.id)}>{o.label}<span className="meta">{o.type}</span></button>)}
    </div>}
    {open && filtered.length===0 && <div className="mention-targets-suggestions"><div className="text-muted small p-2" style={{fontSize:'.55rem'}}>No matches</div></div>}
  </div>;
}
