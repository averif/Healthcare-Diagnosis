import {
  Activity,
  BrainCircuit,
  Droplet,
  FileDown,
  HeartPulse,
  ShieldCheck,
  Stethoscope,
  UserCheck,
} from 'lucide-react'
import { Link, Navigate } from 'react-router'
import { useAuth } from '@/auth/useAuth'
import { Disclaimer } from '@/components/layout/Disclaimer'
import { buttonVariants } from '@/components/ui/buttonVariants'

const MODULES = [
  {
    name: 'Diabetes',
    icon: Droplet,
    desc: 'Glucose, BMI, insulin and 5 more clinical measurements',
  },
  {
    name: 'Heart disease',
    icon: HeartPulse,
    desc: 'Chest pain type, ECG, blood pressure and stress-test results',
  },
  { name: 'Liver disease', icon: Activity, desc: 'Bilirubin, liver enzymes and protein levels' },
  {
    name: 'Symptom checker',
    icon: Stethoscope,
    desc: '131 symptoms mapped to 41 common conditions',
  },
]

const FEATURES = [
  {
    icon: BrainCircuit,
    title: 'Explainable by design',
    desc: 'Decision Tree models show exactly which factors raised or lowered your risk, never a black box.',
  },
  {
    icon: UserCheck,
    title: 'Doctor in the loop',
    desc: 'Every result is reviewed by your assigned doctor, whose verdict and notes you can see.',
  },
  {
    icon: FileDown,
    title: 'Reports and history',
    desc: 'Track your assessments over time and download PDF reports to share with your clinician.',
  },
  {
    icon: ShieldCheck,
    title: 'Safety first',
    desc: 'Clinical range checks, red-flag symptom warnings, encrypted passwords and a full audit trail.',
  },
]

export function LandingPage() {
  const { user } = useAuth()
  if (user) return <Navigate to="/dashboard" replace />

  return (
    <div className="min-h-screen bg-white">
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <span className="flex items-center gap-2 font-semibold text-brand-700">
          <HeartPulse className="size-6" aria-hidden /> MediAssist CDSS
        </span>
        <nav className="flex gap-2">
          <Link to="/login" className={buttonVariants({ variant: 'ghost' })}>
            Sign in
          </Link>
          <Link to="/register" className={buttonVariants()}>
            Get started
          </Link>
        </nav>
      </header>

      <section className="bg-gradient-to-b from-brand-50 to-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
          <p className="mb-3 text-sm font-semibold tracking-wide text-brand-700 uppercase">
            AI-powered clinical decision support
          </p>
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Understand your health risks, with the reasons behind every result.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-slate-600">
            MediAssist gives preliminary, explainable assessments for diabetes, heart disease, liver
            disease and common conditions, reviewed by doctors and backed by transparent machine
            learning.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/register" className={buttonVariants({ size: 'lg' })}>
              Create a free account
            </Link>
            <Link to="/login" className={buttonVariants({ size: 'lg', variant: 'secondary' })}>
              I already have an account
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 className="mb-6 text-xl font-semibold text-slate-900">Four assessment modules</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {MODULES.map(({ name, icon: Icon, desc }) => (
            <div key={name} className="rounded-xl border border-slate-200 p-5">
              <Icon className="mb-3 size-8 text-brand-600" aria-hidden />
              <h3 className="font-semibold">{name}</h3>
              <p className="mt-1 text-sm text-slate-600">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-slate-100 bg-slate-50">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title}>
              <Icon className="mb-3 size-6 text-brand-600" aria-hidden />
              <h3 className="font-semibold text-slate-900">{title}</h3>
              <p className="mt-1 text-sm text-slate-600">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="mx-auto max-w-6xl space-y-4 px-4 py-8 sm:px-6">
        <Disclaimer />
        <p className="text-xs text-slate-400">
          B.Tech CSE final-year project, Integral University Lucknow · Zibran Hasan Khan · Tanvir
          Husain · Yasir Khan · Supervisor: Ms. Saman Khan
        </p>
      </footer>
    </div>
  )
}
