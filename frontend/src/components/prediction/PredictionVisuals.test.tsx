import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { RequireAuth } from '@/auth/RequireAuth'
import { AuthContext, type AuthState } from '@/auth/context'
import type { Explanation, User } from '@/types/api'
import { ExplanationChart, RiskGauge } from './PredictionVisuals'

const explanation: Explanation = {
  target_class: 1,
  base_rate: 0.5,
  probability: 0.88,
  path_length: 3,
  reasons: [
    {
      feature: 'Glucose',
      label: 'Plasma glucose',
      value: '168 mg/dL',
      condition: 'above 166.5 mg/dL',
      text: 'Plasma glucose is 168 mg/dL, above 166.5 mg/dL',
      contribution: 0.458,
      imputed: false,
    },
    {
      feature: 'Insulin',
      label: 'Insulin',
      value: '125 µU/mL',
      condition: 'at most 139.5 µU/mL',
      text: 'Insulin is 125 µU/mL',
      contribution: -0.036,
      imputed: true,
    },
    {
      feature: 'Age',
      label: 'Age',
      value: '47',
      condition: '',
      text: 'Tiny effect',
      contribution: 0.001,
      imputed: false,
    },
  ],
}

describe('ExplanationChart', () => {
  it('lists factors with signed effects and hides negligible ones', () => {
    render(<ExplanationChart explanation={explanation} />)
    expect(screen.getByText(/baseline of 50%/)).toBeInTheDocument()
    expect(screen.getByText('45.8 pts')).toHaveClass('text-red-600')
    expect(screen.getByText('3.6 pts')).toHaveClass('text-emerald-600')
    expect(screen.getByText('(estimated)')).toBeInTheDocument()
    expect(screen.queryByText('Tiny effect')).not.toBeInTheDocument()
  })
})

describe('RiskGauge', () => {
  it('shows the probability and risk band', () => {
    render(<RiskGauge probability={0.88} risk="high" />)
    expect(screen.getByText('88%')).toBeInTheDocument()
    expect(screen.getByText('High risk')).toBeInTheDocument()
  })
})

describe('RequireAuth', () => {
  const user = { id: 1, role: 'patient', full_name: 'Test' } as User
  const renderAt = (auth: Partial<AuthState>, roles?: User['role'][]) =>
    render(
      <AuthContext.Provider
        value={{ user: null, loading: false, signedOut: false, ...auth } as AuthState}
      >
        <MemoryRouter initialEntries={['/secret']}>
          <Routes>
            <Route
              path="/secret"
              element={
                <RequireAuth roles={roles}>
                  <p>secret page</p>
                </RequireAuth>
              }
            />
            <Route path="/login" element={<p>login page</p>} />
            <Route path="/dashboard" element={<p>dashboard page</p>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    )

  it('sends signed-out visitors to the login page', () => {
    renderAt({})
    expect(screen.getByText('login page')).toBeInTheDocument()
  })

  it('sends users without the right role to their dashboard', () => {
    renderAt({ user }, ['admin'])
    expect(screen.getByText('dashboard page')).toBeInTheDocument()
  })

  it('renders the page for an allowed role', () => {
    renderAt({ user }, ['patient'])
    expect(screen.getByText('secret page')).toBeInTheDocument()
  })
})
