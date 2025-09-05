import React, { useState, useRef, useEffect } from 'react';
import { ChannelSelector, FormField, SwitchToggle } from '../components/SharedComponents';

/**
 * WhitelistRolesPicker - Component for selecting whitelist roles similar to MentionTargetsPicker
 */
function WhitelistRolesPicker({ value, onChange, roles }) {
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
          placeholder={list.length ? '' : 'Add roles to whitelist…'} 
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
              <span className="meta">role</span>
            </button>
          ))}
        </div>
      )}
      
      {open && filtered.length === 0 && (
        <div className="mention-targets-suggestions">
          <div className="text-muted small p-2" style={{fontSize: '.55rem'}}>
            {query ? 'No matching roles' : 'All roles already added'}
          </div>
        </div>
      )}
    </div>
  );
}

// Anti-Raid Protection Configuration
export default function AntiRaidConfigForm({ config, updateConfig, channels, roles }) {
  const verificationLevels = [
    { value: 'none', label: 'None - No restrictions' },
    { value: 'low', label: 'Low - Verified email required' },
    { value: 'medium', label: 'Medium - Registered for 5+ minutes' },
    { value: 'high', label: 'High - Member for 10+ minutes' },
    { value: 'highest', label: 'Highest - Verified phone required' }
  ];

  return (
    <div className="moderation-config-form space-y-4">
      {/* Information Section */}
      <div className="mb-4">
        <div className="d-flex align-items-center gap-3 mb-3">
          <h6 className="mb-0 fw-bold">Anti-Raid Protection System</h6>
          <span className="badge badge-soft">
            <i className="fa-solid fa-shield-halved me-1"></i>
            Advanced Server Security
          </span>
        </div>
        <p className="text-muted small mb-0" style={{ fontSize: '0.85rem', lineHeight: 1.4 }}>
          Protect your server from coordinated attacks, mass joins, and suspicious activities with intelligent monitoring, 
          automated responses, and configurable security thresholds. Monitor join patterns and account characteristics.
        </p>
      </div>

      <div className="mb-4 p-3 bg-dark border rounded">
        <h6 className="mb-2">
          <i className="fa-solid fa-shield text-success me-2" />
          Protection Features
        </h6>
        <div className="row small text-muted">
          <div className="col-md-6">
            <div className="mb-2">
              <strong>Join Rate Monitoring:</strong>
              <ul className="mb-0 mt-1">
                <li>Track member join patterns</li>
                <li>Detect coordinated attacks</li>
                <li>Configurable thresholds</li>
              </ul>
            </div>
            <div className="mb-2">
              <strong>Account Analysis:</strong>
              <ul className="mb-0 mt-1">
                <li>Account age verification</li>
                <li>Suspicious pattern detection</li>
                <li>Avatar and username analysis</li>
              </ul>
            </div>
          </div>
          <div className="col-md-6">
            <div className="mb-2">
              <strong>Automated Response:</strong>
              <ul className="mb-0 mt-1">
                <li>Server lockdown capabilities</li>
                <li>Automatic verification changes</li>
                <li>Member removal options</li>
              </ul>
            </div>
            <div className="mb-2">
              <strong>Content Filtering:</strong>
              <ul className="mb-0 mt-1">
                <li>Invite spam detection</li>
                <li>Mass mention protection</li>
                <li>New member monitoring</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-4 p-2 border border-warning rounded bg-warning bg-opacity-10">
        <div className="d-flex align-items-start gap-2">
          <i className="fa-solid fa-exclamation-triangle text-warning mt-1" />
          <div className="small">
            <strong className="text-warning">Important:</strong> Anti-raid protection uses advanced heuristics and may occasionally flag legitimate users. 
            Monitor your alert channel regularly and adjust settings based on your server's needs.
          </div>
        </div>
      </div>
      <hr />

      <div className="row">
        <div className="col-md-6">
          <FormField 
            label="Join Rate Limit"
            description="Maximum members allowed to join per time window"
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
            label="Time Window (seconds)"
            description="Time period for join rate limit"
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
        label="Minimum Account Age (days)"
        description="Accounts younger than this will be flagged as suspicious"
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
            label="Raid Action"
            description="Action to take when a raid is detected"
          >
            <select 
              className="form-select form-select-sm custom-dropdown"
              value={config.raidAction || 'lockdown'}
              onChange={(e) => updateConfig('raidAction', e.target.value)}
            >
              <option value="lockdown">Lockdown Server</option>
              <option value="kick">Kick Suspicious Members</option>
              <option value="ban">Ban Suspicious Members</option>
              <option value="timeout">Timeout Suspicious Members</option>
              <option value="alert">Alert Only</option>
            </select>
          </FormField>
        </div>
        <div className="col-md-6">
          <FormField 
            label="Action Duration (minutes)"
            description="Duration for temporary actions (timeout/lockdown)"
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
              <small className="text-muted">Duration not applicable for this action</small>
            )}
          </FormField>
        </div>
      </div>

      <FormField label="Verification Level During Lockdown">
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
        label="Alert Channel"
        description="Channel to send raid alerts and notifications"
      >
        <ChannelSelector
          value={config.alertChannel}
          onChange={(value) => updateConfig('alertChannel', value)}
          channels={channels}
          placeholder="No alerts"
        />
      </FormField>

      <SwitchToggle
        id="antiraid-auto-kick"
        label="Auto-Kick Suspicious Accounts"
        checked={config.autoKick || false}
        onChange={(checked) => updateConfig('autoKick', checked)}
        description="Automatically kick accounts that meet suspicious criteria"
      />

      <FormField 
        label="New Member Grace Period (minutes)"
        description="How long to monitor new members for suspicious activity"
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
        label="Whitelist Roles"
        description="Members with these roles will bypass anti-raid protection"
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
