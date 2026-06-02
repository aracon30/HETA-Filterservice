'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface ChecklistItem {
  id?: string
  section: string
  label: string
  order: number
}

interface PlantType {
  id: string
  value: string
  label: string
  items: ChecklistItem[]
}

export default function PlantTypesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [plantTypes, setPlantTypes] = useState<PlantType[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedType, setSelectedType] = useState<PlantType | null>(null)
  const [editLabel, setEditLabel] = useState('')

  // New plant type form
  const [showNewForm, setShowNewForm] = useState(false)
  const [newValue, setNewValue] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [creating, setCreating] = useState(false)

  // Checklist editor state
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([])
  const [savingChecklist, setSavingChecklist] = useState(false)

  const role = session?.user?.role as string | undefined

  useEffect(() => {
    if (status === 'loading') return
    if (!session?.user || !['ADMIN', 'SERVICE_MANAGER'].includes(role ?? '')) {
      router.push('/')
      return
    }
    fetchPlantTypes()
  }, [session, status])

  async function fetchPlantTypes() {
    const res = await fetch('/api/plant-types')
    const data = await res.json()
    setPlantTypes(data)
    setLoading(false)
  }

  function selectType(pt: PlantType) {
    setSelectedType(pt)
    setEditLabel(pt.label)
    setChecklistItems(pt.items.map((item, idx) => ({ ...item, order: idx })))
  }

  async function saveLabel() {
    if (!selectedType) return
    const res = await fetch(`/api/plant-types/${selectedType.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: editLabel }),
    })
    if (res.ok) {
      const updated = await res.json()
      setPlantTypes(pts => pts.map(pt => pt.id === updated.id ? { ...updated, items: checklistItems } : pt))
      setSelectedType(prev => prev ? { ...prev, label: editLabel } : prev)
    }
  }

  async function deleteType(id: string) {
    if (!confirm('Anlagentyp wirklich löschen? Bestehende Anlagen behalten ihren Typ-Wert.')) return
    const res = await fetch(`/api/plant-types/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setPlantTypes(pts => pts.filter(pt => pt.id !== id))
      if (selectedType?.id === id) setSelectedType(null)
    }
  }

  async function createType() {
    if (!newValue.trim() || !newLabel.trim()) return
    setCreating(true)
    const res = await fetch('/api/plant-types', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: newValue.trim(), label: newLabel.trim() }),
    })
    if (res.ok) {
      const created = await res.json()
      setPlantTypes(pts => [...pts, created])
      setNewValue('')
      setNewLabel('')
      setShowNewForm(false)
    } else {
      const err = await res.json()
      alert(err.error ?? 'Fehler beim Erstellen')
    }
    setCreating(false)
  }

  async function saveChecklist() {
    if (!selectedType) return
    setSavingChecklist(true)
    const res = await fetch(`/api/plant-types/${selectedType.id}/checklist`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: checklistItems }),
    })
    if (res.ok) {
      const updated = await res.json()
      const newItems = updated.map((item: ChecklistItem, idx: number) => ({ ...item, order: idx }))
      setChecklistItems(newItems)
      setPlantTypes(pts => pts.map(pt =>
        pt.id === selectedType.id ? { ...pt, items: newItems } : pt
      ))
    }
    setSavingChecklist(false)
  }

  function addItem() {
    setChecklistItems(items => [...items, { section: '', label: '', order: items.length }])
  }

  function updateItem(idx: number, field: 'section' | 'label', value: string) {
    setChecklistItems(items => items.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }

  function removeItem(idx: number) {
    setChecklistItems(items => items.filter((_, i) => i !== idx).map((item, i) => ({ ...item, order: i })))
  }

  function moveItem(idx: number, dir: -1 | 1) {
    const newItems = [...checklistItems]
    const target = idx + dir
    if (target < 0 || target >= newItems.length) return
    ;[newItems[idx], newItems[target]] = [newItems[target], newItems[idx]]
    setChecklistItems(newItems.map((item, i) => ({ ...item, order: i })))
  }

  const sections = Array.from(new Set(checklistItems.map(i => i.section).filter(Boolean)))

  if (loading) return <div className="p-8 text-slate-500">Laden...</div>

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Anlagentypen & Standardchecklisten</h1>
          <p className="text-sm text-slate-500 mt-1">Typen anlegen, bearbeiten und deren Standard-Checklisten pflegen</p>
        </div>
        <button
          onClick={() => setShowNewForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Neuer Anlagentyp
        </button>
      </div>

      {showNewForm && (
        <div className="mb-6 bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Neuen Anlagentyp erstellen</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Interner Wert (z.B. "Druckfilter")</label>
              <input
                type="text"
                value={newValue}
                onChange={e => setNewValue(e.target.value)}
                placeholder="Druckfilter"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Anzeigename</label>
              <input
                type="text"
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                placeholder="Druckfilter"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={createType}
              disabled={creating || !newValue.trim() || !newLabel.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {creating ? 'Erstelle...' : 'Erstellen'}
            </button>
            <button
              onClick={() => { setShowNewForm(false); setNewValue(''); setNewLabel('') }}
              className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* Left: Type List */}
        <div className="col-span-1">
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
              <h2 className="text-sm font-semibold text-slate-700">Anlagentypen ({plantTypes.length})</h2>
            </div>
            <ul className="divide-y divide-slate-100">
              {plantTypes.map(pt => (
                <li key={pt.id}>
                  <button
                    onClick={() => selectType(pt)}
                    className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex items-center justify-between ${selectedType?.id === pt.id ? 'bg-blue-50 border-r-2 border-blue-500' : ''}`}
                  >
                    <div>
                      <p className={`text-sm font-medium ${selectedType?.id === pt.id ? 'text-blue-700' : 'text-slate-800'}`}>{pt.label}</p>
                      <p className="text-xs text-slate-400">{pt.items.length} Prüfpunkte</p>
                    </div>
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </li>
              ))}
              {plantTypes.length === 0 && (
                <li className="px-4 py-6 text-sm text-slate-400 text-center">Keine Typen vorhanden</li>
              )}
            </ul>
          </div>
        </div>

        {/* Right: Editor */}
        <div className="col-span-2">
          {selectedType ? (
            <div className="space-y-4">
              {/* Type name editor */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-slate-700">Typ-Einstellungen</h2>
                  <button
                    onClick={() => deleteType(selectedType.id)}
                    className="text-xs text-red-600 hover:text-red-700 hover:underline"
                  >
                    Typ löschen
                  </button>
                </div>
                <div className="flex gap-3 items-end">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-slate-600 mb-1">Anzeigename</label>
                    <input
                      type="text"
                      value={editLabel}
                      onChange={e => setEditLabel(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Interner Wert</label>
                    <input
                      type="text"
                      value={selectedType.value}
                      disabled
                      className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 text-slate-400 cursor-not-allowed"
                    />
                  </div>
                  <button
                    onClick={saveLabel}
                    disabled={editLabel === selectedType.label}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40"
                  >
                    Speichern
                  </button>
                </div>
              </div>

              {/* Checklist editor */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-700">Standardcheckliste</h2>
                    <p className="text-xs text-slate-400 mt-0.5">{checklistItems.length} Prüfpunkte · wird bei neuen Einsätzen geladen</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={addItem}
                      className="flex items-center gap-1 px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Prüfpunkt
                    </button>
                    <button
                      onClick={saveChecklist}
                      disabled={savingChecklist}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
                    >
                      {savingChecklist ? 'Speichert...' : 'Speichern'}
                    </button>
                  </div>
                </div>

                <div className="divide-y divide-slate-100">
                  {checklistItems.length === 0 && (
                    <div className="px-5 py-8 text-center text-sm text-slate-400">
                      Keine Prüfpunkte. Klicke auf &quot;Prüfpunkt&quot; um zu beginnen.
                    </div>
                  )}
                  {checklistItems.map((item, idx) => (
                    <div key={idx} className="px-5 py-3 flex items-center gap-3">
                      <div className="flex flex-col gap-0.5">
                        <button
                          onClick={() => moveItem(idx, -1)}
                          disabled={idx === 0}
                          className="text-slate-300 hover:text-slate-500 disabled:opacity-20"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        </button>
                        <button
                          onClick={() => moveItem(idx, 1)}
                          disabled={idx === checklistItems.length - 1}
                          className="text-slate-300 hover:text-slate-500 disabled:opacity-20"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>
                      <span className="text-xs text-slate-400 w-6 text-center">{idx + 1}</span>
                      <input
                        type="text"
                        value={item.section}
                        onChange={e => updateItem(idx, 'section', e.target.value)}
                        placeholder="Abschnitt"
                        list="sections-list"
                        className="w-40 border border-slate-200 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
                      />
                      <input
                        type="text"
                        value={item.label}
                        onChange={e => updateItem(idx, 'label', e.target.value)}
                        placeholder="Prüfpunkt-Beschreibung"
                        className="flex-1 border border-slate-200 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
                      />
                      <button
                        onClick={() => removeItem(idx)}
                        className="text-red-400 hover:text-red-600"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>

                <datalist id="sections-list">
                  {sections.map(s => <option key={s} value={s} />)}
                </datalist>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl p-12 shadow-sm text-center text-slate-400">
              <svg className="w-12 h-12 mx-auto mb-3 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-sm">Anlagentyp auswählen um die Checkliste zu bearbeiten</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
