import axios from 'axios'

/** Shared HTTP client for the Flask API. Auth interceptors are added in Phase 3/4. */
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api',
  headers: { 'Content-Type': 'application/json' },
})

export interface HealthResponse {
  status: string
  version: string
}

export async function getHealth(): Promise<HealthResponse> {
  const { data } = await api.get<HealthResponse>('/health')
  return data
}
