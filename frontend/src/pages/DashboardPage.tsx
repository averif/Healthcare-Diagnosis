import {
  Activity,
  ClipboardCheck,
  ClipboardList,
  Droplet,
  HeartPulse,
  Stethoscope,
  TriangleAlert,
  UserX,
  Users,
} from 'lucide-react'
import { Link } from 'react-router'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useAuth } from '@/auth/useAuth'
import { PredictionTable } from '@/components/prediction/PredictionVisuals'
import { buttonVariants } from '@/components/ui/buttonVariants'
import { Card, CardBody, CardHeader, PageHeader, StatCard } from '@/components/ui/Card'
import { Alert, EmptyState, FullPageSpinner } from '@/components/ui/Feedback'
import { errorMessage } from '@/lib/api'
import { useAuditLogs, useDashboard, useMyProfile, usePredictions } from '@/lib/queries'
import { DISEASE_LABEL, fmtDate, RISK_COLOR, titleCase } from '@/lib/utils'
import type { DashboardSummary, Disease, RiskLevel } from '@/types/api'

const MODULE_ICONS = { diabetes: Droplet, heart: HeartPulse, liver: Activity, symptom: Stethoscope }

function TimelineChart({ data }: { data: DashboardSummary['timeline'] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ left: -20, right: 8, top: 8 }}>
        <defs>
          <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#14a38b" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#14a38b" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
        <XAxis
          dataKey="date"
          tickFormatter={(d: string) => d.slice(5)}
          tick={{ fontSize: 11, fill: '#64748b' }}
          interval={6}
        />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
        <Tooltip labelFormatter={(d) => fmtDate(String(d))} formatter={(v) => [v, 'Assessments']} />
        <Area type="monotone" dataKey="count" stroke="#0d8574" strokeWidth={2} fill="url(#fill)" />
      </AreaChart>
    </ResponsiveContainer>
  )
}

function RiskChart({ data }: { data: Record<RiskLevel, number> }) {
  const rows = (['low', 'moderate', 'high'] as RiskLevel[]).map((risk) => ({
    risk: titleCase(risk),
    key: risk,
    count: data[risk] ?? 0,
  }))
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={rows} margin={{ left: -20, right: 8, top: 8 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
        <XAxis dataKey="risk" tick={{ fontSize: 12, fill: '#64748b' }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
        <Tooltip formatter={(v) => [v, 'Assessments']} />
        <Bar dataKey="count" radius={[6, 6, 0, 0]}>
          {rows.map((row) => (
            <Cell key={row.key} fill={RISK_COLOR[row.key]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function DiseaseBreakdown({ data }: { data: Record<Disease, number> }) {
  const total = Object.values(data).reduce((a, b) => a + b, 0) || 1
  return (
    <ul className="space-y-3">
      {(Object.keys(DISEASE_LABEL) as Disease[]).map((disease) => {
        const Icon = MODULE_ICONS[disease]
        const count = data[disease] ?? 0
        return (
          <li key={disease}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-slate-700">
                <Icon className="size-4 text-brand-600" aria-hidden />
                {DISEASE_LABEL[disease]}
              </span>
              <span className="font-medium tabular-nums">{count}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100">
              <div
                className="h-2 rounded-full bg-brand-500"
                style={{ width: `${(count / total) * 100}%` }}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

// ---- patient ------------------------------------------------------------------------------

function PatientDashboard({ data }: { data: DashboardSummary }) {
  const { user } = useAuth()
  const profile = useMyProfile()
  const incomplete = profile.data && (!profile.data.date_of_birth || !profile.data.sex)
  const reviewed = data.by_status.reviewed ?? 0

  return (
    <>
      <PageHeader
        title={`Hello, ${user?.full_name.split(' ')[0]}`}
        description="Your assessments, results and doctor reviews in one place."
        action={
          <Link to="/assess" className={buttonVariants()}>
            <Stethoscope className="size-4" /> New assessment
          </Link>
        }
      />
      {incomplete && (
        <Alert tone="info" title="Complete your profile" className="mb-6">
          Adding your date of birth, sex, height and weight helps your doctor interpret results.{' '}
          <Link to="/profile" className="font-medium underline">
            Update profile
          </Link>
        </Alert>
      )}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Assessments"
          value={data.totals.predictions}
          icon={<ClipboardList className="size-5" />}
        />
        <StatCard
          label="High-risk results"
          value={data.totals.high_risk}
          tone="red"
          icon={<TriangleAlert className="size-5" />}
        />
        <StatCard
          label="Reviewed by doctor"
          value={`${reviewed} / ${data.totals.predictions}`}
          tone="slate"
          icon={<ClipboardCheck className="size-5" />}
        />
      </div>
      <Card className="mb-6">
        <CardHeader title="Start an assessment" description="Choose a module to begin." />
        <CardBody className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(Object.keys(DISEASE_LABEL) as Disease[]).map((disease) => {
            const Icon = MODULE_ICONS[disease]
            return (
              <Link
                key={disease}
                to={`/assess/${disease}`}
                className="flex items-center gap-3 rounded-lg border border-slate-200 p-4 transition hover:border-brand-500 hover:bg-brand-50"
              >
                <Icon className="size-6 text-brand-600" aria-hidden />
                <span className="font-medium text-slate-800">{DISEASE_LABEL[disease]}</span>
              </Link>
            )
          })}
        </CardBody>
      </Card>
      <Card>
        <CardHeader
          title="Recent assessments"
          action={
            <Link to="/history" className="text-sm font-medium text-brand-700 hover:underline">
              View all
            </Link>
          }
        />
        <div className="mt-3">
          {data.recent.length ? (
            <PredictionTable predictions={data.recent} />
          ) : (
            <EmptyState icon={<ClipboardList className="size-10" />} title="No assessments yet">
              Start your first assessment to see your results here.
            </EmptyState>
          )}
        </div>
      </Card>
    </>
  )
}

// ---- doctor -------------------------------------------------------------------------------

function DoctorDashboard({ data }: { data: DashboardSummary }) {
  const { user } = useAuth()
  const queue = usePredictions({ status: 'pending_review', page_size: 6 })
  return (
    <>
      <PageHeader
        title={`Good day, ${user?.full_name}`}
        description="Overview of your assigned patients' assessments."
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="My patients"
          value={data.totals.patients}
          icon={<Users className="size-5" />}
        />
        <StatCard
          label="Assessments"
          value={data.totals.predictions}
          tone="slate"
          icon={<ClipboardList className="size-5" />}
        />
        <StatCard
          label="Awaiting review"
          value={data.totals.pending_reviews}
          tone="amber"
          icon={<ClipboardCheck className="size-5" />}
        />
        <StatCard
          label="High risk"
          value={data.totals.high_risk}
          tone="red"
          icon={<TriangleAlert className="size-5" />}
        />
      </div>
      <Card className="mb-6">
        <CardHeader
          title="Review queue"
          description="Most recent assessments waiting for your verdict."
          action={
            <Link
              to="/history?status=pending_review"
              className="text-sm font-medium text-brand-700 hover:underline"
            >
              See all
            </Link>
          }
        />
        <div className="mt-3">
          {queue.data?.items.length ? (
            <PredictionTable predictions={queue.data.items} showPatient />
          ) : (
            <EmptyState icon={<ClipboardCheck className="size-10" />} title="All caught up">
              No assessments are waiting for review.
            </EmptyState>
          )}
        </div>
      </Card>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Assessments, last 30 days" />
          <CardBody>
            <TimelineChart data={data.timeline} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Risk distribution" />
          <CardBody>
            <RiskChart data={data.by_risk} />
          </CardBody>
        </Card>
      </div>
    </>
  )
}

// ---- admin --------------------------------------------------------------------------------

function AdminDashboard({ data }: { data: DashboardSummary }) {
  const audit = useAuditLogs({ page: 1 })
  const roles = data.users_by_role ?? {}
  return (
    <>
      <PageHeader
        title="System overview"
        description="Users, activity and model usage across MediAssist."
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Patients"
          value={roles.patient ?? 0}
          icon={<Users className="size-5" />}
          hint={`${roles.doctor ?? 0} doctor${roles.doctor === 1 ? '' : 's'} · ${roles.admin ?? 0} admin${roles.admin === 1 ? '' : 's'}`}
        />
        <StatCard
          label="Assessments"
          value={data.totals.predictions}
          tone="slate"
          icon={<ClipboardList className="size-5" />}
        />
        <StatCard
          label="Awaiting review"
          value={data.totals.pending_reviews}
          tone="amber"
          icon={<ClipboardCheck className="size-5" />}
        />
        <StatCard
          label="Unassigned patients"
          value={data.unassigned_patients ?? 0}
          tone={data.unassigned_patients ? 'red' : 'slate'}
          icon={<UserX className="size-5" />}
          hint={
            data.unassigned_patients ? (
              <Link to="/patients" className="text-brand-700 hover:underline">
                Assign doctors
              </Link>
            ) : undefined
          }
        />
      </div>
      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Assessments, last 30 days" />
          <CardBody>
            <TimelineChart data={data.timeline} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="By module" />
          <CardBody>
            <DiseaseBreakdown data={data.by_disease} />
          </CardBody>
        </Card>
      </div>
      <Card>
        <CardHeader
          title="Recent activity"
          action={
            <Link to="/admin/audit" className="text-sm font-medium text-brand-700 hover:underline">
              Full audit log
            </Link>
          }
        />
        <ul className="mt-3 divide-y divide-slate-100">
          {audit.data?.items.slice(0, 8).map((log) => (
            <li
              key={log.id}
              className="flex items-center justify-between gap-4 px-5 py-2.5 text-sm"
            >
              <span>
                <span className="font-medium text-slate-800">{log.user_email ?? 'anonymous'}</span>{' '}
                <span className="text-slate-500">{titleCase(log.action.replace('.', ' '))}</span>
              </span>
              <span className="shrink-0 text-xs text-slate-400">
                {fmtDate(log.created_at, true)}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </>
  )
}

export function DashboardPage() {
  const { user } = useAuth()
  const { data, isPending, error } = useDashboard()
  if (isPending) return <FullPageSpinner />
  if (error) return <Alert tone="error">{errorMessage(error)}</Alert>
  if (user?.role === 'admin') return <AdminDashboard data={data} />
  if (user?.role === 'doctor') return <DoctorDashboard data={data} />
  return <PatientDashboard data={data} />
}
