import React from 'react';

export default function GuildSelectionView({ guilds, guildSearch, setGuildSearch, selectedGuild, setSelectedGuild, error, saveSelectedGuild, doLogout }) {
  const filteredGuilds = guilds.filter(g=> !guildSearch || g.name.toLowerCase().includes(guildSearch.toLowerCase()));
  return (
    <div className="container mt-4 fade-in" style={{maxWidth:960}}>
      <div className="card card-glass shadow-sm p-2 p-md-3 guild-select-wrapper">
        <div className="card-body pt-3">
          <div className="d-flex flex-column flex-md-row justify-content-between gap-3 align-items-md-center mb-3">
            <div>
              <div className="d-flex align-items-center gap-2 mb-1">
                <h4 className="mb-0 fw-semibold">Choose a Server</h4>
              </div>
              <p className="text-muted small mb-0">Select the Discord server you want to manage. You can change this later in the dashboard.</p>
            </div>
            <div className="d-flex gap-2 align-items-center w-100 w-md-auto">
              <input className="form-control form-control-sm guild-search" placeholder="Search servers..." value={guildSearch} onChange={e=>setGuildSearch(e.target.value)} />
            </div>
          </div>
          {error && <div className="alert alert-danger py-2 mb-2">{error}</div>}
          <div className="guild-grid mb-3">
            {filteredGuilds.map(g => {
              const active = selectedGuild===g.id;
              const iconUrl = g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=128` : null;
              return <button key={g.id} type="button" onClick={()=>setSelectedGuild(g.id)} className={'guild-card' + (active?' active':'')}>
                <div className="guild-icon-wrap">{iconUrl ? <img src={iconUrl} alt={g.name} loading="lazy" /> : <div className="guild-icon-fallback">{g.name.slice(0,2).toUpperCase()}</div>}</div>
                <div className="guild-meta">
                  <div className="guild-name" title={g.name}>{g.name}</div>
                  <div className="guild-tags">{g.canManage && <span className="badge-perm">Manage</span>}</div>
                </div>
                {active && <div className="checkmark">✓</div>}
              </button>;
            })}
            {filteredGuilds.length===0 && guilds.length>0 && <div className="text-muted small p-4">No servers match your search.</div>}
            {guilds.length===0 && <div className="text-muted small p-4">No servers found that the bot is in. Invite the bot to a server, then refresh this page.</div>}
          </div>
          <div className="d-flex flex-wrap gap-2 justify-content-between align-items-center">
            <div className="small text-muted">{selectedGuild ? 'Selected: '+(guilds.find(g=>g.id===selectedGuild)?.name || selectedGuild) : guilds.length+ ' servers'}</div>
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
