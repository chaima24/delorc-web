import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { client, onSessionLost } from '@/api/client'
import { tokens } from '@/api/tokens'

type Handler = (config: InternalAxiosRequestConfig) => { status: number; data?: unknown } | 'network-error'

/** Replaces the network: axios asks this function instead of calling the API. */
function fakeApi(handler: Handler) {
  const calls: InternalAxiosRequestConfig[] = []

  client.defaults.adapter = async (config) => {
    calls.push(config)
    const answer = handler(config)

    if (answer === 'network-error') {
      throw new AxiosError('Network Error', 'ERR_NETWORK', config)
    }

    const response = { ...answer, statusText: '', headers: {}, config } as AxiosResponse
    if (answer.status >= 400) {
      throw new AxiosError('failed', 'ERR_BAD_RESPONSE', config, null, response)
    }

    return response
  }

  return calls
}

const refreshCalls = (calls: InternalAxiosRequestConfig[]) => calls.filter((call) => call.url === '/auth/refresh')

describe('client', () => {
  beforeEach(() => {
    localStorage.clear()
    tokens.save({ access_token: 'old', refresh_token: 'refresh-1' })
  })

  it('sends the token and the language', async () => {
    const calls = fakeApi(() => ({ status: 200 }))

    await client.get('/anything')

    expect(calls[0]?.headers.get('Authorization')).toBe('Bearer old')
    expect(calls[0]?.headers.get('Accept-Language')).toBe('fr')
  })

  it('refreshes once for calls that fail together, then retries them', async () => {
    const calls = fakeApi((config) => {
      if (config.url === '/auth/refresh') {
        return { status: 200, data: { access_token: 'new', refresh_token: 'refresh-2' } }
      }

      return config.headers.get('Authorization') === 'Bearer new' ? { status: 200, data: 'ok' } : { status: 401 }
    })

    const answers = await Promise.all([client.get('/a'), client.get('/b')])

    expect(answers.map((answer) => answer.data)).toEqual(['ok', 'ok'])
    expect(refreshCalls(calls)).toHaveLength(1)
    expect(tokens.refresh).toBe('refresh-2')
  })

  it('ends the session when the refresh token is refused', async () => {
    const lost = vi.fn()
    onSessionLost(lost)
    fakeApi(() => ({ status: 401 }))

    await expect(client.get('/a')).rejects.toThrow()

    expect(lost).toHaveBeenCalledOnce()
    expect(tokens.access).toBeNull()
  })

  it('keeps the session when there is no network', async () => {
    const lost = vi.fn()
    onSessionLost(lost)
    fakeApi((config) => (config.url === '/auth/refresh' ? 'network-error' : { status: 401 }))

    await expect(client.get('/a')).rejects.toThrow()

    expect(lost).not.toHaveBeenCalled()
    expect(tokens.refresh).toBe('refresh-1')
  })

  it('does not refresh on a wrong password', async () => {
    const calls = fakeApi(() => ({ status: 422 }))

    await expect(client.post('/auth/login', {})).rejects.toThrow()

    expect(refreshCalls(calls)).toHaveLength(0)
  })
})
