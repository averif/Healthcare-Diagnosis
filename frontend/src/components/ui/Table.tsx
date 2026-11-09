import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import { Button } from './Button'

export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto">
      <table className={cn('w-full text-left text-sm', className)} {...props} />
    </div>
  )
}

export function Th({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        'h-10 border-b border-zinc-200/80 bg-zinc-50/70 px-4 text-xs font-medium text-zinc-500 first:pl-5 last:pr-5',
        className,
      )}
      {...props}
    />
  )
}

export function Td({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn(
        'border-b border-zinc-100 px-4 py-3 align-middle first:pl-5 last:pr-5 [tr:last-child_&]:border-0',
        className,
      )}
      {...props}
    />
  )
}

export function Pagination({
  page,
  pages,
  total,
  onChange,
}: {
  page: number
  pages: number
  total: number
  onChange: (page: number) => void
}) {
  return (
    <div className="flex items-center justify-between border-t border-zinc-100 px-5 py-3 text-[13px] text-zinc-500">
      <span>
        {total} result{total === 1 ? '' : 's'}
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="icon"
          className="size-8"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="tabular">
          Page {page} of {pages}
        </span>
        <Button
          variant="secondary"
          size="icon"
          className="size-8"
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
          aria-label="Next page"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}
