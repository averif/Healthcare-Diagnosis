import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { FullPageSpinner } from '@/components/ui/Feedback'
import type { Role } from '@/types/api'
import { useAuth } from './useAuth'

/** Redirects to /login when signed out, and to the dashboard when the role is not allowed. */
export function RequireAuth({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { user, loading, signedOut } = useAuth()
  const location = useLocation()

  if (loading) return <FullPageSpinner />
  // remember the page only when the session expired, not after a deliberate sign-out
  if (!user)
    return <Navigate to="/login" replace state={signedOut ? null : { from: location.pathname }} />
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}
