import React from 'react';
import { ChannelSelector, FormField, SwitchToggle, BypassRolesPicker } from '../components/SharedComponents';

// Auto Moderation Configuration
export default function AutomodConfigForm({ config, updateConfig, channels, roles }) {
  return (
    <div className="moderation-config-form space-y-4">
      <div className="row">
        <div className="col-md-6">
          <SwitchToggle
            id="automod-spam-detection"
            label="Spam Detection"
            checked={config.spamDetection}
            onChange={(checked) => updateConfig('spamDetection', checked)}
            description="Detect and handle repeated messages and spam"
          />
        </div>
        <div className="col-md-6">
          <SwitchToggle
            id="automod-caps-filter"
            label="Excessive Caps Filter"
            checked={config.capsFilter}
            onChange={(checked) => updateConfig('capsFilter', checked)}
            description="Filter messages with excessive capital letters"
          />
        </div>
      </div>

      <div className="row">
        <div className="col-md-6">
          <SwitchToggle
            id="automod-link-filter"
            label="Link Filter"
            checked={config.linkFilter}
            onChange={(checked) => updateConfig('linkFilter', checked)}
            description="Filter unauthorized links and URLs"
          />
        </div>
        <div className="col-md-6">
          <SwitchToggle
            id="automod-profanity-filter"
            label="Profanity Filter"
            checked={config.profanityFilter}
            onChange={(checked) => updateConfig('profanityFilter', checked)}
            description="Filter inappropriate language and content"
          />
        </div>
      </div>

      <FormField 
        label="Log Channel"
        description="Channel where moderation actions will be logged"
      >
        <ChannelSelector
          value={config.logChannelId}
          onChange={(value) => updateConfig('logChannelId', value)}
          channels={channels}
          placeholder="No logging"
        />
      </FormField>

      <FormField label="Auto Delete Violations">
        <select 
          className="form-select form-select-sm custom-dropdown"
          value={config.autoDelete ? 'true' : 'false'}
          onChange={(e) => updateConfig('autoDelete', e.target.value === 'true')}
        >
          <option value="false">Warn only</option>
          <option value="true">Delete messages</option>
        </select>
      </FormField>

      <FormField 
        label={
          <span className="d-flex align-items-center gap-2">
            Bypass Roles 
            {config.bypassRoles?.length ? (
              <span className="badge-soft" style={{fontSize:'.55rem'}}>
                {config.bypassRoles.length}
              </span>
            ) : null}
          </span>
        }
        description="Members with these roles will bypass all auto moderation filters"
      >
        <BypassRolesPicker
          value={config.bypassRoles || []}
          onChange={(list) => updateConfig('bypassRoles', list)}
          roles={roles}
        />
      </FormField>
    </div>
  );
}
