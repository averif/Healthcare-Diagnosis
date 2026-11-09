import { cloneElement, isValidElement } from 'react'
import type {
  InputHTMLAttributes,
  ReactElement,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'
import { cn } from '@/lib/utils'

const control =
  'block w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-xs transition-[border-color,box-shadow] duration-150 placeholder:text-zinc-400 hover:border-zinc-300 focus:border-zinc-400 focus:ring-4 focus:ring-zinc-900/5 focus:outline-none disabled:bg-zinc-50 aria-[invalid=true]:border-red-300 aria-[invalid=true]:ring-red-500/10'

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(control, 'h-10', className)} {...props} />
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(control, 'h-10 pr-8', className)} {...props} />
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(control, 'min-h-24', className)} {...props} />
}

/** Label + control + hint/error, wired for accessibility. */
export function Field({
  id,
  label,
  hint,
  error,
  required,
  children,
  className,
}: {
  id: string
  label: ReactNode
  hint?: ReactNode
  error?: string
  required?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="block text-[13px] font-medium text-zinc-800">
        {label}
        {required ? (
          // the asterisk is visual only; screen readers get aria-required on the control
          <span className="text-zinc-400" aria-hidden>
            {' '}
            *
          </span>
        ) : (
          <span className="font-normal text-zinc-400"> (optional)</span>
        )}
      </label>
      {isValidElement(children)
        ? cloneElement(children as ReactElement<Record<string, unknown>>, {
            'aria-required': required || undefined,
            'aria-describedby': error ? `${id}-error` : undefined,
          })
        : children}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-zinc-500">{hint}</p>
      )}
    </div>
  )
}
