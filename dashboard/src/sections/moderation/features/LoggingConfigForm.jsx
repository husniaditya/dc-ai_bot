import React, { forwardRef, useImperativeHandle } from 'react';
import { ChannelSelector, FormField, SwitchToggle } from '../components/SharedComponents';

// Audit Logging Configuration
const LoggingConfigForm = forwardRef(({ config, updateConfig, channels }, ref) => {
  const logTypes = [
    {
      key: 'messageChannel',
      label: 'Message Logs',
      description: 'Log message edits, deletions, and bulk deletions',
      icon: 'fa-comment'
    },
    {
      key: 'memberChannel',
      label: 'Member Logs',
      description: 'Log member joins, leaves, kicks, and bans',
      icon: 'fa-user'
    },
    {
      key: 'channelChannel',
      label: 'Channel Logs',
      description: 'Log channel creation, deletion, and modifications',
      icon: 'fa-hashtag'
    },
    {
      key: 'roleChannel',
      label: 'Role Logs',
      description: 'Log role creation, deletion, and permission changes',
      icon: 'fa-shield'
    },
    {
      key: 'serverChannel',
      label: 'Server Logs',
      description: 'Log server settings changes and emoji updates',
      icon: 'fa-server'
    },
    {
      key: 'voiceChannel',
      label: 'Voice Logs',
      description: 'Log voice channel joins, leaves, and moves',
      icon: 'fa-microphone'
    }
  ];

  const handleGlobalChannelChange = (value) => {
    updateConfig('globalChannel', value);
    
    // If global channel is set, copy it to all log types that don't have a channel
    if (value) {
      logTypes.forEach(logType => {
        if (!config[logType.key]) {
          updateConfig(logType.key, value);
        }
      });
    }
  };

  // Expose functions to parent component (for compatibility with existing usage)
  useImperativeHandle(ref, () => ({
    save: () => {
      console.log('Save called on LoggingConfigForm');
      return Promise.resolve();
    },
    reset: () => {
      console.log('Reset called on LoggingConfigForm');
    },
    isDirty: () => {
      // Let the parent component handle dirty state tracking
      return false;
    },
    isSaving: () => false
  }), []);

  return (
    <div className="moderation-config-form space-y-4">
      {/* Information Section */}
      <div className="mb-4">
        <div className="d-flex align-items-center gap-3 mb-3">
          <h6 className="mb-0 fw-bold">Audit Logging System</h6>
          <span className="badge badge-soft">
            <i className="fa-solid fa-clipboard-list me-1"></i>
            Complete Server Monitoring
          </span>
        </div>
        <p className="text-muted small mb-0" style={{ fontSize: '0.85rem', lineHeight: 1.4 }}>
          Track all server activities including messages, member changes, channel modifications, role updates, and more. 
          Configure separate channels for different log types or use a single channel for comprehensive monitoring.
        </p>
      </div>

      <div className="mt-4 p-3 bg-dark border rounded">
        <h6 className="mb-2">
          <i className="fa-solid fa-info-circle text-info me-2" />
          Logging Features
        </h6>
        <div className="row small text-muted">
          <div className="col-md-6">
            <div className="mb-2">
              <strong>Message Logs:</strong>
              <ul className="mb-0 mt-1">
                <li>Message edits and deletions</li>
                <li>Bulk message deletions</li>
                <li>Attachment tracking</li>
              </ul>
            </div>
            <div className="mb-2">
              <strong>Member Logs:</strong>
              <ul className="mb-0 mt-1">
                <li>Member joins and leaves</li>
                <li>Kicks and bans</li>
                <li>Nickname changes</li>
              </ul>
            </div>
            <div className="mb-2">
              <strong>Channel Logs:</strong>
              <ul className="mb-0 mt-1">
                <li>Channel creation/deletion</li>
                <li>Permission changes</li>
                <li>Topic and name updates</li>
              </ul>
            </div>
          </div>
          <div className="col-md-6">
            <div className="mb-2">
              <strong>Role Logs:</strong>
              <ul className="mb-0 mt-1">
                <li>Role creation/deletion</li>
                <li>Permission modifications</li>
                <li>Role assignments</li>
              </ul>
            </div>
            <div className="mb-2">
              <strong>Server Logs:</strong>
              <ul className="mb-0 mt-1">
                <li>Server settings changes</li>
                <li>Emoji and sticker updates</li>
                <li>Integration changes</li>
              </ul>
            </div>
            <div className="mb-2">
              <strong>Voice Logs:</strong>
              <ul className="mb-0 mt-1">
                <li>Voice channel activity</li>
                <li>Member moves</li>
                <li>Mute/deafen status</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
      <hr />

      <FormField 
        label="Global Log Channel (Optional)"
        description="Set all empty channels to this channel"
      >
        <ChannelSelector
          value={config.globalChannel}
          onChange={handleGlobalChannelChange}
          channels={channels}
          placeholder="Set all empty channels to this"
        />
      </FormField>
      
      <div className="row">
        <div className="col-md-6">
          <SwitchToggle
            id="logging-include-bots"
            label="Include Bot Actions"
            checked={config.includeBots !== false}
            onChange={(checked) => updateConfig('includeBots', checked)}
            description="Log actions performed by bots and integrations"
          />
        </div>
        <div className="col-md-6">
          <SwitchToggle
            id="logging-enhanced-details"
            label="Enhanced Details"
            checked={config.enhancedDetails !== false}
            onChange={(checked) => updateConfig('enhancedDetails', checked)}
            description="Include additional context and metadata in logs"
          />
        </div>
      </div>
      <br />
      
      <div className="row">
        {logTypes.map(logType => (
          <div key={logType.key} className="col-lg-6 mb-4">
            <div className="log-type-card p-3 border rounded">
              <div className="d-flex align-items-center gap-2 mb-2">
                <i className={`fa-solid ${logType.icon} text-primary`} />
                <h6 className="mb-0">{logType.label}</h6>
              </div>
              <p className="text-muted small mb-3">{logType.description}</p>
              
              <ChannelSelector
                value={config[logType.key]}
                onChange={(value) => updateConfig(logType.key, value)}
                channels={channels}
                placeholder="No logging"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

LoggingConfigForm.displayName = 'LoggingConfigForm';

export default LoggingConfigForm;
