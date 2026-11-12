import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { FullPageSpinner } from '@/components/ui/Feedback'
import { isDoctorApplicant } from '@/lib/doctorApplication'
import type { Role } from '@/types/api'
import { useAuth } from './useAuth'

/**
 * Redirects to /login when signed out, and to the dashboard when the role is not allowed.
 * Unapproved doctor applicants only ever see their application status (the API enforces this
 * too; this just keeps them away from pages that would fail).
 */
export function RequireAuth({
  roles,
  allowApplicant = false,
  children,
}: {
  roles?: Role[]
  allowApplicant?: boolean
  children: ReactNode
}) {
  const { user, loading, signedOut } = useAuth()
  const location = useLocation()

  if (loading) return <FullPageSpinner />
  // remember the page only when the session expired, not after a deliberate sign-out
  if (!user)
    return <Navigate to="/login" replace state={signedOut ? null : { from: location.pathname }} />
  if (isDoctorApplicant(user) && !allowApplicant) return <Navigate to="/application" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}
