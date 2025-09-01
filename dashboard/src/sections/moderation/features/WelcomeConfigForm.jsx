import React from 'react';
import { ChannelSelector, RoleSelector, FormField, SwitchToggle } from '../components/SharedComponents';

// Welcome Messages Configuration
export default function WelcomeConfigForm({ config, updateConfig, channels, roles }) {
  return (
    <div className="moderation-config-form space-y-4">
      <FormField 
        label="Welcome Channel"
        description="Choose where welcome messages will be sent"
      >
        <ChannelSelector
          value={config.channelId}
          onChange={(value) => updateConfig('channelId', value)}
          channels={channels}
          placeholder="Select a channel..."
        />
      </FormField>

      <FormField label="Message Type">
        <select 
          className="form-select form-select-sm custom-dropdown"
          value={config.messageType || 'text'}
          onChange={(e) => updateConfig('messageType', e.target.value)}
        >
          <option value="text">Text Message</option>
          <option value="embed">Embed Message</option>
        </select>
      </FormField>

      <FormField 
        label="Welcome Message"
        description="Available variables: {user}, {username}, {server}, {memberCount}, {rules}, {general}, {welcome}"
      >
        <textarea 
          className="form-control form-control-sm custom-input"
          rows={5}
          value={config.messageText || 'Welcome to {server}, {user}!'}
          onChange={(e) => updateConfig('messageText', e.target.value)}
          placeholder="Use {user} for mention, {username} for name, {server} for server name"
        />
      </FormField>

      <SwitchToggle
        id="welcome-card-enabled"
        label="Enable Welcome Card"
        checked={config.cardEnabled}
        onChange={(checked) => updateConfig('cardEnabled', checked)}
        description="Generate a custom welcome card image for new members"
      />

      <FormField 
        label="Auto Role (Optional)"
        description="Automatically assign this role to new members"
      >
        <RoleSelector
          value={config.roleId}
          onChange={(value) => updateConfig('roleId', value)}
          roles={roles}
          placeholder="No auto role"
        />
      </FormField>

      <SwitchToggle
        id="welcome-dm-enabled"
        label="Send DM Welcome Message"
        checked={config.dmEnabled}
        onChange={(checked) => updateConfig('dmEnabled', checked)}
        description="Send a private welcome message to new members"
      />

      {config.dmEnabled && (
        <FormField 
          label="DM Welcome Message"
          description="Available variables: {user}, {username}, {server}, {memberCount}, {rules}, {general}, {welcome}"
        >
          <textarea 
            className="form-control form-control-sm custom-input"
            rows={2}
            value={config.dmMessage || 'Welcome to {server}! Thanks for joining us.'}
            onChange={(e) => updateConfig('dmMessage', e.target.value)}
            placeholder="Private message sent to new members"
          />
        </FormField>
      )}
    </div>
  );
}
