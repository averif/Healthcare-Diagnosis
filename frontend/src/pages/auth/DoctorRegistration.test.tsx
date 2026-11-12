import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { AuthContext, type AuthState } from '@/auth/context'
import { RequireAuth } from '@/auth/RequireAuth'
import type { DoctorApplicationStatus, User } from '@/types/api'
import { ApplicationStatusPage, RegisterPage } from './AuthPages'

function applicant(overrides: Partial<DoctorApplicationStatus> = {}): User {
  return {
    id: 7,
    email: 'dr.new@test.local',
    full_name: 'Dr. New',
    role: 'patient',
    is_active: true,
    created_at: '2026-11-01T10:00:00Z',
    last_login_at: null,
    patient_id: null,
    doctor_application: {
      status: 'pending',
      rejection_reason: null,
      license_number: 'DMC-2020-12345',
      issuing_authority: 'Delhi Medical Council',
      hospital: 'City Hospital',
      specialty: null,
      has_document: false,
      submitted_at: '2026-11-01T10:00:00Z',
      reviewed_at: null,
      ...overrides,
    },
  }
}

function renderAt(
  path: string,
  auth: Partial<AuthState>,
  routes?: { path: string; element: ReactNode }[],
) {
  const value: AuthState = {
    user: null,
    loading: false,
    signedOut: false,
    login: vi.fn(),
    register: vi.fn(),
    refreshUser: vi.fn(),
    logout: vi.fn(),
    ...auth,
  }
  const router = createMemoryRouter(
    routes ?? [
      { path: '/register', element: <RegisterPage /> },
      {
        path: '/application',
        element: (
          <RequireAuth allowApplicant>
            <ApplicationStatusPage />
          </RequireAuth>
        ),
      },
      {
        path: '/patients',
        element: (
          <RequireAuth roles={['doctor', 'admin']}>
            <p>patient list</p>
          </RequireAuth>
        ),
      },
      { path: '/dashboard', element: <p>dashboard</p> },
      { path: '/profile', element: <p>profile</p> },
      { path: '/login', element: <p>login</p> },
    ],
    { initialEntries: [path] },
  )
  render(
    <AuthContext.Provider value={value}>
      <RouterProvider router={router} />
    </AuthContext.Provider>,
  )
  return value
}

async function fillAccount(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/Full name/), 'Dr. New')
  await user.type(screen.getByLabelText(/^Email/), 'dr.new@test.local')
  await user.type(screen.getByLabelText(/^Password/), 'Secur3pass')
  await user.type(screen.getByLabelText(/Confirm password/), 'Secur3pass')
  await user.click(screen.getByRole('checkbox'))
}

describe('Register page account type toggle', () => {
  it('shows doctor fields and the verification note only for doctors', async () => {
    const user = userEvent.setup()
    renderAt('/register', {})
    expect(screen.getByRole('radio', { name: 'Patient' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.queryByLabelText(/Licence number/)).not.toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: 'Doctor' }))
    expect(screen.getByRole('radio', { name: 'Doctor' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByLabelText(/Licence number/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Issuing authority/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Hospital/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Specialty/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Registration certificate/)).toBeInTheDocument()
    expect(screen.getByText(/verified by an administrator/)).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: 'Patient' }))
    expect(screen.queryByLabelText(/Licence number/)).not.toBeInTheDocument()
  })

  it('requires the licence fields for doctors and validates them', async () => {
    const user = userEvent.setup()
    const auth = renderAt('/register', {})
    await user.click(screen.getByRole('radio', { name: 'Doctor' }))
    await fillAccount(user)
    await user.click(screen.getByRole('button', { name: 'Submit application' }))

    expect(await screen.findByText('Enter your licence number.')).toBeInTheDocument()
    expect(screen.getByText('Enter the issuing authority.')).toBeInTheDocument()

    await user.type(screen.getByLabelText(/Licence number/), '<x>')
    await user.click(screen.getByRole('button', { name: 'Submit application' }))
    expect(await screen.findByText(/Use 3-50 letters/)).toBeInTheDocument()
    expect(auth.register).not.toHaveBeenCalled()
  })

  it('rejects an invalid document before submitting', async () => {
    const user = userEvent.setup({ applyAccept: false })
    renderAt('/register', {})
    await user.click(screen.getByRole('radio', { name: 'Doctor' }))
    await user.upload(
      screen.getByLabelText(/Registration certificate/),
      new File(['MZ'], 'virus.exe', { type: 'application/octet-stream' }),
    )
    expect(screen.getByText('Upload a PDF, JPG or PNG file.')).toBeInTheDocument()
  })

  it('sends a normalised doctor application without any role', async () => {
    const user = userEvent.setup()
    const register = vi.fn().mockResolvedValue(applicant())
    renderAt('/register', { register })
    await user.click(screen.getByRole('radio', { name: 'Doctor' }))
    await fillAccount(user)
    await user.type(screen.getByLabelText(/Licence number/), ' dmc-2020-12345 ')
    await user.type(screen.getByLabelText(/Issuing authority/), 'Delhi   Medical Council')
    await user.click(screen.getByRole('button', { name: 'Submit application' }))

    await waitFor(() => expect(register).toHaveBeenCalledTimes(1))
    const payload = register.mock.calls[0][0]
    expect(payload).toEqual({
      full_name: 'Dr. New',
      email: 'dr.new@test.local',
      password: 'Secur3pass',
      account_type: 'doctor',
      license_number: 'DMC-2020-12345',
      issuing_authority: 'Delhi Medical Council',
      hospital: null,
      specialty: null,
    })
    expect(payload).not.toHaveProperty('role')
    // the (mocked) session has no user, so the status page sends us to sign in
    expect(await screen.findByText('login')).toBeInTheDocument()
  })

  it('patients register exactly as before', async () => {
    const user = userEvent.setup()
    const register = vi.fn().mockResolvedValue({})
    renderAt('/register', { register })
    await fillAccount(user)
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    await waitFor(() => expect(register).toHaveBeenCalledTimes(1))
    expect(register.mock.calls[0][0]).toEqual({
      full_name: 'Dr. New',
      email: 'dr.new@test.local',
      password: 'Secur3pass',
      account_type: 'patient',
    })
    expect(await screen.findByText('profile')).toBeInTheDocument()
  })
})

describe('Doctor application status', () => {
  it('shows the under-review screen to a pending applicant', () => {
    renderAt('/application', { user: applicant() })
    expect(
      screen.getByRole('heading', { name: 'Your application is under review' }),
    ).toBeInTheDocument()
    expect(screen.getByText('DMC-2020-12345')).toBeInTheDocument()
    expect(screen.getByText('Not uploaded')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Upload document/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Check status/ })).toBeInTheDocument()
  })

  it('shows the rejection reason to a rejected applicant', () => {
    renderAt('/application', {
      user: applicant({ status: 'rejected', rejection_reason: 'Licence not found in register.' }),
    })
    expect(
      screen.getByRole('heading', { name: 'Your application was not approved' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Licence not found in register.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Upload document/ })).not.toBeInTheDocument()
  })

  it('keeps applicants away from doctor pages', () => {
    renderAt('/patients', { user: applicant() })
    expect(screen.queryByText('patient list')).not.toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Your application is under review' }),
    ).toBeInTheDocument()
  })

  it('sends approved doctors on to the app', () => {
    renderAt('/application', {
      user: { ...applicant({ status: 'approved' }), role: 'doctor' },
    })
    expect(screen.getByText('dashboard')).toBeInTheDocument()
  })
})
