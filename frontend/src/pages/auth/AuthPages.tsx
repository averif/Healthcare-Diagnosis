import { zodResolver } from '@hookform/resolvers/zod'
import { Check, LogOut, RefreshCw, Stethoscope, Upload, User as UserIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { z } from 'zod'
import { useAuth } from '@/auth/useAuth'
import { Disclaimer } from '@/components/layout/Disclaimer'
import { Logo } from '@/components/layout/Logo'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Feedback'
import { Field, Input } from '@/components/ui/Form'
import { errorMessage, fieldErrors } from '@/lib/api'
import {
  collapse,
  doctorFieldsSchema,
  DOCUMENT_ACCEPT,
  documentError,
  isDoctorApplicant,
} from '@/lib/doctorApplication'
import { uploadDoctorDocument } from '@/lib/queries'
import { cn, fmtDate } from '@/lib/utils'
import type { RegisterPayload } from '@/types/api'

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

type AccountType = 'patient' | 'doctor'

const accountFields = {
  full_name: z.string().trim().min(2, 'Enter your full name.').max(120),
  email: z.email('Enter a valid email address.'),
  password: z
    .string()
    .min(8, 'Use at least 8 characters.')
    .regex(/[A-Za-z]/, 'Include at least one letter.')
    .regex(/\d/, 'Include at least one number.'),
  confirm: z.string(),
  consent: z.literal(true, { error: 'Please confirm you understand this is not a diagnosis.' }),
}

// A union (not a conditional refine) so licence errors show together with the other fields
const registerSchema = z
  .discriminatedUnion('account_type', [
    z.object({
      ...accountFields,
      account_type: z.literal('patient'),
      license_number: z.string().optional(),
      issuing_authority: z.string().optional(),
      hospital: z.string().optional(),
      specialty: z.string().optional(),
    }),
    z.object({ ...accountFields, account_type: z.literal('doctor'), ...doctorFieldsSchema.shape }),
  ])
  .refine((v) => v.password === v.confirm, {
    path: ['confirm'],
    message: 'Passwords do not match.',
  })
type RegisterValues = z.infer<typeof registerSchema>

function toPayload(values: RegisterValues): RegisterPayload {
  const base = {
    full_name: values.full_name,
    email: values.email,
    password: values.password,
    account_type: values.account_type,
  }
  if (values.account_type === 'patient') return base
  const optional = (v?: string) => (v && collapse(v)) || null
  return {
    ...base,
    license_number: collapse(values.license_number ?? '').toUpperCase(),
    issuing_authority: collapse(values.issuing_authority ?? ''),
    hospital: optional(values.hospital),
    specialty: optional(values.specialty),
  }
}

function AccountTypeToggle({
  value,
  onChange,
}: {
  value: AccountType
  onChange: (value: AccountType) => void
}) {
  const options: { value: AccountType; label: string; icon: ReactNode }[] = [
    { value: 'patient', label: 'Patient', icon: <UserIcon className="size-4" aria-hidden /> },
    { value: 'doctor', label: 'Doctor', icon: <Stethoscope className="size-4" aria-hidden /> },
  ]
  return (
    <div
      role="radiogroup"
      aria-label="Account type"
      className="grid grid-cols-2 gap-1 rounded-xl border border-zinc-200/80 bg-zinc-100/70 p-1"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'flex cursor-pointer items-center justify-center gap-2 rounded-lg py-1.5 text-[13px] font-medium transition-all',
            value === option.value
              ? 'bg-white text-zinc-900 shadow-xs ring-1 ring-zinc-200'
              : 'text-zinc-500 hover:text-zinc-800',
          )}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function RegisterPage() {
  const { user, register: createAccount, refreshUser } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [registering, setRegistering] = useState(false) // our navigate() picks the next page
  const [document, setDocument] = useState<File | null>(null)
  const [documentIssue, setDocumentIssue] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState,
    setValue,
    control,
    setError: setFieldError,
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      account_type: 'patient',
      license_number: '',
      issuing_authority: '',
      hospital: '',
      specialty: '',
    },
  })
  const accountType = useWatch({ control, name: 'account_type' })
  const isDoctor = accountType === 'doctor'

  if (user && !registering) return <Navigate to="/dashboard" replace />

  const onSubmit = handleSubmit(async (values) => {
    if (isDoctor && documentIssue) return
    setError(null)
    setRegistering(true)
    try {
      await createAccount(toPayload(values))
    } catch (err) {
      setRegistering(false)
      const fields = fieldErrors(err)
      for (const [name, message] of Object.entries(fields)) {
        setFieldError(name as keyof RegisterValues, { message })
      }
      if (!Object.keys(fields).length) setError(errorMessage(err))
      return
    }
    if (values.account_type === 'patient') {
      navigate('/profile?welcome=1', { replace: true })
      return
    }
    // The account exists now; a failed upload can be retried from the status page
    let uploadError: string | null = null
    if (document) {
      try {
        await uploadDoctorDocument(document)
        await refreshUser()
      } catch (err) {
        uploadError = errorMessage(err, 'The document could not be uploaded.')
      }
    }
    navigate('/application', { replace: true, state: { uploadError } })
  })

  const e = formState.errors
  return (
    <AuthShell
      title={isDoctor ? 'Apply for a doctor account' : 'Create a patient account'}
      subtitle={
        isDoctor
          ? 'Review your patients’ assessments once your registration is verified.'
          : 'Get explainable, preliminary health risk assessments.'
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <AccountTypeToggle
          value={accountType}
          onChange={(value) => setValue('account_type', value, { shouldValidate: false })}
        />
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

        {isDoctor && (
          <fieldset className="space-y-4 border-t border-zinc-200 pt-4">
            <legend className="sr-only">Proof of registration</legend>
            <Alert tone="info" title="Doctor accounts are verified by an administrator">
              You can sign in straight away, but patient records stay locked until your registration
              has been checked.
            </Alert>
            <Field
              id="license_number"
              label="Licence number"
              required
              hint="Your medical registration number."
              error={e.license_number?.message}
            >
              <Input
                id="license_number"
                autoComplete="off"
                maxLength={50}
                aria-invalid={!!e.license_number}
                {...register('license_number')}
              />
            </Field>
            <Field
              id="issuing_authority"
              label="Issuing authority"
              required
              hint="For example, your state medical council."
              error={e.issuing_authority?.message}
            >
              <Input
                id="issuing_authority"
                maxLength={120}
                aria-invalid={!!e.issuing_authority}
                {...register('issuing_authority')}
              />
            </Field>
            <Field id="hospital" label="Hospital" error={e.hospital?.message}>
              <Input
                id="hospital"
                autoComplete="organization"
                maxLength={120}
                aria-invalid={!!e.hospital}
                {...register('hospital')}
              />
            </Field>
            <Field id="specialty" label="Specialty" error={e.specialty?.message}>
              <Input
                id="specialty"
                maxLength={80}
                aria-invalid={!!e.specialty}
                {...register('specialty')}
              />
            </Field>
            <Field
              id="document"
              label="Registration certificate"
              hint="PDF, JPG or PNG, up to 5 MB. Speeds up verification."
              error={documentIssue ?? undefined}
            >
              <Input
                id="document"
                type="file"
                accept={DOCUMENT_ACCEPT}
                className="h-auto py-1.5 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-100 file:px-2.5 file:py-1 file:text-xs file:font-medium"
                aria-invalid={!!documentIssue}
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null
                  setDocument(file)
                  setDocumentIssue(file ? documentError(file) : null)
                }}
              />
            </Field>
          </fieldset>
        )}

        <div>
          <label className="flex items-start gap-2 text-sm text-zinc-600">
            <input type="checkbox" className="mt-0.5 accent-brand-600" {...register('consent')} />I
            understand MediAssist gives preliminary, AI-generated assessments for decision support
            and is not a medical diagnosis.
          </label>
          {e.consent && <p className="mt-1 text-xs text-red-600">{e.consent.message}</p>}
        </div>
        <Button type="submit" className="w-full" loading={formState.isSubmitting}>
          {isDoctor ? 'Submit application' : 'Create account'}
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

// ---- doctor application status ----------------------------------------------------------

function DocumentUpload({ initialError }: { initialError: string | null }) {
  const { refreshUser } = useAuth()
  const [file, setFile] = useState<File | null>(null)
  const [issue, setIssue] = useState<string | null>(initialError)
  const [uploading, setUploading] = useState(false)

  const upload = async () => {
    if (!file) return
    setUploading(true)
    try {
      await uploadDoctorDocument(file)
      await refreshUser()
    } catch (err) {
      setIssue(errorMessage(err, 'The document could not be uploaded.'))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-3">
      <Field
        id="document"
        label="Registration certificate"
        hint="PDF, JPG or PNG, up to 5 MB."
        error={issue ?? undefined}
      >
        <Input
          id="document"
          type="file"
          accept={DOCUMENT_ACCEPT}
          className="h-auto py-1.5 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-100 file:px-2.5 file:py-1 file:text-xs file:font-medium"
          aria-invalid={!!issue}
          onChange={(event) => {
            const next = event.target.files?.[0] ?? null
            setFile(next)
            setIssue(next ? documentError(next) : null)
          }}
        />
      </Field>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={!file || !!issue}
        loading={uploading}
        onClick={upload}
      >
        <Upload className="size-4" aria-hidden /> Upload document
      </Button>
    </div>
  )
}

export function ApplicationStatusPage() {
  const { user, refreshUser, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [checking, setChecking] = useState(false)
  const uploadError = (location.state as { uploadError?: string | null } | null)?.uploadError

  const application = user?.doctor_application
  if (!user || !application || !isDoctorApplicant(user)) {
    return <Navigate to="/dashboard" replace />
  }
  const rejected = application.status === 'rejected'

  const checkAgain = async () => {
    setChecking(true)
    try {
      await refreshUser() // an approval swaps this page for the dashboard
    } finally {
      setChecking(false)
    }
  }
  const signOut = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <AuthShell
      title={rejected ? 'Your application was not approved' : 'Your application is under review'}
      subtitle={
        rejected
          ? 'An administrator could not verify your registration.'
          : 'An administrator is verifying your registration. Patient records stay locked until then.'
      }
    >
      <div className="space-y-5">
        {rejected ? (
          <Alert tone="error" title="Reason given">
            {application.rejection_reason}
          </Alert>
        ) : (
          <Alert tone="info" title="Pending verification">
            Submitted {fmtDate(application.submitted_at)}. Check back later; you will get access as
            soon as you are approved.
          </Alert>
        )}

        <dl className="divide-y divide-zinc-100 rounded-xl border border-zinc-200/80 text-sm">
          {[
            ['Licence number', application.license_number],
            ['Issuing authority', application.issuing_authority],
            ['Hospital', application.hospital ?? '—'],
            ['Specialty', application.specialty ?? '—'],
            ['Document', application.has_document ? 'Received' : 'Not uploaded'],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4 px-4 py-2.5">
              <dt className="text-zinc-500">{label}</dt>
              <dd className="text-right font-medium text-zinc-800">{value}</dd>
            </div>
          ))}
        </dl>

        {!rejected && !application.has_document && (
          <DocumentUpload initialError={uploadError ?? null} />
        )}

        <div className="flex flex-wrap gap-2 border-t border-zinc-200 pt-4">
          {!rejected && (
            <Button type="button" variant="secondary" loading={checking} onClick={checkAgain}>
              <RefreshCw className="size-4" aria-hidden /> Check status
            </Button>
          )}
          <Button type="button" variant="ghost" onClick={signOut}>
            <LogOut className="size-4" aria-hidden /> Sign out
          </Button>
        </div>
        {rejected && (
          <p className="text-[13px] text-zinc-500">
            If you think this is a mistake, contact the administrator with your registration
            details.
          </p>
        )}
      </div>
    </AuthShell>
  )
}
