'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import RequestsBadge from '@/components/RequestsBadge'
import HetaLogo from '@/components/HetaLogo'

const INTERNAL_ROLES = ['ADMIN', 'SERVICE_MANAGER', 'SERVICE_TECHNICIAN']
const EXTERNAL_ROLES = ['MAINTENANCE_MANAGER', 'MAINTENANCE_TECHNICIAN', 'BUYER']

const navItems = [
  {
    href: '/',
    label: 'Dashboard',
    roles: null,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    href: '/jobs',
    label: 'Einsätze',
    roles: null,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
  },
  {
    href: '/customers',
    label: 'Kunden',
    roles: INTERNAL_ROLES,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    href: '/materialien',
    label: 'Materialien',
    roles: INTERNAL_ROLES,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
  {
    href: '/opportunities',
    label: 'Vertrieb',
    roles: ['ADMIN', 'SERVICE_MANAGER'],
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    href: '/requests',
    label: 'Anfragen',
    roles: ['ADMIN', 'SERVICE_MANAGER', 'SERVICE_TECHNICIAN'],
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
      </svg>
    ),
  },
]

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin',
  SERVICE_MANAGER: 'Service Manager',
  SERVICE_TECHNICIAN: 'Techniker',
  MAINTENANCE_MANAGER: 'Instandhaltungsleiter',
  MAINTENANCE_TECHNICIAN: 'Instandh.-Techniker',
  BUYER: 'Einkäufer',
}

interface SidebarProps {
  isOpen?: boolean
  onClose?: () => void
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname()
  const { data: session } = useSession()

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  const role = session?.user?.role as string | undefined
  const isInternal = role ? INTERNAL_ROLES.includes(role) : false
  const isExternal = role ? EXTERNAL_ROLES.includes(role) : false
  const customerName = session?.user?.customerName

  const visibleNavItems = navItems.filter(item =>
    item.roles === null || (role && item.roles.includes(role))
  )

  return (
    <aside className={`w-64 bg-slate-900 text-white flex flex-col min-h-screen fixed left-0 top-0 bottom-0 z-30 transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
      {/* Logo */}
      <div className="px-6 py-5 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <HetaLogo className="h-8 w-8 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm leading-tight">HETA Verfahrenstechnik</div>
            <div className="text-xs text-slate-400 leading-tight">ServiceHub</div>
          </div>
          {/* Close button — mobile only */}
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Menü schließen"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Anfragen-Link — nur für externe Nutzer mit Anfrage-Berechtigung */}
      {role && ['MAINTENANCE_MANAGER', 'BUYER'].includes(role) && (
        <Link
          href="/portal/requests"
          onClick={onClose}
          className={`mx-3 mt-3 px-3 py-2.5 rounded-lg flex items-center gap-3 text-sm font-medium transition-colors ${
            isActive('/portal/requests')
              ? 'bg-blue-600 text-white'
              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
          Anfragen
          <RequestsBadge />
        </Link>
      )}

      {/* Firmen-Badge für externe Nutzer — klickbar */}
      {isExternal && (
        <Link
          href="/portal"
          onClick={onClose}
          className={`mx-3 mt-3 px-3 py-2.5 rounded-lg border flex items-center gap-2.5 transition-colors group ${
            isActive('/portal') && !isActive('/portal/requests')
              ? 'bg-green-700/50 border-green-600/60'
              : 'bg-green-900/30 border-green-700/30 hover:bg-green-800/40 hover:border-green-600/50'
          }`}
        >
          <div className="w-7 h-7 bg-green-700/60 rounded-md flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-green-400 font-semibold leading-tight truncate">
              {customerName ?? 'Mein Unternehmen'}
            </p>
            <p className="text-xs text-green-600 leading-tight">Unternehmensportal</p>
          </div>
          <svg className="w-3.5 h-3.5 text-green-600 group-hover:text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {visibleNavItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={onClose}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isActive(item.href)
                ? 'bg-blue-600 text-white'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            {item.icon}
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Admin Links — nur intern */}
      {(role === 'ADMIN' || role === 'SERVICE_MANAGER') && (
        <div className="px-3 py-3 border-t border-slate-700 space-y-1">
          {role === 'ADMIN' && (
            <Link href="/admin/users" onClick={onClose} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive('/admin/users') ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              Benutzerverwaltung
            </Link>
          )}
<Link href="/admin/plant-types" onClick={onClose} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive('/admin/plant-types') ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 8h.01M9 16h.01M15 12h-6" />
            </svg>
            Anlagentypen
          </Link>
          {role === 'ADMIN' && (
            <Link href="/admin/backup" onClick={onClose} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive('/admin/backup') ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              Datensicherung
            </Link>
          )}
          {role === 'ADMIN' && (
            <Link href="/admin/update" onClick={onClose} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive('/admin/update') ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Server-Update
            </Link>
          )}
        </div>
      )}

      {/* User Info & Logout */}
      {session?.user && (
        <div className="px-4 py-4 border-t border-slate-700">
          <div className="mb-3">
            <p className="text-sm font-medium text-white truncate">{session.user.name}</p>
            <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium ${isInternal ? 'bg-blue-500 text-white' : 'bg-green-600 text-white'}`}>
              {ROLE_LABELS[role ?? ''] ?? role}
            </span>
          </div>
          <Link
            href="/settings/password"
            onClick={onClose}
            className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
              isActive('/settings/password') ? 'bg-slate-700 text-white' : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            Passwort ändern
          </Link>
          <button
            onClick={async () => { await signOut({ redirect: false }); window.location.href = '/login' }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Abmelden
          </button>
        </div>
      )}

      <div className="px-6 py-3 border-t border-slate-700">
        <p className="text-xs text-slate-500">HETA Verfahrenstechnik GmbH</p>
        <p className="text-xs text-slate-600">Gottlieb-Daimler-Str. 7 · D-35423 Lich</p>
      </div>
    </aside>
  )
}
