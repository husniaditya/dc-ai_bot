import React from 'react';

export default function CommandsSection({ commandGroups, commandTogglesState, commandMeta, toggleCommand, hasManageGuild }){
  return <div className="commands-section fade-in-soft">
    <h5 className="mb-3">Commands</h5>
    <div className="cmd-groups">
      {commandGroups.map(gr => <div key={gr.key} className="cmd-group-card">
        <div className="cmd-group-head" style={{'--grp-accent': gr.accent}}>
          <div className="cmd-group-icon"><i className={'fa-solid '+gr.icon}></i></div>
          <div className="cmd-group-meta">
            <h6 className="cmd-group-title mb-0">{gr.title}</h6>
            <div className="cmd-group-count small">{gr.items.length} command{gr.items.length!==1?'s':''}</div>
          </div>
        </div>
        <div className="cmd-items">
          { gr.items.map(it => {
            const locked = it.requiresManage && !hasManageGuild;
            const isPassive = gr.key === 'passive';
            const isReadOnly = locked || isPassive;
            return <div key={it.name} className={"cmd-item" + (isReadOnly ? ' cmd-item-locked':'' )}>
            <div className="cmd-item-main">
              <div className="cmd-item-name"><code>{it.name}</code></div>
              <div className="cmd-item-usage"><code>{it.usage}</code></div>
              <div className="ms-auto d-flex align-items-center">
                <div className="d-flex flex-column align-items-end">
                  {!isPassive ? (
                    <label className="form-check form-switch m-0" title={locked ? 'Requires Manage Server permission' : ''}>
                      <input type="checkbox" className="form-check-input" disabled={locked} checked={commandTogglesState[it.name] !== false} onChange={e=>toggleCommand(it.name, e.target.checked)} />
                    </label>
                  ) : (
                    <span className="badge bg-info">Always Active</span>
                  )}
                  {commandMeta[it.name]?.updatedAt && <div className="cmd-meta-hint small text-muted" title={`Updated by ${commandMeta[it.name]?.updatedBy||'unknown'}`}>{new Date(commandMeta[it.name].updatedAt).toLocaleDateString()}</div>}
                </div>
              </div>
            </div>
            <div className="cmd-item-desc small text-muted">{it.desc}{locked && <span className="ms-2 badge bg-secondary">read-only</span>}{isPassive && <span className="ms-2 badge bg-secondary">passive</span>}</div>
          </div>; })}
        </div>
      </div>)}
    </div>
    <div className="text-muted small mt-3" style={{opacity:.8}}>AI related calls may be rate limited. Image size limit 8MB each. Passive features run automatically.</div>
  </div>;
}
