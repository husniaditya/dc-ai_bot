import { createContext, useContext } from 'react';

// Create a context for guild-related data
const GuildContext = createContext();

// Hook to access guild context
export function useGuildContext() {
  const context = useContext(GuildContext);
  if (!context) {
    throw new Error('useGuildContext must be used within a GuildProvider');
  }
  return context;
}

// Export the context for the provider
export { GuildContext };
