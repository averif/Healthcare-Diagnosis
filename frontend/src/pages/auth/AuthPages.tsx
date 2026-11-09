import { zodResolver } from '@hookform/resolvers/zod'
import { HeartPulse } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { z } from 'zod'
import { useAuth } from '@/auth/useAuth'
import { Disclaimer } from '@/components/layout/Disclaimer'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Alert } from '@/components/ui/Feedback'
import { Field, Input } from '@/components/ui/Form'
import { errorMessage, fieldErrors } from '@/lib/api'

function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-brand-50 via-white to-slate-50 px-4 py-10">
      <Link to="/" className="mb-6 flex items-center gap-2 text-lg font-semibold text-brand-700">
        <HeartPulse className="size-7" aria-hidden /> MediAssist CDSS
      </Link>
      <Card className="w-full max-w-md p-6 sm:p-8">
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        <p className="mt-1 mb-6 text-sm text-slate-500">{subtitle}</p>
        {children}
      </Card>
      <div className="mt-6 w-full max-w-md">
        <Disclaimer />
      </div>
    </div>
  )
}

// ---- login --------------------------------------------------------------------------------

const loginSchema = z.object({
  email: z.email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
})
type LoginValues = z.infer<typeof loginSchema>

const DEMO_ACCOUNTS = [
  { label: 'Patient', email: 'patient@mediassist.test' },
  { label: 'Doctor', email: 'doctor@mediassist.test' },
  { label: 'Admin', email: 'admin@mediassist.test' },
]

export function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [error, setError] = useState<string | null>(null)
  const [signingIn, setSigningIn] = useState(false) // our navigate() picks the next page
  const form = useForm<LoginValues>({ resolver: zodResolver(loginSchema) })
  const { register, handleSubmit, setValue, formState } = form

  if (user && !signingIn) return <Navigate to="/dashboard" replace />

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setError(null)
    setSigningIn(true)
    try {
      await login(email, password)
      const from = (location.state as { from?: string } | null)?.from
      navigate(from && from !== '/login' ? from : '/dashboard', { replace: true })
    } catch (err) {
      setSigningIn(false)
      setError(errorMessage(err))
    }
  })

  return (
    <AuthShell title="Sign in" subtitle="Welcome back. Sign in to view your assessments.">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error && <Alert tone="error">{error}</Alert>}
        <Field id="email" label="Email" required error={formState.errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            aria-invalid={!!formState.errors.email}
            {...register('email')}
          />
        </Field>
        <Field id="password" label="Password" required error={formState.errors.password?.message}>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            aria-invalid={!!formState.errors.password}
            {...register('password')}
          />
        </Field>
        <Button type="submit" className="w-full" loading={formState.isSubmitting}>
          Sign in
        </Button>
      </form>

      {import.meta.env.DEV && (
        <div className="mt-6 border-t border-slate-200 pt-4">
          <p className="mb-2 text-xs font-medium text-slate-500">
            Demo accounts (development only)
          </p>
          <div className="flex flex-wrap gap-2">
            {DEMO_ACCOUNTS.map((account) => (
              <Button
                key={account.email}
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setValue('email', account.email)
                  setValue('password', import.meta.env.VITE_DEMO_PASSWORD ?? '')
                }}
              >
                {account.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      <p className="mt-6 text-center text-sm text-slate-500">
        New patient?{' '}
        <Link to="/register" className="font-medium text-brand-700 hover:underline">
          Create an account
        </Link>
      </p>
    </AuthShell>
  )
}

// ---- register -----------------------------------------------------------------------------

const registerSchema = z
  .object({
    full_name: z.string().trim().min(2, 'Enter your full name.').max(120),
    email: z.email('Enter a valid email address.'),
    password: z
      .string()
      .min(8, 'Use at least 8 characters.')
      .regex(/[A-Za-z]/, 'Include at least one letter.')
      .regex(/\d/, 'Include at least one number.'),
    confirm: z.string(),
    consent: z.literal(true, { error: 'Please confirm you understand this is not a diagnosis.' }),
  })
  .refine((v) => v.password === v.confirm, {
    path: ['confirm'],
    message: 'Passwords do not match.',
  })
type RegisterValues = z.infer<typeof registerSchema>

export function RegisterPage() {
  const { user, register: createAccount } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [registering, setRegistering] = useState(false) // our navigate() picks the next page
  const {
    register,
    handleSubmit,
    formState,
    setError: setFieldError,
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
  })

  if (user && !registering) return <Navigate to="/dashboard" replace />

  const onSubmit = handleSubmit(async (values) => {
    setError(null)
    setRegistering(true)
    try {
      await createAccount(values.full_name, values.email, values.password)
      navigate('/profile?welcome=1', { replace: true })
    } catch (err) {
      setRegistering(false)
      const fields = fieldErrors(err)
      for (const [name, message] of Object.entries(fields)) {
        setFieldError(name as keyof RegisterValues, { message })
      }
      if (!Object.keys(fields).length) setError(errorMessage(err))
    }
  })

  const e = formState.errors
  return (
    <AuthShell
      title="Create a patient account"
      subtitle="Get explainable, preliminary health risk assessments."
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error && <Alert tone="error">{error}</Alert>}
        <Field id="full_name" label="Full name" required error={e.full_name?.message}>
          <Input
            id="full_name"
            autoComplete="name"
            aria-invalid={!!e.full_name}
            {...register('full_name')}
          />
        </Field>
        <Field id="email" label="Email" required error={e.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            aria-invalid={!!e.email}
            {...register('email')}
          />
        </Field>
        <Field
          id="password"
          label="Password"
          required
          hint="At least 8 characters with a letter and a number."
          error={e.password?.message}
        >
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            aria-invalid={!!e.password}
            {...register('password')}
          />
        </Field>
        <Field id="confirm" label="Confirm password" required error={e.confirm?.message}>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            aria-invalid={!!e.confirm}
            {...register('confirm')}
          />
        </Field>
        <div>
          <label className="flex items-start gap-2 text-sm text-slate-600">
            <input type="checkbox" className="mt-0.5 accent-brand-600" {...register('consent')} />I
            understand MediAssist gives preliminary, AI-generated assessments for decision support
            and is not a medical diagnosis.
          </label>
          {e.consent && <p className="mt-1 text-xs text-red-600">{e.consent.message}</p>}
        </div>
        <Button type="submit" className="w-full" loading={formState.isSubmitting}>
          Create account
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">
        Already registered?{' '}
        <Link to="/login" className="font-medium text-brand-700 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  )
}
