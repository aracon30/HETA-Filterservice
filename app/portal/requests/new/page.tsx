'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { REQUEST_TYPE_LABELS, REQUEST_PRIORITY_LABELS } from '@/lib/request-helpers'

const CAN_CREATE_ROLES = ['MAINTENANCE_MANAGER', 'BUYER']

interface Plant {
  id: string
  name: string
  type: string
}

export default function NewRequestPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const [plants, setPlants] = useState<Plant[]>([])
  const [selectedPlantIds, setSelectedPlantIds] = useState<string[]>([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState('SONSTIGES')
  const [priority, setPriority] = useState('NORMAL')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/plants')
      .then(r => r.json())
      .then(data => setPlants(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [])

  // Hooks must run unconditionally; the permission guard comes after all hooks.
  const role = session?.user?.role as string | undefined
  if (session && role && !CAN_CREATE_ROLES.includes(role)) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500 text-sm">Sie haben keine Berechtigung, Anfragen zu stellen.</p>
      </div>
    )
  }

  const togglePlant = (id: string) => {
    setSelectedPlantIds(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!title.trim()) { setError('Titel ist erforderlich.'); return }
    if (!description.trim()) { setError('Beschreibung ist erforderlich.'); return }

    setSubmitting(true)
    const res = await fetch('/api/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description, type, priority, plantIds: selectedPlantIds }),
    })
    setSubmitting(false)

    if (res.ok) {
      router.push('/portal/requests')
    } else {
      const data = await res.json()
      setError(data.error ?? 'Fehler beim Erstellen der Anfrage.')
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <Link href="/portal/requests" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-3">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Zurück zu Anfragen
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Neue Anfrage stellen</h1>
        <p className="text-sm text-gray-500 mt-1">Beschreiben Sie Ihr Anliegen — wir melden uns schnellstmöglich.</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        {/* Titel */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Titel *</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Kurze Beschreibung des Anliegens"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        {/* Typ + Priorität */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Art der Anfrage *</label>
            <select
              value={type}
              onChange={e => setType(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {Object.entries(REQUEST_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Priorität *</label>
            <select
              value={priority}
              onChange={e => setPriority(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {Object.entries(REQUEST_PRIORITY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Beschreibung */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Beschreibung *</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={5}
            placeholder="Beschreiben Sie Ihr Anliegen so detailliert wie möglich..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        {/* Anlagen auswählen */}
        {plants.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Betroffene Anlage(n) <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3">
              {plants.map(plant => (
                <label key={plant.id} className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={selectedPlantIds.includes(plant.id)}
                    onChange={() => togglePlant(plant.id)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 group-hover:text-gray-900">{plant.name}</span>
                  <span className="text-xs text-gray-400">{plant.type}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Wird gesendet...' : 'Anfrage absenden'}
          </button>
          <Link
            href="/portal/requests"
            className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Abbrechen
          </Link>
        </div>
      </form>
    </div>
  )
}
