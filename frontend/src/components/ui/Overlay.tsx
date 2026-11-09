import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Accessible modal built on the native <dialog> element (focus trap + Esc for free). */
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className="m-auto w-full max-w-md rounded-2xl border border-zinc-200 p-0 shadow-elevated backdrop:bg-zinc-950/30 backdrop:backdrop-blur-[2px]"
    >
      <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
        <h2 className="font-semibold">{title}</h2>
        <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600" aria-label="Close">
          <X className="size-5" />
        </button>
      </div>
      <div className="p-5">{children}</div>
    </dialog>
  )
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { value: T; label: ReactNode }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div
      role="tablist"
      className="inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border border-zinc-200/80 bg-zinc-100/70 p-1"
    >
      {tabs.map((tab) => (
        <button
          key={tab.value}
          role="tab"
          aria-selected={tab.value === value}
          onClick={() => onChange(tab.value)}
          className={cn(
            'cursor-pointer rounded-lg px-3.5 py-1.5 text-[13px] font-medium whitespace-nowrap transition-all',
            tab.value === value
              ? 'bg-white text-zinc-900 shadow-xs ring-1 ring-zinc-200'
              : 'text-zinc-500 hover:text-zinc-800',
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
