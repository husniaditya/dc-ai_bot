import { useState, useEffect, useCallback } from 'react';
import authManager from '../utils/auth.js';

/**
 * React hook for JWT authentication management
 * Provides authentication state and handles automatic logout on token expiration
 */
export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!authManager.getToken());
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Handle forced logout
  const handleLogout = useCallback((reason) => {
    console.log('Auth hook: handling logout -', reason);
    setIsAuthenticated(false);
    setUser(null);
    setError(reason);
    
    // Show notification or redirect
    if (window.location.pathname !== '/login') {
      // You can customize this behavior
      window.location.href = `/login?message=${encodeURIComponent(reason)}`;
    }
  }, []);

  // Login function
  const login = useCallback((token, userData = null) => {
    authManager.setToken(token);
    setIsAuthenticated(true);
    setUser(userData);
    setError(null);
  }, []);

  // Logout function
  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await authManager.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Validate token and get user info
  const validateAndLoadUser = useCallback(async () => {
    if (!authManager.getToken()) {
      setIsAuthenticated(false);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      
      // Validate token
      const isValid = await authManager.validateToken();
      
      if (!isValid) {
        handleLogout('Invalid session');
        return;
      }

      // Load user data
      const response = await authManager.authenticatedFetch('/api/auth/user/me');
      
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        setIsAuthenticated(true);
      } else {
        handleLogout('Failed to load user data');
      }
    } catch (error) {
      console.error('Auth validation failed:', error);
      handleLogout('Authentication error');
    } finally {
      setIsLoading(false);
    }
  }, [handleLogout]);

  // Initialize auth state
  useEffect(() => {
    // Set logout callback
    authManager.onLogout(handleLogout);
    
    // Validate current token if exists
    validateAndLoadUser();

    // Cleanup
    return () => {
      authManager.onLogout(null);
    };
  }, [handleLogout, validateAndLoadUser]);

  // Make authenticated API requests
  const apiRequest = useCallback(async (url, options = {}) => {
    try {
      return await authManager.authenticatedFetch(url, options);
    } catch (error) {
      if (error.message.includes('Authentication failed')) {
        // Error already handled by authManager
        throw error;
      }
      throw error;
    }
  }, []);

  // Get token expiration info
  const getTokenInfo = useCallback(() => {
    const expiration = authManager.getTokenExpiration();
    const isExpired = authManager.isTokenExpired();
    
    return {
      expiration,
      isExpired,
      timeUntilExpiry: expiration ? expiration.getTime() - Date.now() : null
    };
  }, []);

  return {
    // State
    isAuthenticated,
    user,
    isLoading,
    error,
    
    // Actions
    login,
    logout,
    validateAndLoadUser,
    
    // Utilities
    apiRequest,
    getTokenInfo,
    
    // Direct access to auth manager if needed
    authManager
  };
}

/**
 * Higher-order component that requires authentication
 * Redirects to login if not authenticated
 */
export function withAuth(Component) {
  return function AuthenticatedComponent(props) {
    const { isAuthenticated, isLoading } = useAuth();

    if (isLoading) {
      return (
        <div className="d-flex justify-content-center align-items-center" style={{height: '100vh'}}>
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      );
    }

    if (!isAuthenticated) {
      window.location.href = '/login?message=Authentication required';
      return null;
    }

    return <Component {...props} />;
  };
}

/**
 * Component that shows authentication status and provides logout button
 */
export function AuthStatus() {
  const { isAuthenticated, user, logout, getTokenInfo } = useAuth();
  const tokenInfo = getTokenInfo();

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="auth-status">
      <div className="d-flex align-items-center gap-2">
        <span className="text-muted small">
          {user?.username || 'User'}
          {tokenInfo.expiration && (
            <span className="ms-2">
              (expires: {tokenInfo.expiration.toLocaleTimeString()})
            </span>
          )}
        </span>
        <button 
          className="btn btn-outline-secondary btn-sm" 
          onClick={logout}
          title="Logout"
        >
          Logout
        </button>
      </div>
    </div>
  );
}
