import {
  BarChart3,
  ClipboardList,
  HeartPulse,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  ScrollText,
  Stethoscope,
  User as UserIcon,
  UserCog,
  Users,
  X,
} from 'lucide-react'
import { useState, type ComponentType } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router'
import { useAuth } from '@/auth/useAuth'
import { cn } from '@/lib/utils'
import type { Role } from '@/types/api'
import { Disclaimer } from './Disclaimer'

interface NavItem {
  to: string
  label: string
  icon: ComponentType<{ className?: string }>
}

const NAV: Record<Role, NavItem[]> = {
  patient: [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/assess', label: 'New assessment', icon: Stethoscope },
    { to: '/history', label: 'My history', icon: History },
    { to: '/profile', label: 'My profile', icon: UserIcon },
  ],
  doctor: [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/patients', label: 'My patients', icon: Users },
    { to: '/history', label: 'Assessments', icon: ClipboardList },
    { to: '/models', label: 'Model performance', icon: BarChart3 },
  ],
  admin: [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/admin/users', label: 'Users', icon: UserCog },
    { to: '/patients', label: 'Patients', icon: Users },
    { to: '/admin/audit', label: 'Audit log', icon: ScrollText },
    { to: '/models', label: 'Model performance', icon: BarChart3 },
  ],
}

const ROLE_LABEL: Record<Role, string> = {
  patient: 'Patient',
  doctor: 'Doctor',
  admin: 'Administrator',
}

export function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  if (!user) return null

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const sidebar = (
    <nav className="flex h-full flex-col" aria-label="Main">
      <div className="flex h-16 items-center gap-2 px-5 font-semibold text-brand-700">
        <HeartPulse className="size-6" aria-hidden />
        MediAssist <span className="font-normal text-slate-400">CDSS</span>
      </div>
      <ul className="flex-1 space-y-1 px-3 py-2">
        {NAV[user.role].map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                )
              }
            >
              <Icon className="size-4.5" aria-hidden />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
      <div className="border-t border-slate-200 p-3">
        <div className="mb-2 flex items-center gap-3 px-2">
          <div className="flex size-9 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
            {user.full_name
              .split(' ')
              .map((p) => p[0])
              .slice(0, 2)
              .join('')}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-900">{user.full_name}</p>
            <p className="text-xs text-slate-500">{ROLE_LABEL[user.role]}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
        >
          <LogOut className="size-4.5" aria-hidden />
          Sign out
        </button>
      </div>
    </nav>
  )

  return (
    <div className="min-h-screen lg:flex">
      {/* desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white lg:block">
        <div className="sticky top-0 h-screen">{sidebar}</div>
      </aside>

      {/* mobile top bar + drawer */}
      <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 lg:hidden">
        <span className="flex items-center gap-2 font-semibold text-brand-700">
          <HeartPulse className="size-5" aria-hidden /> MediAssist
        </span>
        <button onClick={() => setOpen(true)} aria-label="Open menu" className="p-2">
          <Menu className="size-5" />
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-white shadow-xl">
            <button
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="absolute top-4 right-4 p-1 text-slate-400"
            >
              <X className="size-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:py-8">
          <Outlet />
        </main>
        <footer className="mx-auto w-full max-w-6xl px-4 pb-6 sm:px-6">
          <Disclaimer />
        </footer>
      </div>
    </div>
  )
}
