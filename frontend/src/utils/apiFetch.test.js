import { describe, it, expect, beforeEach, vi } from 'vitest'
import { apiFetch } from './apiFetch'
import { authStore } from './authStore'

vi.mock('../config', () => ({ API_URL: '' }))

// ─── Helpers ──────────────────────────────────────────────────────────────────

function okResponse(body = {}) {
  return { ok: true, status: 200, statusText: 'OK', json: () => Promise.resolve(body) }
}

function errorResponse(body = {}, status = 400, statusText = 'Bad Request') {
  return { ok: false, status, statusText, json: () => Promise.resolve(body) }
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  authStore.refreshFn = null
  globalThis.fetch = vi.fn()
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('apiFetch', () => {

  // ─── Successful requests ───────────────────────────────────────────────────

  describe('successful request', () => {
    it('returns parsed JSON on a 200 response', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(okResponse({ data: 'test' }))
      const result = await apiFetch('/api/test')
      expect(result).toEqual({ data: 'test' })
    })

    it('always sends X-Requested-With and Content-Type headers', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(okResponse())
      await apiFetch('/api/test')
      const { headers } = globalThis.fetch.mock.calls[0][1]
      expect(headers['X-Requested-With']).toBe('XMLHttpRequest')
      expect(headers['Content-Type']).toBe('application/json')
    })

    it('includes Authorization header when accessToken is provided', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(okResponse())
      await apiFetch('/api/test', {}, 'my-token')
      const { headers } = globalThis.fetch.mock.calls[0][1]
      expect(headers['Authorization']).toBe('Bearer my-token')
    })

    it('omits Authorization header when no token is provided', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(okResponse())
      await apiFetch('/api/test')
      const { headers } = globalThis.fetch.mock.calls[0][1]
      expect(headers['Authorization']).toBeUndefined()
    })

    it('merges caller-supplied headers with defaults', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(okResponse())
      await apiFetch('/api/test', { headers: { 'X-Custom': 'yes' } })
      const { headers } = globalThis.fetch.mock.calls[0][1]
      expect(headers['X-Custom']).toBe('yes')
      expect(headers['Content-Type']).toBe('application/json')
    })

    it('sends credentials: include', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(okResponse())
      await apiFetch('/api/test')
      expect(globalThis.fetch.mock.calls[0][1].credentials).toBe('include')
    })
  })

  // ─── 401 silent-refresh retry ──────────────────────────────────────────────

  describe('401 silent-refresh retry', () => {
    it('calls refreshFn and retries once on a 401', async () => {
      authStore.refreshFn = vi.fn().mockResolvedValue('new-token')
      globalThis.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: false, status: 401, statusText: 'Unauthorized', json: () => Promise.resolve({}) })
        .mockResolvedValueOnce(okResponse({ retried: true }))

      const result = await apiFetch('/api/protected')
      expect(result).toEqual({ retried: true })
      expect(authStore.refreshFn).toHaveBeenCalledOnce()
      expect(globalThis.fetch).toHaveBeenCalledTimes(2)
    })

    it('sends the new token in the retry request', async () => {
      authStore.refreshFn = vi.fn().mockResolvedValue('fresh-token')
      globalThis.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: false, status: 401, statusText: 'Unauthorized', json: () => Promise.resolve({}) })
        .mockResolvedValueOnce(okResponse())

      await apiFetch('/api/protected')
      const retryHeaders = globalThis.fetch.mock.calls[1][1].headers
      expect(retryHeaders['Authorization']).toBe('Bearer fresh-token')
    })

    it('does not retry when no refreshFn is registered', async () => {
      authStore.refreshFn = null
      globalThis.fetch = vi.fn().mockResolvedValue(
        { ok: false, status: 401, statusText: 'Unauthorized', json: () => Promise.resolve({ message: 'Unauthorized' }) }
      )

      await expect(apiFetch('/api/protected')).rejects.toThrow('Unauthorized')
      expect(globalThis.fetch).toHaveBeenCalledOnce()
    })

    it('does not retry when refreshFn returns null', async () => {
      authStore.refreshFn = vi.fn().mockResolvedValue(null)
      globalThis.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: false, status: 401, statusText: 'Unauthorized', json: () => Promise.resolve({ message: 'No token' }) })

      await expect(apiFetch('/api/protected')).rejects.toThrow()
      expect(globalThis.fetch).toHaveBeenCalledOnce()
    })
  })

  // ─── Error responses ───────────────────────────────────────────────────────

  describe('non-ok responses', () => {
    it('throws with message from the JSON error body', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(errorResponse({ message: 'Not found' }, 404))
      await expect(apiFetch('/api/missing')).rejects.toThrow('Not found')
    })

    it('falls back to statusText when the JSON body has no message', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(errorResponse({}, 500, 'Internal Server Error'))
      await expect(apiFetch('/api/broken')).rejects.toThrow('Internal Server Error')
    })

    it('falls back to "Request failed" when JSON parsing fails', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false, status: 500, statusText: '',
        json: () => Promise.reject(new Error('bad json')),
      })
      await expect(apiFetch('/api/broken')).rejects.toThrow('Request failed')
    })

    it('attaches the errors field to the thrown error when present', async () => {
      const body = { message: 'Validation failed', errors: { email: ['already taken'] } }
      globalThis.fetch = vi.fn().mockResolvedValue(errorResponse(body, 422))
      const err = await apiFetch('/api/register').catch(e => e)
      expect(err.errors).toEqual({ email: ['already taken'] })
    })

    it('attaches the field property to the thrown error when present', async () => {
      const body = { message: 'Invalid', field: 'username' }
      globalThis.fetch = vi.fn().mockResolvedValue(errorResponse(body, 400))
      const err = await apiFetch('/api/register').catch(e => e)
      expect(err.field).toBe('username')
    })

    it('does not attach errors or field when they are absent', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(errorResponse({ message: 'Oops' }, 400))
      const err = await apiFetch('/api/fail').catch(e => e)
      expect(err.errors).toBeUndefined()
      expect(err.field).toBeUndefined()
    })
  })
})
