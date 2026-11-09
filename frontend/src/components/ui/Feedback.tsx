import { CircleAlert, CircleCheck, Info, LoaderCircle, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn, RISK_COLOR } from '@/lib/utils'
import type { PredictionStatus, RiskLevel } from '@/types/api'

export function Spinner({ className }: { className?: string }) {
  return (
    <LoaderCircle
      className={cn('size-5 animate-spin text-brand-600', className)}
      aria-label="Loading"
    />
  )
}

export function FullPageSpinner() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Spinner className="size-8" />
    </div>
  )
}

const alertStyles = {
  info: { box: 'border-sky-200 bg-sky-50 text-sky-900', icon: Info },
  success: { box: 'border-emerald-200 bg-emerald-50 text-emerald-900', icon: CircleCheck },
  warning: { box: 'border-amber-200 bg-amber-50 text-amber-900', icon: TriangleAlert },
  error: { box: 'border-red-200 bg-red-50 text-red-900', icon: CircleAlert },
}

export function Alert({
  tone = 'info',
  title,
  children,
  className,
}: {
  tone?: keyof typeof alertStyles
  title?: ReactNode
  children?: ReactNode
  className?: string
}) {
  const { box, icon: Icon } = alertStyles[tone]
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('flex gap-3 rounded-lg border px-4 py-3 text-sm', box, className)}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="space-y-1">
        {title && <p className="font-medium">{title}</p>}
        {children && <div>{children}</div>}
      </div>
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  children,
}: {
  icon?: ReactNode
  title: string
  children?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      {icon && <div className="text-slate-300">{icon}</div>}
      <p className="font-medium text-slate-700">{title}</p>
      {children && <div className="text-sm text-slate-500">{children}</div>}
    </div>
  )
}

export function Badge({
  children,
  className,
  style,
}: {
  children: ReactNode
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <span
      style={style}
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
        className,
      )}
    >
      {children}
    </span>
  )
}

export function RiskBadge({ risk }: { risk: RiskLevel }) {
  return (
    <Badge
      className="border"
      style={{
        color: RISK_COLOR[risk],
        borderColor: `${RISK_COLOR[risk]}40`,
        backgroundColor: `${RISK_COLOR[risk]}12`,
      }}
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: RISK_COLOR[risk] }} />
      {risk.charAt(0).toUpperCase() + risk.slice(1)} risk
    </Badge>
  )
}

export function StatusBadge({ status }: { status: PredictionStatus }) {
  return status === 'reviewed' ? (
    <Badge className="bg-emerald-50 text-emerald-700">Reviewed</Badge>
  ) : (
    <Badge className="bg-slate-100 text-slate-600">Pending review</Badge>
  )
}
