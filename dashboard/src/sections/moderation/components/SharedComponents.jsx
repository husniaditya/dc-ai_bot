import React from 'react';

// Bypass Roles Picker Component
export function BypassRolesPicker({ value, onChange, roles }) {
  const selectedRoles = value || [];

  const toggleRole = (roleId) => {
    const newSelection = selectedRoles.includes(roleId)
      ? selectedRoles.filter(id => id !== roleId)
      : [...selectedRoles, roleId];
    onChange(newSelection);
  };

  const availableRoles = roles.filter(role => 
    !role.managed && 
    role.name !== '@everyone' && 
    role.id !== roles.find(r => r.name === '@everyone')?.id
  );

  return (
    <div className="bypass-roles-picker">
      <div className="selected-roles mb-2">
        {selectedRoles.length > 0 && (
          <div className="d-flex flex-wrap gap-1">
            {selectedRoles.map(roleId => {
              const role = roles.find(r => r.id === roleId);
              if (!role) return null;
              return (
                <span 
                  key={roleId} 
                  className="badge bg-secondary d-flex align-items-center gap-1"
                  style={{ color: role.color ? `#${role.color.toString(16).padStart(6, '0')}` : undefined }}
                >
                  {role.name}
                  <button
                    type="button"
                    className="btn-close btn-close-white"
                    style={{ fontSize: '0.6em' }}
                    onClick={() => toggleRole(roleId)}
                    aria-label={`Remove ${role.name}`}
                  />
                </span>
              );
            })}
          </div>
        )}
      </div>
      
      <div className="available-roles">
        <div className="dropdown">
          <button 
            className="btn btn-outline-secondary btn-sm dropdown-toggle w-100" 
            type="button" 
            data-bs-toggle="dropdown"
          >
            Add bypass role
          </button>
          <ul className="dropdown-menu w-100">
            {availableRoles.map(role => (
              <li key={role.id}>
                <button 
                  className={`dropdown-item d-flex align-items-center justify-content-between ${
                    selectedRoles.includes(role.id) ? 'active' : ''
                  }`}
                  onClick={() => toggleRole(role.id)}
                >
                  <span style={{ color: role.color ? `#${role.color.toString(16).padStart(6, '0')}` : undefined }}>
                    {role.name}
                  </span>
                  {selectedRoles.includes(role.id) && (
                    <i className="fa-solid fa-check text-success" />
                  )}
                </button>
              </li>
            ))}
            {availableRoles.length === 0 && (
              <li>
                <span className="dropdown-item-text text-muted">No roles available</span>
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

// Channel Selector Component
export function ChannelSelector({ 
  value, 
  onChange, 
  channels, 
  placeholder = "Select a channel...", 
  className = "form-select form-select-sm custom-dropdown",
  allowEmpty = true 
}) {
  const textChannels = channels.filter(ch => ch.type === 0);

  return (
    <select 
      className={className}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
    >
      {allowEmpty && <option value="">{placeholder}</option>}
      {textChannels.map(channel => (
        <option key={channel.id} value={channel.id}>
          #{channel.name}
        </option>
      ))}
    </select>
  );
}

// Role Selector Component
export function RoleSelector({ 
  value, 
  onChange, 
  roles, 
  placeholder = "Select a role...", 
  className = "form-select form-select-sm custom-dropdown",
  allowEmpty = true,
  excludeManaged = true 
}) {
  const availableRoles = roles.filter(role => {
    if (excludeManaged && role.managed) return false;
    if (role.name === '@everyone') return false;
    return true;
  });

  return (
    <select 
      className={className}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
    >
      {allowEmpty && <option value="">{placeholder}</option>}
      {availableRoles.map(role => (
        <option key={role.id} value={role.id}>
          {role.name}
        </option>
      ))}
    </select>
  );
}

// Loading Spinner Component
export function LoadingSpinner({ size = "md", message = "Loading..." }) {
  const sizeClass = size === "lg" ? "spinner-border-lg" : size === "sm" ? "spinner-border-sm" : "";
  
  return (
    <div className="text-center py-5">
      <div className={`spinner-border ${sizeClass} mb-3`} role="status">
        <span className="visually-hidden">Loading...</span>
      </div>
      <div className="h6 mb-0">{message}</div>
    </div>
  );
}

// Form Field Component
export function FormField({ 
  label, 
  children, 
  description, 
  error, 
  required = false 
}) {
  return (
    <div className="mb-3">
      <label className="form-label small fw-semibold mb-1">
        {label}
        {required && <span className="text-danger ms-1">*</span>}
      </label>
      {children}
      {description && (
        <small className="text-muted d-block mt-1">{description}</small>
      )}
      {error && (
        <div className="text-danger small mt-1">{error}</div>
      )}
    </div>
  );
}

// Switch Toggle Component
export function SwitchToggle({ 
  id, 
  label, 
  checked, 
  onChange, 
  disabled = false, 
  description 
}) {
  return (
    <div className="form-check form-switch">
      <input 
        id={id}
        className="form-check-input" 
        type="checkbox" 
        checked={checked || false}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
      <label htmlFor={id} className="form-check-label small fw-semibold">
        {label}
      </label>
      {description && (
        <div className="small text-muted mt-1">{description}</div>
      )}
    </div>
  );
}
