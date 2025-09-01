# Moderation Section Refactor

This directory contains the refactored moderation section, split into organized components and features.

## Structure

```
moderation/
├── index.jsx                    # Main moderation section component
├── constants.js                 # Feature definitions and defaults
├── components/                  # Reusable UI components
│   ├── ConfigurationModal.jsx   # Main configuration modal
│   ├── FeatureCard.jsx         # Individual feature card
│   └── SharedComponents.jsx     # Common form components
└── features/                    # Feature-specific configurations
    ├── WelcomeConfigForm.jsx
    ├── AutomodConfigForm.jsx
    ├── RolesConfigForm.jsx
    ├── XPConfigForm.jsx
    ├── SchedulerConfigForm.jsx
    ├── LoggingConfigForm.jsx
    ├── AntiRaidConfigForm.jsx
    └── roles/                   # Role management sub-features
        ├── ReactionRolesConfig.jsx
        └── SlashCommandRolesConfig.jsx
```

## Features

### 1. Welcome Messages (`WelcomeConfigForm.jsx`)
- Custom welcome messages with variables
- Welcome card generation
- Auto role assignment
- DM welcome messages
- Channel selection

### 2. Auto Moderation (`AutomodConfigForm.jsx`)
- Spam detection
- Caps filter
- Link filter
- Profanity filter
- Bypass roles
- Auto delete violations

### 3. Role Management (`RolesConfigForm.jsx`)
- **Reaction Roles**: Message-based role assignment with emoji reactions
- **Slash Commands**: Self-assignable roles via `/role` commands

### 4. XP & Leveling (`XPConfigForm.jsx`)
- Configurable XP ranges
- Level up messages
- Channel exclusions
- Role multipliers
- Cooldown settings

### 5. Scheduled Messages (`SchedulerConfigForm.jsx`)
- Cron-based scheduling
- Multiple scheduled messages
- Channel targeting
- Enable/disable toggles

### 6. Audit Logging (`LoggingConfigForm.jsx`)
- Message logs
- Member logs
- Channel logs
- Role logs
- Server logs
- Voice logs
- Global channel option

### 7. Anti-Raid Protection (`AntiRaidConfigForm.jsx`)
- Join rate limiting
- Account age verification
- Auto lockdown
- Suspicious account detection
- Bypass roles
- Alert channels

## Shared Components

### `SharedComponents.jsx`
- `BypassRolesPicker`: Multi-select role picker
- `ChannelSelector`: Dropdown for channel selection
- `RoleSelector`: Dropdown for role selection
- `LoadingSpinner`: Consistent loading indicator
- `FormField`: Standardized form field wrapper
- `SwitchToggle`: Toggle switch with label

### `ConfigurationModal.jsx`
- Modal wrapper for all feature configurations
- Handles loading, saving, and error states
- Provides consistent UI/UX across features
- Dirty state tracking and confirmation dialogs

### `FeatureCard.jsx`
- Individual feature display card
- Enable/disable toggle
- Configuration button
- Feature descriptions and status

## Benefits of Refactoring

1. **Maintainability**: Each feature is in its own file, making it easier to maintain and update
2. **Reusability**: Shared components can be used across features
3. **Scalability**: Easy to add new moderation features
4. **Testing**: Individual components can be tested in isolation
5. **Code Organization**: Clear separation of concerns
6. **Performance**: Features can be lazy-loaded if needed

## Usage

The main `ModerationSection.jsx` simply imports and re-exports the refactored version:

```jsx
import ModerationSectionRefactored from './moderation/index';

export default function ModerationSection({ guildId, pushToast }) {
  return <ModerationSectionRefactored guildId={guildId} pushToast={pushToast} />;
}
```

This maintains backward compatibility while using the new modular structure.

## Future Enhancements

- Add feature-specific loading states
- Implement feature dependencies (e.g., logging requires channels)
- Add configuration validation
- Create feature presets (e.g., "Family Friendly", "Gaming Server")
- Add bulk configuration import/export
- Implement feature usage analytics
