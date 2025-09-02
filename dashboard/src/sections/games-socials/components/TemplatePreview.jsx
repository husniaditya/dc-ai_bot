import React from 'react';
import { buildPreview } from '../utils';

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
  const result = buildPreview(template, channelId, type, config, guildRoles);
  const cls = 'template-preview' + (size ? ' size-' + size : '');
  
  if (!template) {
    return (
      <div className={cls + " empty"}>
        No template set.
      </div>
    );
  }
  
  return (
    <div className={cls}>
      <div className="preview-label small text-muted">Preview</div>
      <div className="preview-body">{result}</div>
    </div>
  );
}
