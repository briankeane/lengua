import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import * as authService from '../Services/authService';
import type { AuthResponse, LoginParams, SignupParams } from '../Services/authService';
import { AuthContext, AuthUser } from './authContext';

function loadStoredAuth(): { user: AuthUser | null; token: string | null } {
  const token = localStorage.getItem('token');
  const userJson = localStorage.getItem('user');
  if (token && userJson) {
    try {
      return { user: JSON.parse(userJson), token };
    } catch {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
  }
  return { user: null, token: null };
}

function saveAuth(response: AuthResponse) {
  localStorage.setItem('token', response.token);
  localStorage.setItem('user', JSON.stringify(response.user));
}

function clearAuth() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = loadStoredAuth();
    setUser(stored.user);
    setToken(stored.token);
    setLoading(false);
  }, []);

  const handleAuthResponse = useCallback((response: AuthResponse) => {
    saveAuth(response);
    setUser(response.user);
    setToken(response.token);
  }, []);

  const login = useCallback(
    async (params: LoginParams) => {
      const response = await authService.login(params);
      handleAuthResponse(response);
    },
    [handleAuthResponse],
  );

  const signup = useCallback(
    async (params: SignupParams) => {
      const response = await authService.signup(params);
      handleAuthResponse(response);
    },
    [handleAuthResponse],
  );

  const loginWithToken = useCallback((newToken: string, newUser: AuthUser) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  }, []);

  const logout = useCallback(() => {
    clearAuth();
    setUser(null);
    setToken(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      isAuthenticated: !!token,
      loading,
      login,
      signup,
      loginWithToken,
      logout,
    }),
    [user, token, loading, login, signup, loginWithToken, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
