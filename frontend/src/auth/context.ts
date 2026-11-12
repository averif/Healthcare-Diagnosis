import { createContext } from 'react'
import type { RegisterPayload, User } from '@/types/api'

export interface AuthState {
  user: User | null
  loading: boolean
  /** true after an explicit sign-out (so the next login starts at the dashboard) */
  signedOut: boolean
  login: (email: string, password: string) => Promise<User>
  register: (payload: RegisterPayload) => Promise<User>
  /** Re-read the signed-in account (e.g. after uploading a document) */
  refreshUser: () => Promise<User>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthState | null>(null)
