import {
  BadgeCheck,
  BarChart3,
  ClipboardList,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  ScrollText,
  Stethoscope,
  User as UserIcon,
  UserCog,
  Users,
  X,
} from 'lucide-react'
import { useState, type ComponentType } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router'
import { useAuth } from '@/auth/useAuth'
import { cn } from '@/lib/utils'
import type { Role } from '@/types/api'
import { Disclaimer } from './Disclaimer'
import { Logo } from './Logo'

interface NavItem {
  to: string
  label: string
  icon: ComponentType<{ className?: string }>
}

const NAV: Record<Role, { section: string; items: NavItem[] }[]> = {
  patient: [
    {
      section: 'Overview',
      items: [
        { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { to: '/history', label: 'My history', icon: History },
      ],
    },
    {
      section: 'Care',
      items: [
        { to: '/assess', label: 'New assessment', icon: Stethoscope },
        { to: '/profile', label: 'My profile', icon: UserIcon },
      ],
    },
  ],
  doctor: [
    {
      section: 'Overview',
      items: [
        { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { to: '/history', label: 'Assessments', icon: ClipboardList },
      ],
    },
    {
      section: 'Clinical',
      items: [
        { to: '/patients', label: 'My patients', icon: Users },
        { to: '/models', label: 'Model performance', icon: BarChart3 },
      ],
    },
  ],
  admin: [
    {
      section: 'Overview',
      items: [
        { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { to: '/models', label: 'Model performance', icon: BarChart3 },
      ],
    },
    {
      section: 'Administration',
      items: [
        { to: '/admin/users', label: 'Users', icon: UserCog },
        { to: '/admin/applications', label: 'Applications', icon: BadgeCheck },
        { to: '/patients', label: 'Patients', icon: Users },
        { to: '/admin/audit', label: 'Audit log', icon: ScrollText },
      ],
    },
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
  const initials = user.full_name
    .replace(/^Dr\.?\s+/i, '')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')

  const sidebar = (
    <nav className="flex h-full flex-col" aria-label="Main">
      <div className="flex h-16 items-center px-5">
        <Link to="/dashboard" onClick={() => setOpen(false)}>
          <Logo />
        </Link>
      </div>

      {user.role !== 'admin' && (
        <div className="px-3 pb-2">
          <Link
            to="/assess"
            onClick={() => setOpen(false)}
            className="flex h-9 items-center justify-center gap-2 rounded-lg bg-zinc-900 text-sm font-medium text-white shadow-button transition hover:bg-zinc-800"
          >
            <Plus className="size-4" aria-hidden /> New assessment
          </Link>
        </div>
      )}

      <div className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        {NAV[user.role].map((group) => (
          <div key={group.section}>
            <p className="mb-1.5 px-3 text-[11px] font-medium tracking-wider text-zinc-400 uppercase">
              {group.section}
            </p>
            <ul className="space-y-0.5">
              {group.items.map(({ to, label, icon: Icon }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'group flex h-9 items-center gap-2.5 rounded-lg px-3 text-[13.5px] font-medium transition-colors',
                        isActive
                          ? 'bg-white text-zinc-950 shadow-xs ring-1 ring-zinc-200/80'
                          : 'text-zinc-500 hover:bg-zinc-200/50 hover:text-zinc-900',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon
                          className={cn(
                            'size-4 transition-colors',
                            isActive ? 'text-brand-600' : 'text-zinc-400 group-hover:text-zinc-600',
                          )}
                        />
                        {label}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-zinc-200/80 p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-zinc-700 to-zinc-900 text-xs font-semibold text-white">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-zinc-900">{user.full_name}</p>
            <p className="truncate text-xs text-zinc-500">{ROLE_LABEL[user.role]}</p>
          </div>
          <button
            onClick={handleLogout}
            className="cursor-pointer rounded-md p-1.5 text-zinc-400 transition hover:bg-zinc-200/60 hover:text-zinc-700"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut className="size-4" aria-hidden />
          </button>
        </div>
      </div>
    </nav>
  )

  return (
    <div className="min-h-screen bg-zinc-50 lg:flex">
      {/* desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-zinc-200/80 bg-zinc-50 lg:block">
        <div className="sticky top-0 h-screen">{sidebar}</div>
      </aside>

      {/* mobile top bar + drawer */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-zinc-200/80 bg-white/80 px-4 backdrop-blur lg:hidden">
        <Logo compact />
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="rounded-md p-2 text-zinc-600"
        >
          <Menu className="size-5" />
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-zinc-950/30 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-72 bg-zinc-50 shadow-elevated">
            <button
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="absolute top-4 right-4 rounded-md p-1 text-zinc-400"
            >
              <X className="size-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-8 lg:py-10">
          <Outlet />
        </main>
        <footer className="mx-auto w-full max-w-6xl px-4 pb-8 sm:px-8">
          <div className="border-t border-zinc-200/80 pt-5">
            <Disclaimer />
          </div>
        </footer>
      </div>
    </div>
  )
}
