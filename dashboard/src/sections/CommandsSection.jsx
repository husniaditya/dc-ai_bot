import React from 'react';
import LoadingSection from '../components/LoadingSection';
import { useI18n } from '../i18n';

export default function CommandsSection({ commandGroups, commandTogglesState, commandMeta, toggleCommand, hasManageGuild, loading }){
  const { t } = useI18n();

  const localizeOrDefault = (key, fallback) => {
    const tx = t(key);
    return tx === key ? (fallback ?? key) : tx;
  };
  
  // Sort groups by number of commands (ascending). Tie-breaker: title/key for stable order.
  const sortedGroups = React.useMemo(() => {
    const copy = Array.isArray(commandGroups) ? [...commandGroups] : [];
    copy.sort((a, b) => {
      const ac = (a?.items?.length) || 0;
      const bc = (b?.items?.length) || 0;
      if (ac !== bc) return ac - bc;
      // deterministic tie-breaker: by title (fallback to key)
      const an = (a?.title || a?.key || '').toString().toLowerCase();
      const bn = (b?.title || b?.key || '').toString().toLowerCase();
      return an.localeCompare(bn);
    });
    return copy;
  }, [commandGroups]);
  
  return (
    <LoadingSection
      loading={loading}
      title={t('commands.title')}
      message={t('commands.subtitle')}
      className="commands-section fade-in-soft position-relative"
    >
      <h5 className="mb-3">{t('commands.title')}</h5>
    <div className="cmd-groups">
      {sortedGroups.map(gr => {
        const groupTitle = localizeOrDefault(`commands.groups.${gr.key}.title`, gr.title);
        const count = gr.items.length;
        const countLabel = count === 1 ? t('commands.section.commandOne') : t('commands.section.commandMany', { count });
        return (
          <div key={gr.key} className="cmd-group-card">
            <div className="cmd-group-head" style={{'--grp-accent': gr.accent}}>
              <div className="cmd-group-icon"><i className={'fa-solid '+gr.icon}></i></div>
              <div className="cmd-group-meta">
                <h6 className="cmd-group-title mb-0">{groupTitle}</h6>
                <div className="cmd-group-count small">{countLabel}</div>
              </div>
            </div>
            <div className="cmd-items">
              { gr.items.map(it => {
                const locked = it.requiresManage && !hasManageGuild;
                const isPassive = gr.key === 'passive';
                const isReadOnly = locked || isPassive;
                const usage = localizeOrDefault(`commands.items.${it.name}.usage`, it.usage);
                const desc = localizeOrDefault(`commands.items.${it.name}.desc`, it.desc);
                const updatedBy = commandMeta[it.name]?.updatedBy || t('commands.section.unknownUser');
                return (
                  <div key={it.name} className={"cmd-item" + (isReadOnly ? ' cmd-item-locked':'' )}>
                    <div className="cmd-item-main">
                      <div className="cmd-item-name"><code>{it.name}</code></div>
                      <div className="cmd-item-usage"><code>{usage}</code></div>
                      <div className="ms-auto d-flex align-items-center">
                        <div className="d-flex flex-column align-items-end">
                          {!isPassive ? (
                            <label className="form-check form-switch m-0" title={locked ? t('commands.section.requiresManage') : ''}>
                              <input type="checkbox" className="form-check-input" disabled={locked} checked={commandTogglesState[it.name] !== false} onChange={e=>toggleCommand(it.name, e.target.checked)} />
                            </label>
                          ) : (
                            <span className="badge bg-info">{t('commands.section.alwaysActive')}</span>
                          )}
                          {commandMeta[it.name]?.updatedAt && (
                            <div className="cmd-meta-hint small text-muted" title={t('commands.section.updatedBy', { user: updatedBy })}>
                              {new Date(commandMeta[it.name].updatedAt).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="cmd-item-desc small text-muted">
                      {desc}
                      {locked && <span className="ms-2 badge bg-secondary">{t('commands.section.readOnly')}</span>}
                      {isPassive && <span className="ms-2 badge bg-secondary">{t('commands.section.passive')}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
    <div className="text-muted small mt-3" style={{opacity:.8}}>{t('commands.section.bottomNote')}</div>
    </LoadingSection>
  );
}
