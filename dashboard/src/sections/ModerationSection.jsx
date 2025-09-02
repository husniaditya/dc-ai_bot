import React from 'react';
import ModerationSectionRefactored from './moderation/index';

// Re-export the refactored moderation section
export default function ModerationSection({ guildId, pushToast }) {
  return <ModerationSectionRefactored guildId={guildId} pushToast={pushToast} />;
}
