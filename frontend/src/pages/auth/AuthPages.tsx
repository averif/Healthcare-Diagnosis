import { zodResolver } from '@hookform/resolvers/zod'
import { Check } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { z } from 'zod'
import { useAuth } from '@/auth/useAuth'
import { Disclaimer } from '@/components/layout/Disclaimer'
import { Logo } from '@/components/layout/Logo'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Feedback'
import { Field, Input } from '@/components/ui/Form'
import { errorMessage, fieldErrors } from '@/lib/api'

const PANEL_POINTS = [
  'Exact, per-factor explanations for every result',
  'Reviewed by your assigned doctor',
  'Downloadable PDF reports and full history',
]

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
    <div className="grid min-h-screen bg-white lg:grid-cols-[1fr_1.05fr]">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Link to="/" className="w-fit">
          <Logo />
        </Link>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <h1 className="animate-fade-up text-[28px] font-semibold tracking-[-0.03em] text-zinc-950">
            {title}
          </h1>
          <p className="mt-2 mb-8 animate-fade-up text-[15px] text-zinc-500">{subtitle}</p>
          <div className="animate-fade-up [animation-delay:60ms]">{children}</div>
        </div>
        <div className="mx-auto w-full max-w-sm">
          <Disclaimer />
        </div>
      </div>

      <aside className="relative hidden overflow-hidden bg-zinc-950 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          className="bg-grid pointer-events-none absolute inset-0 opacity-[0.07] invert"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -top-24 -right-24 size-[420px] rounded-full bg-brand-500/25 blur-3xl"
          aria-hidden
        />
        <p className="relative text-xs font-medium tracking-wider text-brand-300 uppercase">
          Clinical decision support
        </p>
        <div className="relative">
          <h2 className="max-w-md text-4xl leading-[1.1] font-semibold tracking-[-0.03em] text-white">
            Every result comes{' '}
            <span className="font-display font-normal text-brand-300 italic">
              with its reasons.
            </span>
          </h2>
          <div className="mt-10 max-w-md rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur">
            <div className="flex items-baseline justify-between">
              <p className="text-sm text-zinc-400">Heart disease</p>
              <p className="font-mono text-2xl text-white">98%</p>
            </div>
            <ul className="mt-4 space-y-3 text-[13px]">
              {[
                ['Thallium stress test is not normal', 29],
                ['Chest pain type is asymptomatic', 11],
                ['ST depression is 2.5 mm, above 0.45', 8],
              ].map(([text, pts]) => (
                <li key={text as string}>
                  <div className="flex justify-between text-zinc-300">
                    <span>{text}</span>
                    <span className="font-mono text-red-300">+{pts}</span>
                  </div>
                  <div className="mt-1.5 h-1 rounded-full bg-white/10">
                    <div
                      className="h-1 rounded-full bg-gradient-to-r from-red-400 to-red-500"
                      style={{ width: `${(Number(pts) / 30) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <ul className="relative space-y-2.5 text-sm text-zinc-400">
          {PANEL_POINTS.map((point) => (
            <li key={point} className="flex items-center gap-2.5">
              <Check className="size-4 text-brand-400" aria-hidden />
              {point}
            </li>
          ))}
        </ul>
      </aside>
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
        <div className="mt-6 border-t border-zinc-200 pt-4">
          <p className="mb-2 text-xs font-medium text-zinc-500">Demo accounts (development only)</p>
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

      <p className="mt-6 text-center text-sm text-zinc-500">
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
          <label className="flex items-start gap-2 text-sm text-zinc-600">
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
      <p className="mt-6 text-center text-sm text-zinc-500">
        Already registered?{' '}
        <Link to="/login" className="font-medium text-brand-700 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  )
}
