import { cn } from '@/lib/utils'

/** MediAssist mark: a pulse line inside a soft emerald tile. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex size-7 items-center justify-center rounded-lg bg-gradient-to-b from-brand-500 to-brand-700 text-white shadow-button',
        className,
      )}
      aria-hidden
    >
      <svg
        viewBox="0 0 24 24"
        className="size-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
      >
        <path d="M3 12h4l2.5-6 4 12 2.5-6H21" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark />
      <span className="text-[15px] font-semibold tracking-tight text-zinc-950">
        MediAssist
        {!compact && <span className="ml-1.5 font-normal text-zinc-400">CDSS</span>}
      </span>
    </span>
  )
}
