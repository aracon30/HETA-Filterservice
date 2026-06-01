'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

interface Customer {
  id: string
  name: string
}

interface Plant {
  id: string
  name: string
  type: string
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
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Pre-fill date from calendar click
  const prefillDate = searchParams.get('date')
  const defaultScheduledAt = prefillDate
    ? new Date(prefillDate).toISOString().slice(0, 16)
    : ''

  const [form, setForm] = useState({
    customerId: '',
    plantId: '',
    scheduledAt: defaultScheduledAt,
    technicianName: '',
    description: '',
    duration: 60,
    vehicle: '',
  })

  useEffect(() => {
    fetch('/api/customers')
      .then((r) => r.json())
      .then(setCustomers)
  }, [])

  useEffect(() => {
    if (!form.customerId) {
      setPlants([])
      setForm((f) => ({ ...f, plantId: '' }))
      return
    }
    fetch(`/api/plants?customerId=${form.customerId}`)
      .then((r) => r.json())
      .then(setPlants)
    setForm((f) => ({ ...f, plantId: '' }))
  }, [form.customerId])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const value = e.target.type === 'number' ? Number(e.target.value) : e.target.value
    setForm((f) => ({ ...f, [e.target.name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!form.customerId || !form.scheduledAt) {
      setError('Bitte Kunde und Datum angeben.')
      return
    }

    setSubmitting(true)
    const res = await fetch('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    if (!res.ok) {
      setError('Fehler beim Erstellen des Einsatzes.')
      setSubmitting(false)
      return
    }

    const job = await res.json()
    router.push(`/jobs/${job.id}`)
  }

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
          <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Anlage
            </label>
            <select
              name="plantId"
              value={form.plantId}
              onChange={handleChange}
              disabled={!form.customerId}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
            >
              <option value="">
                {form.customerId ? 'Anlage auswählen (optional)' : 'Zuerst Kunde wählen'}
              </option>
              {plants.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.type})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Datum & Uhrzeit <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              name="scheduledAt"
              value={form.scheduledAt}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Techniker
            </label>
            <input
              type="text"
              name="technicianName"
              value={form.technicianName}
              onChange={handleChange}
              placeholder="Name des Technikers"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Dauer (Minuten)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                name="duration"
                value={form.duration}
                onChange={handleChange}
                min={15}
                step={15}
                className="w-28 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-500">Minuten</span>
            </div>
            <div className="flex gap-2 mt-2">
              {[{ label: '30 Min', value: 30 }, { label: '1 Std', value: 60 }, { label: '2 Std', value: 120 }, { label: '4 Std', value: 240 }, { label: '8 Std', value: 480 }].map(({ label, value }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, duration: value }))}
                  className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors border ${
                    form.duration === value
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Fahrzeug
            </label>
            <input
              type="text"
              name="vehicle"
              value={form.vehicle}
              onChange={handleChange}
              placeholder="z.B. VW Crafter HH-HE 123"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Beschreibung
            </label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={4}
              placeholder="Beschreibung des Einsatzes..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

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
