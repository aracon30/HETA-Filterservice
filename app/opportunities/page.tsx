'use client'

import { useEffect, useState } from 'react'
import OpportunityStageBadge from '@/components/OpportunityStageBadge'
import { OPPORTUNITY_STAGE_LABELS } from '@/lib/constants'

interface Customer {
  id: string
  name: string
}

interface Opportunity {
  id: string
  title: string
  value: number | null
  stage: string
  notes: string | null
  customer: { id: string; name: string }
  createdAt: string
}

const STAGES = ['IDENTIFIED', 'QUALIFIED', 'PROPOSAL', 'WON', 'LOST']

function formatCurrency(value: number | null) {
  if (value === null) return '—'
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value)
}

interface NewOpportunityForm {
  title: string
  value: string
  stage: string
  customerId: string
  notes: string
}

export default function OpportunitiesPage() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [view, setView] = useState<'kanban' | 'table'>('kanban')

  const [form, setForm] = useState<NewOpportunityForm>({
    title: '',
    value: '',
    stage: 'IDENTIFIED',
    customerId: '',
    notes: '',
  })

  const fetchOpportunities = async () => {
    const res = await fetch('/api/opportunities')
    const data = await res.json()
    setOpportunities(data)
    setLoading(false)
  }

  useEffect(() => {
    fetchOpportunities()
    fetch('/api/customers').then((r) => r.json()).then(setCustomers)
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    await fetch('/api/opportunities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSubmitting(false)
    setShowModal(false)
    setForm({ title: '', value: '', stage: 'IDENTIFIED', customerId: '', notes: '' })
    await fetchOpportunities()
  }

  const byStage = (stage: string) => opportunities.filter((o) => o.stage === stage)

  const stageColors: Record<string, string> = {
    IDENTIFIED: 'border-t-slate-400',
    QUALIFIED: 'border-t-yellow-400',
    PROPOSAL: 'border-t-blue-400',
    WON: 'border-t-green-400',
    LOST: 'border-t-red-400',
  }

  const activeStages = STAGES.slice(0, 4) // IDENTIFIED, QUALIFIED, PROPOSAL, WON
  const lostOpportunities = byStage('LOST')

  const totalActive = opportunities
    .filter((o) => !['WON', 'LOST'].includes(o.stage))
    .reduce((s, o) => s + (o.value ?? 0), 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vertriebschancen</h1>
          <p className="text-sm text-gray-500 mt-1">
            {opportunities.filter((o) => !['WON', 'LOST'].includes(o.stage)).length} aktive Chancen ·{' '}
            Potenzial: {formatCurrency(totalActive)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setView('kanban')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                view === 'kanban' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Kanban
            </button>
            <button
              onClick={() => setView('table')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                view === 'table' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Tabelle
            </button>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Neue Chance
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Laden...</div>
      ) : view === 'kanban' ? (
        <div>
          {/* Kanban Board */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            {activeStages.map((stage) => {
              const stageOpps = byStage(stage)
              const stageTotal = stageOpps.reduce((s, o) => s + (o.value ?? 0), 0)
              return (
                <div key={stage} className={`bg-white rounded-xl border border-gray-200 border-t-4 shadow-sm ${stageColors[stage]}`}>
                  <div className="px-4 py-3 border-b border-gray-100">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-900">
                        {OPPORTUNITY_STAGE_LABELS[stage]}
                      </span>
                      <span className="inline-flex items-center justify-center w-5 h-5 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
                        {stageOpps.length}
                      </span>
                    </div>
                    {stageTotal > 0 && (
                      <p className="text-xs text-gray-400 mt-0.5">{formatCurrency(stageTotal)}</p>
                    )}
                  </div>
                  <div className="p-3 space-y-2 min-h-32">
                    {stageOpps.map((opp) => (
                      <div key={opp.id} className="bg-gray-50 rounded-lg p-3 border border-gray-100 hover:border-gray-200 transition-colors">
                        <p className="text-sm font-medium text-gray-900 leading-tight">{opp.title}</p>
                        <p className="text-xs text-gray-500 mt-1">{opp.customer.name}</p>
                        {opp.value && (
                          <p className="text-xs font-semibold text-blue-600 mt-2">{formatCurrency(opp.value)}</p>
                        )}
                        {opp.notes && (
                          <p className="text-xs text-gray-400 mt-1 line-clamp-2">{opp.notes}</p>
                        )}
                      </div>
                    ))}
                    {stageOpps.length === 0 && (
                      <p className="text-xs text-gray-300 text-center py-4">Keine Chancen</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Lost column (collapsed) */}
          {lostOpportunities.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <p className="text-sm font-medium text-gray-500 mb-3">
                Verloren ({lostOpportunities.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {lostOpportunities.map((opp) => (
                  <span key={opp.id} className="text-xs text-gray-400 bg-gray-50 border border-gray-100 px-2 py-1 rounded">
                    {opp.title} – {opp.customer.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Table View */
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Titel</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Kunde</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Wert</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Stage</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Notizen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {opportunities.map((opp) => (
                <tr key={opp.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{opp.title}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{opp.customer.name}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-gray-900">{formatCurrency(opp.value)}</td>
                  <td className="px-6 py-4">
                    <OpportunityStageBadge stage={opp.stage} />
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">{opp.notes ?? '—'}</td>
                </tr>
              ))}
              {opportunities.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm text-gray-400">
                    Keine Vertriebschancen
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Neue Vertriebschance</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Titel <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="title"
                  value={form.title}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kunde <span className="text-red-500">*</span>
                </label>
                <select
                  name="customerId"
                  value={form.customerId}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Kunde auswählen...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Wert (€)</label>
                  <input
                    type="number"
                    name="value"
                    value={form.value}
                    onChange={handleChange}
                    min="0"
                    step="100"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stage</label>
                  <select
                    name="stage"
                    value={form.stage}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {STAGES.map((s) => (
                      <option key={s} value={s}>{OPPORTUNITY_STAGE_LABELS[s]}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notizen</label>
                <textarea
                  name="notes"
                  value={form.notes}
                  onChange={handleChange}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Speichern...' : 'Chance anlegen'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
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
