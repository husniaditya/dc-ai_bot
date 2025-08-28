import React from 'react';

// Legacy admin form removed. Replaced with: Discord OAuth login + Bot Invite button.
export default function LoginView({ error, authProcessing, startDiscordLogin }) {
  const year = new Date().getFullYear();
  const clientId = (typeof import.meta !== 'undefined' && import.meta.env) ? (import.meta.env.VITE_DISCORD_CLIENT_ID || import.meta.env.VITE_CLIENT_ID) : '';
  const invitePerms = (typeof import.meta !== 'undefined' && import.meta.env) ? (import.meta.env.VITE_INVITE_PERMISSIONS || '') : '';
  const inviteUrl = clientId ? `https://discord.com/oauth2/authorize?client_id=${clientId}&scope=bot%20applications.commands${invitePerms?`&permissions=${invitePerms}`:''}` : null;

  return (
    <div className="login-viewport">
      <div className="login-center fade-in">
        <div className="login-card card-glass">
          <div className="login-card-inner">
            <div className="login-hero mb-3">
              <div className="logo-orb">
                <img src="/images.jpg" alt="Choco Maid" className="logo-img" onError={(e)=>{ e.currentTarget.style.display='none'; }} />
                <span className="orb-text">CM</span>
              </div>
              <div>
                <h1 className="login-title mb-1">Choco Maid</h1>
                <div className="login-subtitle">Smart assistant & auto‑response manager</div>
              </div>
            </div>
            {error && <div className="alert alert-danger py-2 mb-3">{error}</div>}
            {authProcessing ? (
              <div className="auth-processing vstack gap-3 text-center py-4">
                <div className="spinner-border text-light mx-auto" style={{width:'2.5rem', height:'2.5rem'}} role="status"><span className="visually-hidden">Loading...</span></div>
                <div className="small text-muted">Completing Discord sign‑in…</div>
              </div>
            ) : (
              <div className="vstack gap-3">
                <p className="text-muted small m-0">Sign in with Discord to manage the bot.</p>
                <button onClick={startDiscordLogin} className="btn btn-discord-cta">
                  <span className="ico me-1"><i className="fa-brands fa-discord" /></span>
                  <span>Login with Discord</span>
                </button>
              </div>
            )}
            <div className="login-footer small text-muted mt-4">© {year} Choco Maid • Not affiliated with Discord</div>
          </div>
        </div>
      </div>
    </div>
  );
}
