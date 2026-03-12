import React from 'react'
import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AuthProvider, useAuth } from './AuthContext'
import { apiFetch } from '../utils/apiFetch'
import { authStore } from '../utils/authStore'

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../utils/apiFetch', () => ({ apiFetch: vi.fn() }))

// ─── Helpers ──────────────────────────────────────────────────────────────────

const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>

function mockFetch(...responses) {
  const mock = vi.fn()
  responses.forEach(r => mock.mockResolvedValueOnce(r))
  // Any extra calls (e.g. logout) return a generic ok
  mock.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) })
  globalThis.fetch = mock
  return mock
}

function okRefresh(token = 'test-token') {
  return { ok: true, json: () => Promise.resolve({ token }) }
}

function okMe(user = { id: 1, email: 'user@test.com' }) {
  return { ok: true, json: () => Promise.resolve(user) }
}

const failedRefresh = { ok: false }

// Wait for the automatic silentRefresh that fires on mount to settle
async function waitForAuthReady(result) {
  await waitFor(() => expect(result.current.authLoading).toBe(false))
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  // Default: silentRefresh fails — keeps tests isolated
  globalThis.fetch = vi.fn().mockResolvedValue(failedRefresh)
  apiFetch.mockReset()
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AuthContext', () => {

  // ─── Initial state ──────────────────────────────────────────────────────────

  describe('initial state', () => {
    it('authLoading is true before silentRefresh settles', () => {
      // freeze fetch so silentRefresh never completes
      globalThis.fetch = vi.fn().mockReturnValue(new Promise(() => {}))
      const { result } = renderHook(() => useAuth(), { wrapper })
      expect(result.current.authLoading).toBe(true)
    })

    it('isLoggedIn is false and user is null before any auth action', () => {
      globalThis.fetch = vi.fn().mockReturnValue(new Promise(() => {}))
      const { result } = renderHook(() => useAuth(), { wrapper })
      expect(result.current.isLoggedIn).toBe(false)
      expect(result.current.user).toBe(null)
    })
  })

  // ─── silentRefresh on mount ─────────────────────────────────────────────────

  describe('silentRefresh (called automatically on mount)', () => {
    it('sets authLoading to false when refresh returns ok: false', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(failedRefresh)
      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitForAuthReady(result)
      expect(result.current.authLoading).toBe(false)
      expect(result.current.isLoggedIn).toBe(false)
    })

    it('sets authLoading to false when fetch throws', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'))
      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitForAuthReady(result)
      expect(result.current.authLoading).toBe(false)
      expect(result.current.isLoggedIn).toBe(false)
    })

    it('sets accessToken and isLoggedIn when refresh succeeds', async () => {
      mockFetch(okRefresh('abc'), okMe())
      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitForAuthReady(result)
      expect(result.current.isLoggedIn).toBe(true)
      expect(result.current.accessToken).toBe('abc')
    })

    it('restores user from flat /me response shape', async () => {
      const user = { id: 1, email: 'user@test.com' }
      mockFetch(okRefresh(), okMe(user))
      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitForAuthReady(result)
      expect(result.current.user).toEqual(user)
    })

    it('restores user from nested { user: {...} } /me response shape', async () => {
      const user = { id: 2, email: 'nested@test.com' }
      mockFetch(okRefresh(), okMe({ user }))
      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitForAuthReady(result)
      expect(result.current.user).toEqual(user)
    })

    it('remains logged in (token set) even when /me returns non-ok', async () => {
      mockFetch(okRefresh('tok'), { ok: false })
      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitForAuthReady(result)
      expect(result.current.isLoggedIn).toBe(true)
      expect(result.current.user).toBe(null)
    })

    it('remains logged in even when /me fetch throws', async () => {
      globalThis.fetch = vi.fn()
        .mockResolvedValueOnce(okRefresh('tok'))
        .mockRejectedValueOnce(new Error('me failed'))
      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitForAuthReady(result)
      expect(result.current.isLoggedIn).toBe(true)
    })

    it('registers silentRefresh on authStore so apiFetch can use it', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitForAuthReady(result)
      expect(authStore.refreshFn).toBeTypeOf('function')
    })
  })

  // ─── login ──────────────────────────────────────────────────────────────────

  describe('login', () => {
    it('sets isLoggedIn and user on successful login', async () => {
      const user = { id: 3, email: 'login@test.com' }
      apiFetch.mockResolvedValue({ token: 'login-token', user })
      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitForAuthReady(result)

      await act(async () => {
        await result.current.login('login@test.com', 'password')
      })

      expect(result.current.isLoggedIn).toBe(true)
      expect(result.current.user).toEqual(user)
      expect(result.current.accessToken).toBe('login-token')
    })

    it('calls apiFetch with the correct path and credentials', async () => {
      apiFetch.mockResolvedValue({ token: 't', user: {} })
      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitForAuthReady(result)

      await act(async () => {
        await result.current.login('a@a.com', 'pass')
      })

      expect(apiFetch).toHaveBeenCalledWith(
        '/api/users/login',
        expect.objectContaining({ method: 'POST' })
      )
    })

    it('throws when apiFetch rejects (wrong credentials)', async () => {
      apiFetch.mockRejectedValue(new Error('Invalid credentials'))
      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitForAuthReady(result)

      await expect(
        act(async () => { await result.current.login('bad@bad.com', 'wrong') })
      ).rejects.toThrow('Invalid credentials')

      expect(result.current.isLoggedIn).toBe(false)
    })
  })

  // ─── logout ─────────────────────────────────────────────────────────────────

  describe('logout', () => {
    async function renderLoggedIn() {
      const user = { id: 1, email: 'user@test.com' }
      apiFetch.mockResolvedValue({ token: 'tok', user })
      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitForAuthReady(result)
      await act(async () => { await result.current.login('user@test.com', 'pass') })
      expect(result.current.isLoggedIn).toBe(true)
      return result
    }

    it('clears accessToken, user, and isLoggedIn', async () => {
      const result = await renderLoggedIn()
      await act(async () => { await result.current.logout() })
      expect(result.current.isLoggedIn).toBe(false)
      expect(result.current.user).toBe(null)
      expect(result.current.accessToken).toBe(null)
    })

    it('calls /api/auth/logout with the CSRF header', async () => {
      const result = await renderLoggedIn()
      const fetchSpy = vi.fn().mockResolvedValue({ ok: true })
      globalThis.fetch = fetchSpy

      await act(async () => { await result.current.logout() })

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/logout'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'X-Requested-With': 'XMLHttpRequest' }),
        })
      )
    })

    it('still clears state when the logout fetch throws', async () => {
      const result = await renderLoggedIn()
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Offline'))

      await act(async () => { await result.current.logout() })

      expect(result.current.isLoggedIn).toBe(false)
      expect(result.current.user).toBe(null)
    })
  })

  // ─── useAuth hook ────────────────────────────────────────────────────────────

  describe('useAuth', () => {
    it('exposes accessToken, user, isLoggedIn, authLoading, login, and logout', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })
      await waitForAuthReady(result)
      expect(result.current).toMatchObject({
        accessToken: expect.anything() === undefined ? undefined : null,
        user: null,
        isLoggedIn: false,
        authLoading: false,
        login: expect.any(Function),
        logout: expect.any(Function),
      })
    })
  })
})
