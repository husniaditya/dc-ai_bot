import React from 'react';

/**
 * PlaceholderService - Shows placeholder content for unimplemented services
 */
export default function PlaceholderService({ service }) {
  if (!service) return null;

  return (
    <div className="text-muted small p-3">
      <p className="mb-1">
        <strong>{service.label}</strong> integration is not configured yet.
      </p>
      <p className="mb-2">
        Planned features: {service.desc}
      </p>
      <p className="mb-0">
        If you need this sooner, let us know.
      </p>
    </div>
  );
}
