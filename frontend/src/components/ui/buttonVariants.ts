import { cva } from 'class-variance-authority'

export const buttonVariants = cva(
  'inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        // near-black primary, as on most modern product sites
        primary: 'bg-zinc-900 text-white shadow-button hover:bg-zinc-800',
        brand: 'bg-brand-600 text-white shadow-button hover:bg-brand-700',
        secondary:
          'bg-white text-zinc-800 shadow-xs ring-1 ring-zinc-200 ring-inset hover:bg-zinc-50 hover:text-zinc-950',
        ghost: 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900',
        danger: 'bg-red-600 text-white shadow-button hover:bg-red-700',
      },
      size: {
        sm: 'h-8 px-3 text-[13px]',
        md: 'h-9 px-3.5',
        lg: 'h-11 rounded-xl px-5 text-[15px]',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)
