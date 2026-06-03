'use client'

import { useEffect, useState, Suspense, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

interface Customer { id: string; name: string }
interface Plant { id: string; name: string; type: string }
interface Technician { id: string; name: string; role: string }

interface ConflictJob {
  id: string
  orderNumber: string
  scheduledAt: string
  duration: number
  technicianName: string | null
  vehicle: string | null
  customer: { name: string }
}

const VEHICLES = [
  'VW T6 MKK-HT-49',
  'Mercedes Sprinter GI-HT-50E',
]

const DURATION_PRESETS = [
  { label: 'Halber Tag', value: 240 },
  { label: 'Ganzer Tag', value: 480 },
]

const MULTI_DAY_OPTIONS = [
  { label: '2 Tage', value: 960 },
  { label: '3 Tage', value: 1440 },
  { label: '4 Tage', value: 1920 },
  { label: '5 Tage', value: 2400 },
]

function formatConflictTime(scheduledAt: string, duration: number) {
  const start = new Date(scheduledAt)
  const end = new Date(start.getTime() + duration * 60 * 1000)
  const fmt = (d: Date) => d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  return `${fmt(start)} – ${fmt(end)}`
}

export default function NewJobPageWrapper() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64 text-gray-400">Laden...</div>}>
      <NewJobPage />
    </Suspense>
  )
}

function NewJobPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [plants, setPlants] = useState<Plant[]>([])
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [techConflicts, setTechConflicts] = useState<ConflictJob[]>([])
  const [vehicleConflicts, setVehicleConflicts] = useState<ConflictJob[]>([])
  const [checkingAvailability, setCheckingAvailability] = useState(false)

  // Duration mode: 'preset' | 'multiday'
  const [durationMode, setDurationMode] = useState<'preset' | 'multiday'>('preset')

  const prefillDate = searchParams.get('date')
  const defaultScheduledAt = prefillDate
    ? new Date(prefillDate).toISOString().slice(0, 16)
    : ''

  const [form, setForm] = useState({
    orderNumber: '',
    customerId: '',
    plantId: '',
    scheduledAt: defaultScheduledAt,
    technicianId: '',
    description: '',
    duration: 480,
    vehicle: '',
  })

  useEffect(() => {
    fetch('/api/customers').then(r => r.json()).then(setCustomers)
    fetch('/api/technicians').then(r => r.json()).then((data) => {
      if (Array.isArray(data)) setTechnicians(data)
    })
  }, [])

  useEffect(() => {
    if (!form.customerId) { setPlants([]); setForm(f => ({ ...f, plantId: '' })); return }
    fetch(`/api/plants?customerId=${form.customerId}`).then(r => r.json()).then(setPlants)
    setForm(f => ({ ...f, plantId: '' }))
  }, [form.customerId])

  const checkAvailability = useCallback(async (
    date: string, duration: number, technicianId: string, vehicle: string
  ) => {
    if (!date) { setTechConflicts([]); setVehicleConflicts([]); return }
    setCheckingAvailability(true)
    try {
      const params = new URLSearchParams({ date, duration: String(duration) })
      if (technicianId) params.set('technicianId', technicianId)
      if (vehicle) params.set('vehicle', vehicle)
      const res = await fetch(`/api/availability?${params}`)
      if (res.ok) {
        const { technicianConflicts, vehicleConflicts } = await res.json()
        setTechConflicts(technicianConflicts)
        setVehicleConflicts(vehicleConflicts)
      }
    } finally {
      setCheckingAvailability(false)
    }
  }, [])

  // Re-check whenever relevant fields change
  useEffect(() => {
    checkAvailability(form.scheduledAt, form.duration, form.technicianId, form.vehicle)
  }, [form.scheduledAt, form.duration, form.technicianId, form.vehicle, checkAvailability])

  const setField = (field: string, value: string | number) =>
    setForm(f => ({ ...f, [field]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.orderNumber || !form.customerId || !form.scheduledAt) {
      setError('Bitte Auftragsnummer, Kunde und Datum angeben.')
      return
    }
    const selectedTech = technicians.find(t => t.id === form.technicianId)
    setSubmitting(true)
    const res = await fetch('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        technicianName: selectedTech?.name ?? '',
      }),
    })
    if (!res.ok) { setError('Fehler beim Erstellen des Einsatzes.'); setSubmitting(false); return }
    const job = await res.json()
    router.push(`/jobs/${job.id}`)
  }

  const hasConflicts = techConflicts.length > 0 || vehicleConflicts.length > 0

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/jobs" className="text-gray-400 hover:text-gray-600 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Neuer Serviceeinsatz</h1>
          <p className="text-sm text-gray-500 mt-1">Einsatz anlegen und mit Standard-Checkliste versehen</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Auftragsnummer */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Auftragsnummer <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.orderNumber}
              onChange={e => setField('orderNumber', e.target.value)}
              required
              placeholder="K-12345.26-KUNDE"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
            <p className="mt-1 text-xs text-gray-400">Format: K-XXXXX.JJ-Kundenname (z.B. K-12345.26-MUS)</p>
          </div>

          {/* Kunde */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Kunde <span className="text-red-500">*</span>
            </label>
            <select
              value={form.customerId}
              onChange={e => setField('customerId', e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Kunde auswählen...</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Anlage */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Anlage</label>
            <select
              value={form.plantId}
              onChange={e => setField('plantId', e.target.value)}
              disabled={!form.customerId}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
            >
              <option value="">{form.customerId ? 'Anlage auswählen (optional)' : 'Zuerst Kunde wählen'}</option>
              {plants.map(p => <option key={p.id} value={p.id}>{p.name} ({p.type})</option>)}
            </select>
          </div>

          {/* Datum & Uhrzeit */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Datum & Uhrzeit <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              value={form.scheduledAt}
              onChange={e => setField('scheduledAt', e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Dauer */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Dauer</label>
            <div className="flex gap-2 flex-wrap">
              {DURATION_PRESETS.map(p => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => { setDurationMode('preset'); setField('duration', p.value) }}
                  className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors border ${
                    durationMode === 'preset' && form.duration === p.value
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {p.label}
                </button>
              ))}
              <div className="flex items-center gap-1">
                <span className={`text-sm font-medium px-1 ${durationMode === 'multiday' ? 'text-blue-600' : 'text-gray-500'}`}>
                  Mehrere Tage:
                </span>
                <select
                  value={durationMode === 'multiday' ? form.duration : ''}
                  onChange={e => { setDurationMode('multiday'); setField('duration', Number(e.target.value)) }}
                  onFocus={() => setDurationMode('multiday')}
                  className={`px-2 py-1.5 text-sm rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    durationMode === 'multiday' ? 'border-blue-600 bg-blue-50' : 'border-gray-200'
                  }`}
                >
                  <option value="">auswählen...</option>
                  {MULTI_DAY_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Techniker */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Techniker</label>
            <select
              value={form.technicianId}
              onChange={e => setField('technicianId', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Techniker auswählen (optional)</option>
              {technicians.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            {techConflicts.length > 0 && (
              <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center gap-1.5 text-amber-700 text-sm font-medium mb-1.5">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </svg>
                  Techniker bereits gebucht:
                </div>
                {techConflicts.map(j => (
                  <div key={j.id} className="text-xs text-amber-700">
                    {j.orderNumber} – {j.customer.name} · {formatConflictTime(j.scheduledAt, j.duration)}
                  </div>
                ))}
              </div>
            )}
            {form.technicianId && techConflicts.length === 0 && form.scheduledAt && !checkingAvailability && (
              <div className="mt-1.5 flex items-center gap-1 text-xs text-green-600">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Techniker verfügbar
              </div>
            )}
          </div>

          {/* Fahrzeug */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Fahrzeug</label>
            <select
              value={form.vehicle}
              onChange={e => setField('vehicle', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Fahrzeug auswählen (optional)</option>
              {VEHICLES.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            {vehicleConflicts.length > 0 && (
              <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center gap-1.5 text-amber-700 text-sm font-medium mb-1.5">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </svg>
                  Fahrzeug bereits gebucht:
                </div>
                {vehicleConflicts.map(j => (
                  <div key={j.id} className="text-xs text-amber-700">
                    {j.orderNumber} – {j.customer.name} · {formatConflictTime(j.scheduledAt, j.duration)}
                  </div>
                ))}
              </div>
            )}
            {form.vehicle && vehicleConflicts.length === 0 && form.scheduledAt && !checkingAvailability && (
              <div className="mt-1.5 flex items-center gap-1 text-xs text-green-600">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Fahrzeug verfügbar
              </div>
            )}
          </div>

          {/* Beschreibung */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Beschreibung</label>
            <textarea
              value={form.description}
              onChange={e => setField('description', e.target.value)}
              rows={4}
              placeholder="Beschreibung des Einsatzes..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {hasConflicts && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
              Achtung: Es bestehen Konflikte. Du kannst den Einsatz trotzdem anlegen.
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Wird erstellt...' : 'Einsatz erstellen'}
            </button>
            <Link
              href="/jobs"
              className="px-6 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
            >
              Abbrechen
            </Link>
          </div>
        </form>
      </div>

      <div className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-lg">
        <p className="text-xs text-blue-700 font-medium mb-2">Standard-Checkliste wird automatisch hinzugefügt:</p>
        <p className="text-xs text-blue-600">
          10 Prüfpunkte für Filtrationsanlagen (Sichtprüfung, Differenzdruck, Filterelemente, Dichtheit, Betriebsparameter u.a.)
        </p>
      </div>
    </div>
  )
}
