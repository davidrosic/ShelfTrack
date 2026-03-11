import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { API_URL } from '../config';
import { apiFetch } from '../utils/apiFetch';
import { authStore } from '../utils/authStore';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [accessToken, setAccessToken] = useState(null);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const refreshTimerRef = useRef(null);
  const silentRefreshRef = useRef(null);

  const silentRefresh = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      });
      if (!res.ok) {
        setAccessToken(null);
        setUser(null);
        return null;
      }
      const data = await res.json();
      setAccessToken(data.token);
      // Restore user profile after getting a fresh token
      try {
        const meRes = await fetch(`${API_URL}/api/users/me`, {
          headers: {
            Authorization: `Bearer ${data.token}`,
            'X-Requested-With': 'XMLHttpRequest',
          },
          credentials: 'include',
        });
        if (meRes.ok) {
          const meData = await meRes.json();
          setUser(meData.user ?? meData);
        }
      } catch {
        // Non-critical — user data is nice to have but token is enough for auth
      }
      // Schedule next silent refresh 5 minutes before the 15-min access token expires
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(() => silentRefreshRef.current?.(), 10 * 60 * 1000);
      return data.token;
    } catch {
      setAccessToken(null);
      setUser(null);
      return null;
    } finally {
      setAuthLoading(false);
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
    refreshTimerRef.current = setTimeout(() => silentRefreshRef.current?.(), 10 * 60 * 1000);
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch(`${API_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      });
    } catch {
      // Proceed with client-side logout even if the server call fails
    }
    setAccessToken(null);
    setUser(null);
    clearTimeout(refreshTimerRef.current);
  }, []);

  return (
    <AuthContext.Provider value={{ accessToken, user, login, logout, isLoggedIn: !!accessToken, authLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
