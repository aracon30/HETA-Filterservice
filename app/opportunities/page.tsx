'use client'

import { useState, useEffect, useCallback } from 'react'
import { useConfirm } from '@/components/ConfirmDialog'
import {
  TrendingUp, Plus, BarChart2, List, Lightbulb,
  X, Calendar,
  Factory, FileText, AlertTriangle, CheckCircle,
  Trash2, Edit3
} from 'lucide-react'

// Types
interface Customer { id: string; name: string }
interface Plant { id: string; name: string; serialNumber: string; type: string; customerId: string }
interface SourceJob { id: string; orderNumber: string }

interface Opportunity {
  id: string
  title: string
  value: number | null
  stage: string
  notes: string | null
  probability: number | null
  expectedCloseAt: string | null
  contactPerson: string | null
  source: string
  customerId: string
  customer: Customer
  plantId: string | null
  plant: Plant | null
  sourceJob: SourceJob | null
  createdAt: string
}

interface Suggestion {
  id: string
  title: string
  reason: string
  nokItems: Array<{ label: string; section: string; comment: string | null }>
  notes: string | null
  customerId: string
  customerName: string
  plantId: string | null
  plantName: string | null
  plantType: string | null
  sourceJobId: string
  sourceJobNumber: string
  source: string
  alreadyConverted: boolean
}

const STAGES = ['IDENTIFIED', 'QUALIFIED', 'PROPOSAL', 'WON', 'LOST'] as const
type Stage = typeof STAGES[number]

const STAGE_CONFIG: Record<Stage, { label: string; color: string; bg: string; border: string }> = {
  IDENTIFIED: { label: 'Identifiziert', color: 'text-slate-700', bg: 'bg-slate-50', border: 'border-slate-300' },
  QUALIFIED:  { label: 'Qualifiziert',  color: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-400' },
  PROPOSAL:   { label: 'Angebot',       color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-400' },
  WON:        { label: 'Gewonnen',      color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-500' },
  LOST:       { label: 'Verloren',      color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-400' },
}

const SOURCE_CONFIG: Record<string, { label: string; icon: string }> = {
  MANUAL: { label: 'Manuell', icon: '✏️' },
  SERVICE_REPORT: { label: 'Servicebericht', icon: '📋' },
  CHECKLIST_NOK: { label: 'n.i.O.-Punkte', icon: '⚠️' },
}

function fmt(val: number | null | undefined) {
  if (!val) return '—'
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val)
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('de-DE')
}

function StageBadge({ stage }: { stage: string }) {
  const cfg = STAGE_CONFIG[stage as Stage] || STAGE_CONFIG.IDENTIFIED
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cfg.color} ${cfg.bg} border ${cfg.border}`}>
      {cfg.label}
    </span>
  )
}

function OpportunityModal({
  opp, customers, plants, onClose, onSave, onDelete
}: {
  opp: Opportunity | null
  customers: Customer[]
  plants: Plant[]
  onClose: () => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSave: (data: Record<string, any> & { id?: string }) => void
  onDelete?: (id: string) => void
}) {
  const isNew = !opp?.id
  const [form, setForm] = useState({
    title: opp?.title || '',
    customerId: opp?.customerId || '',
    plantId: opp?.plantId || '',
    value: opp?.value?.toString() || '',
    stage: opp?.stage || 'IDENTIFIED',
    probability: opp?.probability?.toString() || '',
    expectedCloseAt: opp?.expectedCloseAt ? opp.expectedCloseAt.split('T')[0] : '',
    contactPerson: opp?.contactPerson || '',
    notes: opp?.notes || '',
  })

  const customerPlants = plants.filter(p => p.customerId === form.customerId)

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            {isNew ? 'Neue Vertriebschance' : 'Vertriebschance bearbeiten'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Titel *</label>
            <input value={form.title} onChange={e => set('title', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kunde *</label>
              <select value={form.customerId} onChange={e => set('customerId', e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Bitte wählen</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Anlage</label>
              <select value={form.plantId} onChange={e => set('plantId', e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Keine</option>
                {customerPlants.map(p => <option key={p.id} value={p.id}>{p.name || p.type} ({p.serialNumber})</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Wert (€)</label>
              <input type="number" value={form.value} onChange={e => set('value', e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="0" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Wahrscheinlichkeit (%)</label>
              <input type="number" min="0" max="100" value={form.probability} onChange={e => set('probability', e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="50" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phase</label>
              <select value={form.stage} onChange={e => set('stage', e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {STAGES.map(s => <option key={s} value={s}>{STAGE_CONFIG[s].label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ziel-Abschluss</label>
              <input type="date" value={form.expectedCloseAt} onChange={e => set('expectedCloseAt', e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ansprechpartner</label>
            <input value={form.contactPerson} onChange={e => set('contactPerson', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Name, Funktion" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notizen</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
          {opp?.sourceJob && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
              <FileText size={14} />
              <span>Aus Serviceeinsatz #{opp.sourceJob.orderNumber}</span>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between p-5 border-t bg-gray-50">
          <div>
            {!isNew && onDelete && opp && (
              <button onClick={() => onDelete(opp.id)}
                className="flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700">
                <Trash2 size={14} /> Löschen
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-100">Abbrechen</button>
            <button
              onClick={() => onSave({ ...form, id: opp?.id })}
              disabled={!form.title || !form.customerId}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {isNew ? 'Erstellen' : 'Speichern'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function SuggestionCard({ s, onConvert }: { s: Suggestion; onConvert: (s: Suggestion) => void }) {
  return (
    <div className={`p-4 rounded-lg border bg-white ${s.alreadyConverted ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-orange-100 text-orange-700">
              {SOURCE_CONFIG[s.source]?.icon} {SOURCE_CONFIG[s.source]?.label}
            </span>
            {s.alreadyConverted && (
              <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle size={12} /> Bereits übernommen</span>
            )}
          </div>
          <p className="text-sm font-medium text-gray-900">{s.title}</p>
          <p className="text-xs text-gray-500 mt-0.5">{s.reason}</p>
          {s.nokItems.length > 0 && (
            <div className="mt-2 space-y-1.5">
              {s.nokItems.map((item, i) => (
                <div key={i} className="text-xs">
                  <div className="flex items-start gap-1.5 text-red-600">
                    <AlertTriangle size={10} className="mt-0.5 shrink-0" />
                    <span className="font-medium">{item.section ? `${item.section}: ` : ''}{item.label}</span>
                  </div>
                  {item.comment && (
                    <p className="ml-4 text-gray-600 italic mt-0.5">{item.comment}</p>
                  )}
                </div>
              ))}
            </div>
          )}
          {s.notes && (
            <p className="mt-2 text-xs text-gray-600 italic line-clamp-2">&quot;{s.notes}&quot;</p>
          )}
          <p className="mt-2 text-xs text-gray-400">Aus Einsatz: {s.sourceJobNumber}</p>
        </div>
        {!s.alreadyConverted && (
          <button onClick={() => onConvert(s)}
            className="shrink-0 flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 border border-blue-200 hover:border-blue-300 rounded-lg px-3 py-1.5 bg-blue-50 hover:bg-blue-100 transition-colors">
            <Plus size={12} /> Übernehmen
          </button>
        )}
      </div>
    </div>
  )
}

export default function VertriebPage() {
  const confirm = useConfirm()
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [plants, setPlants] = useState<Plant[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'kanban' | 'table' | 'suggestions'>('kanban')
  const [modal, setModal] = useState<{ open: boolean; opp: Opportunity | null }>({ open: false, opp: null })
  const [dragOver, setDragOver] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [opps, custs, plnts] = await Promise.all([
      fetch('/api/opportunities').then(r => r.json()),
      fetch('/api/customers').then(r => r.json()),
      fetch('/api/plants').then(r => r.json()),
    ])
    setOpportunities(Array.isArray(opps) ? opps : [])
    setCustomers(Array.isArray(custs) ? custs : [])
    setPlants(Array.isArray(plnts) ? plnts : [])
    setLoading(false)
  }, [])

  const loadSuggestions = useCallback(async () => {
    const data = await fetch('/api/opportunities/suggestions').then(r => r.json())
    setSuggestions(Array.isArray(data) ? data : [])
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { if (view === 'suggestions') loadSuggestions() }, [view, loadSuggestions])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function handleSave(data: Record<string, any> & { id?: string }) {
    if (data.id) {
      const res = await fetch(`/api/opportunities/${data.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      })
      if (res.ok) {
        const updated = await res.json()
        setOpportunities(os => os.map(o => o.id === updated.id ? updated : o))
      }
    } else {
      const res = await fetch('/api/opportunities', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      })
      if (res.ok) {
        const created = await res.json()
        setOpportunities(os => [created, ...os])
      }
    }
    setModal({ open: false, opp: null })
  }

  async function handleDelete(id: string) {
    if (!(await confirm({
      title: 'Vertriebschance löschen',
      message: 'Soll diese Vertriebschance wirklich gelöscht werden?',
    }))) return
    await fetch(`/api/opportunities/${id}`, { method: 'DELETE' })
    setOpportunities(os => os.filter(o => o.id !== id))
    setModal({ open: false, opp: null })
  }

  async function handleConvertSuggestion(s: Suggestion) {
    const noteParts: string[] = []
    if (s.nokItems.length > 0) {
      noteParts.push(`n.i.O.-Punkte aus Einsatz ${s.sourceJobNumber}:`)
      s.nokItems.forEach(item => {
        const label = item.section ? `${item.section}: ${item.label}` : item.label
        noteParts.push(item.comment ? `• ${label} — ${item.comment}` : `• ${label}`)
      })
    }
    if (s.notes) noteParts.push(noteParts.length > 0 ? `\nBefunde: ${s.notes}` : s.notes)
    const notes = noteParts.join('\n') || null

    const res = await fetch('/api/opportunities/suggestions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: s.title,
        customerId: s.customerId,
        plantId: s.plantId,
        sourceJobId: s.sourceJobId,
        source: s.source,
        notes,
      }),
    })
    if (res.ok) {
      const created = await res.json()
      setOpportunities(os => [created, ...os])
      setSuggestions(ss => ss.map(x => x.sourceJobId === s.sourceJobId ? { ...x, alreadyConverted: true } : x))
    }
  }

  async function handleDrop(oppId: string, newStage: string) {
    const opp = opportunities.find(o => o.id === oppId)
    if (!opp || opp.stage === newStage) return
    setOpportunities(os => os.map(o => o.id === oppId ? { ...o, stage: newStage } : o))
    await fetch(`/api/opportunities/${oppId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stage: newStage }),
    })
  }

  const activeOpps = opportunities.filter(o => !['WON', 'LOST'].includes(o.stage))
  const totalPipeline = activeOpps.reduce((s, o) => s + (o.value || 0), 0)
  const weightedPipeline = activeOpps.reduce((s, o) => s + (o.value || 0) * ((o.probability || 50) / 100), 0)
  const wonTotal = opportunities.filter(o => o.stage === 'WON').reduce((s, o) => s + (o.value || 0), 0)
  const suggestionCount = suggestions.filter(s => !s.alreadyConverted).length

  if (loading) return (
    <div className="flex-1 flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
    </div>
  )

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <TrendingUp size={22} className="text-blue-600" /> Vertrieb
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">Pipeline-Management und Vertriebschancen</p>
          </div>
          <button onClick={() => setModal({ open: true, opp: null })}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 self-start sm:self-auto">
            <Plus size={16} /> Neue Chance
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          <div className="bg-blue-50 rounded-lg p-3">
            <p className="text-xs text-blue-600 font-medium">Aktive Chancen</p>
            <p className="text-2xl font-bold text-blue-700">{activeOpps.length}</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-xs text-slate-600 font-medium">Pipeline gesamt</p>
            <p className="text-lg font-bold text-slate-700">{fmt(totalPipeline)}</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-3">
            <p className="text-xs text-purple-600 font-medium">Gewichtete Pipeline</p>
            <p className="text-lg font-bold text-purple-700">{fmt(weightedPipeline)}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-3">
            <p className="text-xs text-green-600 font-medium">Gewonnen (gesamt)</p>
            <p className="text-lg font-bold text-green-700">{fmt(wonTotal)}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4 border-b -mb-4">
          {[
            { key: 'kanban', icon: BarChart2, label: 'Kanban' },
            { key: 'table', icon: List, label: 'Tabelle' },
            { key: 'suggestions', icon: Lightbulb, label: `Vorschläge${suggestionCount > 0 ? ` (${suggestionCount})` : ''}` },
          ].map(({ key, icon: Icon, label }) => (
            <button key={key} onClick={() => setView(key as typeof view)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                view === key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">

        {/* Kanban View */}
        {view === 'kanban' && (
          <div className="flex flex-col md:flex-row gap-4 h-full min-h-[500px] overflow-x-auto">
            {STAGES.filter(s => s !== 'LOST').map(stage => {
              const cfg = STAGE_CONFIG[stage]
              const stageOpps = opportunities.filter(o => o.stage === stage)
              const stageValue = stageOpps.reduce((s, o) => s + (o.value || 0), 0)
              return (
                <div key={stage}
                  className={`flex-1 min-w-full md:min-w-[200px] flex flex-col rounded-xl border-2 ${dragOver === stage ? 'border-blue-400 bg-blue-50/50' : 'border-gray-200 bg-white'} transition-colors`}
                  onDragOver={e => { e.preventDefault(); setDragOver(stage) }}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={e => { e.preventDefault(); setDragOver(null); handleDrop(e.dataTransfer.getData('oppId'), stage) }}>
                  <div className={`p-3 rounded-t-xl ${cfg.bg} border-b border-gray-200`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-semibold ${cfg.color}`}>{cfg.label}</span>
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${cfg.bg} ${cfg.color} border ${cfg.border}`}>{stageOpps.length}</span>
                    </div>
                    {stageValue > 0 && <p className={`text-xs ${cfg.color} opacity-80 mt-0.5`}>{fmt(stageValue)}</p>}
                  </div>
                  <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                    {stageOpps.map(opp => (
                      <div key={opp.id}
                        draggable
                        onDragStart={e => e.dataTransfer.setData('oppId', opp.id)}
                        onClick={() => setModal({ open: true, opp })}
                        className="p-3 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-sm cursor-pointer transition-all">
                        <p className="text-sm font-medium text-gray-900 line-clamp-2">{opp.title}</p>
                        <p className="text-xs text-gray-500 mt-1">{opp.customer.name}</p>
                        {opp.plant && <p className="text-xs text-gray-400">{opp.plant.name || opp.plant.type}</p>}
                        <div className="flex items-center justify-between mt-2">
                          {opp.value ? <span className="text-xs font-semibold text-gray-700">{fmt(opp.value)}</span> : <span />}
                          <div className="flex items-center gap-1">
                            {opp.source !== 'MANUAL' && (
                              <span className="text-xs" title={SOURCE_CONFIG[opp.source]?.label}>{SOURCE_CONFIG[opp.source]?.icon}</span>
                            )}
                            {opp.probability != null && (
                              <span className="text-xs text-gray-400">{opp.probability}%</span>
                            )}
                          </div>
                        </div>
                        {opp.expectedCloseAt && (
                          <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                            <Calendar size={10} /> {fmtDate(opp.expectedCloseAt)}
                          </p>
                        )}
                      </div>
                    ))}
                    {stageOpps.length === 0 && (
                      <p className="text-xs text-gray-400 text-center py-6">Keine Einträge</p>
                    )}
                  </div>
                </div>
              )
            })}
            {/* Lost column collapsed */}
            <div className="w-10 flex flex-col">
              <div
                className={`flex-1 rounded-xl border-2 border-red-200 bg-red-50 flex flex-col items-center py-3 gap-2 overflow-hidden ${dragOver === 'LOST' ? 'border-red-400' : ''}`}
                onDragOver={e => { e.preventDefault(); setDragOver('LOST') }}
                onDragLeave={() => setDragOver(null)}
                onDrop={e => { e.preventDefault(); setDragOver(null); handleDrop(e.dataTransfer.getData('oppId'), 'LOST') }}>
                <span className="text-red-600 font-semibold text-xs" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                  Verloren ({opportunities.filter(o => o.stage === 'LOST').length})
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Table View */}
        {view === 'table' && (
          <div className="bg-white rounded-xl border overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Titel</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Kunde / Anlage</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Wert</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Phase</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Abschluss</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Quelle</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {opportunities.map(opp => (
                  <tr key={opp.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setModal({ open: true, opp })}>
                    <td className="px-4 py-3 font-medium text-gray-900">{opp.title}</td>
                    <td className="px-4 py-3">
                      <p className="text-gray-800">{opp.customer.name}</p>
                      {opp.plant && <p className="text-xs text-gray-400">{opp.plant.name || opp.plant.type}</p>}
                    </td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{fmt(opp.value)}</td>
                    <td className="px-4 py-3"><StageBadge stage={opp.stage} /></td>
                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{fmtDate(opp.expectedCloseAt)}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs hidden lg:table-cell">{SOURCE_CONFIG[opp.source]?.icon} {SOURCE_CONFIG[opp.source]?.label}</td>
                    <td className="px-4 py-3">
                      <Edit3 size={14} className="text-gray-400 hover:text-blue-600" />
                    </td>
                  </tr>
                ))}
                {opportunities.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">Noch keine Vertriebschancen</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Suggestions View */}
        {view === 'suggestions' && (
          <div className="max-w-3xl">
            <div className="flex items-center gap-3 mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <Lightbulb size={20} className="text-amber-600 shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-800">Intelligente Vertriebsvorschläge</p>
                <p className="text-xs text-amber-600 mt-0.5">
                  Basierend auf offenen Prüfpunkten und Befunden aus Serviceeinsätzen werden automatisch potenzielle Vertriebschancen erkannt.
                </p>
              </div>
            </div>
            {suggestions.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Lightbulb size={32} className="mx-auto mb-3 opacity-30" />
                <p>Keine Vorschläge vorhanden</p>
                <p className="text-xs mt-1">Vorschläge entstehen aus offenen Prüfpunkten und Befunden in Serviceeinsätzen</p>
              </div>
            ) : (
              <div className="space-y-3">
                {suggestions.map(s => <SuggestionCard key={s.id} s={s} onConvert={handleConvertSuggestion} />)}
              </div>
            )}
          </div>
        )}
      </div>

      {modal.open && (
        <OpportunityModal
          opp={modal.opp}
          customers={customers}
          plants={plants}
          onClose={() => setModal({ open: false, opp: null })}
          onSave={handleSave}
          onDelete={modal.opp ? handleDelete : undefined}
        />
      )}
    </div>
  )
}
