import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService } from '../services/authService';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  // Check current session on application startup via /api/v1/auth/me
  const verifySession = useCallback(async () => {
    setLoading(true);
    setAuthError(null);
    try {
      const data = await authService.getCurrentAdmin();
      setAdmin(data);
    } catch (err) {
      // Unauthenticated or expired session
      setAdmin(null);
      setAuthError(err.message || 'Session expired.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    verifySession();
  }, [verifySession]);

  // Login handler
  const login = async (username, password) => {
    const data = await authService.login(username, password);
    setAdmin(data.admin);
    return data;
  };

  // Logout handler
  const logout = async () => {
    try {
      await authService.logout();
    } catch (err) {
      console.warn('Logout API warning:', err);
    } finally {
      setAdmin(null);
    }
  };

  // Change password handler
  const changePassword = async (currentPassword, newPassword, confirmPassword) => {
    const result = await authService.changePassword(currentPassword, newPassword, confirmPassword);
    // Refresh admin state to clear must_change_password flag
    await verifySession();
    return result;
  };

  const isAuthenticated = !!admin;
  const mustChangePassword = admin?.must_change_password === true;

  return (
    <AuthContext.Provider
      value={{
        admin,
        loading,
        isAuthenticated,
        mustChangePassword,
        authError,
        login,
        logout,
        changePassword,
        verifySession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
