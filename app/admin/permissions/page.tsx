'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

type Permission = {
  id: string
  role: string
  resource: string
  canView: boolean
  canCreate: boolean
  canEdit: boolean
  canDelete: boolean
  scope: string
}

const ROLES = [
  'ADMIN',
  'SERVICE_MANAGER',
  'SERVICE_TECHNICIAN',
  'MAINTENANCE_MANAGER',
  'MAINTENANCE_TECHNICIAN',
  'BUYER',
]

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrator',
  SERVICE_MANAGER: 'Service Manager',
  SERVICE_TECHNICIAN: 'Service Techniker',
  MAINTENANCE_MANAGER: 'Instandhaltungsleiter',
  MAINTENANCE_TECHNICIAN: 'Instandhaltungstechniker',
  BUYER: 'Einkäufer',
}

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

export default function PermissionsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  const currentRole = session?.user?.role as string | undefined

  const loadPermissions = useCallback(async () => {
    const res = await fetch('/api/permissions')
    if (res.ok) {
      setPermissions(await res.json())
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (status === 'loading') return
    if (!session?.user || (currentRole !== 'ADMIN' && currentRole !== 'SERVICE_MANAGER')) {
      router.push('/')
      return
    }
    loadPermissions()
  }, [session, status, router, loadPermissions, currentRole])

  function getPermission(role: string, resource: string): Permission | undefined {
    return permissions.find((p) => p.role === role && p.resource === resource)
  }

  function isRowEditable(role: string): boolean {
    if (role === 'ADMIN') return false
    if (role === 'SERVICE_MANAGER') return currentRole === 'ADMIN'
    return true
  }

  async function updatePermission(
    role: string,
    resource: string,
    field: string,
    value: boolean | string
  ) {
    const perm = getPermission(role, resource)
    const base = perm ?? {
      role, resource, canView: false, canCreate: false, canEdit: false, canDelete: false, scope: 'all',
    }
    const updated = { ...base, [field]: value }

    const key = `${role}-${resource}`
    setSaving(key)

    await fetch('/api/permissions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        permRole: role,
        resource,
        canView: updated.canView,
        canCreate: updated.canCreate,
        canEdit: updated.canEdit,
        canDelete: updated.canDelete,
        scope: updated.scope,
      }),
    })

    await loadPermissions()
    setSaving(null)
  }

  if (status === 'loading' || loading) {
    return <div className="flex items-center justify-center h-64 text-gray-500">Laden...</div>
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Berechtigungen</h1>
        <p className="text-sm text-gray-500 mt-1">Rollenbezogene Zugriffsrechte verwalten</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-48">Ressource</th>
              {ROLES.map((role) => (
                <th key={role} className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide min-w-[140px]">
                  {ROLE_LABELS[role]}
                  {role === 'ADMIN' && <div className="text-gray-400 font-normal normal-case text-xs mt-0.5">(unveränderlich)</div>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {RESOURCES.map((resource) => (
              <tr key={resource} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-700">
                  {RESOURCE_LABELS[resource]}
                </td>
                {ROLES.map((role) => {
                  const perm = getPermission(role, resource)
                  const editable = isRowEditable(role)
                  const key = `${role}-${resource}`
                  const isSaving = saving === key

                  return (
                    <td key={role} className={`px-3 py-3 text-center ${!editable ? 'opacity-50' : ''}`}>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-center gap-3">
                          {[
                            { field: 'canView', label: 'S' },
                            { field: 'canCreate', label: 'E' },
                            { field: 'canEdit', label: 'B' },
                            { field: 'canDelete', label: 'L' },
                          ].map(({ field, label }) => (
                            <label key={field} className="flex flex-col items-center gap-1 cursor-pointer">
                              <span className="text-xs text-gray-400">{label}</span>
                              <input
                                type="checkbox"
                                checked={perm ? (perm[field as keyof Permission] as boolean) : false}
                                disabled={!editable || isSaving}
                                onChange={(e) => updatePermission(role, resource, field, e.target.checked)}
                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-60"
                              />
                            </label>
                          ))}
                        </div>
                        {editable && (
                          <select
                            value={perm?.scope ?? 'all'}
                            disabled={isSaving}
                            onChange={(e) => updatePermission(role, resource, 'scope', e.target.value)}
                            className="w-full text-xs border border-gray-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
                          >
                            {SCOPE_OPTIONS.map((s) => (
                              <option key={s.value} value={s.value}>{s.label}</option>
                            ))}
                          </select>
                        )}
                        {!editable && perm && (
                          <div className="text-xs text-gray-400">{SCOPE_OPTIONS.find(s => s.value === perm.scope)?.label ?? perm.scope}</div>
                        )}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400 mt-3">
        S = Sehen · E = Erstellen · B = Bearbeiten · L = Löschen
      </p>
    </div>
  )
}
