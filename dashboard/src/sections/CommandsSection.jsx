import React from 'react';

export default function CommandsSection({ commandGroups, commandTogglesState, commandMeta, toggleCommand }){
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
          { gr.items.map(it => <div key={it.name} className="cmd-item">
            <div className="cmd-item-main">
              <div className="cmd-item-name"><code>{it.name}</code></div>
              <div className="cmd-item-usage"><code>{it.usage}</code></div>
              <div className="ms-auto d-flex align-items-center">
                <div className="d-flex flex-column align-items-end">
                  <label className="form-check form-switch m-0">
                    <input type="checkbox" className="form-check-input" checked={commandTogglesState[it.name] !== false} onChange={e=>toggleCommand(it.name, e.target.checked)} />
                  </label>
                  {commandMeta[it.name]?.updatedAt && <div className="cmd-meta-hint small text-muted" title={`Updated by ${commandMeta[it.name]?.updatedBy||'unknown'}`}>{new Date(commandMeta[it.name].updatedAt).toLocaleDateString()}</div>}
                </div>
              </div>
            </div>
            <div className="cmd-item-desc small text-muted">{it.desc}</div>
          </div>)}
        </div>
      </div>)}
    </div>
    <div className="text-muted small mt-3" style={{opacity:.8}}>AI related calls may be rate limited. Image size limit 8MB each. Passive features run automatically.</div>
  </div>;
}
