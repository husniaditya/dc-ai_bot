# LoadingSection Migration Guide

## Quick Reference for Converting Sections

### 1. Update Import
```jsx
// OLD:
import LoadingOverlay from '../components/LoadingOverlay';

// NEW:
import LoadingSection from '../components/LoadingSection';
```

### 2. Wrap Return Content
```jsx
// OLD:
return <div className="section-wrapper">
  {/* section content */}
  {loading && (
    <LoadingOverlay 
      title="Loading..."
      message="..."
      fullHeight={false}
    />
  )}
</div>;

// NEW:
return (
  <LoadingSection
    loading={loading}
    title="Loading..."
    message="..."
    className="section-wrapper"
  >
    {/* section content */}
  </LoadingSection>
);
```

### 3. Section-Specific Loading Props

**PersonalizationSection.jsx:**
```jsx
<LoadingSection
  loading={personalizationLoading}
  title="Loading Personalization Settings"
  message="Fetching your server's personalization configuration..."
  className="personalization-section fade-in-soft"
>
```

**CommandsSection.jsx:**
```jsx
<LoadingSection
  loading={commandsLoading}
  title="Loading Commands Settings"  
  message="Fetching command configuration and permissions..."
  className="commands-section fade-in-soft"
>
```

**moderation/index.jsx:**
```jsx
<LoadingSection
  loading={moderationLoading}
  title="Loading Moderation Settings"
  message="Fetching your server configuration and permissions..."
  className="moderation-section fade-in-soft"
>
```

**games-socials/index.jsx:**
```jsx
<LoadingSection
  loading={gamesSocialsLoading}
  title="Loading Games & Socials"
  message="Fetching social platform configurations..."
  className="games-socials-section fade-in-soft"
>
```

### 4. Remove Old Loading Overlays
Remove any `LoadingOverlay` components that were placed inside cards or nested elements, since the section-level loading will handle everything.

## Benefits of This Approach

✅ **Cleaner Code**: No need to manage overlay positioning in each section
✅ **Consistent UX**: All sections load the same way
✅ **Better Performance**: Content doesn't render until loaded
✅ **Responsive**: Works perfectly on all screen sizes
✅ **Theme-Aware**: Automatically adapts to light/dark themes
