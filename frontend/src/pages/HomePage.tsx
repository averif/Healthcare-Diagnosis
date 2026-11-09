import { useQuery } from '@tanstack/react-query'
import { Activity, Droplet, HeartPulse, Stethoscope } from 'lucide-react'
import { getHealth } from '@/lib/api'

const modules = [
  { name: 'Diabetes', icon: Droplet, desc: 'Glucose, BMI, insulin and other clinical parameters' },
  { name: 'Heart Disease', icon: HeartPulse, desc: 'Cholesterol, blood pressure, ECG and more' },
  { name: 'Liver Disease', icon: Activity, desc: 'Bilirubin, enzymes and protein levels' },
  { name: 'Symptom Checker', icon: Stethoscope, desc: 'General conditions from reported symptoms' },
]

function ApiStatus() {
  const health = useQuery({ queryKey: ['health'], queryFn: getHealth, retry: false })

  if (health.isPending) return <span className="text-slate-500">checking…</span>
  if (health.isError) return <span className="font-medium text-risk-high">offline</span>
  return <span className="font-medium text-risk-low">online (v{health.data.version})</span>
}

export function HomePage() {
  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight">
          AI-Powered Healthcare Diagnosis &amp; Clinical Decision Support
        </h1>
        <p className="max-w-2xl text-slate-600">
          Explainable, Decision Tree based preliminary predictions for multiple diseases, with
          patient history, doctor review and downloadable reports.
        </p>
        <p className="text-sm" data-testid="api-status">
          API status: <ApiStatus />
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {modules.map(({ name, icon: Icon, desc }) => (
          <article key={name} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <Icon className="mb-3 size-8 text-brand-600" aria-hidden />
            <h2 className="font-semibold">{name}</h2>
            <p className="mt-1 text-sm text-slate-600">{desc}</p>
          </article>
        ))}
      </section>
    </div>
  )
}
