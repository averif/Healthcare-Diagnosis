import { HeartPulse } from 'lucide-react'
import { NavLink, Outlet } from 'react-router'
import { cn } from '@/lib/utils'
import { Disclaimer } from './Disclaimer'

const navItems = [
  { to: '/', label: 'Home' },
  { to: '/login', label: 'Sign in' },
]

export function AppLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <NavLink to="/" className="flex items-center gap-2 font-semibold text-brand-700">
            <HeartPulse className="size-6" aria-hidden />
            <span>MediAssist CDSS</span>
          </NavLink>
          <nav className="flex gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end
                className={({ isActive }) =>
                  cn(
                    'rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100',
                    isActive && 'bg-brand-50 text-brand-700',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>
      <footer className="mx-auto w-full max-w-6xl px-4 pb-6">
        <Disclaimer />
      </footer>
    </div>
  )
}
