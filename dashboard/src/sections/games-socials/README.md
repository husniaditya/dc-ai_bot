# Games & Socials Section

This directory contains the refactored Games & Socials section components, organized in a modular and maintainable structure.

## Structure

```
games-socials/
├── index.jsx                 # Main container component
├── constants.js              # Service definitions and constants
├── utils.js                  # Utility functions
├── components/               # Reusable components
│   ├── ServiceCard.jsx       # Individual service card component
│   ├── ServiceConfigCard.jsx # Service configuration header
│   ├── TemplatePreview.jsx   # Template preview component
│   ├── MentionTargetsPicker.jsx # Mention targets selector
│   └── PlaceholderService.jsx # Placeholder for unimplemented services
└── features/                 # Service-specific configuration components
    ├── YouTubeConfig.jsx     # YouTube integration configuration
    └── TwitchConfig.jsx      # Twitch integration configuration
```

## Components

### Main Container (`index.jsx`)
- Manages overall state for all services
- Handles service selection and toggling
- Coordinates data loading and saving
- Provides loading overlays and error handling

### Service Components

#### `ServiceCard.jsx`
- Displays individual service cards in the grid
- Handles service selection and enable/disable toggle
- Shows loading states and service information

#### `ServiceConfigCard.jsx`
- Header component for service configuration
- Shows service icon, name, and status
- Displays unsaved changes indicator

#### `TemplatePreview.jsx`
- Renders preview of message templates
- Supports both YouTube and Twitch placeholder replacement
- Configurable size and styling

#### `MentionTargetsPicker.jsx`
- Interactive component for selecting mention targets
- Supports @everyone, @here, and role selection
- Keyboard navigation and autocomplete

#### `PlaceholderService.jsx`
- Shows placeholder content for unimplemented services
- Displays planned features and descriptions

### Feature Components

#### `YouTubeConfig.jsx`
- Complete YouTube integration configuration
- Channel management with add/remove functionality
- Template configuration with per-channel overrides
- Live and upload announcement settings

#### `TwitchConfig.jsx`
- Complete Twitch integration configuration
- Streamer management with add/remove functionality
- Template configuration with per-streamer overrides
- Live stream announcement settings

## Utilities

### `constants.js`
- Service definitions with metadata
- Template placeholder mappings
- Default configuration objects

### `utils.js`
- Data cleaning functions for malformed database entries
- Template preview generation
- Configuration comparison utilities

## API Integration

The components maintain compatibility with existing API endpoints:
- `getYouTubeConfig()` / `updateYouTubeConfig()`
- `getTwitchConfig()` / `updateTwitchConfig()`
- `getChannels()` / `getRoles()`
- `extractYouTubeChannelId()` / `resolveYouTubeChannel()`
- `resolveTwitchStreamer()`

## Usage

Replace the original `GamesSocialsSection.jsx` import with:

```jsx
import GamesSocialsSection from './sections/games-socials';
```

The component interface remains the same:

```jsx
<GamesSocialsSection guildId={guildId} pushToast={pushToast} />
```

## Benefits

1. **Modularity**: Each service has its own configuration component
2. **Reusability**: Shared components can be used across services
3. **Maintainability**: Clear separation of concerns
4. **Extensibility**: Easy to add new services or modify existing ones
5. **Testability**: Smaller, focused components are easier to test
6. **Code Organization**: Logical file structure following established patterns

## Adding New Services

To add a new service integration:

1. Add service definition to `constants.js`
2. Create configuration component in `features/`
3. Add service-specific logic to main `index.jsx`
4. Update any shared utilities as needed

The modular structure makes it easy to implement new integrations without affecting existing functionality.
