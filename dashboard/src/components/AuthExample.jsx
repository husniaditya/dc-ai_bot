import React from 'react';
import { useAuth, AuthStatus, withAuth } from '../hooks/useAuth';

/**
 * Example component showing how to use the auth system
 * This can be integrated into your existing navbar or header
 */
function AuthenticatedHeader() {
  const { user, logout, getTokenInfo } = useAuth();
  const tokenInfo = getTokenInfo();

  const handleLogout = async () => {
    if (confirm('Are you sure you want to logout?')) {
      await logout();
    }
  };

  return (
    <div className="d-flex justify-content-between align-items-center p-3 border-bottom">
      <div>
        <h4 className="mb-0">Discord Bot Dashboard</h4>
      </div>
      
      <div className="d-flex align-items-center gap-3">
        {/* Token expiration warning */}
        {tokenInfo.timeUntilExpiry && tokenInfo.timeUntilExpiry < 30 * 60 * 1000 && (
          <div className="alert alert-warning py-1 px-2 mb-0 small">
            <i className="fas fa-clock me-1"></i>
            Session expires in {Math.round(tokenInfo.timeUntilExpiry / 60000)} minutes
          </div>
        )}
        
        {/* User info and logout */}
        <div className="dropdown">
          <button 
            className="btn btn-outline-secondary dropdown-toggle" 
            type="button" 
            data-bs-toggle="dropdown"
          >
            <i className="fas fa-user me-2"></i>
            {user?.username || 'User'}
          </button>
          <ul className="dropdown-menu">
            <li>
              <span className="dropdown-item-text small text-muted">
                Logged in as {user?.username}
              </span>
            </li>
            {tokenInfo.expiration && (
              <li>
                <span className="dropdown-item-text small text-muted">
                  Expires: {tokenInfo.expiration.toLocaleString()}
                </span>
              </li>
            )}
            <li><hr className="dropdown-divider" /></li>
            <li>
              <button className="dropdown-item" onClick={handleLogout}>
                <i className="fas fa-sign-out-alt me-2"></i>
                Logout
              </button>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

/**
 * Example protected page component
 */
function ProtectedDashboard() {
  const { apiRequest, isLoading } = useAuth();
  const [data, setData] = React.useState(null);

  React.useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const response = await apiRequest('/api/settings');
      if (response.ok) {
        const settings = await response.json();
        setData(settings);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      // Auth errors are automatically handled by the auth system
    }
  };

  if (isLoading) {
    return (
      <div className="text-center p-5">
        <div className="spinner-border" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <AuthenticatedHeader />
      <div className="container-fluid p-4">
        <h1>Dashboard Content</h1>
        <p>This content is only visible to authenticated users.</p>
        {data && (
          <div className="alert alert-info">
            <strong>Settings loaded:</strong> {JSON.stringify(data, null, 2)}
          </div>
        )}
      </div>
    </div>
  );
}

// Export the protected component
export default withAuth(ProtectedDashboard);

// Export individual components for integration
export { AuthenticatedHeader, AuthStatus };
