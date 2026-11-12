import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router'
import { AuthProvider } from '@/auth/AuthContext'
import { RequireAuth } from '@/auth/RequireAuth'
import { AppLayout } from '@/components/layout/AppLayout'
import { AssessFormPage, AssessIndexPage } from '@/pages/AssessPages'
import { ApplicationStatusPage, LoginPage, RegisterPage } from '@/pages/auth/AuthPages'
import { HistoryPage } from '@/pages/HistoryPage'
import { LandingPage } from '@/pages/LandingPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { PatientDetailPage, PatientsPage } from '@/pages/PatientsPages'
import { PredictionDetailPage } from '@/pages/PredictionDetailPage'
import { ProfilePage } from '@/pages/ProfilePage'
import { FullPageSpinner } from '@/components/ui/Feedback'
import type { Role } from '@/types/api'

// Chart-heavy pages (Recharts) load on demand to keep the first page small
const DashboardPage = lazy(() =>
  import('@/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })),
)
const ModelsPage = lazy(() => import('@/pages/ModelsPage').then((m) => ({ default: m.ModelsPage })))
const UsersPage = lazy(() => import('@/pages/AdminPages').then((m) => ({ default: m.UsersPage })))
const ApplicationsPage = lazy(() =>
  import('@/pages/AdminPages').then((m) => ({ default: m.ApplicationsPage })),
)
const AuditLogPage = lazy(() =>
  import('@/pages/AdminPages').then((m) => ({ default: m.AuditLogPage })),
)

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 15_000 },
  },
})

const only = (roles: Role[], element: ReactNode) => (
  <RequireAuth roles={roles}>
    <Suspense fallback={<FullPageSpinner />}>{element}</Suspense>
  </RequireAuth>
)

const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  {
    // the only page an unapproved doctor applicant can open
    path: '/application',
    element: (
      <RequireAuth allowApplicant>
        <ApplicationStatusPage />
      </RequireAuth>
    ),
  },
  {
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      {
        path: '/dashboard',
        element: (
          <Suspense fallback={<FullPageSpinner />}>
            <DashboardPage />
          </Suspense>
        ),
      },
      { path: '/assess', element: only(['patient', 'doctor'], <AssessIndexPage />) },
      { path: '/assess/:disease', element: only(['patient', 'doctor'], <AssessFormPage />) },
      { path: '/predictions/:id', element: <PredictionDetailPage /> },
      { path: '/history', element: only(['patient', 'doctor'], <HistoryPage />) },
      { path: '/profile', element: only(['patient'], <ProfilePage />) },
      { path: '/patients', element: only(['doctor', 'admin'], <PatientsPage />) },
      { path: '/patients/:id', element: only(['doctor', 'admin'], <PatientDetailPage />) },
      { path: '/models', element: only(['doctor', 'admin'], <ModelsPage />) },
      { path: '/admin/users', element: only(['admin'], <UsersPage />) },
      { path: '/admin/applications', element: only(['admin'], <ApplicationsPage />) },
      { path: '/admin/audit', element: only(['admin'], <AuditLogPage />) },
      { path: '/home', element: <Navigate to="/dashboard" replace /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  )
}
