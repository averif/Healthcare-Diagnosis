import { zodResolver } from '@hookform/resolvers/zod'
import {
  Activity,
  Droplet,
  HeartPulse,
  Search,
  Sparkles,
  Stethoscope,
  TriangleAlert,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router'
import { useAuth } from '@/auth/useAuth'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader, PageHeader } from '@/components/ui/Card'
import { Alert, Badge, FullPageSpinner } from '@/components/ui/Feedback'
import { Field, Input, Select } from '@/components/ui/Form'
import { errorMessage, fieldErrors } from '@/lib/api'
import { buildSchema, emptyValues, EXAMPLES, toInputs } from '@/lib/assessment'
import { useCreatePrediction, useModules, usePatient, usePatients } from '@/lib/queries'
import { cn, pct } from '@/lib/utils'
import type { Disease, FeatureSpec, PredictionModule, SymptomOption } from '@/types/api'

const ICONS = { diabetes: Droplet, heart: HeartPulse, liver: Activity, symptom: Stethoscope }

// ---- module picker ------------------------------------------------------------------------

export function AssessIndexPage() {
  const { data: modules, isPending, error } = useModules()
  const [params] = useSearchParams()
  const suffix = params.get('patient') ? `?patient=${params.get('patient')}` : ''
  if (isPending) return <FullPageSpinner />
  if (error) return <Alert tone="error">{errorMessage(error)}</Alert>

  return (
    <>
      <PageHeader
        title="New assessment"
        description="Choose what you would like to check. Each module takes about a minute."
      />
      <div className="grid gap-4 md:grid-cols-2">
        {modules.map((m) => {
          const Icon = ICONS[m.disease]
          return (
            <Link
              key={m.disease}
              to={`/assess/${m.disease}${suffix}`}
              className="group rounded-xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:border-brand-500 hover:shadow-md"
            >
              <div className="mb-4 flex items-center justify-between">
                <div className="rounded-lg bg-brand-50 p-3 text-brand-600">
                  <Icon className="size-6" aria-hidden />
                </div>
                <Badge className="bg-zinc-100 text-zinc-600">
                  {m.algorithm.replace('Classifier', '')} · v{m.version}
                </Badge>
              </div>
              <h2 className="text-lg font-semibold text-zinc-900 group-hover:text-brand-700">
                {m.title}
              </h2>
              <p className="mt-1 text-sm text-zinc-600">{m.description}</p>
              <p className="mt-3 text-xs text-zinc-500">
                {m.disease === 'symptom'
                  ? `${m.symptoms?.length ?? 0} symptoms · test accuracy ${pct(m.test_metrics.accuracy)}`
                  : `${m.features.length} inputs · test accuracy ${pct(m.test_metrics.accuracy)}`}
              </p>
            </Link>
          )
        })}
      </div>
    </>
  )
}

// ---- assessment form ----------------------------------------------------------------------

function ClinicalForm({
  module,
  onSubmit,
  submitting,
  serverErrors,
}: {
  module: PredictionModule
  onSubmit: (inputs: object) => void
  submitting: boolean
  serverErrors: Record<string, string>
}) {
  const schema = useMemo(() => buildSchema(module.features), [module.features])
  const { register, handleSubmit, reset, formState } = useForm<Record<string, string>>({
    resolver: zodResolver(schema),
    defaultValues: emptyValues(module.features),
  })

  const renderControl = (f: FeatureSpec) => {
    const error = formState.errors[f.name]?.message ?? serverErrors[f.name]
    const props = { id: f.name, 'aria-invalid': !!error, ...register(f.name) }
    const hint =
      f.kind === 'numeric'
        ? [f.help, `Range ${f.min}–${f.max}${f.unit ? ` ${f.unit}` : ''}`]
            .filter(Boolean)
            .join('. ')
        : f.help
    return (
      <Field
        key={f.name}
        id={f.name}
        label={f.label}
        required={f.required}
        hint={hint}
        error={error}
      >
        {f.kind === 'numeric' ? (
          <div className="relative">
            <Input type="number" step="any" inputMode="decimal" className="pr-16" {...props} />
            {f.unit && (
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-zinc-400">
                {f.unit}
              </span>
            )}
          </div>
        ) : (
          <Select {...props}>
            <option value="">Select…</option>
            {Object.entries(f.choices).map(([code, label]) => (
              <option key={code} value={code}>
                {label.charAt(0).toUpperCase() + label.slice(1)}
              </option>
            ))}
          </Select>
        )}
      </Field>
    )
  }

  return (
    <form onSubmit={handleSubmit((values) => onSubmit(toInputs(values)))} noValidate>
      <Card>
        <CardHeader
          title="Clinical information"
          description="Enter values from your most recent test results. Optional fields can be left blank."
          action={
            EXAMPLES[module.disease] && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => reset(EXAMPLES[module.disease])}
              >
                <Sparkles className="size-4" /> Fill example
              </Button>
            )
          }
        />
        <CardBody className="grid gap-5 sm:grid-cols-2">
          {module.features.map(renderControl)}
        </CardBody>
        <div className="flex justify-end gap-3 border-t border-zinc-100 px-5 py-4">
          <Button
            type="button"
            variant="secondary"
            onClick={() => reset(emptyValues(module.features))}
          >
            Clear
          </Button>
          <Button type="submit" loading={submitting}>
            Get assessment
          </Button>
        </div>
      </Card>
    </form>
  )
}

function SymptomPicker({
  symptoms,
  onSubmit,
  submitting,
  serverError,
}: {
  symptoms: SymptomOption[]
  onSubmit: (inputs: object) => void
  submitting: boolean
  serverError?: string
}) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [touched, setTouched] = useState(false)
  const byName = useMemo(() => new Map(symptoms.map((s) => [s.name, s])), [symptoms])
  const filtered = symptoms.filter((s) =>
    s.label.toLowerCase().includes(query.toLowerCase().trim()),
  )
  const toggle = (name: string) =>
    setSelected((cur) => (cur.includes(name) ? cur.filter((n) => n !== name) : [...cur, name]))
  const redFlags = selected.filter((n) => byName.get(n)?.red_flag)
  const tooFew = selected.length < 2

  return (
    <Card>
      <CardHeader
        title="Your symptoms"
        description="Select every symptom you have (at least two). Search to find them quickly."
      />
      <CardBody className="space-y-4">
        <div className="flex min-h-12 flex-wrap gap-2 rounded-lg border border-dashed border-zinc-300 p-2">
          {selected.length === 0 && (
            <span className="px-1 py-1 text-sm text-zinc-400">No symptoms selected yet</span>
          )}
          {selected.map((name) => {
            const s = byName.get(name)!
            return (
              <button
                key={name}
                type="button"
                onClick={() => toggle(name)}
                className={cn(
                  'flex cursor-pointer items-center gap-1 rounded-full px-3 py-1 text-sm',
                  s.red_flag ? 'bg-red-100 text-red-800' : 'bg-brand-100 text-brand-800',
                )}
                aria-label={`Remove ${s.label}`}
              >
                {s.label} <X className="size-3.5" />
              </button>
            )
          })}
        </div>

        {redFlags.length > 0 && (
          <Alert tone="error" title="Some of these symptoms can be serious">
            {redFlags.map((n) => byName.get(n)!.label).join(', ')}: if they are severe or sudden,
            call emergency services now instead of using this tool.
          </Alert>
        )}

        <div className="relative">
          <Search className="pointer-events-none absolute top-2.5 left-3 size-5 text-zinc-400" />
          <Input
            placeholder="Search symptoms, e.g. fever, cough, rash"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10"
            aria-label="Search symptoms"
          />
        </div>
        <div className="grid max-h-80 gap-1 overflow-y-auto rounded-lg border border-zinc-200 p-2 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => (
            <label
              key={s.name}
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-zinc-50',
                selected.includes(s.name) && 'bg-brand-50',
              )}
            >
              <input
                type="checkbox"
                checked={selected.includes(s.name)}
                onChange={() => toggle(s.name)}
                className="accent-brand-600"
              />
              <span className="text-zinc-700">{s.label}</span>
              {s.red_flag && (
                <TriangleAlert className="size-3.5 text-red-500" aria-label="red flag" />
              )}
            </label>
          ))}
          {filtered.length === 0 && (
            <p className="col-span-full p-4 text-center text-sm text-zinc-500">
              No symptom matches “{query}”.
            </p>
          )}
        </div>
        {touched && tooFew && <p className="text-sm text-red-600">Select at least two symptoms.</p>}
        {serverError && <p className="text-sm text-red-600">{serverError}</p>}
      </CardBody>
      <div className="flex items-center justify-between border-t border-zinc-100 px-5 py-4">
        <span className="text-sm text-zinc-500">{selected.length} selected</span>
        <Button
          loading={submitting}
          onClick={() => {
            setTouched(true)
            if (!tooFew) onSubmit({ symptoms: selected })
          }}
        >
          Check symptoms
        </Button>
      </div>
    </Card>
  )
}

function PatientSelector({ disease }: { disease: string }) {
  const navigate = useNavigate()
  const { data } = usePatients({ page_size: 100 })
  return (
    <Card className="mb-6">
      <CardBody>
        <Field
          id="patient"
          label="Patient"
          required
          hint="Doctors run assessments for their assigned patients."
        >
          <Select
            id="patient"
            defaultValue=""
            onChange={(e) => navigate(`/assess/${disease}?patient=${e.target.value}`)}
          >
            <option value="" disabled>
              Choose a patient…
            </option>
            {data?.items.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
              </option>
            ))}
          </Select>
        </Field>
      </CardBody>
    </Card>
  )
}

export function AssessFormPage() {
  const { disease } = useParams<{ disease: Disease }>()
  const [params] = useSearchParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const patientId = Number(params.get('patient')) || undefined
  const { data: modules, isPending } = useModules()
  const patient = usePatient(patientId ?? 0)
  const create = useCreatePrediction()
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({})

  if (isPending) return <FullPageSpinner />
  const module = modules?.find((m) => m.disease === disease)
  if (!module) return <Navigate to="/assess" replace />
  const isDoctor = user?.role === 'doctor'
  const Icon = ICONS[module.disease]

  const submit = (inputs: object) => {
    setServerErrors({})
    create.mutate(
      { disease: module.disease, inputs, patient_id: patientId },
      {
        onSuccess: (prediction) => navigate(`/predictions/${prediction.id}`),
        onError: (err) => setServerErrors(fieldErrors(err)),
      },
    )
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <Icon className="size-7 text-brand-600" aria-hidden /> {module.title}
          </span>
        }
        description={
          isDoctor && patient.data ? `Assessment for ${patient.data.full_name}` : module.description
        }
        action={
          <Link
            to={`/assess${patientId ? `?patient=${patientId}` : ''}`}
            className="text-sm text-brand-700 hover:underline"
          >
            Change module
          </Link>
        }
      />
      {isDoctor && !patientId ? (
        <PatientSelector disease={module.disease} />
      ) : (
        <>
          {create.error && !Object.keys(serverErrors).length && (
            <Alert tone="error" className="mb-4">
              {errorMessage(create.error)}
            </Alert>
          )}
          {module.disease === 'symptom' ? (
            <SymptomPicker
              symptoms={module.symptoms ?? []}
              onSubmit={submit}
              submitting={create.isPending}
              serverError={serverErrors.symptoms}
            />
          ) : (
            <ClinicalForm
              module={module}
              onSubmit={submit}
              submitting={create.isPending}
              serverErrors={serverErrors}
            />
          )}
          <p className="mt-4 text-xs text-zinc-500">
            Model: {module.algorithm} v{module.version}. {module.limitations[0]}
          </p>
        </>
      )}
    </div>
  )
}
