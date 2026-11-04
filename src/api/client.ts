import axios, { type AxiosError } from 'axios'
import { tokens } from '@/api/tokens'
import { currentLocale } from '@/plugins/i18n'
import { apiBaseUrl } from '@/space'

declare module 'axios' {
  interface AxiosRequestConfig {
    /** Already retried after a refresh, or the refresh call itself: never refresh again. */
    noRefresh?: boolean
  }
}

/** Every call to the API goes through this client. */
export const client = axios.create({
  baseURL: apiBaseUrl(window.location, import.meta.env.VITE_API_PORT),
  headers: { Accept: 'application/json' },
})

client.interceptors.request.use((config) => {
  config.headers.set('Accept-Language', currentLocale())
  if (tokens.access) {
    config.headers.set('Authorization', `Bearer ${tokens.access}`)
  }

  return config
})

let sessionLost = () => {}

/** Called when the session really ended, so the app can go back to the sign-in page. */
export function onSessionLost(callback: () => void): void {
  sessionLost = callback
}

/** The API uses up a refresh token on its first use, so calls that fail together share one refresh. */
let refreshing: Promise<boolean> | null = null

function refreshSession(): Promise<boolean> {
  refreshing ??= sendRefresh().finally(() => {
    refreshing = null
  })

  return refreshing
}

async function sendRefresh(): Promise<boolean> {
  try {
    const { data } = await client.post('/auth/refresh', { refresh_token: tokens.refresh }, { noRefresh: true })
    tokens.save(data)

    return true
  } catch (error) {
    // No network is not the end of a session: a rep in the field keeps their tokens.
    if ((error as AxiosError).response === undefined) {
      throw error
    }
    tokens.clear()

    return false
  }
}

client.interceptors.response.use(undefined, async (error: AxiosError) => {
  const request = error.config

  if (error.response?.status !== 401 || request === undefined || request.noRefresh || !tokens.refresh) {
    throw error
  }

  if (!(await refreshSession())) {
    sessionLost()
    throw error
  }

  return client({ ...request, noRefresh: true })
})
