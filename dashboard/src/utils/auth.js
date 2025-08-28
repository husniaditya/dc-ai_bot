/**
 * Authentication utilities for JWT token management and automatic logout
 */

class AuthManager {
  constructor() {
    this.token = localStorage.getItem('token');
    this.checkInterval = null;
    this.onLogoutCallback = null;
  }

  /**
   * Set the JWT token and start monitoring
   * @param {string} token - JWT token
   */
  setToken(token) {
    this.token = token;
    localStorage.setItem('token', token);
    this.startTokenMonitoring();
  }

  /**
   * Get the current token
   * @returns {string|null} - Current JWT token
   */
  getToken() {
    return this.token || localStorage.getItem('token');
  }

  /**
   * Remove token and stop monitoring
   */
  clearToken() {
    this.token = null;
    localStorage.removeItem('token');
    this.stopTokenMonitoring();
  }

  /**
   * Set callback function to execute when logout is required
   * @param {Function} callback - Function to call on forced logout
   */
  onLogout(callback) {
    this.onLogoutCallback = callback;
  }

  /**
   * Force logout - clear token and execute callback
   * @param {string} reason - Reason for logout
   */
  forceLogout(reason = 'Session expired') {
    console.warn('Forcing logout:', reason);
    this.clearToken();
    
    if (this.onLogoutCallback) {
      this.onLogoutCallback(reason);
    } else {
      // Default logout behavior
      this.redirectToLogin(reason);
    }
  }

  /**
   * Redirect to login page with message
   * @param {string} message - Message to display
   */
  redirectToLogin(message) {
    const params = new URLSearchParams();
    if (message) params.set('message', message);
    
    // Check if we're already on login page to prevent redirect loops
    const currentPath = window.location.pathname;
    if (currentPath === '/login' || currentPath === '/') {
      // Already on login, just clear URL params and show message
      const cleanUrl = window.location.origin + window.location.pathname;
      if (message) {
        window.history.replaceState({}, '', cleanUrl + '?' + params.toString());
      } else {
        window.history.replaceState({}, '', cleanUrl);
      }
      // Trigger a page reload to reset the app state
      window.location.reload();
    } else {
      // Redirect to login page
      window.location.href = '/' + (params.toString() ? '?' + params.toString() : '');
    }
  }

  /**
   * Check if token is expired based on payload
   * @returns {boolean} - True if token is expired
   */
  isTokenExpired() {
    const token = this.getToken();
    if (!token) return true;

    try {
      // Decode JWT payload (without verification)
      const payload = JSON.parse(atob(token.split('.')[1]));
      const now = Math.floor(Date.now() / 1000);
      
      return payload.exp && payload.exp < now;
    } catch (e) {
      console.error('Error checking token expiration:', e);
      return true;
    }
  }

  /**
   * Get token expiration time
   * @returns {Date|null} - Expiration date or null
   */
  getTokenExpiration() {
    const token = this.getToken();
    if (!token) return null;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp ? new Date(payload.exp * 1000) : null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Start monitoring token expiration
   */
  startTokenMonitoring() {
    this.stopTokenMonitoring(); // Clear any existing interval

    // Check every 30 seconds
    this.checkInterval = setInterval(() => {
      if (this.isTokenExpired()) {
        this.forceLogout('Token expired');
      }
    }, 30000);

    // Also check immediately
    if (this.isTokenExpired()) {
      this.forceLogout('Token expired');
    }
  }

  /**
   * Stop token monitoring
   */
  stopTokenMonitoring() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Make authenticated API request with automatic logout on auth errors
   * @param {string} url - API endpoint URL
   * @param {Object} options - Fetch options
   * @returns {Promise<Response>} - Fetch response
   */
  async authenticatedFetch(url, options = {}) {
    const token = this.getToken();
    
    if (!token) {
      this.forceLogout('No authentication token');
      throw new Error('Not authenticated');
    }

    // Add authorization header
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      // Check for authentication errors
      if (response.status === 401) {
        const errorData = await response.json().catch(() => ({}));
        
        if (errorData.requiresLogout) {
          this.forceLogout(errorData.message || 'Authentication failed');
          throw new Error('Authentication failed - logged out');
        }
      }

      return response;
    } catch (error) {
      // Network errors or other issues
      if (error.message.includes('Authentication failed')) {
        throw error; // Re-throw auth errors
      }
      
      console.error('API request failed:', error);
      throw error;
    }
  }

  /**
   * Validate current token with server
   * @returns {Promise<boolean>} - True if token is valid
   */
  async validateToken() {
    try {
      const response = await this.authenticatedFetch('/api/auth/validate');
      
      if (response.ok) {
        const data = await response.json();
        return data.valid === true;
      }
      
      return false;
    } catch (error) {
      console.error('Token validation failed:', error);
      return false;
    }
  }

  /**
   * Logout via API call
   * @returns {Promise<boolean>} - True if logout was successful
   */
  async logout() {
    try {
      const response = await this.authenticatedFetch('/api/auth/logout', {
        method: 'POST'
      });

      if (response.ok) {
        this.forceLogout('User logged out');
        return true;
      }
      
      // Even if API call fails, clear local token
      this.forceLogout('Logout completed');
      return false;
    } catch (error) {
      console.error('Logout API call failed:', error);
      // Still clear local token
      this.forceLogout('Logout completed');
      return false;
    }
  }
}

// Create singleton instance
const authManager = new AuthManager();

// Auto-start monitoring if token exists
if (authManager.getToken()) {
  authManager.startTokenMonitoring();
}

export default authManager;

// Also export utilities for non-module usage
window.AuthManager = AuthManager;
window.authManager = authManager;
