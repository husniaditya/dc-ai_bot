import React, { useState, useRef, useEffect } from 'react';
import { ChannelSelector, FormField, SwitchToggle } from '../components/SharedComponents';
import { useI18n } from '../../../i18n';

/**
 * WhitelistRolesPicker - Component for selecting whitelist roles similar to MentionTargetsPicker
 */
function WhitelistRolesPicker({ value, onChange, roles }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const boxRef = useRef(null);
  const inputRef = useRef(null);
  const list = value || [];
  
  useEffect(() => {
    function onDoc(e) { 
      if (!boxRef.current) return; 
      if (!boxRef.current.contains(e.target)) setOpen(false); 
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);
  
  const filtered = (roles || [])
    .filter(role => !query || role.name.toLowerCase().includes(query.toLowerCase()))
    .filter(role => !list.includes(role.id));
  
  const [activeIdx, setActiveIdx] = useState(0);
  
  useEffect(() => { 
    setActiveIdx(0); 
  }, [query, open]);
  
  function add(roleId) { 
    if (!list.includes(roleId)) onChange([...list, roleId]); 
    setQuery(''); 
    setOpen(false); 
    setTimeout(() => inputRef.current && inputRef.current.focus(), 0); 
  }
  
  function remove(roleId) { 
    onChange(list.filter(x => x !== roleId)); 
  }
  
  function handleKey(e) {
    if (e.key === 'Backspace' && !query) { 
      onChange(list.slice(0, -1)); 
    } else if (e.key === 'Enter') { 
      e.preventDefault(); 
      if (open && filtered[activeIdx]) add(filtered[activeIdx].id); 
    } else if (e.key === 'ArrowDown') { 
      e.preventDefault(); 
      setOpen(true); 
      setActiveIdx(i => Math.min(filtered.length - 1, i + 1)); 
    } else if (e.key === 'ArrowUp') { 
      e.preventDefault(); 
      setActiveIdx(i => Math.max(0, i - 1)); 
    }
  }
  
  return (
    <div className="mention-targets-picker" ref={boxRef}>
      <div 
        className="mention-targets-box" 
        onClick={() => { 
          setOpen(true); 
          inputRef.current && inputRef.current.focus(); 
        }}
      >
        {list.map(roleId => {
          const role = roles.find(r => r.id === roleId);
          const label = role ? role.name : roleId;
          return (
            <span key={roleId} className="mention-chip role">
              @{label}
              <button 
                type="button" 
                onClick={e => { 
                  e.stopPropagation(); 
                  remove(roleId); 
                }}
              >
                &times;
              </button>
            </span>
          );
        })}
        <input 
          ref={inputRef} 
          value={query} 
          placeholder={list.length ? '' : t('moderation.features.antiraid.roles.placeholder')} 
          onFocus={() => setOpen(true)} 
          onChange={e => { 
            setQuery(e.target.value); 
            setOpen(true); 
          }} 
          onKeyDown={handleKey} 
        />
      </div>
      
      {open && filtered.length > 0 && (
        <div className="mention-targets-suggestions">
          {filtered.slice(0, 40).map((role, idx) => (
            <button 
              type="button" 
              key={role.id} 
              className={idx === activeIdx ? 'active' : ''} 
              onMouseEnter={() => setActiveIdx(idx)} 
              onClick={() => add(role.id)}
            >
              {role.name}
              <span className="meta">{t('moderation.features.antiraid.roles.meta.role')}</span>
            </button>
          ))}
        </div>
      )}
      
      {open && filtered.length === 0 && (
        <div className="mention-targets-suggestions">
          <div className="text-muted small p-2" style={{fontSize: '.55rem'}}>
            {query ? t('moderation.features.antiraid.roles.noMatches') : t('moderation.features.antiraid.roles.allAdded')}
          </div>
        </div>
      )}
    </div>
  );
}

// Anti-Raid Protection Configuration
export default function AntiRaidConfigForm({ config, updateConfig, channels, roles }) {
  const { t } = useI18n();
  const verificationLevels = [
    { value: 'none', label: t('moderation.features.antiraid.verification.levels.none') },
    { value: 'low', label: t('moderation.features.antiraid.verification.levels.low') },
    { value: 'medium', label: t('moderation.features.antiraid.verification.levels.medium') },
    { value: 'high', label: t('moderation.features.antiraid.verification.levels.high') },
    { value: 'highest', label: t('moderation.features.antiraid.verification.levels.highest') }
  ];

  return (
    <div className="moderation-config-form space-y-4">
      {/* Information Section */}
      <div className="mb-4">
        <div className="d-flex align-items-center gap-3 mb-3">
          <h6 className="mb-0 fw-bold">{t('moderation.features.antiraid.header')}</h6>
          <span className="badge badge-soft">
            <i className="fa-solid fa-shield-halved me-1"></i>
            {t('moderation.features.antiraid.badge')}
          </span>
        </div>
        <p className="text-muted small mb-0" style={{ fontSize: '0.85rem', lineHeight: 1.4 }}>
          {t('moderation.features.antiraid.info.description')}
        </p>
      </div>

      <div className="mb-4 p-3 bg-body-secondary border rounded">
        <h6 className="mb-2">
          <i className="fa-solid fa-shield text-success me-2" />
          {t('moderation.cards.common.features')}
        </h6>
        <div className="row small">
          <div className="col-md-6">
            <div className="mb-2">
              <strong className="text-body">{t('moderation.features.antiraid.features.joinRate.title')}</strong>
              <ul className="mb-0 mt-1 text-muted">
                <li>{t('moderation.features.antiraid.features.joinRate.items.trackPatterns')}</li>
                <li>{t('moderation.features.antiraid.features.joinRate.items.detectAttacks')}</li>
                <li>{t('moderation.features.antiraid.features.joinRate.items.thresholds')}</li>
              </ul>
            </div>
            <div className="mb-2">
              <strong className="text-body">{t('moderation.features.antiraid.features.accountAnalysis.title')}</strong>
              <ul className="mb-0 mt-1 text-muted">
                <li>{t('moderation.features.antiraid.features.accountAnalysis.items.age')}</li>
                <li>{t('moderation.features.antiraid.features.accountAnalysis.items.patterns')}</li>
                <li>{t('moderation.features.antiraid.features.accountAnalysis.items.avatarUsername')}</li>
              </ul>
            </div>
          </div>
          <div className="col-md-6">
            <div className="mb-2">
              <strong className="text-body">{t('moderation.features.antiraid.features.automatedResponse.title')}</strong>
              <ul className="mb-0 mt-1 text-muted">
                <li>{t('moderation.features.antiraid.features.automatedResponse.items.lockdown')}</li>
                <li>{t('moderation.features.antiraid.features.automatedResponse.items.verification')}</li>
                <li>{t('moderation.features.antiraid.features.automatedResponse.items.removal')}</li>
              </ul>
            </div>
            <div className="mb-2">
              <strong className="text-body">{t('moderation.features.antiraid.features.contentFiltering.title')}</strong>
              <ul className="mb-0 mt-1 text-muted">
                <li>{t('moderation.features.antiraid.features.contentFiltering.items.inviteSpam')}</li>
                <li>{t('moderation.features.antiraid.features.contentFiltering.items.massMention')}</li>
                <li>{t('moderation.features.antiraid.features.contentFiltering.items.newMember')}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-4 p-2 border border-warning rounded bg-warning bg-opacity-10">
        <div className="d-flex align-items-start gap-2">
          <i className="fa-solid fa-exclamation-triangle text-warning mt-1" />
          <div className="small">
            <strong className="text-warning">{t('moderation.features.antiraid.warning.title')}</strong> {t('moderation.features.antiraid.warning.message')}
          </div>
        </div>
      </div>
      <hr />

      <div className="row">
        <div className="col-md-6">
          <FormField 
            label={t('moderation.features.antiraid.fields.joinRate.label')}
            description={t('moderation.features.antiraid.fields.joinRate.desc')}
          >
            <input 
              type="number"
              className="form-control form-control-sm"
              min="1"
              max="50"
              value={config.joinRate || 5}
              onChange={(e) => updateConfig('joinRate', parseInt(e.target.value) || 5)}
            />
          </FormField>
        </div>
        <div className="col-md-6">
          <FormField 
            label={t('moderation.features.antiraid.fields.joinWindow.label')}
            description={t('moderation.features.antiraid.fields.joinWindow.desc')}
          >
            <input 
              type="number"
              className="form-control form-control-sm"
              min="5"
              max="300"
              value={config.joinWindow || 10}
              onChange={(e) => updateConfig('joinWindow', parseInt(e.target.value) || 10)}
            />
          </FormField>
        </div>
      </div>

      <FormField 
        label={t('moderation.features.antiraid.fields.accountAge.label')}
        description={t('moderation.features.antiraid.fields.accountAge.desc')}
      >
        <input 
          type="number"
          className="form-control form-control-sm"
          min="0"
          max="365"
          value={config.accountAge || 7}
          onChange={(e) => updateConfig('accountAge', parseInt(e.target.value) || 7)}
        />
      </FormField>

      <div className="row">
        <div className="col-md-6">
          <FormField 
            label={t('moderation.features.antiraid.fields.raidAction.label')}
            description={t('moderation.features.antiraid.fields.raidAction.desc')}
          >
            <select 
              className="form-select form-select-sm custom-dropdown"
              value={config.raidAction || 'lockdown'}
              onChange={(e) => updateConfig('raidAction', e.target.value)}
            >
              <option value="lockdown">{t('moderation.features.antiraid.actions.lockdown')}</option>
              <option value="kick">{t('moderation.features.antiraid.actions.kick')}</option>
              <option value="ban">{t('moderation.features.antiraid.actions.ban')}</option>
              <option value="timeout">{t('moderation.features.antiraid.actions.timeout')}</option>
              <option value="alert">{t('moderation.features.antiraid.actions.alert')}</option>
            </select>
          </FormField>
        </div>
        <div className="col-md-6">
          <FormField 
            label={t('moderation.features.antiraid.fields.raidActionDuration.label')}
            description={t('moderation.features.antiraid.fields.raidActionDuration.desc')}
          >
            <input 
              type="number"
              className="form-control form-control-sm"
              min="1"
              max="10080"
              value={config.raidActionDuration || 60}
              onChange={(e) => updateConfig('raidActionDuration', parseInt(e.target.value) || 60)}
              disabled={config.raidAction === 'kick' || config.raidAction === 'ban' || config.raidAction === 'alert'}
            />
            {(config.raidAction === 'kick' || config.raidAction === 'ban' || config.raidAction === 'alert') && (
              <small className="text-muted">{t('moderation.features.antiraid.fields.raidActionDuration.notApplicable')}</small>
            )}
          </FormField>
        </div>
      </div>

      <FormField label={t('moderation.features.antiraid.verification.label')}>
        <select 
          className="form-select form-select-sm custom-dropdown"
          value={config.verificationLevel || 'medium'}
          onChange={(e) => updateConfig('verificationLevel', e.target.value)}
        >
          {verificationLevels.map(level => (
            <option key={level.value} value={level.value}>
              {level.label}
            </option>
          ))}
        </select>
      </FormField>

      <FormField 
        label={t('moderation.features.antiraid.fields.alertChannel.label')}
        description={t('moderation.features.antiraid.fields.alertChannel.desc')}
      >
        <ChannelSelector
          value={config.alertChannel}
          onChange={(value) => updateConfig('alertChannel', value)}
          channels={channels}
          placeholder={t('moderation.features.antiraid.placeholders.noAlerts')}
        />
      </FormField>

      <SwitchToggle
        id="antiraid-auto-kick"
        label={t('moderation.features.antiraid.fields.autoKick.label')}
        checked={config.autoKick || false}
        onChange={(checked) => updateConfig('autoKick', checked)}
        description={t('moderation.features.antiraid.fields.autoKick.desc')}
      />

      <FormField 
        label={t('moderation.features.antiraid.fields.gracePeriod.label')}
        description={t('moderation.features.antiraid.fields.gracePeriod.desc')}
      >
        <input 
          type="number"
          className="form-control form-control-sm"
          min="1"
          max="1440"
          value={config.gracePeriod || 30}
          onChange={(e) => updateConfig('gracePeriod', parseInt(e.target.value) || 30)}
        />
      </FormField>

      <FormField 
        label={t('moderation.features.antiraid.fields.whitelistRoles.label')}
        description={t('moderation.features.antiraid.fields.whitelistRoles.desc')}
      >
        <WhitelistRolesPicker
          value={config.bypassRoles || []}
          onChange={(list) => updateConfig('bypassRoles', list)}
          roles={roles}
        />
      </FormField>
    </div>
  );
}
