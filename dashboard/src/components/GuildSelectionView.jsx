import React from 'react';

export default function GuildSelectionView({ guilds, guildSearch, setGuildSearch, selectedGuild, setSelectedGuild, error, saveSelectedGuild, doLogout, refreshGuilds }) {
  // Filter to only show guilds where user can manage
  const manageableGuilds = guilds.filter(g => g.canManage);
  const filteredGuilds = manageableGuilds.filter(g=> !guildSearch || g.name.toLowerCase().includes(guildSearch.toLowerCase()));
  
  // State for tracking invite status
  const [inviteStatus, setInviteStatus] = React.useState(null); // null | 'success' | 'error'
  
  // Generate Discord bot invite URL with necessary permissions
  const generateInviteUrl = () => {
    const CLIENT_ID = import.meta.env.VITE_DISCORD_CLIENT_ID || '951335667756072981'; // Use actual client ID from env
    const permissions = import.meta.env.VITE_INVITE_PERMISSIONS || '274878286912'; // Use configured permissions
    const scopes = 'bot%20applications.commands';
    return `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&permissions=${permissions}&scope=${scopes}`;
  };
  
  const handleAddBotClick = () => {
    const inviteUrl = generateInviteUrl();
    
    // Show success message with adaptive monitoring
    setInviteStatus('success');
    
    // Open invite in new tab (more reliable than popup)
    window.open(inviteUrl, '_blank', 'noopener,noreferrer');
    
    // Smart polling: check for new guilds periodically until found or timeout
    let pollAttempts = 0;
    const maxAttempts = 30; // 5 minutes max (10 second intervals)
    const pollInterval = 5000; // 10 seconds between checks
    
    const pollForNewGuild = () => {
      pollAttempts++;
      console.log(`Polling for new guild (attempt ${pollAttempts}/${maxAttempts})...`);
      
      if (refreshGuilds) {
        refreshGuilds();
      }
      
      // Continue polling if we haven't reached max attempts
      if (pollAttempts < maxAttempts) {
        setTimeout(pollForNewGuild, pollInterval);
      } else {
        // Stop polling after max attempts
        console.log('Stopped polling for new guild after maximum attempts');
        setInviteStatus(null);
      }
    };
    
    // Start polling after initial delay
    setTimeout(pollForNewGuild, 5000); // Wait 5 seconds before first check
    
    // Clear success message after 1 minute if still showing
    setTimeout(() => {
      if (inviteStatus === 'success') {
        setInviteStatus(null);
      }
    }, 60000);
  };
  
  return (
    <div className="container mt-4 fade-in" style={{maxWidth:960}}>
      <div className="card card-glass shadow-sm p-2 p-md-3 guild-select-wrapper">
        <div className="card-body pt-3">
          <div className="d-flex flex-column flex-md-row justify-content-between gap-3 align-items-md-center mb-3">
            <div>
              <div className="d-flex align-items-center gap-2 mb-1">
                <h4 className="mb-0 fw-semibold">Choose a Server</h4>
              </div>
              <p className="text-muted small mb-0">Select a Discord server you can manage. Only servers where you have management permissions are shown. Use the refresh button if you just added the bot to a new server.</p>
            </div>
            <div className="d-flex gap-2 align-items-center w-100 w-md-auto">
              <input className="form-control form-control-sm guild-search" placeholder="Search servers..." value={guildSearch} onChange={e=>setGuildSearch(e.target.value)} />
            </div>
          </div>
          {error && <div className="alert alert-danger py-2 mb-2">{error}</div>}
          <div className="guild-grid mb-3">
            {/* Add Bot to Server Card */}
            <button 
              type="button" 
              onClick={handleAddBotClick}
              className="guild-card guild-card-invite"
              title="Add bot to a new server"
            >
              <div className="guild-icon-wrap">
                <div className="guild-icon-add">
                  <i className="fa-solid fa-plus"></i>
                </div>
              </div>
              <div className="guild-meta">
                <div className="guild-name">Add Bot to Server</div>
                <div className="guild-tags">
                  <span className="badge-invite">Invite</span>
                </div>
              </div>
            </button>
            
            {/* Existing Guild Cards */}
            {filteredGuilds.map(g => {
              const active = selectedGuild===g.id;
              const iconUrl = g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=128` : null;
              
              return <button 
                key={g.id} 
                type="button" 
                onClick={()=>setSelectedGuild(g.id)} 
                className={'guild-card' + (active?' active':'')}
                title={g.name}
              >
                <div className="guild-icon-wrap">
                  {iconUrl ? <img src={iconUrl} alt={g.name} loading="lazy" /> : <div className="guild-icon-fallback">{g.name.slice(0,2).toUpperCase()}</div>}
                </div>
                <div className="guild-meta">
                  <div className="guild-name" title={g.name}>
                    {g.name}
                  </div>
                  <div className="guild-tags">
                    {g.canManage && <span className="badge-perm">Manage</span>}
                  </div>
                </div>
                {active && <div className="checkmark">✓</div>}
              </button>;
            })}
            {filteredGuilds.length===0 && manageableGuilds.length>0 && <div className="text-muted small p-4">No servers match your search.</div>}
            {manageableGuilds.length===0 && guilds.length>0 && <div className="text-muted small p-4">No manageable servers found. You need "Manage Server" permission to configure the bot.</div>}
            {guilds.length===0 && <div className="text-muted small p-4">
              <div className="d-flex align-items-center gap-2">
                <i className="fa-solid fa-spinner fa-spin"></i>
                Loading servers... If the bot isn't in any servers yet, use the "Add Bot to Server" card above.
              </div>
            </div>}
          </div>
          <div className="d-flex flex-wrap gap-2 justify-content-between align-items-center">
            <div className="small text-muted">{selectedGuild ? 'Selected: '+(manageableGuilds.find(g=>g.id===selectedGuild)?.name || selectedGuild) : manageableGuilds.length+ ' manageable servers'}</div>
            <div className="d-flex gap-2">
              <button disabled={!selectedGuild} onClick={()=>saveSelectedGuild('dashboard')} className="btn btn-brand px-4">
                <i className="fa-solid fa-gauge-high me-2" />
                Continue to Dashboard
              </button>
              <button onClick={()=>{ setSelectedGuild(null); doLogout(); }} className="btn btn-outline-secondary">
                <i className="fa-solid fa-right-from-bracket me-2" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
