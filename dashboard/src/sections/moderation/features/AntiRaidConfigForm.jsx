import React from 'react';
import { ChannelSelector, FormField, SwitchToggle, BypassRolesPicker } from '../components/SharedComponents';

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
      <div className="mb-4">
        <h6 className="mb-1">Anti-Raid Protection</h6>
        <p className="text-muted small mb-0">
          Protect your server from raids and mass join attacks with automated security measures.
        </p>
      </div>

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

      <SwitchToggle
        id="antiraid-auto-lockdown"
        label="Auto Lockdown"
        checked={config.autoLockdown !== false}
        onChange={(checked) => updateConfig('autoLockdown', checked)}
        description="Automatically lock the server when a raid is detected"
      />

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
        id="antiraid-kick-suspicious"
        label="Auto-Kick Suspicious Accounts"
        checked={config.kickSuspicious || false}
        onChange={(checked) => updateConfig('kickSuspicious', checked)}
        description="Automatically kick accounts that meet suspicious criteria"
      />

      <SwitchToggle
        id="antiraid-delete-invite-spam"
        label="Delete Invite Spam"
        checked={config.deleteInviteSpam !== false}
        onChange={(checked) => updateConfig('deleteInviteSpam', checked)}
        description="Automatically delete messages containing Discord invites from new members"
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
        label="Bypass Roles"
        description="Members with these roles will bypass anti-raid protection"
      >
        <BypassRolesPicker
          value={config.bypassRoles || []}
          onChange={(list) => updateConfig('bypassRoles', list)}
          roles={roles}
        />
      </FormField>

      <div className="mt-4 p-3 bg-dark border rounded">
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

      <div className="mt-3 p-2 border border-warning rounded bg-warning bg-opacity-10">
        <div className="d-flex align-items-start gap-2">
          <i className="fa-solid fa-exclamation-triangle text-warning mt-1" />
          <div className="small">
            <strong className="text-warning">Important:</strong> Anti-raid protection uses advanced heuristics and may occasionally flag legitimate users. 
            Monitor your alert channel regularly and adjust settings based on your server's needs.
          </div>
        </div>
      </div>
    </div>
  );
}
