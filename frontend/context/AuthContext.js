import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { jwtDecode } from 'jwt-decode';
import { authApi, api } from '../api';
import { saveToken, getToken, deleteToken, saveRefreshToken, getRefreshToken, deleteRefreshToken } from '../utils/authStorage';

// uygulama genelinde paylaşılacak auth verisini taşıyan Context
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // { id, username, email }
  const [loading, setLoading] = useState(true);

  // uygulama açıldığında daha önce kaydedilmiş token varsa oturum açık
  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        if (token) {
          const decoded = jwtDecode(token);
          setUser({
            id: decoded?.sub,
            username: decoded?.unique_name,
            email: decoded?.email,
          });
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async ({ emailOrUsername, password }) => {
    try {
      console.log('Attempting login with:', { emailOrUsername, apiBaseURL: api.defaults.baseURL });
      const payload = { UsernameOrEmail: emailOrUsername, Password: password };
      const res = await authApi.login(payload);
      console.log('Login response received:', res.status);
      const { accessToken, refreshToken } = camelizeKeys(res.data);
      await saveToken(accessToken);
      await saveRefreshToken(refreshToken);
      const decoded = jwtDecode(accessToken);
      setUser({ id: decoded?.sub, username: decoded?.unique_name, email: decoded?.email });
    } catch (error) {
      console.error('Login error:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        code: error.code
      });
      throw error;
    }
  };

  const register = async ({ username, email, password }) => {
    try {
      console.log('Attempting registration with:', { username, email, apiBaseURL: api.defaults.baseURL });
      const payload = { Username: username, Email: email, Password: password };
      const res = await authApi.register(payload);
      console.log('Registration response received:', res.status);
      const { accessToken, refreshToken } = camelizeKeys(res.data);
      await saveToken(accessToken);
      await saveRefreshToken(refreshToken);
      const decoded = jwtDecode(accessToken);
      setUser({ id: decoded?.sub, username: decoded?.unique_name, email: decoded?.email });
    } catch (error) {
      console.error('Registration error:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        code: error.code
      });
      throw error;
    }
  };

  const logout = async () => {
    await deleteToken();
    await deleteRefreshToken();
    setUser(null);
  };

  const value = useMemo(() => ({ user, loading, login, register, logout }), [user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

// yardımcı: .NET'ten gelen PascalCase alanları camelCase'e dönüştür
function camelizeKeys(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const mapKey = (k) => k.charAt(0).toLowerCase() + k.slice(1);
  const out = {};
  for (const [k, v] of Object.entries(obj)) out[mapKey(k)] = v;
  return out;
}
