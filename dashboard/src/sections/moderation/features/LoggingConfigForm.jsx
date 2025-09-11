import React, { forwardRef, useImperativeHandle } from 'react';
import { ChannelSelector, FormField, SwitchToggle } from '../components/SharedComponents';
import { useI18n } from '../../../i18n';

// Audit Logging Configuration
const LoggingConfigForm = forwardRef(({ config, updateConfig, channels, showToast }, ref) => {
  const { t } = useI18n();

  const logTypes = [
    {
      key: 'messageChannel',
      label: t('moderation.features.logging.fields.channels.message.label'),
      description: t('moderation.features.logging.fields.channels.message.desc'),
      icon: 'fa-comment'
    },
    {
      key: 'memberChannel',
      label: t('moderation.features.logging.fields.channels.member.label'),
      description: t('moderation.features.logging.fields.channels.member.desc'),
      icon: 'fa-user'
    },
    {
      key: 'channelChannel',
      label: t('moderation.features.logging.fields.channels.channel.label'),
      description: t('moderation.features.logging.fields.channels.channel.desc'),
      icon: 'fa-hashtag'
    },
    {
      key: 'roleChannel',
      label: t('moderation.features.logging.fields.channels.role.label'),
      description: t('moderation.features.logging.fields.channels.role.desc'),
      icon: 'fa-shield'
    },
    {
      key: 'serverChannel',
      label: t('moderation.features.logging.fields.channels.server.label'),
      description: t('moderation.features.logging.fields.channels.server.desc'),
      icon: 'fa-server'
    },
    {
      key: 'voiceChannel',
      label: t('moderation.features.logging.fields.channels.voice.label'),
      description: t('moderation.features.logging.fields.channels.voice.desc'),
      icon: 'fa-microphone'
    }
  ];

  const handleGlobalChannelChange = (value) => {
    updateConfig('globalChannel', value);
    if (value) {
      let copied = 0;
      logTypes.forEach(logType => {
        if (!config[logType.key]) {
          updateConfig(logType.key, value);
          copied += 1;
        }
      });
      if (copied > 0) {
        showToast?.('success', t('moderation.features.logging.toasts.copiedToEmpty'));
      } else {
        showToast?.('success', t('moderation.features.logging.toasts.updatedGlobal'));
      }
    } else {
      showToast?.('success', t('moderation.features.logging.toasts.updatedGlobal'));
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
          <h6 className="mb-0 fw-bold">{t('moderation.features.logging.header')}</h6>
          <span className="badge badge-soft">
            <i className="fa-solid fa-clipboard-list me-1"></i>
            {t('moderation.features.logging.badge')}
          </span>
        </div>
        <p className="text-muted small mb-0" style={{ fontSize: '0.85rem', lineHeight: 1.4 }}>
          {t('moderation.features.logging.info.description')}
        </p>
      </div>

      <div className="mt-4 p-3 bg-body-secondary border rounded">
        <h6 className="mb-2">
          <i className="fa-solid fa-info-circle text-info me-2" />
          {t('moderation.cards.common.features')}
        </h6>
        <div className="row small">
          <div className="col-md-6">
            {[logTypes[0], logTypes[1], logTypes[2]].map((lt) => (
              <div key={lt.key} className="mb-2">
                <strong className="text-body">{lt.label}:</strong>
                <div className="mb-0 mt-1 text-muted">{lt.description}</div>
              </div>
            ))}
          </div>
          <div className="col-md-6">
            {[logTypes[3], logTypes[4], logTypes[5]].map((lt) => (
              <div key={lt.key} className="mb-2">
                <strong className="text-body">{lt.label}:</strong>
                <div className="mb-0 mt-1 text-muted">{lt.description}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <hr />

      <FormField 
        label={t('moderation.features.logging.fields.globalChannel.label')}
        description={t('moderation.features.logging.fields.globalChannel.desc')}
      >
        <ChannelSelector
          value={config.globalChannel}
          onChange={handleGlobalChannelChange}
          channels={channels}
          placeholder={t('moderation.features.logging.fields.globalChannel.placeholder')}
        />
      </FormField>
      
      <div className="row">
        <div className="col-md-6">
          <SwitchToggle
            id="logging-include-bots"
            label={t('moderation.features.logging.fields.includeBots.label')}
            checked={config.includeBots !== false}
            onChange={(checked) => updateConfig('includeBots', checked)}
            description={t('moderation.features.logging.fields.includeBots.desc')}
          />
        </div>
        <div className="col-md-6">
          <SwitchToggle
            id="logging-enhanced-details"
            label={t('moderation.features.logging.fields.enhancedDetails.label')}
            checked={config.enhancedDetails !== false}
            onChange={(checked) => updateConfig('enhancedDetails', checked)}
            description={t('moderation.features.logging.fields.enhancedDetails.desc')}
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
                placeholder={t('moderation.features.logging.placeholders.noLogging')}
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
