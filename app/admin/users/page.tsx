'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

// ─── Types ────────────────────────────────────────────────────────────────────

type User = {
  id: string
  name: string
  email: string
  role: string
  active: boolean
  customerId: string | null
  customer: { id: string; name: string } | null
  createdAt: string
}

type Customer = { id: string; name: string }

type PermRow = {
  resource: string
  hasOverride: boolean
  canView: boolean | null
  canCreate: boolean | null
  canEdit: boolean | null
  canDelete: boolean | null
  scope: string | null
}

type RolePerm = {
  resource: string
  canView: boolean
  canCreate: boolean
  canEdit: boolean
  canDelete: boolean
  scope: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const RESOURCES = ['customers', 'plants', 'jobs', 'checklist', 'opportunities', 'users']
const RESOURCE_LABELS: Record<string, string> = {
  customers: 'Kunden',
  plants: 'Anlagen',
  jobs: 'Einsätze',
  checklist: 'Checkliste',
  opportunities: 'Vertrieb',
  users: 'Benutzer',
}
const SCOPE_OPTIONS = [
  { value: 'all', label: 'Alle' },
  { value: 'own_company', label: 'Eigene Firma' },
  { value: 'own_plant', label: 'Eigene Anlage' },
]

const INTERNAL_ROLES = ['ADMIN', 'SERVICE_MANAGER', 'SERVICE_TECHNICIAN']
const EXTERNAL_ROLES = ['MAINTENANCE_MANAGER', 'MAINTENANCE_TECHNICIAN', 'BUYER']

const ROLE_OPTIONS_INTERNAL = [
  { value: 'ADMIN', label: 'Administrator' },
  { value: 'SERVICE_MANAGER', label: 'Service Manager' },
  { value: 'SERVICE_TECHNICIAN', label: 'Service Techniker' },
]
const ROLE_OPTIONS_EXTERNAL = [
  { value: 'MAINTENANCE_MANAGER', label: 'Instandhaltungsleiter' },
  { value: 'MAINTENANCE_TECHNICIAN', label: 'Instandhaltungstechniker' },
  { value: 'BUYER', label: 'Einkäufer' },
]
const ALL_ROLE_OPTIONS = [...ROLE_OPTIONS_INTERNAL, ...ROLE_OPTIONS_EXTERNAL]

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin',
  SERVICE_MANAGER: 'Service Manager',
  SERVICE_TECHNICIAN: 'Techniker',
  MAINTENANCE_MANAGER: 'Instandh.-Leiter',
  MAINTENANCE_TECHNICIAN: 'Instandh.-Techniker',
  BUYER: 'Einkäufer',
}

const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'bg-red-100 text-red-700',
  SERVICE_MANAGER: 'bg-blue-100 text-blue-700',
  SERVICE_TECHNICIAN: 'bg-blue-50 text-blue-600',
  MAINTENANCE_MANAGER: 'bg-green-100 text-green-700',
  MAINTENANCE_TECHNICIAN: 'bg-green-50 text-green-600',
  BUYER: 'bg-purple-100 text-purple-700',
}

const INTERNAL_GROUP_ORDER = ['ADMIN', 'SERVICE_MANAGER', 'SERVICE_TECHNICIAN']
const INTERNAL_GROUP_LABELS: Record<string, string> = {
  ADMIN: 'Administrator',
  SERVICE_MANAGER: 'Service Manager',
  SERVICE_TECHNICIAN: 'Service Techniker',
}

const EXTERNAL_ONLY_RESOURCES = ['opportunities', 'users']

// ─── Permission Matrix Component ─────────────────────────────────────────────

function PermissionMatrix({
  userId,
  rolePerms,
  isExternal,
  onClose,
}: {
  userId: string
  rolePerms: RolePerm[]
  isExternal: boolean
  onClose: () => void
}) {
  const [perms, setPerms] = useState<PermRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(`/api/users/${userId}/permissions`)
      .then(r => r.json())
      .then((data: PermRow[]) => {
        // If no override, fill in null (will display role default as placeholder)
        setPerms(data)
        setLoading(false)
      })
  }, [userId])

  // Effective value: user override or role default
  function effective(row: PermRow, field: 'canView' | 'canCreate' | 'canEdit' | 'canDelete' | 'scope') {
    if (row.hasOverride) {
      if (field === 'scope') return row.scope ?? 'all'
      return row[field] ?? false
    }
    const rp = rolePerms.find(r => r.resource === row.resource)
    if (!rp) return field === 'scope' ? 'all' : false
    return rp[field]
  }

  function toggle(resource: string, field: 'canView' | 'canCreate' | 'canEdit' | 'canDelete') {
    setPerms(prev => prev.map(row => {
      if (row.resource !== resource) return row
      const current = effective(row, field) as boolean
      return {
        ...row,
        hasOverride: true,
        canView: row.hasOverride ? row.canView : (rolePerms.find(r => r.resource === resource)?.canView ?? false),
        canCreate: row.hasOverride ? row.canCreate : (rolePerms.find(r => r.resource === resource)?.canCreate ?? false),
        canEdit: row.hasOverride ? row.canEdit : (rolePerms.find(r => r.resource === resource)?.canEdit ?? false),
        canDelete: row.hasOverride ? row.canDelete : (rolePerms.find(r => r.resource === resource)?.canDelete ?? false),
        scope: row.scope ?? rolePerms.find(r => r.resource === resource)?.scope ?? 'all',
        [field]: !current,
      }
    }))
  }

  function setScope(resource: string, scope: string) {
    setPerms(prev => prev.map(row => {
      if (row.resource !== resource) return row
      return {
        ...row,
        hasOverride: true,
        canView: row.hasOverride ? row.canView : (rolePerms.find(r => r.resource === resource)?.canView ?? false),
        canCreate: row.hasOverride ? row.canCreate : (rolePerms.find(r => r.resource === resource)?.canCreate ?? false),
        canEdit: row.hasOverride ? row.canEdit : (rolePerms.find(r => r.resource === resource)?.canEdit ?? false),
        canDelete: row.hasOverride ? row.canDelete : (rolePerms.find(r => r.resource === resource)?.canDelete ?? false),
        scope,
      }
    }))
  }

  function resetToRole(resource: string) {
    setPerms(prev => prev.map(row => {
      if (row.resource !== resource) return row
      return { ...row, hasOverride: false, canView: null, canCreate: null, canEdit: null, canDelete: null, scope: null }
    }))
  }

  async function save() {
    setSaving(true)
    const payload = perms
      .filter(row => !isExternal || !EXTERNAL_ONLY_RESOURCES.includes(row.resource))
      .map(row => {
        if (!row.hasOverride) {
          return { resource: row.resource, remove: true, canView: false, canCreate: false, canEdit: false, canDelete: false, scope: 'all' }
        }
        return {
          resource: row.resource,
          canView: row.canView ?? false,
          canCreate: isExternal ? false : (row.canCreate ?? false),
          canEdit: isExternal ? false : (row.canEdit ?? false),
          canDelete: isExternal ? false : (row.canDelete ?? false),
          scope: row.scope ?? 'all',
        }
      })
    await fetch(`/api/users/${userId}/permissions`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setSaving(false)
    onClose()
  }

  if (loading) return (
    <div className="p-6 text-center text-gray-400 text-sm">Lade Berechtigungen...</div>
  )

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-gray-500">
          Individuelle Rechte — überschreiben die Rollen-Standards.
          <span className="ml-1 text-gray-400">Grau = Rollen-Standard</span>
        </p>
      </div>
      <div className="overflow-x-auto">
        {isExternal && (
          <div className="mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
            Externe Benutzer haben nur Leserechte. Schreibrechte und die Bereiche Vertrieb & Benutzer sind nicht verfügbar.
          </div>
        )}
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 pr-3 text-gray-500 font-medium w-28">Bereich</th>
              <th className="text-center px-2 py-2 text-gray-500 font-medium">Sehen</th>
              {!isExternal && <>
                <th className="text-center px-2 py-2 text-gray-500 font-medium">Erstellen</th>
                <th className="text-center px-2 py-2 text-gray-500 font-medium">Bearbeiten</th>
                <th className="text-center px-2 py-2 text-gray-500 font-medium">Löschen</th>
              </>}
              <th className="text-center px-2 py-2 text-gray-500 font-medium">Umfang</th>
              <th className="px-2 py-2 w-16"></th>
            </tr>
          </thead>
          <tbody>
            {perms.filter(row => !isExternal || !EXTERNAL_ONLY_RESOURCES.includes(row.resource)).map(row => {
              const isOverride = row.hasOverride
              return (
                <tr key={row.resource} className={`border-b border-gray-50 ${isOverride ? 'bg-blue-50/40' : ''}`}>
                  <td className="py-2 pr-3">
                    <span className="font-medium text-gray-700">{RESOURCE_LABELS[row.resource]}</span>
                    {isOverride && <span className="ml-1 text-blue-500">✎</span>}
                  </td>
                  <td className="px-2 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={effective(row, 'canView') as boolean}
                      onChange={() => toggle(row.resource, 'canView')}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  {!isExternal && (['canCreate', 'canEdit', 'canDelete'] as const).map(field => (
                    <td key={field} className="px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={effective(row, field) as boolean}
                        onChange={() => toggle(row.resource, field)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                  ))}
                  <td className="px-2 py-2">
                    <select
                      value={effective(row, 'scope') as string}
                      onChange={e => setScope(row.resource, e.target.value)}
                      className="w-full border border-gray-200 rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      {SCOPE_OPTIONS.map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-2 text-center">
                    {isOverride && (
                      <button
                        onClick={() => resetToRole(row.resource)}
                        className="text-gray-400 hover:text-red-500 text-xs"
                        title="Auf Rollen-Standard zurücksetzen"
                      >
                        ↺
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="flex gap-2 mt-4 justify-end">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
        >
          Abbrechen
        </button>
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium"
        >
          {saving ? 'Speichern...' : 'Speichern'}
        </button>
      </div>
    </div>
  )
}

// ─── User Card ────────────────────────────────────────────────────────────────

function UserCard({
  user,
  canEditRole,
  customers,
  rolePerms,
  onEdit,
  onToggle,
  onDelete,
}: {
  user: User
  canEditRole: boolean
  customers: Customer[]
  rolePerms: RolePerm[]
  onEdit: (u: User) => void
  onToggle: (u: User) => void
  onDelete: (u: User) => void
}) {
  const isExternal = EXTERNAL_ROLES.includes(user.role)
  const [showPerms, setShowPerms] = useState(false)

  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${user.active ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-70'}`}>
      {/* Card header */}
      <div className="px-4 py-3 flex items-center gap-3">
        {/* Avatar */}
        <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold text-white ${user.active ? 'bg-slate-600' : 'bg-gray-400'}`}>
          {user.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-gray-900 text-sm">{user.name}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${ROLE_COLORS[user.role] ?? 'bg-gray-100 text-gray-600'}`}>
              {ROLE_LABELS[user.role] ?? user.role}
            </span>
            {!user.active && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">Inaktiv</span>
            )}
          </div>
          <div className="text-xs text-gray-400 truncate mt-0.5">{user.email}</div>
        </div>
        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setShowPerms(v => !v)}
            title="Berechtigungen"
            className={`p-1.5 rounded-lg text-xs transition-colors ${showPerms ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </button>
          <button
            onClick={() => onEdit(user)}
            title="Bearbeiten"
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={() => onToggle(user)}
            title={user.active ? 'Deaktivieren' : 'Aktivieren'}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {user.active
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              }
            </svg>
          </button>
          {user.role !== 'ADMIN' && (
            <button
              onClick={() => onDelete(user)}
              title="Löschen"
              className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Permissions panel */}
      {showPerms && (
        <div className="border-t border-gray-100">
          <PermissionMatrix
            userId={user.id}
            rolePerms={rolePerms}
            isExternal={isExternal}
            onClose={() => setShowPerms(false)}
          />
        </div>
      )}
    </div>
  )
}

// ─── Customer Group (External) ─────────────────────────────────────────────────

function CustomerGroup({
  customer,
  users,
  rolePerms,
  customers,
  onEdit,
  onToggle,
  onDelete,
  onAddUser,
}: {
  customer: Customer
  users: User[]
  rolePerms: RolePerm[]
  customers: Customer[]
  onEdit: (u: User) => void
  onToggle: (u: User) => void
  onDelete: (u: User) => void
  onAddUser: (customerId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const activeCount = users.filter(u => u.active).length

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
      {/* Header */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
        onClick={() => setOpen(v => !v)}
      >
        <div className="w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        </div>
        <div className="flex-1">
          <p className="font-semibold text-gray-900 text-sm">{customer.name}</p>
          <p className="text-xs text-gray-400">
            {users.length} Benutzer{users.length !== 1 ? '' : ''} · {activeCount} aktiv
          </p>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Users */}
      {open && (
        <div className="border-t border-gray-100 p-3 space-y-2">
          {users.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-3">Keine Benutzer für diesen Kunden</p>
          ) : (
            users.map(u => (
              <UserCard
                key={u.id}
                user={u}
                canEditRole={true}
                customers={customers}
                rolePerms={rolePerms}
                onEdit={onEdit}
                onToggle={onToggle}
                onDelete={onDelete}
              />
            ))
          )}
          <button
            onClick={() => onAddUser(customer.id)}
            className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg border border-dashed border-blue-200 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Benutzer hinzufügen
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [rolePerms, setRolePerms] = useState<RolePerm[]>([])
  const [loading, setLoading] = useState(true)

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [form, setForm] = useState({
    name: '', email: '', password: '', userRole: 'SERVICE_TECHNICIAN', customerId: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const currentRole = session?.user?.role as string | undefined

  const loadAll = useCallback(async () => {
    const [uRes, cRes, pRes] = await Promise.all([
      fetch('/api/users'),
      fetch('/api/customers'),
      fetch('/api/permissions'),
    ])
    if (uRes.ok) setUsers(await uRes.json())
    if (cRes.ok) setCustomers(await cRes.json())
    if (pRes.ok) setRolePerms(await pRes.json())
    setLoading(false)
  }, [])

  useEffect(() => {
    if (status === 'loading') return
    if (!session?.user || currentRole !== 'ADMIN') {
      router.push('/')
      return
    }
    loadAll()
  }, [session, status, router, loadAll, currentRole])

  function openCreate(presetCustomerId?: string, presetRole?: string) {
    setEditUser(null)
    setForm({
      name: '', email: '', password: '',
      userRole: presetRole ?? (presetCustomerId ? 'MAINTENANCE_MANAGER' : 'SERVICE_TECHNICIAN'),
      customerId: presetCustomerId ?? '',
    })
    setError('')
    setShowForm(true)
  }

  function openEdit(user: User) {
    setEditUser(user)
    setForm({
      name: user.name,
      email: user.email,
      password: '',
      userRole: user.role,
      customerId: user.customerId ?? '',
    })
    setError('')
    setShowForm(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = {
        ...form,
        customerId: EXTERNAL_ROLES.includes(form.userRole) ? form.customerId : null,
      }
      let res: Response
      if (editUser) {
        const { password, ...rest } = payload
        res = await fetch(`/api/users/${editUser.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(password ? payload : rest),
        })
      } else {
        res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Fehler beim Speichern')
      } else {
        setShowForm(false)
        await loadAll()
      }
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(user: User) {
    await fetch(`/api/users/${user.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !user.active }),
    })
    await loadAll()
  }

  async function deleteUser(user: User) {
    if (!confirm(`Benutzer "${user.name}" wirklich löschen?`)) return
    await fetch(`/api/users/${user.id}`, { method: 'DELETE' })
    await loadAll()
  }

  if (status === 'loading' || loading) {
    return <div className="flex items-center justify-center h-64 text-gray-500">Laden...</div>
  }

  // Split users
  const internalUsers = users.filter(u => INTERNAL_ROLES.includes(u.role))
  const externalUsers = users.filter(u => EXTERNAL_ROLES.includes(u.role))

  // Get rolePerms for a given role
  function permsForRole(role: string): RolePerm[] {
    return rolePerms.filter((p: any) => p.role === role)
  }

  // (customers list already contains all relevant companies)

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Benutzerverwaltung</h1>
          <p className="text-sm text-gray-500 mt-1">
            {users.length} Benutzer · {internalUsers.length} intern · {externalUsers.length} extern
          </p>
        </div>
        <button
          onClick={() => openCreate()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Neuer Benutzer
        </button>
      </div>

      {/* ── INTERN ─────────────────────────────────────────────────────────── */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h2 className="text-base font-bold text-gray-900">Interne Benutzer</h2>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{internalUsers.length}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {INTERNAL_GROUP_ORDER.map(role => {
            const group = internalUsers.filter(u => u.role === role)
            return (
              <div key={role} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                {/* Group header */}
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{INTERNAL_GROUP_LABELS[role]}</p>
                    <p className="text-xs text-gray-400">{group.length} Benutzer</p>
                  </div>
                  <button
                    onClick={() => openCreate(undefined, role)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                    title="Benutzer hinzufügen"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>
                {/* Users */}
                <div className="p-2 space-y-2 min-h-[60px]">
                  {group.length === 0 ? (
                    <p className="text-xs text-gray-300 text-center py-4">Keine Benutzer</p>
                  ) : (
                    group.map(u => (
                      <UserCard
                        key={u.id}
                        user={u}
                        canEditRole={role !== 'ADMIN'}
                        customers={customers}
                        rolePerms={permsForRole(u.role)}
                        onEdit={openEdit}
                        onToggle={toggleActive}
                        onDelete={deleteUser}
                      />
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── EXTERN ─────────────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-7 h-7 bg-green-600 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h2 className="text-base font-bold text-gray-900">Externe Benutzer</h2>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{externalUsers.length}</span>
          <span className="text-xs text-gray-400">nach Unternehmen</span>
        </div>

        {customers.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-sm text-gray-400">
            Keine Kunden angelegt. Zuerst einen Kunden erstellen.
          </div>
        ) : (
          <div className="space-y-3">
            {customers.map(c => {
              const cusUsers = externalUsers.filter(u => u.customerId === c.id)
              return (
                <CustomerGroup
                  key={c.id}
                  customer={c}
                  users={cusUsers}
                  rolePerms={rolePerms.filter((p: any) => EXTERNAL_ROLES.includes(p.role))}
                  customers={customers}
                  onEdit={openEdit}
                  onToggle={toggleActive}
                  onDelete={deleteUser}
                  onAddUser={(cid) => openCreate(cid)}
                />
              )
            })}
            {/* External users without customer */}
            {(() => {
              const orphans = externalUsers.filter(u => !u.customerId)
              if (orphans.length === 0) return null
              return (
                <div className="border border-amber-200 bg-amber-50 rounded-xl p-4">
                  <p className="text-xs font-semibold text-amber-700 mb-2">Externe ohne Kundenzuordnung</p>
                  <div className="space-y-2">
                    {orphans.map(u => (
                      <UserCard
                        key={u.id}
                        user={u}
                        canEditRole={true}
                        customers={customers}
                        rolePerms={permsForRole(u.role)}
                        onEdit={openEdit}
                        onToggle={toggleActive}
                        onDelete={deleteUser}
                      />
                    ))}
                  </div>
                </div>
              )
            })()}
          </div>
        )}
      </div>

      {/* ── FORM MODAL ─────────────────────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">
                {editUser ? 'Benutzer bearbeiten' : 'Neuer Benutzer'}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">E-Mail</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Passwort {editUser && <span className="text-gray-400 font-normal">(leer = unverändert)</span>}
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  required={!editUser}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rolle</label>
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-gray-500 mb-1 font-medium">Intern</p>
                    <div className="grid grid-cols-3 gap-1">
                      {ROLE_OPTIONS_INTERNAL.map(r => (
                        <button
                          key={r.value}
                          type="button"
                          onClick={() => setForm({ ...form, userRole: r.value, customerId: '' })}
                          className={`py-1.5 px-2 text-xs rounded-lg border transition-colors text-left ${form.userRole === r.value ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1 font-medium">Extern</p>
                    <div className="grid grid-cols-3 gap-1">
                      {ROLE_OPTIONS_EXTERNAL.map(r => (
                        <button
                          key={r.value}
                          type="button"
                          onClick={() => setForm({ ...form, userRole: r.value })}
                          className={`py-1.5 px-2 text-xs rounded-lg border transition-colors text-left ${form.userRole === r.value ? 'bg-green-600 text-white border-green-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              {EXTERNAL_ROLES.includes(form.userRole) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unternehmen (Kunde)</label>
                  <select
                    value={form.customerId}
                    onChange={e => setForm({ ...form, customerId: e.target.value })}
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Unternehmen auswählen...</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
                  {error}
                </div>
              )}
              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-2.5 px-4 rounded-lg text-sm font-medium"
                >
                  {saving ? 'Speichern...' : 'Speichern'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 border border-gray-300 hover:bg-gray-50 text-gray-700 py-2.5 px-4 rounded-lg text-sm font-medium"
                >
                  Abbrechen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
