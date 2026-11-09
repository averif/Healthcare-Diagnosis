import { ArrowLeft, ClipboardCheck, FileDown, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { useAuth } from '@/auth/useAuth'
import { AssistantChat } from '@/components/prediction/AssistantChat'
import { ExplanationChart, RiskGauge } from '@/components/prediction/PredictionVisuals'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Alert, Badge, FullPageSpinner, StatusBadge } from '@/components/ui/Feedback'
import { Field, Select, Textarea } from '@/components/ui/Form'
import { errorMessage } from '@/lib/api'
import {
  downloadReportByCode,
  useDownloadReport,
  useModules,
  usePrediction,
  useReview,
} from '@/lib/queries'
import { DISEASE_LABEL, fmtDate, humanizeSymptom, pct } from '@/lib/utils'
import type { Prediction, Verdict } from '@/types/api'

const VERDICT_LABEL: Record<Verdict, string> = {
  agree: 'Agrees with the assessment',
  disagree: 'Disagrees with the assessment',
  inconclusive: 'Inconclusive, needs more information',
}

function ReviewPanel({ prediction, canReview }: { prediction: Prediction; canReview: boolean }) {
  const review = prediction.review
  const save = useReview(prediction.id)
  const [editing, setEditing] = useState(false)
  const [verdict, setVerdict] = useState<Verdict>(review?.verdict ?? 'agree')
  const [notes, setNotes] = useState(review?.notes ?? '')

  const showForm = canReview && (!review || editing)
  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <ClipboardCheck className="size-5 text-brand-600" aria-hidden /> Doctor review
          </span>
        }
        action={<StatusBadge status={prediction.status} />}
      />
      <CardBody>
        {review && !editing && (
          <div className="space-y-2 text-sm">
            <p>
              <span className="font-medium text-zinc-900">{review.doctor?.full_name}</span>{' '}
              <span className="text-zinc-500">· {fmtDate(review.created_at)}</span>
            </p>
            <p className="font-medium text-zinc-800">{VERDICT_LABEL[review.verdict]}</p>
            {review.notes && (
              <blockquote className="border-l-2 border-brand-200 pl-3 text-zinc-600 italic">
                {review.notes}
              </blockquote>
            )}
            {canReview && (
              <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
                Edit review
              </Button>
            )}
          </div>
        )}
        {!review && !canReview && (
          <p className="text-sm text-zinc-500">
            Your doctor has not reviewed this result yet. Their verdict and notes will appear here.
          </p>
        )}
        {showForm && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              save.mutate({ verdict, notes }, { onSuccess: () => setEditing(false) })
            }}
          >
            <Field id="verdict" label="Your verdict" required>
              <Select
                id="verdict"
                value={verdict}
                onChange={(e) => setVerdict(e.target.value as Verdict)}
              >
                {(Object.keys(VERDICT_LABEL) as Verdict[]).map((v) => (
                  <option key={v} value={v}>
                    {VERDICT_LABEL[v]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              id="notes"
              label="Notes for the patient"
              hint="Visible to the patient and printed on the report."
            >
              <Textarea
                id="notes"
                value={notes}
                maxLength={4000}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Agree. Please book an HbA1c test and follow up in 2 weeks."
              />
            </Field>
            {save.error && <Alert tone="error">{errorMessage(save.error)}</Alert>}
            <div className="flex gap-2">
              <Button type="submit" loading={save.isPending}>
                Save review
              </Button>
              {editing && (
                <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        )}
      </CardBody>
    </Card>
  )
}

function InputsCard({ prediction }: { prediction: Prediction }) {
  const { data: modules } = useModules()
  const module = modules?.find((m) => m.disease === prediction.disease)
  if (prediction.disease === 'symptom') {
    const symptoms = (prediction.input_data.symptoms as string[]) ?? []
    return (
      <Card>
        <CardHeader title="Reported symptoms" />
        <CardBody className="flex flex-wrap gap-2">
          {symptoms.map((s) => (
            <Badge key={s} className="bg-zinc-100 text-zinc-700">
              {humanizeSymptom(s)}
            </Badge>
          ))}
        </CardBody>
      </Card>
    )
  }
  return (
    <Card>
      <CardHeader title="Information provided" />
      <CardBody>
        <dl className="grid text-sm">
          {module?.features.map((f) => {
            const raw = prediction.input_data[f.name] as number | null
            const shown =
              raw === null || raw === undefined
                ? 'not provided'
                : f.kind === 'numeric'
                  ? `${raw} ${f.unit}`.trim()
                  : (f.choices[String(raw)] ?? String(raw))
            return (
              <div
                key={f.name}
                className="flex justify-between gap-4 border-b border-zinc-100 py-1.5"
              >
                <dt className="text-zinc-500">{f.label}</dt>
                <dd className={raw === null ? 'text-zinc-400 italic' : 'font-medium text-zinc-800'}>
                  {shown}
                </dd>
              </div>
            )
          })}
        </dl>
      </CardBody>
    </Card>
  )
}

export function PredictionDetailPage() {
  const id = Number(useParams().id)
  const { user } = useAuth()
  const { data: p, isPending, error } = usePrediction(id)
  const report = useDownloadReport(id)
  if (isPending) return <FullPageSpinner />
  if (error) return <Alert tone="error">{errorMessage(error, 'Assessment not found.')}</Alert>

  const isSymptom = p.disease === 'symptom'
  const canChat = user?.role === 'patient' || user?.role === 'doctor'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link
            to={user?.role === 'patient' ? '/history' : `/patients/${p.patient_id}`}
            className="mb-2 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800"
          >
            <ArrowLeft className="size-4" /> Back
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
            {DISEASE_LABEL[p.disease]} assessment
          </h1>
          <p className="text-sm text-zinc-500">
            {p.patient_name} · {fmtDate(p.created_at, true)}
            {p.created_by && ` · requested by ${p.created_by}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {p.report_codes.length > 0 && (
            <Button
              variant="secondary"
              onClick={() => downloadReportByCode(p.report_codes.at(-1)!)}
            >
              <FileDown className="size-4" /> Last report
            </Button>
          )}
          <Button loading={report.isPending} onClick={() => report.mutate()}>
            {!report.isPending && <FileDown className="size-4" />} Download PDF report
          </Button>
        </div>
      </div>
      {report.error && <Alert tone="error">{errorMessage(report.error)}</Alert>}

      {p.red_flags.length > 0 && (
        <Alert tone="error" title="Important warning">
          <ul className="list-inside list-disc">
            {p.red_flags.map((flag) => (
              <li key={flag}>{flag}</li>
            ))}
          </ul>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardBody className="flex flex-col items-center text-center">
            <p className="text-sm text-zinc-500">
              {isSymptom ? 'Most likely condition' : 'Result'}
            </p>
            <p className="mb-4 text-2xl font-bold text-zinc-900">{p.predicted_label}</p>
            <RiskGauge probability={p.probability} risk={p.risk_level} />
            {isSymptom && p.top_conditions && p.top_conditions.length > 1 && (
              <div className="mt-6 w-full text-left">
                <p className="mb-2 text-sm font-medium text-zinc-700">Other possibilities</p>
                <ul className="space-y-1.5 text-sm">
                  {p.top_conditions.slice(1).map((c) => (
                    <li key={c.condition} className="flex justify-between">
                      <span className="text-zinc-600">{c.condition}</span>
                      <span className="tabular-nums text-zinc-500">{pct(c.probability)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {p.model && (
              <p className="mt-6 text-xs text-zinc-400">
                {p.model.algorithm} v{p.model.version}
              </p>
            )}
          </CardBody>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader
            title="Why this result?"
            description={
              isSymptom
                ? 'Symptoms that most influenced the top condition.'
                : 'Factors that raised or lowered the estimated risk.'
            }
          />
          <CardBody>
            {p.explanation ? (
              <ExplanationChart explanation={p.explanation} />
            ) : (
              <p className="text-sm text-zinc-500">No explanation available.</p>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <TriangleAlert className="size-5 text-amber-500" aria-hidden /> What to do next
              </span>
            }
            description="General guidance, not medical advice."
          />
          <CardBody>
            <ul className="space-y-2 text-sm text-zinc-700">
              {p.guidance.map((g) => (
                <li key={g} className="flex gap-2">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-500" />
                  {g}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
        <ReviewPanel prediction={p} canReview={user?.role === 'doctor'} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <InputsCard prediction={p} />
        {canChat && <AssistantChat predictionId={p.id} />}
      </div>
    </div>
  )
}
