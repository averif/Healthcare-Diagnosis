import { CircleAlert, CircleCheck, Info, LoaderCircle, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { PredictionStatus, RiskLevel } from '@/types/api'

export function Spinner({ className }: { className?: string }) {
  return (
    <LoaderCircle
      className={cn('size-5 animate-spin text-zinc-400', className)}
      aria-label="Loading"
    />
  )
}

export function FullPageSpinner() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Spinner className="size-6" />
    </div>
  )
}

const alertStyles = {
  info: { box: 'border-zinc-200 bg-white text-zinc-700', icon: Info, iconClass: 'text-zinc-400' },
  success: {
    box: 'border-emerald-200/80 bg-emerald-50/60 text-emerald-900',
    icon: CircleCheck,
    iconClass: 'text-emerald-600',
  },
  warning: {
    box: 'border-amber-200/80 bg-amber-50/60 text-amber-900',
    icon: TriangleAlert,
    iconClass: 'text-amber-600',
  },
  error: {
    box: 'border-red-200/80 bg-red-50/60 text-red-900',
    icon: CircleAlert,
    iconClass: 'text-red-600',
  },
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
  const { box, icon: Icon, iconClass } = alertStyles[tone]
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('flex gap-3 rounded-xl border px-4 py-3 text-sm shadow-xs', box, className)}
    >
      <Icon className={cn('mt-0.5 size-4 shrink-0', iconClass)} aria-hidden />
      <div className="space-y-1">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className="opacity-90">{children}</div>}
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
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      {icon && (
        <div className="mb-1 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-zinc-400 [&>svg]:size-5">
          {icon}
        </div>
      )}
      <p className="text-sm font-medium text-zinc-800">{title}</p>
      {children && <div className="max-w-sm text-[13px] text-zinc-500">{children}</div>}
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
        'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-zinc-900/5 ring-inset',
        className,
      )}
    >
      {children}
    </span>
  )
}

const RISK_STYLE: Record<RiskLevel, { badge: string; dot: string; label: string }> = {
  low: {
    badge: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15',
    dot: 'bg-emerald-500',
    label: 'Low risk',
  },
  moderate: {
    badge: 'bg-amber-50 text-amber-700 ring-amber-600/20',
    dot: 'bg-amber-500',
    label: 'Moderate risk',
  },
  high: { badge: 'bg-red-50 text-red-700 ring-red-600/15', dot: 'bg-red-500', label: 'High risk' },
}

export function RiskBadge({ risk }: { risk: RiskLevel }) {
  const style = RISK_STYLE[risk]
  return (
    <Badge className={style.badge}>
      <span className={cn('size-1.5 rounded-full', style.dot)} />
      {style.label}
    </Badge>
  )
}

export function StatusBadge({ status }: { status: PredictionStatus }) {
  return status === 'reviewed' ? (
    <Badge className="bg-white text-zinc-700 ring-zinc-200">
      <CircleCheck className="size-3 text-brand-600" aria-hidden />
      Reviewed
    </Badge>
  ) : (
    <Badge className="bg-zinc-50 text-zinc-500 ring-zinc-200">
      <span className="size-1.5 rounded-full border border-zinc-400" aria-hidden />
      Pending review
    </Badge>
  )
}
