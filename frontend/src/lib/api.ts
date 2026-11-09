import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import type { AuthTokens } from '@/types/api'

/**
 * Shared HTTP client for the Flask API.
 * - attaches the access token to every request
 * - on a 401, refreshes the access token once (concurrent requests share the refresh)
 * - if refreshing fails, clears the session and notifies the auth context
 */

const ACCESS_KEY = 'mediassist.access'
const REFRESH_KEY = 'mediassist.refresh'

export const tokenStore = {
  get access() {
    return localStorage.getItem(ACCESS_KEY)
  },
  get refresh() {
    return localStorage.getItem(REFRESH_KEY)
  },
  save(tokens: Pick<AuthTokens, 'access_token' | 'refresh_token'>) {
    localStorage.setItem(ACCESS_KEY, tokens.access_token)
    if (tokens.refresh_token) localStorage.setItem(REFRESH_KEY, tokens.refresh_token)
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
  },
}

let onSessionExpired: () => void = () => {}
export function setSessionExpiredHandler(handler: () => void) {
  onSessionExpired = handler
}

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = tokenStore.access
  if (token && !config.headers.Authorization) config.headers.Authorization = `Bearer ${token}`
  return config
})

let refreshing: Promise<string> | null = null

async function refreshAccessToken(): Promise<string> {
  const refresh = tokenStore.refresh
  if (!refresh) throw new Error('No refresh token')
  const { data } = await axios.post<AuthTokens>(`${api.defaults.baseURL}/auth/refresh`, null, {
    headers: { Authorization: `Bearer ${refresh}` },
  })
  tokenStore.save({ access_token: data.access_token })
  return data.access_token
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as
      (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined
    const isAuthCall = original?.url?.startsWith('/auth/')
    if (error.response?.status !== 401 || !original || original._retried || isAuthCall) {
      throw error
    }
    original._retried = true
    try {
      refreshing ??= refreshAccessToken().finally(() => {
        refreshing = null
      })
      const token = await refreshing
      original.headers.Authorization = `Bearer ${token}`
      return api(original)
    } catch {
      tokenStore.clear()
      onSessionExpired()
      throw error
    }
  },
)

interface ApiErrorBody {
  message?: string
  errors?: { json?: Record<string, unknown>; query?: Record<string, unknown> }
}

/** Human-readable message from any API error. */
export function errorMessage(error: unknown, fallback = 'Something went wrong. Please try again.') {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    if (!error.response) return 'Cannot reach the server. Is the backend running?'
    return error.response.data?.message ?? fallback
  }
  return error instanceof Error ? error.message : fallback
}

/** Field-level validation errors from a 422 response, flattened to {field: message}. */
export function fieldErrors(error: unknown): Record<string, string> {
  if (!axios.isAxiosError<ApiErrorBody>(error)) return {}
  const json = error.response?.data?.errors?.json ?? {}
  const flat: Record<string, string> = {}
  const walk = (obj: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(obj)) {
      if (Array.isArray(value)) flat[key] = String(value[0])
      else if (typeof value === 'string') flat[key] = value
      else if (value && typeof value === 'object') walk(value as Record<string, unknown>)
    }
  }
  walk(json)
  return flat
}

/** Trigger a browser download from a Blob response. */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
