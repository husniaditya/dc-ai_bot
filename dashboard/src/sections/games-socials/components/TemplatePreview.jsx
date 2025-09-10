import React from 'react';
import { buildPreview } from '../utils';
import { useI18n } from '../../../i18n';

/**
 * TemplatePreview - Shows a preview of how a template will look
 */
export default function TemplatePreview({ 
  template, 
  channelId, 
  size, 
  type = 'youtube', 
  config = {}, 
  guildRoles = [] 
}) {
  const { t } = useI18n();
  const result = buildPreview(template, channelId, type, config, guildRoles, t);
  const cls = 'template-preview' + (size ? ' size-' + size : '');
  
  if (!template) {
    return (
      <div className={cls + " empty"}>
        {t('gamesSocials.common.noTemplate')}
      </div>
    );
  }
  
  return (
    <div className={cls}>
      <div className="preview-label small text-muted">{t('gamesSocials.common.preview')}</div>
      <div className="preview-body">{result}</div>
    </div>
  );
}
