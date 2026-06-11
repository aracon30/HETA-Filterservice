'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import InvoicePanel from '@/components/InvoicePanel'
import PlantDocuments from '@/components/PlantDocuments'
import PlantArchivedRequests from '@/components/PlantArchivedRequests'
import CustomerArchivedRequests from '@/components/CustomerArchivedRequests'

interface Plant {
  id: string
  name: string
  type: string
  serialNumber: string | null
  location: string | null
  installedAt: string | null
  buildYear: number | null
  description: string | null
  manufacturer: string | null
  model: string | null
  customerId: string
  defaultTechnicianId: string | null
  defaultTechnician: { id: string; name: string } | null
  externalUsers: { userId: string; user: { id: string; name: string } }[]
  _count?: { jobPlants: number }
}

interface CustomerUser {
  id: string
  name: string
  email: string | null
  phone: string | null
  role: string
}

interface Customer {
  id: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  plants: Plant[]
  users: CustomerUser[]
  _count: { jobs: number }
}

interface PlantType {
  id: string
  value: string
  label: string
  items: { section: string; label: string; order: number }[]
}

interface ChecklistOverrideItem {
  id?: string
  section: string
  label: string
  order: number
}

interface PlantForm {
  name: string
  type: string
  serialNumber: string
  location: string
  installedAt: string
  buildYear: string
  description: string
  manufacturer: string
  model: string
  defaultTechnicianId: string
  externalUserIds: string[]
}

const emptyPlantForm: PlantForm = {
  name: '',
  type: '',
  serialNumber: '',
  location: '',
  installedAt: '',
  buildYear: '',
  description: '',
  manufacturer: '',
  model: '',
  defaultTechnicianId: '',
  externalUserIds: [],
}

export default function CustomerDetailPage() {
  const { data: session } = useSession()
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [customer, setCustomer] = useState<Customer | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Edit customer state
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
  })
  const [saving, setSaving] = useState(false)

  // Delete customer state
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Plant modal state
  const [showPlantModal, setShowPlantModal] = useState(false)
  const [editingPlant, setEditingPlant] = useState<Plant | null>(null)
  const [plantForm, setPlantForm] = useState<PlantForm>(emptyPlantForm)
  const [submittingPlant, setSubmittingPlant] = useState(false)

  // Delete plant state
  const [plantToDelete, setPlantToDelete] = useState<Plant | null>(null)
  const [deletingPlant, setDeletingPlant] = useState(false)
  const [deletePlantError, setDeletePlantError] = useState<string | null>(null)

  // Plant types from DB
  const [plantTypes, setPlantTypes] = useState<PlantType[]>([])

  // Technician list for plant assignment (internal)
  const [internalTechs, setInternalTechs] = useState<{id: string; name: string}[]>([])

  // Per-plant checklist override editor
  const [checklistPlant, setChecklistPlant] = useState<Plant | null>(null)
  const [overrideItems, setOverrideItems] = useState<ChecklistOverrideItem[]>([])
  const [loadingOverride, setLoadingOverride] = useState(false)
  const [savingOverride, setSavingOverride] = useState(false)
  const [overrideHasData, setOverrideHasData] = useState(false)

  const role = session?.user?.role ?? ''
  const canEditDelete = ['ADMIN', 'SERVICE_MANAGER'].includes(role)
  const canManagePlants = ['ADMIN', 'SERVICE_MANAGER', 'SERVICE_TECHNICIAN'].includes(role)
  const canManageInvoices = ['ADMIN', 'SERVICE_MANAGER'].includes(role)

  const fetchCustomer = async () => {
    setLoading(true)
    const res = await fetch(`/api/customers/${id}`)
    if (res.ok) {
      const data = await res.json()
      setCustomer(data)
    } else {
      setError('Kunde nicht gefunden')
    }
    setLoading(false)
  }

  useEffect(() => {
    if (id) fetchCustomer()
    fetch('/api/plant-types').then(r => r.json()).then(setPlantTypes).catch(() => {})
    // Load internal technicians (SERVICE_TECHNICIAN)
    fetch('/api/users?role=SERVICE_TECHNICIAN').then(r => r.json()).then(data => {
      if (Array.isArray(data)) setInternalTechs(data.filter((u: {active: boolean}) => u.active))
    }).catch(() => {})
  }, [id])

  async function openChecklistEditor(plant: Plant) {
    setChecklistPlant(plant)
    setLoadingOverride(true)
    const res = await fetch(`/api/plants/${plant.id}/checklist`)
    if (res.ok) {
      const data: ChecklistOverrideItem[] = await res.json()
      if (data.length > 0) {
        setOverrideItems(data.map((item, idx) => ({ ...item, order: idx })))
        setOverrideHasData(true)
      } else {
        // Load type default as starting point
        const pt = plantTypes.find(p => p.value === plant.type)
        const defaults = pt?.items ?? []
        setOverrideItems(defaults.map((item, idx) => ({ section: item.section, label: item.label, order: idx })))
        setOverrideHasData(false)
      }
    }
    setLoadingOverride(false)
  }

  async function saveOverride() {
    if (!checklistPlant) return
    setSavingOverride(true)
    await fetch(`/api/plants/${checklistPlant.id}/checklist`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: overrideItems }),
    })
    setOverrideHasData(overrideItems.length > 0)
    setSavingOverride(false)
  }

  async function resetOverride() {
    if (!checklistPlant) return
    if (!confirm('Angepasste Checkliste löschen und Typ-Standard wiederherstellen?')) return
    await fetch(`/api/plants/${checklistPlant.id}/checklist`, { method: 'DELETE' })
    const pt = plantTypes.find(p => p.value === checklistPlant.type)
    setOverrideItems((pt?.items ?? []).map((item, idx) => ({ section: item.section, label: item.label, order: idx })))
    setOverrideHasData(false)
  }

  function addOverrideItem() {
    setOverrideItems(items => [...items, { section: '', label: '', order: items.length }])
  }

  function updateOverrideItem(idx: number, field: 'section' | 'label', value: string) {
    setOverrideItems(items => items.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }

  function removeOverrideItem(idx: number) {
    setOverrideItems(items => items.filter((_, i) => i !== idx).map((item, i) => ({ ...item, order: i })))
  }

  function moveOverrideItem(idx: number, dir: -1 | 1) {
    const newItems = [...overrideItems]
    const target = idx + dir
    if (target < 0 || target >= newItems.length) return
    ;[newItems[idx], newItems[target]] = [newItems[target], newItems[idx]]
    setOverrideItems(newItems.map((item, i) => ({ ...item, order: i })))
  }

  const startEdit = () => {
    if (!customer) return
    setEditForm({
      name: customer.name,
      email: customer.email ?? '',
      phone: customer.phone ?? '',
      address: customer.address ?? '',
    })
    setEditing(true)
  }

  const handleSave = async () => {
    setSaving(true)
    const res = await fetch(`/api/customers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    })
    if (res.ok) {
      await fetchCustomer()
      setEditing(false)
    }
    setSaving(false)
  }

  const handleDelete = async () => {
    setDeleting(true)
    setDeleteError(null)
    const res = await fetch(`/api/customers/${id}`, { method: 'DELETE' })
    if (res.ok) {
      router.push('/customers')
    } else {
      const data = await res.json()
      setDeleteError(data.error ?? 'Fehler beim Löschen')
      setDeleting(false)
    }
  }

  const openAddPlant = () => {
    setEditingPlant(null)
    setPlantForm(emptyPlantForm)
    setShowPlantModal(true)
  }

  const openEditPlant = (plant: Plant) => {
    setEditingPlant(plant)
    setPlantForm({
      name: plant.name,
      type: plant.type,
      serialNumber: plant.serialNumber ?? '',
      location: plant.location ?? '',
      installedAt: plant.installedAt ? plant.installedAt.slice(0, 10) : '',
      buildYear: plant.buildYear != null ? String(plant.buildYear) : '',
      description: plant.description ?? '',
      manufacturer: plant.manufacturer ?? '',
      model: plant.model ?? '',
      defaultTechnicianId: plant.defaultTechnicianId ?? '',
      externalUserIds: plant.externalUsers?.map(eu => eu.userId) ?? [],
    })
    setShowPlantModal(true)
  }

  const handlePlantSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmittingPlant(true)
    const payload = {
      ...plantForm,
      customerId: id,
      buildYear: plantForm.buildYear ? Number(plantForm.buildYear) : null,
      installedAt: plantForm.installedAt || null,
      defaultTechnicianId: plantForm.defaultTechnicianId || null,
      externalUserIds: plantForm.externalUserIds,
    }
    const url = editingPlant ? `/api/plants/${editingPlant.id}` : '/api/plants'
    const method = editingPlant ? 'PUT' : 'POST'
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    await fetchCustomer()
    setShowPlantModal(false)
    setSubmittingPlant(false)
  }

  const handleDeletePlant = async () => {
    if (!plantToDelete) return
    setDeletingPlant(true)
    setDeletePlantError(null)
    const res = await fetch(`/api/plants/${plantToDelete.id}`, { method: 'DELETE' })
    if (res.ok) {
      await fetchCustomer()
      setPlantToDelete(null)
    } else {
      const data = await res.json()
      setDeletePlantError(data.error ?? 'Fehler beim Löschen')
    }
    setDeletingPlant(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-sm text-gray-400">Laden...</div>
      </div>
    )
  }

  if (error || !customer) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="text-sm text-red-500">{error ?? 'Kunde nicht gefunden'}</div>
        <Link href="/customers" className="text-sm text-blue-600 hover:underline">Zurück zur Übersicht</Link>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Back */}
      <Link href="/customers" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Zurück zu Kunden
      </Link>

      {/* Customer info card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-8">
        <div className="flex items-start justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{customer.name}</h1>
          {canEditDelete && !editing && (
            <div className="flex gap-2">
              <button
                onClick={startEdit}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Bearbeiten
              </button>
              <button
                onClick={() => { setDeleteError(null); setShowDeleteModal(true) }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Löschen
              </button>
            </div>
          )}
        </div>

        {editing ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Firmenname <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={editForm.name}
                onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                required
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">E-Mail</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
                <input
                  type="tel"
                  value={editForm.phone}
                  onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Adresse</label>
              <input
                type="text"
                value={editForm.address}
                onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {saving ? 'Speichern...' : 'Speichern'}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
              >
                Abbrechen
              </button>
            </div>
          </div>
        ) : (
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Firmenname</dt>
              <dd className="text-sm text-gray-900">{customer.name}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Personen</dt>
              <dd className="text-sm text-gray-900">{customer.users.length} angelegt</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">E-Mail</dt>
              <dd className="text-sm">
                {customer.email ? (
                  <a href={`mailto:${customer.email}`} className="text-blue-600 hover:underline">{customer.email}</a>
                ) : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Telefon</dt>
              <dd className="text-sm text-gray-900">{customer.phone ?? '—'}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Adresse</dt>
              <dd className="text-sm text-gray-900">{customer.address ?? '—'}</dd>
            </div>
          </dl>
        )}
      </div>

      {/* Persons section — visible to internal roles */}
      {['ADMIN', 'SERVICE_MANAGER', 'SERVICE_TECHNICIAN'].includes(role) && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Personen</h2>
            <span className="inline-flex items-center justify-center px-2.5 py-0.5 bg-gray-100 text-gray-700 text-xs font-medium rounded-full">
              {customer.users.length}
            </span>
          </div>
          {customer.users.length === 0 ? (
            <p className="text-sm text-gray-400">Keine externen Benutzer angelegt. Benutzer können in der Benutzerverwaltung hinzugefügt werden.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 pr-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="text-left py-2 pr-4 text-xs font-medium text-gray-500 uppercase tracking-wider">E-Mail</th>
                    <th className="text-left py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Telefon</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {customer.users.map(u => (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="py-2.5 pr-4 font-medium text-gray-900">{u.name}</td>
                      <td className="py-2.5 pr-4 text-gray-600">
                        {u.email ? (
                          <a href={`mailto:${u.email}`} className="text-blue-600 hover:underline">{u.email}</a>
                        ) : '—'}
                      </td>
                      <td className="py-2.5 text-gray-600">{u.phone ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Plants section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-900">Anlagen</h2>
            <span className="inline-flex items-center justify-center px-2.5 py-0.5 bg-gray-100 text-gray-700 text-xs font-medium rounded-full">
              {customer.plants.length}
            </span>
          </div>
          {canManagePlants && (
            <button
              onClick={openAddPlant}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Anlage hinzufügen
            </button>
          )}
        </div>

        {customer.plants.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center text-sm text-gray-400">
            Keine Anlagen vorhanden
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {customer.plants.map(plant => (
              <div key={plant.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-semibold text-gray-900">{plant.name}</div>
                    <span className="inline-block mt-1 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                      {plant.type}
                    </span>
                  </div>
                  <div className="flex gap-1.5">
                    {canEditDelete && (
                      <button
                        onClick={() => openChecklistEditor(plant)}
                        className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors"
                        title="Checkliste anpassen"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 8h.01M9 16h.01M15 12h-6" />
                        </svg>
                      </button>
                    )}
                    {canManagePlants && (
                      <button
                        onClick={() => openEditPlant(plant)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Bearbeiten"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    )}
                    {canEditDelete && (
                      <button
                        onClick={() => { setDeletePlantError(null); setPlantToDelete(plant) }}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Löschen"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-1 text-sm">
                  {(plant.manufacturer || plant.model) && (
                    <div className="text-gray-600">
                      {[plant.manufacturer, plant.model].filter(Boolean).join(' · ')}
                    </div>
                  )}
                  {plant.buildYear && (
                    <div className="text-gray-500">Baujahr: {plant.buildYear}</div>
                  )}
                  {plant.serialNumber && (
                    <div className="text-gray-500">Seriennummer: {plant.serialNumber}</div>
                  )}
                  {plant.location && (
                    <div className="text-gray-500">Standort: {plant.location}</div>
                  )}
                  {plant.defaultTechnician && (
                    <div className="text-gray-500">Standardtechniker: {plant.defaultTechnician.name}</div>
                  )}
                  {plant.description && (
                    <p className="text-gray-500 line-clamp-2 mt-2">{plant.description}</p>
                  )}
                </div>

                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-4">
                  <Link
                    href={`/jobs?customer=${customer.id}`}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    {plant._count?.jobPlants ?? 0} Einsätze
                  </Link>
                </div>

                <PlantDocuments
                  plantId={plant.id}
                  customerId={customer.id}
                  role={role ?? ''}
                />
                {['ADMIN', 'SERVICE_MANAGER'].includes(role ?? '') && (
                  <PlantArchivedRequests plantId={plant.id} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete customer modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowDeleteModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Kunde löschen</h2>
            <p className="text-sm text-gray-600 mb-4">
              Wirklich löschen? Alle Anlagen werden ebenfalls gelöscht.
            </p>
            {deleteError && (
              <div className="mb-4 px-3 py-2 bg-red-50 text-red-700 text-sm rounded-lg">{deleteError}</div>
            )}
            <div className="flex gap-3">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleting ? 'Löschen...' : 'Löschen'}
              </button>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete plant modal */}
      {plantToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setPlantToDelete(null)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Anlage löschen</h2>
            <p className="text-sm text-gray-600 mb-4">
              Soll die Anlage &ldquo;{plantToDelete.name}&rdquo; wirklich gelöscht werden?
            </p>
            {deletePlantError && (
              <div className="mb-4 px-3 py-2 bg-red-50 text-red-700 text-sm rounded-lg">{deletePlantError}</div>
            )}
            <div className="flex gap-3">
              <button
                onClick={handleDeletePlant}
                disabled={deletingPlant}
                className="flex-1 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deletingPlant ? 'Löschen...' : 'Löschen'}
              </button>
              <button
                onClick={() => setPlantToDelete(null)}
                className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Plant modal (add/edit) */}
      {showPlantModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowPlantModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-xl mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingPlant ? 'Anlage bearbeiten' : 'Neue Anlage'}
              </h2>
              <button onClick={() => setShowPlantModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handlePlantSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={plantForm.name}
                    onChange={e => setPlantForm(f => ({ ...f, name: e.target.value }))}
                    required
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Typ <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={plantForm.type}
                    onChange={e => setPlantForm(f => ({ ...f, type: e.target.value }))}
                    required
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Anlagentyp auswählen...</option>
                    {plantTypes.map(pt => (
                      <option key={pt.value} value={pt.value}>{pt.label}</option>
                    ))}
                  </select>
                  {plantForm.type && (plantTypes.find(p => p.value === plantForm.type)?.items.length ?? 0) > 0 ? (
                    <p className="mt-1 text-xs text-green-600">
                      ✓ Typspezifische Checkliste ({plantTypes.find(p => p.value === plantForm.type)!.items.length} Punkte) verfügbar
                    </p>
                  ) : plantForm.type ? (
                    <p className="mt-1 text-xs text-gray-400">Standard-Checkliste wird verwendet</p>
                  ) : null}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hersteller</label>
                  <input
                    type="text"
                    value={plantForm.manufacturer}
                    onChange={e => setPlantForm(f => ({ ...f, manufacturer: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Modell</label>
                  <input
                    type="text"
                    value={plantForm.model}
                    onChange={e => setPlantForm(f => ({ ...f, model: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Baujahr</label>
                  <input
                    type="number"
                    value={plantForm.buildYear}
                    onChange={e => setPlantForm(f => ({ ...f, buildYear: e.target.value }))}
                    min={1900}
                    max={2100}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Seriennummer</label>
                  <input
                    type="text"
                    value={plantForm.serialNumber}
                    onChange={e => setPlantForm(f => ({ ...f, serialNumber: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Standort</label>
                <input
                  type="text"
                  value={plantForm.location}
                  onChange={e => setPlantForm(f => ({ ...f, location: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Installiert am</label>
                <input
                  type="date"
                  value={plantForm.installedAt}
                  onChange={e => setPlantForm(f => ({ ...f, installedAt: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Beschreibung</label>
                <textarea
                  value={plantForm.description}
                  onChange={e => setPlantForm(f => ({ ...f, description: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Standardtechniker (intern) */}
              {canManagePlants && internalTechs.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Standardtechniker (intern)</label>
                  <select
                    value={plantForm.defaultTechnicianId}
                    onChange={e => setPlantForm(f => ({ ...f, defaultTechnicianId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Kein Standardtechniker</option>
                    {internalTechs.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-400">Wird bei Einsatzerstellung vorgeschlagen.</p>
                </div>
              )}

              {/* Personen zuordnen */}
              {canManagePlants && customer && customer.users.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Personen zuordnen</label>
                  <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-40 overflow-y-auto">
                    {customer.users.map(u => {
                      const checked = plantForm.externalUserIds.includes(u.id)
                      return (
                        <label key={u.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50 transition-colors">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => setPlantForm(f => ({
                              ...f,
                              externalUserIds: checked
                                ? f.externalUserIds.filter(uid => uid !== u.id)
                                : [...f.externalUserIds, u.id],
                            }))}
                            className="w-4 h-4 text-blue-600 rounded border-gray-300"
                          />
                          <span className="text-sm text-gray-800">{u.name}</span>
                          {u.email && <span className="text-xs text-gray-400 ml-auto">{u.email}</span>}
                        </label>
                      )
                    })}
                  </div>
                  <p className="mt-1 text-xs text-gray-400">Zugeordnete Personen können diese Anlage im Portal einsehen.</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={submittingPlant}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {submittingPlant ? 'Speichern...' : editingPlant ? 'Speichern' : 'Anlage hinzufügen'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowPlantModal(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Abbrechen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Per-plant checklist override modal */}
      {checklistPlant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setChecklistPlant(null)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Checkliste anpassen</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {checklistPlant.name} · {checklistPlant.type}
                  {overrideHasData && <span className="ml-2 px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">Angepasst</span>}
                </p>
              </div>
              <button onClick={() => setChecklistPlant(null)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-4 py-3 bg-amber-50 border-b border-amber-100 text-xs text-amber-700">
              Diese Checkliste ersetzt die Typ-Standardcheckliste für alle neuen Einsätze dieser Anlage.
              {overrideHasData && (
                <button onClick={resetOverride} className="ml-3 underline hover:no-underline">Auf Typ-Standard zurücksetzen</button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto">
              {loadingOverride ? (
                <div className="p-8 text-center text-sm text-gray-400">Laden...</div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {overrideItems.length === 0 && (
                    <div className="p-8 text-center text-sm text-gray-400">
                      Noch keine Prüfpunkte. Klicke auf &quot;Prüfpunkt hinzufügen&quot;.
                    </div>
                  )}
                  {overrideItems.map((item, idx) => (
                    <div key={idx} className="px-5 py-3 flex items-center gap-3">
                      <div className="flex flex-col gap-0.5">
                        <button onClick={() => moveOverrideItem(idx, -1)} disabled={idx === 0} className="text-gray-300 hover:text-gray-500 disabled:opacity-20">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                        </button>
                        <button onClick={() => moveOverrideItem(idx, 1)} disabled={idx === overrideItems.length - 1} className="text-gray-300 hover:text-gray-500 disabled:opacity-20">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </button>
                      </div>
                      <span className="text-xs text-gray-400 w-6 text-center">{idx + 1}</span>
                      <input
                        type="text"
                        value={item.section}
                        onChange={e => updateOverrideItem(idx, 'section', e.target.value)}
                        placeholder="Abschnitt"
                        className="w-36 border border-gray-200 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
                      />
                      <input
                        type="text"
                        value={item.label}
                        onChange={e => updateOverrideItem(idx, 'label', e.target.value)}
                        placeholder="Prüfpunkt-Beschreibung"
                        className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
                      />
                      <button onClick={() => removeOverrideItem(idx)} className="text-red-400 hover:text-red-600">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100 bg-gray-50">
              <button
                onClick={addOverrideItem}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-white"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Prüfpunkt hinzufügen
              </button>
              <div className="flex gap-2">
                <button onClick={() => setChecklistPlant(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
                  Schließen
                </button>
                <button
                  onClick={saveOverride}
                  disabled={savingOverride}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingOverride ? 'Speichert...' : 'Speichern'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Archivierte Anfragen ohne Anlage — Admin und Service Manager */}
      {canManagePlants && customer && (
        <CustomerArchivedRequests customerId={customer.id} />
      )}

      {/* Rechnungen — nur für Admin und Service Manager */}
      {canManageInvoices && customer && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mt-6">
          <InvoicePanel customerId={customer.id} canUpload={canManageInvoices} />
        </div>
      )}
    </div>
  )
}
