import {
  ArrowRight,
  BrainCircuit,
  FileText,
  FlaskConical,
  LockKeyhole,
  MessagesSquare,
  Stethoscope,
  UserCheck,
} from 'lucide-react'
import { Link, Navigate } from 'react-router'
import { useAuth } from '@/auth/useAuth'
import { Disclaimer } from '@/components/layout/Disclaimer'
import { Logo } from '@/components/layout/Logo'
import { ExplanationChart, RiskGauge } from '@/components/prediction/PredictionVisuals'
import { buttonVariants } from '@/components/ui/buttonVariants'
import { cn } from '@/lib/utils'
import type { Explanation } from '@/types/api'

/** A real explanation from the deployed diabetes model, used as the product preview. */
const PREVIEW: Explanation = {
  target_class: 1,
  base_rate: 0.5,
  probability: 0.86,
  path_length: 4,
  reasons: [
    {
      feature: 'SkinThickness',
      label: 'Triceps skin-fold',
      value: '35 mm',
      condition: 'above 31.5 mm',
      text: 'Triceps skin-fold is 35 mm, above 31.5 mm',
      contribution: 0.131,
      imputed: false,
    },
    {
      feature: 'BMI',
      label: 'Body mass index',
      value: '33.6',
      condition: 'above 29.95',
      text: 'Body mass index is 33.6 kg/m², above 29.95',
      contribution: 0.115,
      imputed: false,
    },
    {
      feature: 'Glucose',
      label: 'Plasma glucose',
      value: '148 mg/dL',
      condition: 'between 127.5 and 154.5',
      text: 'Plasma glucose is 148 mg/dL, between 127.5 and 154.5',
      contribution: 0.115,
      imputed: false,
    },
  ],
}

const STATS = [
  { value: '4', label: 'assessment modules' },
  { value: '41', label: 'conditions from 131 symptoms' },
  { value: '103', label: 'automated tests in CI' },
  { value: '~2s', label: 'AI assistant replies' },
]

const FEATURES = [
  {
    icon: BrainCircuit,
    title: 'Explainable by design',
    desc: 'Every result shows which factors raised or lowered the risk, and the contributions add up exactly to the prediction.',
  },
  {
    icon: UserCheck,
    title: 'Doctor in the loop',
    desc: 'Assessments wait in a review queue. Your assigned doctor records a verdict and notes you can read.',
  },
  {
    icon: FlaskConical,
    title: 'Honest evaluation',
    desc: 'Nested cross-validation against baselines, leakage removed, and model cards published inside the app.',
  },
  {
    icon: MessagesSquare,
    title: 'Assistant with guardrails',
    desc: 'Ask why, what next, or how reliable. It never diagnoses or doses, and emergencies are escalated instantly.',
  },
  {
    icon: FileText,
    title: 'Reports and history',
    desc: 'Track every assessment over time and download a PDF report with a unique code to share with your clinician.',
  },
  {
    icon: LockKeyhole,
    title: 'Secure by default',
    desc: 'Argon2 passwords, role-based access, rate-limited sign-in, and a full audit trail of record access.',
  },
]

const STEPS = [
  {
    title: 'Enter your values',
    desc: 'Lab results or symptoms. Every field shows its unit and accepted clinical range.',
  },
  {
    title: 'See the reasons',
    desc: 'Probability, risk level and the exact factors behind the result, plus clear next steps.',
  },
  {
    title: 'Get it reviewed',
    desc: 'Your doctor confirms or questions the result, and you can download the report.',
  },
]

export function LandingPage() {
  const { user } = useAuth()
  if (user) return <Navigate to="/dashboard" replace />

  return (
    <div className="min-h-screen bg-white">
      {/* nav */}
      <header className="sticky top-0 z-30 border-b border-zinc-200/60 bg-white/75 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Logo />
          <nav className="hidden items-center gap-7 text-[13.5px] text-zinc-600 md:flex">
            <a href="#features" className="hover:text-zinc-950">
              Features
            </a>
            <a href="#how" className="hover:text-zinc-950">
              How it works
            </a>
            <a href="#science" className="hover:text-zinc-950">
              Science
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/login" className={buttonVariants({ variant: 'ghost' })}>
              Sign in
            </Link>
            <Link to="/register" className={buttonVariants()}>
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* hero */}
      <section className="relative overflow-hidden">
        <div className="bg-grid mask-fade-b pointer-events-none absolute inset-0" aria-hidden />
        <div
          className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[880px] -translate-x-1/2 rounded-full bg-brand-200/40 blur-3xl"
          aria-hidden
        />
        <div className="relative mx-auto max-w-6xl px-5 pt-20 pb-16 text-center sm:px-8 lg:pt-28">
          <div className="inline-flex animate-fade-up items-center gap-2 rounded-full border border-zinc-200 bg-white/80 px-3 py-1 text-xs font-medium text-zinc-600 shadow-xs backdrop-blur">
            <span className="size-1.5 rounded-full bg-brand-500" />
            Explainable clinical decision support
          </div>
          <h1 className="mx-auto mt-6 max-w-4xl animate-fade-up text-[44px] leading-[1.04] font-semibold tracking-[-0.04em] text-zinc-950 sm:text-6xl lg:text-[72px]">
            Health risk assessments,{' '}
            <span className="font-display font-normal tracking-[-0.02em] text-brand-700 italic">
              with the reasons
            </span>{' '}
            you can see.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl animate-fade-up text-lg leading-relaxed text-zinc-600 [animation-delay:80ms]">
            MediAssist gives preliminary, explainable assessments for diabetes, heart disease, liver
            disease and 41 common conditions, reviewed by doctors and backed by transparent machine
            learning.
          </p>
          <div className="mt-9 flex animate-fade-up flex-wrap justify-center gap-3 [animation-delay:160ms]">
            <Link to="/register" className={buttonVariants({ size: 'lg' })}>
              Start a free assessment <ArrowRight className="size-4" />
            </Link>
            <Link to="/login" className={buttonVariants({ size: 'lg', variant: 'secondary' })}>
              Sign in
            </Link>
          </div>
          <p className="mt-5 text-xs text-zinc-500">
            Decision support only, not a medical diagnosis.
          </p>
        </div>

        {/* product preview built from the real result components */}
        <div className="relative mx-auto max-w-5xl animate-fade-up px-5 pb-24 [animation-delay:240ms] sm:px-8">
          <div className="rounded-2xl border border-zinc-200/80 bg-zinc-100/60 p-2 shadow-elevated">
            <div className="overflow-hidden rounded-xl border border-zinc-200/80 bg-white">
              <div className="flex items-center gap-2 border-b border-zinc-100 px-4 py-3">
                <span className="size-2.5 rounded-full bg-zinc-200" />
                <span className="size-2.5 rounded-full bg-zinc-200" />
                <span className="size-2.5 rounded-full bg-zinc-200" />
                <span className="ml-3 font-mono text-[11px] text-zinc-400">
                  mediassist / predictions / diabetes
                </span>
              </div>
              <div className="grid gap-0 text-left md:grid-cols-5">
                <div className="flex flex-col items-center justify-center border-b border-zinc-100 p-8 md:col-span-2 md:border-r md:border-b-0">
                  <p className="text-[13px] text-zinc-500">Result</p>
                  <p className="mb-4 text-2xl font-semibold tracking-tight">Diabetic</p>
                  <RiskGauge probability={0.86} risk="high" />
                </div>
                <div className="p-8 md:col-span-3">
                  <p className="mb-1 text-[15px] font-semibold">Why this result?</p>
                  <ExplanationChart explanation={PREVIEW} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* stats */}
      <section className="border-y border-zinc-200/70 bg-zinc-50/60">
        <div className="mx-auto grid max-w-6xl grid-cols-2 divide-zinc-200/70 px-5 sm:px-8 md:grid-cols-4 md:divide-x">
          {STATS.map((s) => (
            <div key={s.label} className="px-4 py-10 text-center">
              <p className="font-mono text-4xl font-medium tracking-tight text-zinc-950">
                {s.value}
              </p>
              <p className="mt-1.5 text-[13px] text-zinc-500">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* features */}
      <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-24 sm:px-8">
        <div className="max-w-2xl">
          <p className="text-xs font-medium tracking-wider text-brand-700 uppercase">Features</p>
          <h2 className="mt-3 text-4xl font-semibold tracking-[-0.03em] text-zinc-950">
            Built for trust, not just predictions.
          </h2>
          <p className="mt-4 text-[17px] text-zinc-600">
            A preliminary result is only useful if patients understand it and clinicians can check
            it. Every part of MediAssist is designed around that.
          </p>
        </div>
        <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-zinc-200/80 bg-zinc-200/80 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-white p-7 transition-colors hover:bg-zinc-50/70">
              <div className="inline-flex size-9 items-center justify-center rounded-lg border border-zinc-200 bg-white shadow-xs">
                <Icon className="size-4 text-brand-600" aria-hidden />
              </div>
              <h3 className="mt-5 text-[15px] font-semibold text-zinc-950">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* how it works */}
      <section id="how" className="scroll-mt-20 border-t border-zinc-200/70 bg-zinc-50/60">
        <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8">
          <p className="text-xs font-medium tracking-wider text-brand-700 uppercase">
            How it works
          </p>
          <h2 className="mt-3 text-4xl font-semibold tracking-[-0.03em] text-zinc-950">
            From lab values to a reviewed result in minutes.
          </h2>
          <ol className="mt-14 grid gap-6 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <li
                key={step.title}
                className="rounded-2xl border border-zinc-200/80 bg-white p-7 shadow-card"
              >
                <span className="font-mono text-xs text-zinc-400">0{i + 1}</span>
                <h3 className="mt-3 text-lg font-semibold tracking-tight">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-600">{step.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* science */}
      <section id="science" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-24 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-xs font-medium tracking-wider text-brand-700 uppercase">
              The science
            </p>
            <h2 className="mt-3 text-4xl font-semibold tracking-[-0.03em] text-zinc-950">
              Interpretable models,{' '}
              <span className="font-display font-normal text-brand-700 italic">
                evaluated honestly.
              </span>
            </h2>
            <p className="mt-4 text-[17px] leading-relaxed text-zinc-600">
              Decision Trees tuned with grid search and the one-standard-error rule, compared with
              black-box models under nested cross-validation. We also removed the data leakage that
              inflates many published results.
            </p>
          </div>
          <dl className="grid gap-4 sm:grid-cols-2">
            {[
              [
                '41 / 42',
                'test rows in a popular symptom dataset were copies of training rows. We de-duplicated it.',
              ],
              ['0.79', 'balanced accuracy for heart disease from a tree with just 8 leaves.'],
              ['±1 SD', 'every Decision Tree is within one standard deviation of Random Forest.'],
              [
                'Exact',
                'explanations: base rate plus contributions equals the prediction, every time.',
              ],
            ].map(([value, text]) => (
              <div
                key={value}
                className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-card"
              >
                <dt className="font-mono text-2xl font-medium tracking-tight text-zinc-950">
                  {value}
                </dt>
                <dd className="mt-2 text-[13.5px] leading-relaxed text-zinc-600">{text}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* CTA */}
      <section className="px-5 pb-24 sm:px-8">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-zinc-950 px-8 py-16 text-center sm:px-16">
          <div
            className="bg-grid pointer-events-none absolute inset-0 opacity-[0.08] invert"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-32 left-1/2 h-72 w-[640px] -translate-x-1/2 rounded-full bg-brand-500/30 blur-3xl"
            aria-hidden
          />
          <Stethoscope className="relative mx-auto size-8 text-brand-400" aria-hidden />
          <h2 className="relative mt-5 text-4xl font-semibold tracking-[-0.03em] text-white sm:text-5xl">
            Understand your health,{' '}
            <span className="font-display font-normal text-brand-300 italic">
              one reason at a time.
            </span>
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-zinc-400">
            Create a free account and run your first assessment in about a minute.
          </p>
          <div className="relative mt-8 flex justify-center gap-3">
            <Link
              to="/register"
              className={cn(
                buttonVariants({ size: 'lg' }),
                'bg-white text-zinc-950 hover:bg-zinc-100',
              )}
            >
              Get started <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-zinc-200/70">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 sm:px-8 md:flex-row md:items-start md:justify-between">
          <div className="space-y-3">
            <Logo />
            <p className="max-w-sm text-xs leading-relaxed text-zinc-500">
              B.Tech CSE final-year project, Integral University Lucknow. Zibran Hasan Khan, Tanvir
              Husain, Yasir Khan. Supervisor: Ms. Saman Khan.
            </p>
          </div>
          <div className="max-w-md">
            <Disclaimer />
          </div>
        </div>
      </footer>
    </div>
  )
}
