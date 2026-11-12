import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { api, setSessionExpiredHandler, tokenStore } from '@/lib/api'
import type { AuthTokens, RegisterPayload, User } from '@/types/api'
import { AuthContext } from './context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(Boolean(tokenStore.access))
  const [signedOut, setSignedOut] = useState(false)

  // Restore the session on page load
  useEffect(() => {
    if (!tokenStore.access) return
    api
      .get<User>('/auth/me')
      .then(({ data }) => setUser(data))
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    setSessionExpiredHandler(() => {
      setUser(null)
      queryClient.clear()
    })
  }, [queryClient])

  const startSession = useCallback(
    (tokens: AuthTokens) => {
      queryClient.clear()
      tokenStore.save(tokens)
      setSignedOut(false)
      setUser(tokens.user)
      return tokens.user
    },
    [queryClient],
  )

  const login = useCallback(
    async (email: string, password: string) =>
      startSession((await api.post<AuthTokens>('/auth/login', { email, password })).data),
    [startSession],
  )

  const register = useCallback(
    async (payload: RegisterPayload) =>
      startSession((await api.post<AuthTokens>('/auth/register', payload)).data),
    [startSession],
  )

  const refreshUser = useCallback(async () => {
    const { data } = await api.get<User>('/auth/me')
    setUser(data)
    return data
  }, [])

  const logout = useCallback(async () => {
    const refresh = tokenStore.refresh
    try {
      await api.post('/auth/logout') // revokes the access token
      if (refresh) {
        await api.post('/auth/logout', null, { headers: { Authorization: `Bearer ${refresh}` } })
      }
    } catch {
      // the session is cleared locally either way
    }
    tokenStore.clear()
    queryClient.clear()
    setSignedOut(true)
    setUser(null)
  }, [queryClient])

  const value = useMemo(
    () => ({ user, loading, signedOut, login, register, refreshUser, logout }),
    [user, loading, signedOut, login, register, refreshUser, logout],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
