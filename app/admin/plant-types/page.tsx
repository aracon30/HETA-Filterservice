'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface ChecklistItem {
  id?: string
  section: string
  label: string
  order: number
}

interface PartItem {
  id?: string
  label: string
  partNumber: string
  quantity: number
  order: number
}

interface PlantType {
  id: string
  value: string
  label: string
  items: ChecklistItem[]
  partItems?: PartItem[]
}

export default function PlantTypesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [plantTypes, setPlantTypes] = useState<PlantType[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedType, setSelectedType] = useState<PlantType | null>(null)
  const [editLabel, setEditLabel] = useState('')

  const [activeTab, setActiveTab] = useState<'checklist' | 'parts'>('checklist')

  // New plant type form
  const [showNewForm, setShowNewForm] = useState(false)
  const [newValue, setNewValue] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [creating, setCreating] = useState(false)

  // Copy dialog
  const [copySource, setCopySource] = useState<PlantType | null>(null)
  const [copyValue, setCopyValue] = useState('')
  const [copyLabel, setCopyLabel] = useState('')
  const [copying, setCopying] = useState(false)

  // Checklist editor state
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([])
  const [savingChecklist, setSavingChecklist] = useState(false)

  // Parts editor state
  const [partItems, setPartItems] = useState<PartItem[]>([])
  const [savingParts, setSavingParts] = useState(false)

  // Drag state
  const dragIndexRef = useRef<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

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

  async function selectType(pt: PlantType) {
    setSelectedType(pt)
    setEditLabel(pt.label)
    setChecklistItems(pt.items.map((item, idx) => ({ ...item, order: idx })))
    const res = await fetch(`/api/plant-types/${pt.id}/parts`)
    if (res.ok) {
      const data: PartItem[] = await res.json()
      setPartItems(data.map((item, idx) => ({ ...item, order: idx, partNumber: item.partNumber ?? '' })))
    } else {
      setPartItems([])
    }
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
      setPlantTypes(pts => pts.map(pt => pt.id === updated.id ? { ...updated, items: checklistItems, partItems } : pt))
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

  function openCopyDialog(pt: PlantType, e: React.MouseEvent) {
    e.stopPropagation()
    setCopySource(pt)
    setCopyValue('')
    setCopyLabel(pt.label + ' (Kopie)')
  }

  async function executeCopy() {
    if (!copySource || !copyValue.trim() || !copyLabel.trim()) return
    setCopying(true)

    // Fetch latest checklist + parts for source
    const [clRes, partsRes] = await Promise.all([
      fetch(`/api/plant-types/${copySource.id}/checklist`),
      fetch(`/api/plant-types/${copySource.id}/parts`),
    ])
    const sourceChecklist: ChecklistItem[] = clRes.ok ? await clRes.json() : []
    const sourceParts: PartItem[] = partsRes.ok ? await partsRes.json() : []

    // Create new type
    const createRes = await fetch('/api/plant-types', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: copyValue.trim(), label: copyLabel.trim() }),
    })
    if (!createRes.ok) {
      const err = await createRes.json()
      alert(err.error ?? 'Fehler beim Erstellen')
      setCopying(false)
      return
    }
    const newType: PlantType = await createRes.json()

    // Copy checklist
    if (sourceChecklist.length > 0) {
      await fetch(`/api/plant-types/${newType.id}/checklist`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: sourceChecklist.map(({ section, label }, i) => ({ section, label, order: i })) }),
      })
    }

    // Copy parts
    if (sourceParts.length > 0) {
      await fetch(`/api/plant-types/${newType.id}/parts`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: sourceParts.map(({ label, partNumber, quantity }, i) => ({ label, partNumber, quantity, order: i })) }),
      })
    }

    await fetchPlantTypes()
    setCopySource(null)
    setCopying(false)
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

  async function saveParts() {
    if (!selectedType) return
    setSavingParts(true)
    const res = await fetch(`/api/plant-types/${selectedType.id}/parts`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: partItems }),
    })
    if (res.ok) {
      const updated: PartItem[] = await res.json()
      const newItems = updated.map((item, idx) => ({ ...item, order: idx, partNumber: item.partNumber ?? '' }))
      setPartItems(newItems)
      setPlantTypes(pts => pts.map(pt =>
        pt.id === selectedType.id ? { ...pt, partItems: newItems } : pt
      ))
    }
    setSavingParts(false)
  }

  // Checklist helpers
  function addItem() {
    setChecklistItems(items => [...items, { section: '', label: '', order: items.length }])
  }

  function updateItem(idx: number, field: 'section' | 'label', value: string) {
    setChecklistItems(items => items.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }

  function removeItem(idx: number) {
    setChecklistItems(items => items.filter((_, i) => i !== idx).map((item, i) => ({ ...item, order: i })))
  }

  // Parts helpers
  function addPartItem() {
    setPartItems(items => [...items, { label: '', partNumber: '', quantity: 1, order: items.length }])
  }

  function updatePartItem(idx: number, field: keyof PartItem, value: string | number) {
    setPartItems(items => items.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }

  function removePartItem(idx: number) {
    setPartItems(items => items.filter((_, i) => i !== idx).map((item, i) => ({ ...item, order: i })))
  }

  // Drag & Drop handlers (shared for checklist and parts)
  function handleDragStart(idx: number) {
    dragIndexRef.current = idx
  }

  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault()
    setDragOverIndex(idx)
  }

  function handleDropChecklist(dropIdx: number) {
    const dragIdx = dragIndexRef.current
    if (dragIdx === null || dragIdx === dropIdx) {
      dragIndexRef.current = null
      setDragOverIndex(null)
      return
    }
    const newItems = [...checklistItems]
    const [moved] = newItems.splice(dragIdx, 1)
    newItems.splice(dropIdx, 0, moved)
    setChecklistItems(newItems.map((item, i) => ({ ...item, order: i })))
    dragIndexRef.current = null
    setDragOverIndex(null)
  }

  function handleDropParts(dropIdx: number) {
    const dragIdx = dragIndexRef.current
    if (dragIdx === null || dragIdx === dropIdx) {
      dragIndexRef.current = null
      setDragOverIndex(null)
      return
    }
    const newItems = [...partItems]
    const [moved] = newItems.splice(dragIdx, 1)
    newItems.splice(dropIdx, 0, moved)
    setPartItems(newItems.map((item, i) => ({ ...item, order: i })))
    dragIndexRef.current = null
    setDragOverIndex(null)
  }

  function handleDragEnd() {
    dragIndexRef.current = null
    setDragOverIndex(null)
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

      {/* New type form */}
      {showNewForm && (
        <div className="mb-6 bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Neuen Anlagentyp erstellen</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Interner Wert (z.B. &quot;Druckfilter&quot;)</label>
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

      {/* Copy dialog */}
      {copySource && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-base font-semibold text-slate-800 mb-1">Anlagentyp kopieren</h2>
            <p className="text-sm text-slate-500 mb-4">
              Kopiert <span className="font-medium text-slate-700">{copySource.label}</span> inkl. Checkliste und Materialien.
            </p>
            <div className="space-y-3 mb-5">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Interner Wert (eindeutig)</label>
                <input
                  type="text"
                  value={copyValue}
                  onChange={e => setCopyValue(e.target.value)}
                  placeholder={copySource.value + '-kopie'}
                  autoFocus
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Anzeigename</label>
                <input
                  type="text"
                  value={copyLabel}
                  onChange={e => setCopyLabel(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={executeCopy}
                disabled={copying || !copyValue.trim() || !copyLabel.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {copying ? 'Kopiere...' : 'Kopieren'}
              </button>
              <button
                onClick={() => setCopySource(null)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50"
              >
                Abbrechen
              </button>
            </div>
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
                    className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex items-center justify-between group ${selectedType?.id === pt.id ? 'bg-blue-50 border-r-2 border-blue-500' : ''}`}
                  >
                    <div className="min-w-0">
                      <p className={`text-sm font-medium truncate ${selectedType?.id === pt.id ? 'text-blue-700' : 'text-slate-800'}`}>{pt.label}</p>
                      <p className="text-xs text-slate-400">{pt.items.length} Prüfpunkte · {pt.partItems?.length ?? 0} Teile</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <span
                        title="Kopieren"
                        onClick={e => openCopyDialog(pt, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-opacity"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </span>
                      <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
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

              {/* Tab bar */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="flex border-b border-slate-100">
                  <button
                    onClick={() => setActiveTab('checklist')}
                    className={`flex-1 px-5 py-3 text-sm font-medium transition-colors ${activeTab === 'checklist' ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-500' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                  >
                    Standardcheckliste
                    <span className="ml-2 text-xs font-normal text-slate-400">({checklistItems.length})</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('parts')}
                    className={`flex-1 px-5 py-3 text-sm font-medium transition-colors ${activeTab === 'parts' ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-500' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                  >
                    Materialien
                    <span className="ml-2 text-xs font-normal text-slate-400">({partItems.length})</span>
                  </button>
                </div>

                {/* Checklist tab */}
                {activeTab === 'checklist' && (
                  <>
                    <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                      <p className="text-xs text-slate-400">{checklistItems.length} Prüfpunkte · wird bei neuen Einsätzen geladen</p>
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
                        <div
                          key={idx}
                          draggable
                          onDragStart={() => handleDragStart(idx)}
                          onDragOver={e => handleDragOver(e, idx)}
                          onDrop={() => handleDropChecklist(idx)}
                          onDragEnd={handleDragEnd}
                          className={`px-5 py-3 flex items-center gap-3 transition-colors ${dragOverIndex === idx && dragIndexRef.current !== idx ? 'bg-blue-50 border-t-2 border-blue-400' : ''}`}
                        >
                          <span className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 touch-none">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                            </svg>
                          </span>
                          <span className="text-xs text-slate-400 w-6 text-center select-none">{idx + 1}</span>
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
                  </>
                )}

                {/* Parts tab */}
                {activeTab === 'parts' && (
                  <>
                    <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                      <p className="text-xs text-slate-400">{partItems.length} Teile · wird bei neuen Einsätzen als Materialliste angelegt</p>
                      <div className="flex gap-2">
                        <button
                          onClick={addPartItem}
                          className="flex items-center gap-1 px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          Material
                        </button>
                        <button
                          onClick={saveParts}
                          disabled={savingParts}
                          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
                        >
                          {savingParts ? 'Speichert...' : 'Speichern'}
                        </button>
                      </div>
                    </div>

                    {partItems.length > 0 && (
                      <div className="px-5 py-2 flex items-center gap-3 text-xs text-slate-400 border-b border-slate-50">
                        <div className="w-4" />
                        <span className="w-6" />
                        <span className="flex-1">Bezeichnung</span>
                        <span className="w-32">Artikelnummer</span>
                        <span className="w-16 text-center">Menge</span>
                        <span className="w-6" />
                      </div>
                    )}

                    <div className="divide-y divide-slate-100">
                      {partItems.length === 0 && (
                        <div className="px-5 py-8 text-center text-sm text-slate-400">
                          Keine Materialien. Klicke auf &quot;Material&quot; um zu beginnen.
                        </div>
                      )}
                      {partItems.map((item, idx) => (
                        <div
                          key={idx}
                          draggable
                          onDragStart={() => handleDragStart(idx)}
                          onDragOver={e => handleDragOver(e, idx)}
                          onDrop={() => handleDropParts(idx)}
                          onDragEnd={handleDragEnd}
                          className={`px-5 py-3 flex items-center gap-3 transition-colors ${dragOverIndex === idx && dragIndexRef.current !== idx ? 'bg-blue-50 border-t-2 border-blue-400' : ''}`}
                        >
                          <span className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 touch-none">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                            </svg>
                          </span>
                          <span className="text-xs text-slate-400 w-6 text-center select-none">{idx + 1}</span>
                          <input
                            type="text"
                            value={item.label}
                            onChange={e => updatePartItem(idx, 'label', e.target.value)}
                            placeholder="Bezeichnung"
                            className="flex-1 border border-slate-200 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
                          />
                          <input
                            type="text"
                            value={item.partNumber}
                            onChange={e => updatePartItem(idx, 'partNumber', e.target.value)}
                            placeholder="Art.-Nr. (optional)"
                            className="w-32 border border-slate-200 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
                          />
                          <input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={e => updatePartItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                            className="w-16 border border-slate-200 rounded px-2 py-1 text-xs text-center focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
                          />
                          <button
                            onClick={() => removePartItem(idx)}
                            className="text-red-400 hover:text-red-600"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl p-12 shadow-sm text-center text-slate-400">
              <svg className="w-12 h-12 mx-auto mb-3 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-sm">Anlagentyp auswählen um die Checkliste und Materialien zu bearbeiten</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
