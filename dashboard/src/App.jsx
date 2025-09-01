import React, { useState, useEffect, useRef, startTransition } from 'react';
import { createRoot } from 'react-dom/client';
// Lazy loaded sections (code splitting)
const SettingsSection = React.lazy(()=> import('./sections/SettingsSection.jsx'));
const AutosSectionLazy = React.lazy(()=> import('./sections/AutosSection.jsx'));
const OverviewSection = React.lazy(()=> import('./sections/OverviewSection.jsx'));
const CommandsSection = React.lazy(()=> import('./sections/CommandsSection.jsx'));
const PersonalizationSection = React.lazy(()=> import('./sections/PersonalizationSection.jsx'));
const ModerationSection = React.lazy(()=> import('./sections/ModerationSection.jsx'));
const GamesSocialsSection = React.lazy(()=> import('./sections/GamesSocialsSection.jsx'));
import 'bootstrap/dist/css/bootstrap.min.css';
import './theme.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
// Layout & structural components
import Sidebar from './components/Sidebar.jsx';
import AutoResponseModal from './components/AutoResponseModal.jsx';
import Footer from './components/Footer.jsx';
import Navbar from './components/Navbar.jsx';
import LoginView from './components/LoginView.jsx';
import GuildSelectionView from './components/GuildSelectionView.jsx';
import Toasts from './components/Toasts.jsx';
// Highcharts libs will be loaded dynamically (not via React.lazy because they export objects, not components)
// We'll load them when the Overview section is first viewed
// Option B: removed DataTables – using pure React table implementation
import { login, getSettings, updateSettings, listAuto, upsertAuto, deleteAuto, getApiBase, fetchJson, getCommandToggles, setCommandToggle, getPersonalization, updatePersonalization, getWelcome, updateWelcome, getChannels } from './api';
const API_BASE = getApiBase();

export default function App(){
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loginForm, setLoginForm] = useState({ username:'', password:'' });
  const [settings, setSettings] = useState(null);
  const [autos, setAutos] = useState([]); // always array
  // Modal editing state
  const emptyAuto = { key:'', pattern:'', flags:'i', replies:'', enabled:true };
  const [modalAuto, setModalAuto] = useState(emptyAuto);
  const [showAutoModal, setShowAutoModal] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [toasts, setToasts] = useState([]); // {id,type,message}
  const [loading, setLoading] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false); // Loading state for login button
  const [oauthMode, setOauthMode] = useState(true); // new flag
  const [guilds, setGuilds] = useState(()=>{
    try {
      const raw = localStorage.getItem('guildsCache');
      if(raw) return JSON.parse(raw) || [];
    } catch {}
    return [];
  });
  // Persist selected guild & view so refresh keeps current location
  const [selectedGuild, setSelectedGuild] = useState(()=>{
    try { return localStorage.getItem('selectedGuild') || null; } catch { return null; }
  });
  const [view, setView] = useState(()=>{
    try {
      const tok = localStorage.getItem('token');
      const sg = localStorage.getItem('selectedGuild');
      const lastView = localStorage.getItem('lastView');
      
      // If no token, go to login
      if(!tok) return 'login';
      
      // If we have token but no selected guild, or last view was guild selection, go to guild selection
      if(!sg || lastView === 'guild') return 'guild';
      
      // If we have both token + selectedGuild, assume dashboard
      return 'dashboard';
    } catch { return 'login'; }
  }); // login | guild | dashboard
  const [guildSearch, setGuildSearch] = useState('');
  // Sidebar section
  const [dashSection, setDashSection] = useState(()=>{
    try { return localStorage.getItem('dashSection') || 'overview'; } catch { return 'overview'; }
  }); // overview | autos | commands | personal | welcome | settings
  // Add youtube section key soon
  // Sidebar UI state
  const [sidebarOpen, setSidebarOpen] = useState(false); // mobile overlay
  // Sidebar modes: full (240px) | mini (70px) – persisted
  const [sidebarMode, setSidebarMode] = useState(()=> (typeof window!=='undefined' && localStorage.getItem('sidebarMode')==='mini') ? 'mini' : 'full');
  const sidebarRef = useRef(null);
  // Preloaded section tracking ref must be declared before any conditional early returns
  const preloaded = useRef({});
  function cycleSidebarMode(){
    setSidebarMode(m => {
      const next = (m==='full') ? 'mini' : 'full';
      if(sidebarRef.current){
        sidebarRef.current.classList.add('animating');
        setTimeout(()=> sidebarRef.current && sidebarRef.current.classList.remove('animating'), 360);
      }
      return next;
    });
  }
  useEffect(()=>{ try { localStorage.setItem('sidebarMode', sidebarMode); } catch(_){} }, [sidebarMode]);
  useEffect(()=>{ try { localStorage.setItem('guildsCache', JSON.stringify(guilds)); } catch(_){} }, [guilds]);
  // Persist selected guild & dash section
  useEffect(()=>{ try { if(selectedGuild) localStorage.setItem('selectedGuild', selectedGuild); } catch(_){} }, [selectedGuild]);
  useEffect(()=>{ try { localStorage.setItem('dashSection', dashSection); } catch(_){} }, [dashSection]);
  // Persist view mainly for guild vs dashboard (login recalculated from token presence)
  useEffect(()=>{ try { localStorage.setItem('lastView', view); } catch(_){} }, [view]);
  // On reload when we jumped straight to dashboard but guilds list empty, fetch guild metadata silently so logo appears
  useEffect(()=>{
    if(token && selectedGuild && guilds.length===0){
      (async()=>{
        try {
          const res = await fetch(API_BASE + '/api/guilds', { headers:{ Authorization: 'Bearer '+localStorage.getItem('token') }});
          if(!res.ok) return;
          const txt = await res.text();
            let data={}; try { data = txt? JSON.parse(txt):{}; } catch { return; }
          if(Array.isArray(data.guilds)) setGuilds(data.guilds);
          else if(Array.isArray(data)) setGuilds(data);
        } catch {}
      })();
    }
  }, [token, selectedGuild, guilds.length]);

  // Load guilds when on guild selection view (for page refresh scenarios)
  useEffect(()=>{
    if(token && view === 'guild' && guilds.length === 0){
      (async()=>{
        try {
          const res = await fetch(API_BASE + '/api/guilds', { headers:{ Authorization: 'Bearer '+localStorage.getItem('token') }});
          if(!res.ok) return;
          const txt = await res.text();
          let data={}; try { data = txt? JSON.parse(txt):{}; } catch { return; }
          if(Array.isArray(data.guilds)) setGuilds(data.guilds);
          else if(Array.isArray(data)) setGuilds(data);
        } catch {}
      })();
    }
  }, [token, view, guilds.length]);
  // Effect: lock body scroll when mobile sidebar open
  useEffect(()=>{
    if(sidebarOpen) { document.body.classList.add('sidebar-open'); }
    else { document.body.classList.remove('sidebar-open'); }
  }, [sidebarOpen]);
  // Global Escape key handler: closes modal first, then sidebar
  useEffect(()=>{
    const handler = (e)=>{
      if(e.key !== 'Escape') return;
      if(showAutoModal){
        e.preventDefault();
        closeAutoModal();
        return;
      }
      if(sidebarOpen){
        setSidebarOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return ()=> window.removeEventListener('keydown', handler);
  }, [showAutoModal, sidebarOpen]);
  // OAuth processing flag (start as false so effect below can trigger the first exchange)
  const initialAuthCode = (typeof window !== 'undefined') ? new URLSearchParams(window.location.search).get('code') : null;
  const [authProcessing, setAuthProcessing] = useState(false);
  // Ref to avoid double exchange attempts if dependencies cause re-run
  const oauthExchangeStarted = useRef(false);

  // Handle logout messages from URL parameters
  useEffect(() => {
    if (view === 'login') {
      const params = new URLSearchParams(window.location.search);
      const message = params.get('message');
      
      if (message && !error) {
        setError(decodeURIComponent(message));
        
        // Clean URL after showing message
        const cleanUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, '', cleanUrl);
      }
    }
  }, [view, error]);

  // --- Lifecycle / bootstrap ---
  useEffect(()=>{
    // Set up global auth manager integration if available
    if (window.authManager) {
      window.authManager.onLogout((reason) => {
        console.log('AuthManager forced logout:', reason);
        setError(reason || 'Session expired');
        doLogout();
      });
    }
    
    // If token already exists (persisted), go fetch guilds
    if(token && view==='login'){
      bootstrapGuilds();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Handle OAuth code & state present in URL (Discord redirect)
  useEffect(()=>{
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    
    // Reset authProcessing if it's been stuck for too long (failsafe)
    if (authProcessing && !code) {
      console.log('Resetting stuck authProcessing state');
      setAuthProcessing(false);
      oauthExchangeStarted.current = false; // Reset the exchange flag too
      return;
    }
    
    if(!token && code && state && !authProcessing && !oauthExchangeStarted.current){
      (async()=>{
        try {
          setAuthProcessing(true);
          oauthExchangeStarted.current = true;
          
          // Clear any previous errors before starting OAuth
          setError('');
          
          if (import.meta.env.DEBUG_PERSONALIZATION === '1') {
              console.log('[OAuth Debug] Starting exchange with code:', code?.substring(0, 10) + '...', 'state:', state);
          }
          
          // Add timeout to prevent hanging
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
          
          const resp = await fetch(API_BASE + '/api/auth/oauth/discord/exchange', { 
            method:'POST', 
            headers:{'Content-Type':'application/json'}, 
            body: JSON.stringify({ code, state }),
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          const text = await resp.text();
          
          if (import.meta.env.DEBUG_PERSONALIZATION === '1') {
              console.log('[OAuth Debug] Exchange response status:', resp.status);
              console.log('[OAuth Debug] Exchange response text:', text);
          }
          
          let data; 
          try { 
            data = text ? JSON.parse(text) : {}; 
          } catch { 
            throw new Error('OAuth exchange failed (invalid server response)'); 
          }
          
          if(!resp.ok){ 
            console.error('OAuth exchange failed:', data);
            const errorMsg = data.error === 'invalid_state' 
              ? 'Login session expired. Please try logging in again.' 
              : (data.message || data.error || 'OAuth exchange failed');
            throw new Error(errorMsg); 
          }
          
          if(data.token){ 
            localStorage.setItem('token', data.token); 
            setToken(data.token);
            
            // Also set token in AuthManager if available
            if (window.authManager) {
              window.authManager.setToken(data.token);
            }
          }
          if(Array.isArray(data.guilds)) {
            setGuilds(data.guilds);
          }
          setView('guild');
          const cleanUrl = window.location.origin + window.location.pathname; // strip params
          window.history.replaceState({}, '', cleanUrl);
        } catch(e){ 
          console.error('OAuth exchange error:', e);
          oauthExchangeStarted.current = false; // Reset flag on error so user can try again
          if (e.name === 'AbortError') {
            setError('Authentication timed out. Please try again.');
          } else {
            setError(e.message); 
          }
          // IMPORTANT: Clear stale code/state params so we don't keep retrying the same expired state
          try {
            const url = new URL(window.location.href);
            if (url.searchParams.has('code') || url.searchParams.has('state')) {
              const cleanUrl = window.location.origin + window.location.pathname; // drop query
              window.history.replaceState({}, '', cleanUrl);
              if (import.meta.env.DEBUG_PERSONALIZATION === '1') {
                console.log('[OAuth Debug] Cleared stale code/state params after failure');
              }
            }
          } catch(_e) { /* ignore */ }
        } finally { 
          setAuthProcessing(false);
        }
      })();
    }
  }, [token, authProcessing]);
  
  // Clear OAuth exchange flag when leaving login view or when token changes
  useEffect(() => {
    if (view !== 'login' || token) {
      if (oauthExchangeStarted.current) {
        console.log('Clearing OAuth exchange flag - view changed or token acquired');
        oauthExchangeStarted.current = false;
      }
    }
  }, [view, token]);

  // Failsafe: Reset authProcessing if it gets stuck
  useEffect(() => {
    if (authProcessing) {
      const timeoutId = setTimeout(() => {
        console.log('Resetting stuck authProcessing after timeout');
        setAuthProcessing(false);
        oauthExchangeStarted.current = false; // Also reset the exchange flag
      }, 30000); // 30 second timeout
      
      return () => clearTimeout(timeoutId);
    }
  }, [authProcessing]);

  // If token exists (return visit) fetch user profile to restore selected guild automatically
  useEffect(()=>{
    if(token && view==='login'){
      (async()=>{
        try {
          const resp = await fetch(API_BASE + '/api/auth/user/me', { headers:{ Authorization:'Bearer '+token }});
          if(resp.ok){
            const t = await resp.text();
            let u={}; try { u = t? JSON.parse(t):{}; } catch {}
            if(u && u.selected_guild_id){
              // First, fetch guilds to validate the selected guild
              const guildResp = await fetch(API_BASE + '/api/guilds', { headers:{ Authorization: 'Bearer '+token }});
              if(guildResp.ok){
                const guildTxt = await guildResp.text();
                let guildData={}; try { guildData = guildTxt? JSON.parse(guildTxt):{}; } catch {}
                const availableGuilds = guildData.guilds||guildData||[];
                setGuilds(availableGuilds);
                
                // Check if the selected guild is still valid and user can manage it
                const validGuild = availableGuilds.find(g => g.id === u.selected_guild_id && g.canManage);
                if(validGuild){
                  setSelectedGuild(u.selected_guild_id);
                  setView('dashboard');
                  refresh();
                } else {
                  // Selected guild is no longer valid, go to guild selection
                  setSelectedGuild(null);
                  setView('guild');
                }
              } else {
                bootstrapGuilds();
              }
            } else {
              bootstrapGuilds();
            }
          } else if(resp.status === 401) {
            // Token is invalid/expired - force logout to clear everything
            console.log('Token validation failed on login page - clearing session');
            doLogout();
          }
        } catch(e){
          // Network error or other issue - don't force logout, just log
          console.warn('Token validation failed:', e.message);
        }
      })();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function bootstrapGuilds(){
    // Guard: don't make API calls if no token
    const currentToken = localStorage.getItem('token');
    if (!currentToken) {
      console.log('No token available for bootstrapGuilds, redirecting to login...');
      setView('login');
      return;
    }
    
    try {
      setLoading(true);
      // guild list endpoint piggybacked from settings API when guild not chosen yet? Fallback to /api/guilds via window.fetch
      const res = await fetch(API_BASE + '/api/guilds', { headers:{ Authorization: 'Bearer '+currentToken }});
      if(!res.ok) {
        if(res.status === 401) {
          // Unauthorized - token invalid, force logout
          console.log('Bootstrap guilds failed - unauthorized, forcing logout');
          doLogout();
          return;
        }
        if(res.status === 404) {
          // Guilds endpoint not found - set empty guilds and go to guild selection
          console.log('Guilds endpoint not found - setting empty guild list');
          setGuilds([]);
          setView('guild');
          return;
        }
        throw new Error(`Failed to load guilds (${res.status})`);
      }
      const txt = await res.text(); 
      let data={}; 
      try { data = txt? JSON.parse(txt):{}; } catch { throw new Error('Guilds JSON parse failed'); }
      setGuilds(data.guilds||data||[]);
      setView('guild');
    } catch(e){ 
      if(e.message.includes('logout')) {
        // Already handled logout above
        return;
      }
      setError(e.message); 
    }
    finally { setLoading(false); }
  }

  // Function to refresh guild list (for when bot is added to new servers)
  async function refreshGuilds(){
    const currentToken = localStorage.getItem('token');
    if (!currentToken) return;
    
    try {
      const res = await fetch(API_BASE + '/api/guilds', { headers:{ Authorization: 'Bearer '+currentToken }});
      
      if(!res.ok) {
        if(res.status === 401) {
          doLogout();
          return;
        }
        if(res.status === 404) {
          // Guilds endpoint not found - redirect to guild selection with empty guilds
          setGuilds([]);
          setView('guild');
          return;
        }
        return; // Fail silently for other errors during refresh
      }
      const txt = await res.text();
      let data={}; 
      try { data = txt? JSON.parse(txt):{}; } catch { return; }
      setGuilds(data.guilds||data||[]);
      // Clear any selected guild that might be invalid
      const newGuilds = data.guilds||data||[];
      if (selectedGuild && !newGuilds.find(g => g.id === selectedGuild)) {
        setSelectedGuild(null);
      }
    } catch(e){ 
      // Fail silently for refresh
    }
  }

  useEffect(()=>{ if(token && view==='dashboard' && selectedGuild){ refresh(); } }, [token, view, selectedGuild]);

  // Ensure guilds are loaded when on guild selection view
  useEffect(()=>{
    if(token && view==='guild' && guilds.length === 0){
      console.log('Guild selection view with empty guilds - fetching guilds...');
      // Inline bootstrap logic to avoid dependency issues
      (async()=>{
        const currentToken = localStorage.getItem('token');
        if (!currentToken) {
          console.log('No token available for guild fetch, redirecting to login...');
          setView('login');
          return;
        }
        
        try {
          setLoading(true);
          const res = await fetch(API_BASE + '/api/guilds', { headers:{ Authorization: 'Bearer '+currentToken }});
          if(!res.ok) {
            if(res.status === 401) {
              console.log('Guild fetch failed - unauthorized, forcing logout');
              doLogout();
              return;
            }
            if(res.status === 404) {
              console.log('Guilds endpoint not found - setting empty guild list');
              setGuilds([]);
              setView('guild');
              return;
            }
            throw new Error(`Failed to load guilds (${res.status})`);
          }
          const txt = await res.text(); 
          let data={}; 
          try { data = txt? JSON.parse(txt):{}; } catch { throw new Error('Guilds JSON parse failed'); }
          setGuilds(data.guilds||data||[]);
          // Don't change view if we're already on guild
        } catch(e){ 
          if(e.message.includes('logout')) {
            return;
          }
          setError(e.message); 
        }
        finally { setLoading(false); }
      })();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, view, guilds.length]);

  async function refresh(){
    if(!selectedGuild) return;
    
    // Guard: don't make API calls if no token
    const currentToken = localStorage.getItem('token');
    if (!currentToken) {
      console.log('No token available for refresh, skipping...');
      return;
    }
    
    try {
      setLoading(true);
      const [s, a] = await Promise.all([getSettings(selectedGuild), listAuto(selectedGuild)]);
      setSettings(s || {});
      setAutos(Array.isArray(a) ? a : []);
      setError('');
    } catch(e){
      if (e.message.toLowerCase().includes('unauthorized') || e.message.toLowerCase().includes('authentication failed')) { 
        console.log('Refresh failed due to auth error, logging out...');
        doLogout(); 
      } else {
        setError(e.message);
      }
    } finally { setLoading(false); }
  }

  async function handleLogin(e){
    e.preventDefault();
    try { await login(loginForm.username, loginForm.password); setToken(localStorage.getItem('token')); setError(''); } catch(e){ setError(e.message); }
  }

  function startDiscordLogin(){
    setLoginLoading(true);
    setError('');
    const isDevelopment = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || !!window.location.port);
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isAndroid = /Android/i.test(ua);
    const isMobile = isIOS || isAndroid;
  // Optional: allow Android deep link attempt if explicitly enabled (can be flaky on some devices/browsers)
  const enableAndroidApp = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_ANDROID_APP_LOGIN === '1');
  // Attempt discord:// on iOS by default; Android only if flag enabled. Desktop handled separately below.
  const preferApp = !isDevelopment && (isIOS || (enableAndroidApp && isAndroid));
    if (import.meta.env.DEBUG_PERSONALIZATION === '1') {
      console.log('[OAuth Debug] Platform detection:', { isDevelopment, isIOS, isAndroid, isMobile, preferApp });
    }
    const url = `/api/auth/oauth/discord/url?preferApp=${preferApp}&isMobile=${isMobile}`;
    fetchJson(url)
      .then(d => {
        if (import.meta.env.DEBUG_PERSONALIZATION === '1') {
          console.log('[OAuth Debug] URL generation response:', d);
        }
        if(!(d && (d.url || d.webUrl || d.appUrl))) throw new Error('No OAuth URL');
    if(preferApp && d.appUrl){
      // Immediate deep link attempt (no artificial delay) with fallback (mobile flag influences timing)
      tryDiscordAppWithFallback(d.appUrl, d.webUrl || d.url || d.appUrl, isMobile);
        } else if(!isDevelopment && !isMobile && d.appUrl && d.webUrl){
            checkDiscordAppAndRedirect(d.appUrl, d.webUrl);
        } else {
            const redirectUrl = d.webUrl || d.url || d.appUrl;
            if (import.meta.env.DEBUG_PERSONALIZATION === '1') {
              console.log('[OAuth Debug] Using web OAuth URL:', redirectUrl);
            }
            window.location.href = redirectUrl;
        }
      })
      .catch(e => {
        setError('OAuth URL error: '+e.message+' (is backend running on 3001?)');
        setLoginLoading(false);
      });
  }

  function checkDiscordAppAndRedirect(appUrl, webUrl) {
    // For desktop: Try to detect if Discord app is running/available
    let redirected = false;
    
    // Create a test to see if Discord app can handle the protocol
    const startTime = Date.now();
    
    // Try Discord app protocol
    window.location.href = appUrl;
    
    // Set up a timer to check if we're still on the page
    // If Discord app opens, the page should lose focus or the app should take over
    setTimeout(() => {
      const elapsed = Date.now() - startTime;
      
      // If we're still here and focused after 2 seconds, Discord app probably didn't open
      if (document.hasFocus() && !document.hidden && !redirected) {
        console.log('Discord app not available or failed to open, redirecting to browser');
        window.location.href = webUrl;
        redirected = true;
      }
    }, 2000);
    
    // Also check for visibility change (app switch)
    const handleVisibilityChange = () => {
      if (document.hidden && !redirected) {
        redirected = true;
        console.log('Discord app opened successfully');
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Cleanup listener after 5 seconds
    setTimeout(() => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, 5000);
  }

  function tryDiscordAppWithFallback(appUrl, webUrl, isMobile = false) {
    let redirected = false;
    const startTime = Date.now();
    
    // For mobile, be more persistent with app opening
    const fallbackDelay = isMobile ? 3000 : 2000;
    
    try {
      window.location.href = appUrl;
    } catch (e) {
      console.log('Discord app protocol failed, using web browser');
      window.location.href = webUrl;
      redirected = true;
      return;
    }
    
    // Fallback mechanism
    setTimeout(() => {
      if (document.hasFocus() && !document.hidden && !redirected) {
        window.location.href = webUrl;
        redirected = true;
      }
    }, fallbackDelay);
    
    // For mobile, also listen for app switches
    if (isMobile) {
      const handleFocus = () => {
        // If we regain focus quickly, app probably didn't open
        const elapsed = Date.now() - startTime;
        if (elapsed < 1000 && !redirected) {
          console.log('Quick focus return, Discord app may not be installed');
          window.location.href = webUrl;
          redirected = true;
        }
        window.removeEventListener('focus', handleFocus);
      };
      
      window.addEventListener('focus', handleFocus);
      
      // Cleanup
      setTimeout(() => {
        window.removeEventListener('focus', handleFocus);
      }, 5000);
    }
  }

  // Android specific sequence using discord:// then intent:// then web fallback.
  // NOTE: Discord Android app often does NOT register the deep link for the full OAuth authorize path; success is not guaranteed.
  function tryAndroidDeepLinkSequence(oauthData){
    const webUrl = oauthData.webUrl || oauthData.url || oauthData.appUrl;
    const originalAppUrl = oauthData.appUrl; // discord://discord.com/api/oauth2/authorize?... (from backend)
    // Derive query part to build variant deep links (Discord may only register certain paths on Android)
    const queryPart = (()=>{ try { return webUrl.split('?')[1] || ''; } catch { return ''; } })();
    const variants = [
      originalAppUrl,
      `discord://discord.com/oauth2/authorize?${queryPart}`,
      `discord://oauth2/authorize?${queryPart}`
    ].filter(Boolean);
    // Build intent URL (Chrome) with fallback back to the web URL (using standard /oauth2 path, not /api/oauth2)
    const intentUrl = `intent://discord.com/oauth2/authorize?${queryPart}#Intent;scheme=discord;package=com.discord;S.browser_fallback_url=${encodeURIComponent(webUrl)};end`;
    if (import.meta.env.DEBUG_PERSONALIZATION === '1') {
      console.log('[OAuth Debug][Android] Deep link sequence start', { variants, intentUrl, webUrl });
    }
    let stage = 0; // 0 protocol, 1 intent, 2 web
    let variantIndex = 0;
    const tryIntent = () => {
      if(stage !== 0) return;
      stage = 1;
      if (import.meta.env.DEBUG_PERSONALIZATION === '1') console.log('[OAuth Debug][Android] Trying intent URL');
      window.location.href = intentUrl;
    };
    const fallbackWeb = () => {
      if(stage === 2) return;
      stage = 2;
      if (import.meta.env.DEBUG_PERSONALIZATION === '1') console.log('[OAuth Debug][Android] Falling back to web URL');
      window.location.href = webUrl;
    };
    // Attempt variants sequentially before intent
    const tryNextVariant = () => {
      if (variantIndex >= variants.length) { tryIntent(); return; }
      const v = variants[variantIndex++];
      if (!v) { tryNextVariant(); return; }
      if (import.meta.env.DEBUG_PERSONALIZATION === '1') console.log('[OAuth Debug][Android] Trying variant', v);
      try { window.location.href = v; } catch { tryNextVariant(); }
      // Schedule next variant if still here
      setTimeout(()=>{
        if (document.hasFocus() && !document.hidden && stage === 0) {
          tryNextVariant();
        }
      }, 600);
    };
    tryNextVariant();
    // After 1s attempt intent if still here
    setTimeout(()=>{ if(document.hasFocus() && !document.hidden && stage === 0) tryIntent(); }, 2000);
    // After 2500ms fallback to web if still here
    setTimeout(()=>{ if(document.hasFocus() && !document.hidden && stage < 2) fallbackWeb(); }, 4000);
  }

  function doLogout(){
    
    // Clear all localStorage items
    localStorage.removeItem('token');
    localStorage.removeItem('selectedGuild');
    localStorage.removeItem('dashSection');
    localStorage.removeItem('lastView');
    localStorage.removeItem('guildsCache');
    
    // Reset all state
    setToken(null);
    setSelectedGuild(null);
    setSettings(null);
    setAutos([]);
    setGuilds([]);
    setError('');
    setInfo('');
    setLoading(false);
    setAuthProcessing(false);
    
    // Ensure we're on login view
    setView('login');
    
    // Clear any existing auth manager token if available
    if (window.authManager) {
      window.authManager.clearToken();
    }
  }

  function saveSelectedGuild(nextView){
    if(!selectedGuild) return;
    (async()=>{
      try {
        const response = await fetch(API_BASE + '/api/auth/user/select-guild', { 
          method:'POST', 
          headers:{ 
            'Content-Type':'application/json', 
            Authorization:'Bearer '+localStorage.getItem('token') 
          }, 
          body: JSON.stringify({ guildId: selectedGuild }) 
        });
        
        if (!response.ok) {
          if (response.status === 401) {
            // Token is invalid, redirect to login
            doLogout();
            return;
          }
          throw new Error(`Server selection failed: ${response.status}`);
        }
        
        // Successfully selected guild, proceed to dashboard
        setView(nextView||'dashboard');
        refresh();
      } catch(e){ 
        console.error('Guild selection error:', e);
        setError('Failed to select server: ' + e.message);
        // Don't proceed to dashboard if there was an error
      }
    })();
  }

  function openNewAuto(){
    setModalAuto(emptyAuto);
    setShowAutoModal(true);
  }
  function openEditAuto(a){
    const replies = Array.isArray(a.replies)? a.replies.join('\n'): '';
    setModalAuto({...a, replies });
    setShowAutoModal(true);
  }
  function closeAutoModal(){
    setShowAutoModal(false);
    setModalAuto(emptyAuto);
  }

  // (regex tester + table logic moved into AutosSection)

  async function saveSettings(){
    try {
      const optimistic = { ...settings };
      setSettings(optimistic);
  const updated = await updateSettings(optimistic, selectedGuild);
      setSettings(updated);
  pushToast('success','Settings saved');
    } catch(e){ setError(e.message); }
  }

  async function addOrUpdateAuto(){
    if(!modalAuto.key || !modalAuto.pattern) return;
    const replies = modalAuto.replies.split('\n').map(r=>r.trim()).filter(Boolean);
    const entry = { key:modalAuto.key, pattern:modalAuto.pattern, flags:modalAuto.flags, replies, enabled: modalAuto.enabled };
    // optimistic update
    setAutos(prev => {
      const idx = prev.findIndex(p=>p.key===entry.key);
      if(idx>=0){ const copy=[...prev]; copy[idx]=entry; return copy; }
      return [...prev, entry];
    });
    try {
  await upsertAuto(entry, selectedGuild);
  pushToast('success','Auto response saved');
      closeAutoModal();
    } catch(e){ setError(e.message); refresh(); }
  }

  async function removeAuto(key){
    if(!window.confirm('Delete '+key+'?')) return;
    // optimistic removal
    const prev = autos;
    setAutos(autos.filter(a=>a.key!==key));
  try { await deleteAuto(key, selectedGuild); pushToast('success','Deleted'); } catch(e){ setError(e.message); setAutos(prev); }
  }

  function pushToast(type,message){
    const id = Math.random().toString(36).slice(2);
    setToasts(t => [...t, { id, type, message }]);
    setTimeout(()=> setToasts(t => t.filter(x=>x.id!==id)), 3500);
  }

  // Responsive breakpoint detection for mobile optimized UI (used for sidebar behavior only now)
  const [isMobile, setIsMobile] = useState(false);
  useEffect(()=>{
    function handleResize(){ setIsMobile(window.innerWidth < 720); }
    handleResize();
    window.addEventListener('resize', handleResize);
    return ()=> window.removeEventListener('resize', handleResize);
  }, []);

  // Add body padding to accommodate fixed footer
  useEffect(()=>{
    if(typeof document !== 'undefined'){
      document.body.classList.add('has-fixed-footer');
      return () => document.body.classList.remove('has-fixed-footer');
    }
  }, []);

  // simple stats
  const totalEnabled = Array.isArray(autos) ? autos.filter(a=>a && a.enabled!==false).length : 0;
  const totalDisabled = (Array.isArray(autos)? autos.length:0) - totalEnabled;
  // Analytics snapshot state
  const [analytics, setAnalytics] = useState(null);
  const [apiStatus, setApiStatus] = useState(null); // shape { gemini:{enabled}, discord:{ready,ping}, database:{mode,connected}, uptime:{seconds,startedAt} }
  // Highcharts dynamic modules
  const [Highcharts, setHighcharts] = useState(null);
  const [HighchartsReact, setHighchartsReact] = useState(null);
  const [chartsReady, setChartsReady] = useState(false);
  // Load chart libs only when overview section is viewed & analytics needed
  useEffect(()=>{
    let cancelled = false;
    if(dashSection==='overview' && !Highcharts){
      (async()=>{
        try {
          const [hc, hcr] = await Promise.all([
            import(/* webpackChunkName: 'charts-hc' */ 'highcharts'),
            import(/* webpackChunkName: 'charts-hcr' */ 'highcharts-react-official')
          ]);
          if(!cancelled){
            setHighcharts(hc.default || hc);
            setHighchartsReact(hcr.default || hcr);
            setChartsReady(true);
          }
        } catch(e){ /* ignore failed chart load */ }
      })();
    }
    return ()=>{ cancelled=true; };
  }, [dashSection, Highcharts]);
  useEffect(()=>{
    if(view==='dashboard' && selectedGuild){
      fetch(getApiBase() + '/api/analytics/overview?guildId='+selectedGuild, { headers:{ Authorization:'Bearer '+localStorage.getItem('token') }} )
        .then(r=>r.json().catch(()=>null))
        .then(d=>{ if(d && d.totals) setAnalytics(d); })
        .catch(()=>{});
      fetch(getApiBase() + '/api/status', { headers:{ Authorization:'Bearer '+localStorage.getItem('token') }} )
        .then(r=>r.json().catch(()=>null))
        .then(d=>{ if(d && d.uptime) setApiStatus(d); })
        .catch(()=>{});
    }
  }, [view, selectedGuild, autos.length]);

  // Auto-refresh analytics and status every 30 seconds
  useEffect(() => {
    if (view === 'dashboard' && selectedGuild) {
      const refreshInterval = setInterval(() => {
        // Refresh analytics data
        fetch(getApiBase() + '/api/analytics/overview?guildId='+selectedGuild, { headers:{ Authorization:'Bearer '+localStorage.getItem('token') }} )
          .then(r=>r.json().catch(()=>null))
          .then(d=>{ if(d && d.totals) setAnalytics(d); })
          .catch(()=>{});
        
        // Refresh status data  
        fetch(getApiBase() + '/api/status', { headers:{ Authorization:'Bearer '+localStorage.getItem('token') }} )
          .then(r=>r.json().catch(()=>null))
          .then(d=>{ if(d && d.uptime) setApiStatus(d); })
          .catch(()=>{});
      }, 5000); // Refresh every 30 seconds

      return () => clearInterval(refreshInterval);
    }
  }, [view, selectedGuild]);

  function refreshAnalytics(){
    if(!(view==='dashboard' && selectedGuild)) return;
    fetch(getApiBase() + '/api/analytics/overview?guildId='+selectedGuild, { headers:{ Authorization:'Bearer '+localStorage.getItem('token') }} )
      .then(r=>r.json().catch(()=>null))
      .then(d=>{ if(d && d.totals) setAnalytics(d); })
      .catch(()=>{});
  }

  function adjustAutosEnabled(delta){
    if(!delta) return;
    setAnalytics(a => {
      if(!a || !a.totals) return a;
      const totals = { ...a.totals };
      if(typeof totals.autosEnabled === 'number'){
        const autosTotal = totals.autos ?? Math.max(totals.autosEnabled, 0);
        totals.autosEnabled = Math.max(0, Math.min(autosTotal, totals.autosEnabled + delta));
      }
      return { ...a, totals };
    });
  }

  // Command toggles state
  const [commandTogglesState, setCommandTogglesState] = useState({}); // name -> enabled bool
  const [commandMeta, setCommandMeta] = useState({}); // name -> {createdAt, createdBy, updatedAt, updatedBy}
  useEffect(()=>{
    if(dashSection==='commands' && selectedGuild){
      (async()=>{
        try {
          const data = await getCommandToggles(selectedGuild);
          if(data && Array.isArray(data.commands)){
            const enabledMap = {}; const metaMap = {};
            for (const c of data.commands){
              enabledMap[c.name] = c.enabled !== false;
              metaMap[c.name] = { createdAt: c.createdAt, createdBy: c.createdBy, updatedAt: c.updatedAt, updatedBy: c.updatedBy };
            }
            setCommandTogglesState(enabledMap);
            setCommandMeta(metaMap);
          } else if (data && data.toggles) { // fallback older shape
            setCommandTogglesState(data.toggles);
          }
        } catch(e){ /* ignore */ }
      })();
    }
  }, [dashSection, selectedGuild]);
  function toggleCommand(name, enabled){
    // Optimistic toggle update + adjust analytics counters so Overview updates immediately
    setCommandTogglesState(prev => {
      const prevEnabled = prev[name] !== false; // treat undefined as enabled (default true) ? existing logic: enabled !== false
      if(prevEnabled !== enabled){
        setAnalytics(a => {
          if(!a || !a.totals) return a;
          const totals = { ...a.totals };
          if(enabled){
            totals.commandsEnabled = Math.min((totals.commandsEnabled||0) + 1, totals.commands||totals.commandsEnabled||0);
            if(typeof totals.commandsDisabled === 'number') totals.commandsDisabled = Math.max(totals.commandsDisabled - 1, 0);
          } else {
            totals.commandsEnabled = Math.max((totals.commandsEnabled||0) - 1, 0);
            if(typeof totals.commandsDisabled === 'number') totals.commandsDisabled = Math.min((totals.commandsDisabled||0) + 1, totals.commands|| (totals.commandsEnabled||0));
          }
          return { ...a, totals };
        });
      }
      return { ...prev, [name]: enabled };
    });
    setCommandToggle(name, enabled, selectedGuild).then(()=>{
      // Show toast with appropriate style
      pushToast(enabled ? 'success' : 'info', `Command "${name}" ${enabled ? 'enabled' : 'disabled'} successfully`);
      // fetch authoritative analytics snapshot
      refreshAnalytics();
    }).catch(()=>{
      // Revert on failure (both toggle state & analytics counters)
      setCommandTogglesState(prev => {
        const currentEnabled = prev[name] !== false;
        if(currentEnabled === enabled){
          setAnalytics(a => {
            if(!a || !a.totals) return a;
            const totals = { ...a.totals };
            if(enabled){
              // we attempted enabling; revert to disabled
              totals.commandsEnabled = Math.max((totals.commandsEnabled||0) - 1, 0);
              if(typeof totals.commandsDisabled === 'number') totals.commandsDisabled = Math.min((totals.commandsDisabled||0) + 1, totals.commands|| (totals.commandsEnabled||0));
            } else {
              // attempted disabling; revert to enabled
              totals.commandsEnabled = Math.min((totals.commandsEnabled||0) + 1, totals.commands|| (totals.commandsEnabled||0));
              if(typeof totals.commandsDisabled === 'number') totals.commandsDisabled = Math.max((totals.commandsDisabled||0) - 1, 0);
            }
            return { ...a, totals };
          });
          return { ...prev, [name]: !enabled };
        }
        return prev;
      });
      pushToast('error', 'Failed to update '+name);
    });
  }

  // (Legacy selection helpers removed in Option B)

  // ---- Move below states above conditional early returns to maintain consistent hook order ----
  // Personalization state (must be declared before any conditional returns)
  const [personalization, setPersonalization] = useState(null);
  const [personalizationLoading, setPersonalizationLoading] = useState(false);
  const [personalizationOriginal, setPersonalizationOriginal] = useState(null); // snapshot for dirty detection
  useEffect(()=>{
    if(dashSection==='personal' && selectedGuild){
      (async()=>{ 
        try { 
          setPersonalizationLoading(true);
          const p = await getPersonalization(selectedGuild); 
          setPersonalization(p); 
          setPersonalizationOriginal(p);
        } catch{} 
        finally { setPersonalizationLoading(false); }
      })();
    }
  }, [dashSection, selectedGuild]);

  // Welcome config state (also before conditional returns)
  const [welcomeCfg, setWelcomeCfg] = useState(null);
  const [welcomeOriginal, setWelcomeOriginal] = useState(null); // snapshot for dirty detection
  const [welcomeLoading, setWelcomeLoading] = useState(false);
  const [welcomeChannels, setWelcomeChannels] = useState([]);
  useEffect(()=>{
    if(dashSection==='welcome' && selectedGuild){
  (async()=>{ try { setWelcomeLoading(true); const [w, ch] = await Promise.all([getWelcome(selectedGuild), getChannels(selectedGuild).catch(()=>null)]); setWelcomeCfg(w); setWelcomeOriginal(w); if(ch && Array.isArray(ch.channels)) setWelcomeChannels(ch.channels); } catch{} finally { setWelcomeLoading(false); } })();
    }
  }, [dashSection, selectedGuild]);

  // Login view
  if(view==='login' && !token){
    if(typeof document!=='undefined'){ document.body.classList.add('login-mode'); }
    return <>
      <Navbar />
      <LoginView
        error={error}
        authProcessing={authProcessing}
        loginLoading={loginLoading}
        startDiscordLogin={startDiscordLogin}
      />
      <Footer />
    </>;
  } else if(typeof document!=='undefined'){ document.body.classList.remove('login-mode'); }

  // Guild selection view
  if(view==='guild'){
    return <>
      <Navbar />
      <GuildSelectionView
        guilds={guilds}
        guildSearch={guildSearch}
        setGuildSearch={setGuildSearch}
        selectedGuild={selectedGuild}
        setSelectedGuild={setSelectedGuild}
        error={error}
        saveSelectedGuild={saveSelectedGuild}
        doLogout={doLogout}
        refreshGuilds={refreshGuilds}
      />
      <Footer />
    </>;
  }

  // Dashboard view --------------------------------------------------
  if(view!=='dashboard') return null; // safety

  const resolvedGuildName = guilds.find(g=>g.id===selectedGuild)?.name || (selectedGuild && selectedGuild.length>4 ? 'Server '+selectedGuild.slice(0,6)+'…' : selectedGuild) || 'Unknown';
  const guildBanner = guilds.find(g=>g.id===selectedGuild)?.banner ? `https://cdn.discordapp.com/banners/${selectedGuild}/${guilds.find(g=>g.id===selectedGuild).banner}.png?size=512` : null;

  // --- Section contents ---
  const overviewContent = <OverviewSection analytics={analytics} apiStatus={apiStatus} autos={autos} totalEnabled={totalEnabled} totalDisabled={totalDisabled} error={error} info={info} loading={loading} dashSection={dashSection} chartsReady={chartsReady} Highcharts={Highcharts} HighchartsReact={HighchartsReact} refreshAnalytics={refreshAnalytics} />;

  const autosContent = <React.Suspense fallback={<div className="text-muted small p-3">Loading auto responses…</div>}>
    <AutosSectionLazy
    autos={autos}
    setAutos={setAutos}
    totalEnabled={totalEnabled}
    totalDisabled={totalDisabled}
    selectedGuild={selectedGuild}
    openEditAuto={openEditAuto}
    openNewAuto={openNewAuto}
    upsertAuto={upsertAuto}
    deleteAuto={deleteAuto}
    pushToast={pushToast}
    refresh={refresh}
  refreshAnalytics={refreshAnalytics}
  adjustAutosEnabled={adjustAutosEnabled}
  />
  </React.Suspense>;

  const commandGroups = [
    {
      key: 'core', title: 'Core', icon: 'fa-gauge-high', accent: 'var(--accent)',
      items: [
        { name:'ping', usage:'/ping', desc:'Health check – replies with Pong.' },
        { name:'uptime', usage:'/uptime', desc:'Shows bot process uptime.' },
        { name:'whoami', usage:'/whoami', desc:'Shows your user tag & id.' },
        { name:'echo', usage:'/echo <text>', desc:'Replies with the same text.' },
        { name:'help', usage:'/help', desc:'Interactive category help menu.' }
      ]
    },
    {
      key: 'ai', title: 'AI & Language', icon: 'fa-robot', accent: '#8d90ff',
      items: [
        { name:'ask', usage:'/ask prompt:<text>', desc:'Ask AI a question (cached 3 min).' },
        { name:'askfollow', usage:'/askfollow prompt:<text>', desc:'Follow-up using recent conversation context.' },
        { name:'explain_image', usage:'/explain_image image(1-3) [prompt]', desc:'Explain up to 3 images with optional prompt.' },
        { name:'summarize', usage:'/summarize [count]', desc:'Summarize last messages (default 30).' },
        { name:'translate', usage:'/translate text target', desc:'Translate text into the target language.' }
      ]
    },
    {
      key: 'polls', title: 'Polls', icon: 'fa-square-poll-horizontal', accent: '#10b981',
      items: [
        { name:'poll create', usage:'/poll create question options', desc:'Create a poll (up to 5 options).' },
        { name:'poll results', usage:'/poll results id', desc:'Show results for a poll id.' }
      ]
    },
    {
      key: 'utilities', title: 'Utilities', icon: 'fa-wrench', accent: '#f59e0b',
      items: [
        { name:'math', usage:'/math add|sub|mul|div a b', desc:'Basic arithmetic operations.' },
        { name:'user info', usage:'/user info [target]', desc:'Lookup Discord user info.' },
  { name:'remind', usage:'/remind minutes text', desc:'Schedule a reminder DM or channel.' },
	{ name:'meme', usage:'/meme', desc:'Random meme image from meme-api.com.' }
      ]
    },
    {
      key: 'moderation', title: 'Moderation & Roles', icon: 'fa-users-gear', accent: '#8b5cf6',
      items: [
        { name:'role list', usage:'/role list', desc:'Show all available self-assignable roles.' },
        { name:'role menu', usage:'/role menu', desc:'Interactive role selection menu (ephemeral).' },
        { name:'role add', usage:'/role add <role> [user]', desc:'Add a self-assignable role to yourself or another user.' },
        { name:'role remove', usage:'/role remove <role> [user]', desc:'Remove a self-assignable role from yourself or another user.' },
        { name:'role setup', usage:'/role setup <action> <role> [options]', desc:'Configure self-assignable roles (requires Manage Roles).', requiresManage:true },
        { name:'role toggle', usage:'/role toggle <command_name>', desc:'Enable/disable a role command (requires Manage Roles).', requiresManage:true }
      ]
    },
    {
      key: 'passive', title: 'Passive / Automation', icon: 'fa-bolt', accent: '#ef4444',
      items: [
        { name:'autoreply', usage:'(passive)', desc:'Automatic replies based on configured patterns.' },
        { name:'welcome', usage:'(passive)', desc:'Welcome new members with customizable messages and cards.' },
        { name:'automod', usage:'(passive)', desc:'Automatic moderation for spam, caps, links, and profanity.' },
        { name:'xp system', usage:'(passive)', desc:'XP and leveling system for active members.' },
        { name:'audit logs', usage:'(passive)', desc:'Track all moderation actions and server changes.' },
        { name:'anti-raid', usage:'(passive)', desc:'Protection against raids and mass join attacks.' }
      ]
    },
    // YouTube group (conditionally shown if user has Manage Server permission in guild)
    {
      key: 'youtube', title: 'YouTube', icon: 'fa-brands fa-youtube', accent: '#FF0000',
      items: [
    { name:'ytwatch', usage:'/ytwatch action:<enable|disable|addchannel|removechannel|announcechannel|mentionrole|interval|status>', desc:'Manage YouTube notifications (requires Manage Server).', requiresManage:true },
    { name:'ytstats', usage:'/ytstats', desc:'Show YouTube watcher cache & quota stats.', requiresManage:true }
      ]
    },
    // Twitch group (conditionally shown if user has Manage Server permission in guild)
    {
      key: 'twitch', title: 'Twitch', icon: 'fa-brands fa-twitch', accent: '#9146FF',
      items: [
        { name:'twitchstats', usage:'/twitchstats', desc:'Show Twitch watcher cache & API stats.', requiresManage:true },
        { name:'twitchdebug', usage:'/twitchdebug action:<config|status|test|resolve>', desc:'Debug Twitch integration and test notifications.', requiresManage:true }
      ]
    }
  ];
  const selectedGuildObj = guilds.find(g=> g.id===selectedGuild);
  const hasManageGuild = selectedGuildObj ? !!selectedGuildObj.canManage : false;
  const commandsContent = <CommandsSection hasManageGuild={hasManageGuild} commandGroups={commandGroups} commandTogglesState={commandTogglesState} commandMeta={commandMeta} toggleCommand={toggleCommand} />;

  function handleAvatarFile(e){
    const file = e.target.files?.[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const b64 = reader.result.toString();
      setPersonalization(p => ({ ...(p||{}), avatarBase64: b64 }));
    };
    reader.readAsDataURL(file);
  }
  async function savePersonalization(){
    if(!personalization) return;
    try { const res = await updatePersonalization(personalization, selectedGuild); setPersonalization(res); setPersonalizationOriginal(res); pushToast('success','Bot personalization saved'); } catch(e){ pushToast('error','Save failed'); }
  }
  function personalizationDirty(){
    if(!personalization || !personalizationOriginal) return false;
    const keys=['nickname','activityType','activityText','status','avatarBase64'];
    return keys.some(k => (personalization[k]||'') !== (personalizationOriginal[k]||''));
  }
  function resetPersonalization(){ if(personalizationOriginal) setPersonalization(personalizationOriginal); }
  function welcomeDirty(){
    if(!welcomeCfg || !welcomeOriginal) return false;
  // Exclude 'enabled' (auto-saved immediately when toggled)
  const keys=['channelId','messageType','messageText','cardEnabled'];
    return keys.some(k => (welcomeCfg[k]??'') !== (welcomeOriginal[k]??''));
  }
  function resetWelcome(){ if(welcomeOriginal) setWelcomeCfg(welcomeOriginal); }
  async function saveWelcome(){
    if(!welcomeCfg) return;
    try { const res = await updateWelcome(welcomeCfg, selectedGuild); setWelcomeCfg(res); setWelcomeOriginal(res); pushToast('success','Welcome settings saved'); } catch(e){ pushToast('error','Save failed'); }
  }
  async function toggleWelcomeEnabled(on){
    if(!welcomeCfg) return;
    // Optimistic update
    setWelcomeCfg(c => ({ ...(c||{}), enabled: on }));
    setWelcomeOriginal(o => o ? { ...o, enabled: on } : o);
    try {
      await updateWelcome({ enabled: on }, selectedGuild);
      pushToast('success', 'Welcome messages ' + (on? 'enabled':'disabled'));
    } catch(e){
      pushToast('error','Failed to update toggle');
      // revert
      setWelcomeCfg(c => ({ ...(c||{}), enabled: !on }));
      setWelcomeOriginal(o => o ? { ...o, enabled: !on } : o);
    }
  }
  // --- Personalization Preview helpers ---
  function renderStatusDot(st){
    const map = { online:'#16a34a', idle:'#f59e0b', dnd:'#dc2626', invisible:'#6b7280' };
    const color = map[st] || '#16a34a';
    return <span style={{display:'inline-block',width:10,height:10,borderRadius:'50%',background:color,marginRight:6,boxShadow:'0 0 0 2px rgba(255,255,255,0.1)'}}></span>;
  }
  const personalizationContent = <PersonalizationSection personalization={personalization} personalizationLoading={personalizationLoading} personalizationDirty={personalizationDirty} resetPersonalization={resetPersonalization} savePersonalization={savePersonalization} handleAvatarFile={handleAvatarFile} renderStatusDot={renderStatusDot} setPersonalization={setPersonalization} />;

  // saveWelcome redefined above with dirty tracking
  // Channel selection placeholder (requires channel list API future). For now free text.
  const moderationContent = <React.Suspense fallback={<div className="text-muted small p-3">Loading Moderation…</div>}>
    <ModerationSection guildId={selectedGuild} pushToast={pushToast} />
  </React.Suspense>;

  const settingsContent = <React.Suspense fallback={<div className="text-muted small p-3">Loading settings…</div>}>
    <SettingsSection guildId={selectedGuild} pushToast={pushToast} />
  </React.Suspense>;
  const gamesContent = <React.Suspense fallback={<div className="text-muted small p-3">Loading Games & Socials…</div>}>
    <GamesSocialsSection guildId={selectedGuild} pushToast={pushToast} />
  </React.Suspense>;
  const sectionMap = { overview: overviewContent, autos: autosContent, commands: commandsContent, personal: personalizationContent, moderation: moderationContent, games: gamesContent, settings: settingsContent };

  // Preload lazily loaded sections to reduce Suspense flashes
  function preloadSection(key){
    if(preloaded.current[key]) return;
    preloaded.current[key] = true;
    switch(key){
      case 'overview': import('./sections/OverviewSection.jsx'); break;
      case 'commands': import('./sections/CommandsSection.jsx'); break;
      case 'personal': import('./sections/PersonalizationSection.jsx'); break;
      case 'moderation': import('./sections/ModerationSection.jsx'); break;
  case 'settings': import('./sections/SettingsSection.jsx'); break;
  case 'autos': import('./sections/AutosSection.jsx'); break;
  case 'games': import('./sections/GamesSocialsSection.jsx'); break;
      default: break;
    }
  }

  const effectiveSidebarMode = isMobile ? 'full' : sidebarMode; // force full on mobile
  const content = <div className="container-fluid py-4 fade-in">
    {guildBanner}
    <div className={"dashboard-flex sidebar-"+effectiveSidebarMode}>
      <Sidebar
        guilds={guilds}
        selectedGuild={selectedGuild}
        setSelectedGuild={setSelectedGuild}
        setView={setView}
        isMobile={isMobile}
        cycleSidebarMode={cycleSidebarMode}
        effectiveSidebarMode={effectiveSidebarMode}
        dashSection={dashSection}
        setDashSection={setDashSection}
        startTransition={startTransition}
        preloadSection={preloadSection}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        doLogout={doLogout}
        sidebarRef={sidebarRef}
      />
      <main className="dash-main">
        <React.Suspense fallback={<div className="p-4 text-muted small">Loading section…</div>}>
          {sectionMap[dashSection]}
        </React.Suspense>
      </main>
    </div>
    {/* Floating action button & backdrop for mobile */}
    {!sidebarOpen && <button type="button" className="fab-toggle d-lg-none" onClick={()=>setSidebarOpen(true)} aria-label="Open menu">
      <span className="fab-ripple"></span>
      <i className="fa-solid fa-bars"></i>
    </button>}
    {sidebarOpen && <div className="sidebar-backdrop d-lg-none" onClick={()=>setSidebarOpen(false)} />}
    <AutoResponseModal
      show={showAutoModal}
      modalAuto={modalAuto}
      autos={autos}
      setModalAuto={setModalAuto}
      closeAutoModal={closeAutoModal}
      addOrUpdateAuto={addOrUpdateAuto}
      dashSection={dashSection}
    />
  </div>;
  // Toasts container
  const header = <Navbar />;
  return <>
  {header}
    {content}
    <Footer />
    <Toasts toasts={toasts} setToasts={setToasts} />
  </>;
}

// Self-mount when imported directly as entry (allows removal of main.jsx)
if (typeof document !== 'undefined') {
  const mountEl = document.getElementById('root');
  if (mountEl && !mountEl._reactRootContainer) {
    createRoot(mountEl).render(<App />);
  }
}
