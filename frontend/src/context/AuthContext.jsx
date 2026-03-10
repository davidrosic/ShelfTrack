import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { API_URL } from '../config';
import { apiFetch } from '../utils/apiFetch';
import { authStore } from '../utils/authStore';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [accessToken, setAccessToken] = useState(null);
  const [user, setUser] = useState(null);
  const refreshTimerRef = useRef(null);
  const silentRefreshRef = useRef(null);

  const silentRefresh = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        setAccessToken(null);
        setUser(null);
        return null;
      }
      const data = await res.json();
      setAccessToken(data.token);
      // Schedule next silent refresh 60s before the 15-min access token expires
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(() => silentRefreshRef.current?.(), 14 * 60 * 1000);
      return data.token;
    } catch {
      setAccessToken(null);
      setUser(null);
      return null;
    }
  }, []);

  // Keep the ref in sync so the timer callback always calls the latest version
  useEffect(() => {
    silentRefreshRef.current = silentRefresh;
    authStore.refreshFn = silentRefresh;
  }, [silentRefresh]);

  // On app mount: attempt silent refresh to restore an existing session
  useEffect(() => {
    silentRefresh();
    return () => clearTimeout(refreshTimerRef.current);
  }, [silentRefresh]);

  const login = useCallback(async (email, password) => {
    const data = await apiFetch('/api/users/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setAccessToken(data.token);
    setUser(data.user);
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => silentRefreshRef.current?.(), 14 * 60 * 1000);
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch(`${API_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // Proceed with client-side logout even if the server call fails
    }
    setAccessToken(null);
    setUser(null);
    clearTimeout(refreshTimerRef.current);
  }, []);

  return (
    <AuthContext.Provider value={{ accessToken, user, login, logout, isLoggedIn: !!accessToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
