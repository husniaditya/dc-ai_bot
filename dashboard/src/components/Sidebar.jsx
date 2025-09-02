import React from 'react';

export default function Sidebar({
  guilds, selectedGuild, setSelectedGuild, setView, isMobile, cycleSidebarMode, effectiveSidebarMode,
  dashSection, setDashSection, startTransition, preloadSection, sidebarOpen, setSidebarOpen, doLogout,
  sidebarRef
}) {
  return (
    <aside ref={sidebarRef} className={"dash-sidebar mode-"+effectiveSidebarMode + (sidebarOpen? ' open':'')}>
      <div className="sidebar-inner">
        <div className="guild-switcher card-glass mb-3 p-2 d-flex align-items-center gap-2">
          <button type="button" className="guild-switcher-btn flex-grow-1" onClick={()=>setView('guild')} title="Change server">
            {(() => { const g = guilds.find(x=>x.id===selectedGuild); const iconUrl = g?.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=128` : null; return <>
              <div className="gw-icon">{iconUrl ? <img src={iconUrl} alt={g?.name||'Guild'} /> : <span className="fallback">{(g?.name||'?').slice(0,2).toUpperCase()}</span>}</div>
              <div className="gw-meta">
                <div className="gw-name" title={g?.name}>{g?.name||'Select a Server'}</div>
                <div className="gw-action">Change server ▾</div>
              </div>
            </>; })()}
          </button>
          {!isMobile && <button type="button" className="collapse-toggle" onClick={cycleSidebarMode} title={effectiveSidebarMode==='full'? 'Collapse sidebar':'Expand sidebar'}>
            <i className={'fa-solid chev '+ (effectiveSidebarMode==='full'? 'fa-chevron-left':'fa-chevron-right')}></i>
          </button>}
        </div>
        <div className="dash-menu">
          {[
            {key:'overview', label:'Overview', icon:'fa-gauge-high'},
            {key:'autos', label:'Auto Responses', icon:'fa-bolt'},
            {key:'commands', label:'Commands', icon:'fa-terminal'},
            {key:'personal', label:'Bot Personalization', icon:'fa-user-gear'},
            {key:'moderation', label:'Moderation', icon:'fa-shield-halved'},
            {key:'games', label:'Games & Socials', icon:'fa-gamepad'},
            {key:'settings', label:'Settings', icon:'fa-sliders'}
          ].map(item => (
            <button
              key={item.key}
              type="button"
              data-label={item.label}
              onMouseEnter={()=>preloadSection(item.key)}
              onFocus={()=>preloadSection(item.key)}
              onClick={()=>{ startTransition(()=> setDashSection(item.key)); setSidebarOpen(false); }}
              className={'dash-menu-item'+(dashSection===item.key? ' active':'')}
            >
              <i className={`fa-solid ${item.icon} menu-ico`}></i>
              <span className="menu-label">{item.label}</span>
            </button>
          ))}
        </div>
        <div className="dash-sidebar-footer mt-4">
          <button
            type="button"
            data-label="Logout"
            className="dash-menu-item logout-btn"
            onClick={()=>{ doLogout(); setSidebarOpen(false); }}
            title="Sign out"
          >
            <i className="fa-solid fa-right-from-bracket menu-ico"></i>
            <span className="menu-label">Logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
