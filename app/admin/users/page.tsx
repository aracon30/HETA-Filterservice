'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

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

const ROLE_OPTIONS = [
  { value: 'ADMIN', label: 'Administrator' },
  { value: 'SERVICE_MANAGER', label: 'Service Manager' },
  { value: 'SERVICE_TECHNICIAN', label: 'Service Techniker' },
  { value: 'MAINTENANCE_MANAGER', label: 'Instandhaltungsleiter' },
  { value: 'MAINTENANCE_TECHNICIAN', label: 'Instandhaltungstechniker' },
  { value: 'BUYER', label: 'Einkäufer' },
]

const EXTERNAL_ROLES = ['MAINTENANCE_MANAGER', 'MAINTENANCE_TECHNICIAN', 'BUYER']

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin',
  SERVICE_MANAGER: 'Service Manager',
  SERVICE_TECHNICIAN: 'Techniker',
  MAINTENANCE_MANAGER: 'Instandhaltungsleiter',
  MAINTENANCE_TECHNICIAN: 'Instandhaltungstechniker',
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

export default function UsersPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [form, setForm] = useState({
    name: '', email: '', password: '', userRole: 'SERVICE_TECHNICIAN', customerId: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const loadUsers = useCallback(async () => {
    const res = await fetch('/api/users')
    if (res.ok) {
      setUsers(await res.json())
    }
  }, [])

  useEffect(() => {
    if (status === 'loading') return
    if (!session?.user || session.user.role !== 'ADMIN') {
      router.push('/')
      return
    }
    const load = async () => {
      await loadUsers()
      const cRes = await fetch('/api/customers')
      if (cRes.ok) setCustomers(await cRes.json())
      setLoading(false)
    }
    load()
  }, [session, status, router, loadUsers])

  function openCreate() {
    setEditUser(null)
    setForm({ name: '', email: '', password: '', userRole: 'SERVICE_TECHNICIAN', customerId: '' })
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
        await loadUsers()
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
    await loadUsers()
  }

  async function deleteUser(user: User) {
    if (!confirm(`Benutzer "${user.name}" wirklich löschen?`)) return
    await fetch(`/api/users/${user.id}`, { method: 'DELETE' })
    await loadUsers()
  }

  if (status === 'loading' || loading) {
    return <div className="flex items-center justify-center h-64 text-gray-500">Laden...</div>
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Benutzerverwaltung</h1>
          <p className="text-sm text-gray-500 mt-1">{users.length} Benutzer</p>
        </div>
        <button
          onClick={openCreate}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Neuer Benutzer
        </button>
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-semibold mb-4">
              {editUser ? 'Benutzer bearbeiten' : 'Neuer Benutzer'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">E-Mail</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Passwort {editUser && <span className="text-gray-400">(leer lassen = unverändert)</span>}
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required={!editUser}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rolle</label>
                <select
                  value={form.userRole}
                  onChange={(e) => setForm({ ...form, userRole: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
              {EXTERNAL_ROLES.includes(form.userRole) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kunde</label>
                  <select
                    value={form.customerId}
                    onChange={(e) => setForm({ ...form, customerId: e.target.value })}
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Kunde auswählen...</option>
                    {customers.map((c) => (
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
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-2 px-4 rounded-lg text-sm font-medium"
                >
                  {saving ? 'Speichern...' : 'Speichern'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 border border-gray-300 hover:bg-gray-50 text-gray-700 py-2 px-4 rounded-lg text-sm font-medium"
                >
                  Abbrechen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Benutzer</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Rolle</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Kunde</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Aktionen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{user.name}</div>
                  <div className="text-xs text-gray-500">{user.email}</div>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[user.role] ?? 'bg-gray-100 text-gray-600'}`}>
                    {ROLE_LABELS[user.role] ?? user.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600 text-xs">
                  {user.customer?.name ?? '—'}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${user.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {user.active ? 'Aktiv' : 'Inaktiv'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => openEdit(user)}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Bearbeiten
                    </button>
                    <button
                      onClick={() => toggleActive(user)}
                      className="text-xs text-gray-500 hover:text-gray-700 font-medium"
                    >
                      {user.active ? 'Deaktivieren' : 'Aktivieren'}
                    </button>
                    {user.role !== 'ADMIN' && (
                      <button
                        onClick={() => deleteUser(user)}
                        className="text-xs text-red-500 hover:text-red-700 font-medium"
                      >
                        Löschen
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && (
          <div className="text-center py-12 text-gray-400">Keine Benutzer gefunden.</div>
        )}
      </div>
    </div>
  )
}
