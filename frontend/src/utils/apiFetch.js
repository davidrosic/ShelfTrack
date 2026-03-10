import { API_URL } from '../config';
import { authStore } from './authStore';

async function doFetch(path, options, accessToken) {
  const headers = {
    'Content-Type': 'application/json',
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...options.headers,
  };

  return fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers,
  });
}

export async function apiFetch(path, options = {}, accessToken = null) {
  let res = await doFetch(path, options, accessToken);

  // On 401, try a silent token refresh then retry once
  if (res.status === 401 && authStore.refreshFn) {
    const newToken = await authStore.refreshFn();
    if (newToken) {
      res = await doFetch(path, options, newToken);
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(err.message || res.statusText);
  }

  return res.json();
}
