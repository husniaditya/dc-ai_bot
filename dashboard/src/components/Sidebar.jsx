import React from 'react';
import { useI18n } from '../i18n';

export default function Sidebar({
  guilds, selectedGuild, setSelectedGuild, setView, isMobile, cycleSidebarMode, effectiveSidebarMode,
  dashSection, setDashSection, startTransition, preloadSection, sidebarOpen, setSidebarOpen, doLogout,
  sidebarRef
}) {
  const { t } = useI18n();
  return (
    <aside ref={sidebarRef} className={"dash-sidebar mode-"+effectiveSidebarMode + (sidebarOpen? ' open':'')}>
      <div className="sidebar-inner">
        <div className="guild-switcher card-glass mb-3 p-2 d-flex align-items-center gap-2">
          <button type="button" className="guild-switcher-btn flex-grow-1" onClick={()=>setView('guild')} title={t('navigation.changeServer')}>
            {(() => { const g = guilds.find(x=>x.id===selectedGuild); const iconUrl = g?.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=128` : null; return <>
              <div className="gw-icon">{iconUrl ? <img src={iconUrl} alt={g?.name||t('navigation.selectServer')} /> : <span className="fallback">{(g?.name||'?').slice(0,2).toUpperCase()}</span>}</div>
              <div className="gw-meta">
                <div className="gw-name" title={g?.name}>{g?.name||t('navigation.selectServer')}</div>
                <div className="gw-action">{t('navigation.changeServer')} ▾</div>
              </div>
            </>; })()}
          </button>
          {!isMobile && <button type="button" className="collapse-toggle" onClick={cycleSidebarMode} title={effectiveSidebarMode==='full'? t('navigation.collapseSidebar') : t('navigation.expandSidebar')}>
            <i className={'fa-solid chev '+ (effectiveSidebarMode==='full'? 'fa-chevron-left':'fa-chevron-right')}></i>
          </button>}
        </div>
        <div className="dash-menu">
          {[
            {key:'overview', label: t('navigation.overview'), icon:'fa-gauge-high'},
            {key:'autos', label: t('navigation.autos'), icon:'fa-bolt'},
            {key:'commands', label: t('navigation.commands'), icon:'fa-terminal'},
            {key:'personal', label: t('navigation.personal'), icon:'fa-user-gear'},
            {key:'moderation', label: t('navigation.moderation'), icon:'fa-shield-halved'},
            {key:'games', label: t('navigation.games'), icon:'fa-gamepad'},
            {key:'settings', label: t('navigation.settings'), icon:'fa-sliders'}
          ].filter(item => {
            return true;
          }).map(item => (
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
          {/* API Docs moved above logout button, only for allowed server */}
          {selectedGuild === '935480450707759165' && (
            <div className="dash-menu mb-2">
              <button
                type="button"
                data-label={t('navigation.apiDocs') || 'API Docs'}
                onMouseEnter={()=>preloadSection('api-docs')}
                onFocus={()=>preloadSection('api-docs')}
                onClick={()=>{ startTransition(()=> setDashSection('api-docs')); setSidebarOpen(false); }}
                className={'dash-menu-item'+(dashSection==='api-docs'? ' active':'')}
              >
                <i className="fa-solid fa-book menu-ico"></i>
                <span className="menu-label">{t('navigation.apiDocs') || 'API Docs'}</span>
              </button>
            </div>
          )}
          <button
            type="button"
            data-label={t('navigation.logout')}
            className="dash-menu-item logout-btn"
            onClick={()=>{ doLogout(); setSidebarOpen(false); }}
            title={t('navigation.signOut')}
          >
            <i className="fa-solid fa-right-from-bracket menu-ico"></i>
            <span className="menu-label">{t('navigation.logout')}</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
