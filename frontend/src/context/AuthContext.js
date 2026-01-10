import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import axios from 'axios';
import { API_BASE } from '@/lib/utils';

const API = API_BASE;

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('kayicom_token'));
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    localStorage.removeItem('kayicom_token');
    delete axios.defaults.headers.common['Authorization'];
    setToken(null);
    setUser(null);
  }, []);

  const fetchUser = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/auth/me`);
      setUser(response.data);
    } catch (error) {
      console.error('Failed to fetch user:', error);
      logout();
    } finally {
      setLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [token, fetchUser]);

  const login = useCallback(async (email, password) => {
    const response = await axios.post(`${API}/auth/login`, { email, password });
    const { token: newToken, user: userData } = response.data;
    
    localStorage.setItem('kayicom_token', newToken);
    axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    setToken(newToken);
    setUser(userData);
    
    return userData;
  }, []);

  const register = useCallback(async (userData) => {
    const response = await axios.post(`${API}/auth/register`, userData);
    const { token: newToken, user: newUser } = response.data;
    
    localStorage.setItem('kayicom_token', newToken);
    axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    setToken(newToken);
    setUser(newUser);
    
    return newUser;
  }, []);

  const refreshUser = useCallback(async () => {
    if (token) {
      await fetchUser();
    }
  }, [token, fetchUser]);

  const forgotPassword = useCallback(async (email) => {
    await axios.post(`${API}/auth/forgot-password`, { email });
  }, []);

  const resetPassword = useCallback(async (resetToken, newPassword) => {
    await axios.post(`${API}/auth/reset-password`, { token: resetToken, new_password: newPassword });
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      login,
      register,
      logout,
      refreshUser,
      forgotPassword,
      resetPassword,
      isAuthenticated: !!user,
      isAdmin: user?.is_admin || false,
      adminRole: user?.is_admin ? (user?.admin_role || 'admin') : null,
      hasAdminRole: (roles = []) => {
        if (!user?.is_admin) return false;
        const role = (user?.admin_role || 'admin').toLowerCase();
        if (role === 'superadmin') return true;
        return Array.isArray(roles) ? roles.map(r => String(r).toLowerCase()).includes(role) : false;
      }
    }}>
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
