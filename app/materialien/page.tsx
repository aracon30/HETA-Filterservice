'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useConfirm } from '@/components/ConfirmDialog'

const INTERNAL_ROLES = ['ADMIN', 'SERVICE_MANAGER', 'SERVICE_TECHNICIAN']

const STATUS_LABELS: Record<string, string> = {
  TO_ORDER: 'Zu bestellen',
  ORDERED: 'Bestellt',
  IN_STOCK: 'Im Lager',
  NOT_NEEDED: 'Nicht benötigt',
}

const STATUS_COLORS: Record<string, string> = {
  TO_ORDER: 'bg-orange-100 text-orange-700',
  ORDERED: 'bg-blue-100 text-blue-700',
  IN_STOCK: 'bg-green-100 text-green-700',
  NOT_NEEDED: 'bg-gray-100 text-gray-500',
}

interface Customer { id: string; name: string }
interface Plant { id: string; name: string; type: string; customerId: string }

interface Material {
  id?: string
  label: string
  partNumber: string
  quantity: number
  status: string
  deliveryDate: string
  notes: string
  order: number
}

function emptyMaterial(order: number): Material {
  return { label: '', partNumber: '', quantity: 1, status: 'TO_ORDER', deliveryDate: '', notes: '', order }
}

function StatusDot({ materials }: { materials: Material[] }) {
  if (materials.length === 0) return <span className="w-2 h-2 rounded-full bg-gray-200 inline-block" />
  const hasToOrder = materials.some(m => m.status === 'TO_ORDER')
  const allInStock = materials.every(m => m.status === 'IN_STOCK' || m.status === 'NOT_NEEDED')
  if (allInStock) return <span className="w-2 h-2 rounded-full bg-green-500 inline-block" title="Alle verfügbar" />
  if (hasToOrder) return <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" title="Teile zu bestellen" />
  return <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" title="Teile bestellt" />
}

export default function MaterialienPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const confirm = useConfirm()
  const role = session?.user?.role as string | undefined

  const [customers, setCustomers] = useState<Customer[]>([])
  const [plants, setPlants] = useState<Plant[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [selectedPlant, setSelectedPlant] = useState<Plant | null>(null)
  const [materials, setMaterials] = useState<Material[]>([])
  const [saving, setSaving] = useState(false)
  const [initializing, setInitializing] = useState(false)
  const [loadingMaterials, setLoadingMaterials] = useState(false)
  const [dirty, setDirty] = useState(false)

  // plantId → cached materials for status dots
  const [materialCache, setMaterialCache] = useState<Record<string, Material[]>>({})

  useEffect(() => {
    if (status === 'loading') return
    if (!session?.user || !INTERNAL_ROLES.includes(role ?? '')) {
      router.push('/')
    }
  }, [session, status, role, router])

  useEffect(() => {
    if (!session?.user) return
    fetch('/api/customers').then(r => r.json()).then(setCustomers)
    fetch('/api/plants').then(r => r.json()).then(setPlants)
  }, [session])

  const plantsByCustomer = (customerId: string) =>
    plants.filter(p => p.customerId === customerId)

  const toggleExpand = (customerId: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(customerId)) next.delete(customerId)
      else next.add(customerId)
      return next
    })
  }

  const selectPlant = useCallback(async (plant: Plant) => {
    setSelectedPlant(plant)
    setDirty(false)
    if (materialCache[plant.id]) {
      setMaterials(materialCache[plant.id])
      return
    }
    setLoadingMaterials(true)
    const res = await fetch(`/api/plants/${plant.id}/materials`)
    if (res.ok) {
      const data = await res.json()
      const parsed = data.map((m: Material & { deliveryDate: string | null }) => ({
        ...m,
        deliveryDate: m.deliveryDate ? m.deliveryDate.slice(0, 10) : '',
        partNumber: m.partNumber ?? '',
        notes: m.notes ?? '',
      }))
      setMaterials(parsed)
      setMaterialCache(prev => ({ ...prev, [plant.id]: parsed }))
    }
    setLoadingMaterials(false)
  }, [materialCache])

  const addRow = () => {
    setMaterials(prev => [...prev, emptyMaterial(prev.length)])
    setDirty(true)
  }

  const removeRow = (idx: number) => {
    setMaterials(prev => prev.filter((_, i) => i !== idx).map((m, i) => ({ ...m, order: i })))
    setDirty(true)
  }

  const moveRow = (idx: number, dir: -1 | 1) => {
    const next = [...materials]
    const target = idx + dir
    if (target < 0 || target >= next.length) return
    ;[next[idx], next[target]] = [next[target], next[idx]]
    setMaterials(next.map((m, i) => ({ ...m, order: i })))
    setDirty(true)
  }

  const updateRow = (idx: number, field: keyof Material, value: string | number) => {
    setMaterials(prev => prev.map((m, i) => i === idx ? { ...m, [field]: value } : m))
    setDirty(true)
  }

  const save = async () => {
    if (!selectedPlant) return
    setSaving(true)
    const res = await fetch(`/api/plants/${selectedPlant.id}/materials`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ materials }),
    })
    if (res.ok) {
      const updated = await res.json()
      const parsed = updated.map((m: Material & { deliveryDate: string | null }) => ({
        ...m,
        deliveryDate: m.deliveryDate ? m.deliveryDate.slice(0, 10) : '',
        partNumber: m.partNumber ?? '',
        notes: m.notes ?? '',
      }))
      setMaterials(parsed)
      setMaterialCache(prev => ({ ...prev, [selectedPlant.id]: parsed }))
      setDirty(false)
    }
    setSaving(false)
  }

  const initFromTemplate = async () => {
    if (!selectedPlant) return
    if (!(await confirm({
      title: 'Vorlage laden',
      message: 'Materialliste aus Anlagentyp-Vorlage laden? Bestehende Einträge werden überschrieben.',
      confirmLabel: 'Laden',
      danger: false,
    }))) return
    setInitializing(true)
    const res = await fetch(`/api/plants/${selectedPlant.id}/materials`, { method: 'POST' })
    if (res.ok) {
      const data = await res.json()
      const parsed = data.map((m: Material & { deliveryDate: string | null }) => ({
        ...m,
        deliveryDate: m.deliveryDate ? m.deliveryDate.slice(0, 10) : '',
        partNumber: m.partNumber ?? '',
        notes: m.notes ?? '',
      }))
      setMaterials(parsed)
      setMaterialCache(prev => ({ ...prev, [selectedPlant.id]: parsed }))
      setDirty(false)
    } else {
      alert('Keine Vorlage für diesen Anlagentyp vorhanden.')
    }
    setInitializing(false)
  }

  if (status === 'loading') return null

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Materialien</h1>
        <p className="text-sm text-gray-500 mt-1">Materiallisten pro Anlage verwalten</p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left: Customer / Plant tree */}
        <div className="col-span-1">
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
              <h2 className="text-sm font-semibold text-gray-700">Kunden & Anlagen</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {customers.length === 0 && (
                <div className="px-4 py-6 text-sm text-gray-400 text-center">Keine Kunden vorhanden</div>
              )}
              {customers.map(customer => {
                const cPlants = plantsByCustomer(customer.id)
                const isExpanded = expanded.has(customer.id)
                return (
                  <div key={customer.id}>
                    <button
                      onClick={() => toggleExpand(customer.id)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-2">
                        <svg
                          className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        <span className="text-sm font-medium text-gray-800">{customer.name}</span>
                      </div>
                      <span className="text-xs text-gray-400">{cPlants.length} Anlagen</span>
                    </button>
                    {isExpanded && cPlants.map(plant => (
                      <button
                        key={plant.id}
                        onClick={() => selectPlant(plant)}
                        className={`w-full flex items-center gap-3 pl-8 pr-4 py-2.5 hover:bg-gray-50 transition-colors text-left ${selectedPlant?.id === plant.id ? 'bg-blue-50 border-r-2 border-blue-500' : ''}`}
                      >
                        <StatusDot materials={materialCache[plant.id] ?? []} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium truncate ${selectedPlant?.id === plant.id ? 'text-blue-700' : 'text-gray-700'}`}>
                            {plant.name}
                          </p>
                          <p className="text-xs text-gray-400 truncate">{plant.type}</p>
                        </div>
                        {materialCache[plant.id] && (
                          <span className="text-xs text-gray-400">{materialCache[plant.id].length}</span>
                        )}
                      </button>
                    ))}
                    {isExpanded && cPlants.length === 0 && (
                      <p className="pl-8 pr-4 py-2 text-xs text-gray-400">Keine Anlagen</p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Right: Material editor */}
        <div className="col-span-2">
          {!selectedPlant ? (
            <div className="bg-white border border-gray-200 rounded-xl p-12 shadow-sm text-center text-gray-400">
              <svg className="w-12 h-12 mx-auto mb-3 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <p className="text-sm">Anlage auswählen um Materialien zu verwalten</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
              {/* Header */}
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-gray-800">{selectedPlant.name}</h2>
                  <p className="text-xs text-gray-400 mt-0.5">{selectedPlant.type} · {customers.find(c => c.id === selectedPlant.customerId)?.name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={initFromTemplate}
                    disabled={initializing}
                    className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                    title="Materialliste aus Anlagentyp-Vorlage laden"
                  >
                    {initializing ? 'Lädt...' : 'Von Vorlage laden'}
                  </button>
                  <button
                    onClick={addRow}
                    className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Hinzufügen
                  </button>
                  <button
                    onClick={save}
                    disabled={saving || !dirty}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors"
                  >
                    {saving ? 'Speichert...' : 'Speichern'}
                  </button>
                </div>
              </div>

              {loadingMaterials ? (
                <div className="px-5 py-10 text-center text-sm text-gray-400">Laden...</div>
              ) : materials.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-gray-400">
                  Noch keine Materialien. &ldquo;Hinzufügen&rdquo; oder &ldquo;Von Vorlage laden&rdquo; klicken.
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {/* Column headers */}
                  <div className="px-5 py-2 grid grid-cols-12 gap-2 text-xs font-medium text-gray-400 uppercase tracking-wide">
                    <div className="col-span-1"></div>
                    <div className="col-span-3">Bezeichnung</div>
                    <div className="col-span-2">Artikelnummer</div>
                    <div className="col-span-1 text-center">Menge</div>
                    <div className="col-span-2">Status</div>
                    <div className="col-span-2">Lieferdatum</div>
                    <div className="col-span-1"></div>
                  </div>
                  {materials.map((mat, idx) => (
                    <div key={idx} className="px-5 py-3 grid grid-cols-12 gap-2 items-start">
                      {/* Reorder */}
                      <div className="col-span-1 flex flex-col gap-0.5 pt-1">
                        <button onClick={() => moveRow(idx, -1)} disabled={idx === 0} className="text-gray-300 hover:text-gray-500 disabled:opacity-20">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        </button>
                        <button onClick={() => moveRow(idx, 1)} disabled={idx === materials.length - 1} className="text-gray-300 hover:text-gray-500 disabled:opacity-20">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>
                      {/* Label */}
                      <div className="col-span-3">
                        <input
                          value={mat.label}
                          onChange={e => updateRow(idx, 'label', e.target.value)}
                          placeholder="Bezeichnung"
                          className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
                        />
                      </div>
                      {/* Part number */}
                      <div className="col-span-2">
                        <input
                          value={mat.partNumber}
                          onChange={e => updateRow(idx, 'partNumber', e.target.value)}
                          placeholder="optional"
                          className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
                        />
                      </div>
                      {/* Quantity */}
                      <div className="col-span-1">
                        <input
                          type="number"
                          min={1}
                          value={mat.quantity}
                          onChange={e => updateRow(idx, 'quantity', Number(e.target.value))}
                          className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs text-center focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
                        />
                      </div>
                      {/* Status */}
                      <div className="col-span-2">
                        <select
                          value={mat.status}
                          onChange={e => updateRow(idx, 'status', e.target.value)}
                          className={`w-full border rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-blue-400 focus:border-blue-400 ${STATUS_COLORS[mat.status] ?? ''} border-gray-200`}
                        >
                          {Object.entries(STATUS_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                          ))}
                        </select>
                      </div>
                      {/* Delivery date — only for ORDERED */}
                      <div className="col-span-2">
                        {mat.status === 'ORDERED' ? (
                          <input
                            type="date"
                            value={mat.deliveryDate}
                            onChange={e => updateRow(idx, 'deliveryDate', e.target.value)}
                            className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
                          />
                        ) : (
                          <span className="text-xs text-gray-300 px-2">—</span>
                        )}
                      </div>
                      {/* Delete */}
                      <div className="col-span-1 flex justify-end pt-1">
                        <button onClick={() => removeRow(idx)} className="text-red-300 hover:text-red-500 transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      {/* Notes row */}
                      {(mat.notes !== '' || mat.status !== 'NOT_NEEDED') && (
                        <div className="col-span-12 col-start-2 -mt-1">
                          <input
                            value={mat.notes}
                            onChange={e => updateRow(idx, 'notes', e.target.value)}
                            placeholder="Notiz (optional)"
                            className="w-full border border-gray-100 rounded px-2 py-1 text-xs text-gray-500 focus:ring-1 focus:ring-blue-300 focus:border-blue-300 bg-gray-50"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
