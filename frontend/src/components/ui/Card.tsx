import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-xl border border-zinc-200/80 bg-white shadow-card', className)}
      {...props}
    />
  )
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4 px-5 pt-5', className)}>
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-zinc-900">{title}</h2>
        {description && <p className="mt-0.5 text-[13px] text-zinc-500">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5', className)} {...props} />
}

export function PageHeader({
  title,
  description,
  action,
  eyebrow,
}: {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  eyebrow?: ReactNode
}) {
  return (
    <div className="mb-8 flex animate-fade-up flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <p className="mb-1.5 text-xs font-medium tracking-wide text-brand-700 uppercase">
            {eyebrow}
          </p>
        )}
        <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.025em] text-zinc-950">
          {title}
        </h1>
        {description && <p className="mt-1.5 text-[15px] text-zinc-500">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'brand',
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  icon?: ReactNode
  tone?: 'brand' | 'amber' | 'red' | 'slate'
}) {
  const tones = {
    brand: 'text-brand-600',
    amber: 'text-amber-600',
    red: 'text-red-600',
    slate: 'text-zinc-500',
  }
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-medium text-zinc-500">{label}</p>
        {icon && <div className={cn('[&>svg]:size-4', tones[tone])}>{icon}</div>}
      </div>
      <p className="mt-3 text-[28px] leading-none font-semibold tracking-[-0.03em] text-zinc-950 tabular">
        {value}
      </p>
      {hint && <p className="mt-2 text-xs text-zinc-500">{hint}</p>}
    </Card>
  )
}
