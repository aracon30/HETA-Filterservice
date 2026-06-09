'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import {
  REQUEST_STATUS_LABELS,
  REQUEST_STATUS_COLORS,
  REQUEST_PRIORITY_LABELS,
  REQUEST_PRIORITY_COLORS,
  REQUEST_TYPE_LABELS,
} from '@/lib/request-helpers'

interface RequestItem {
  id: string
  requestNumber: string
  title: string
  type: string
  priority: string
  status: string
  createdByName: string
  offerNumber?: string
  serviceJobNumber?: string
  createdAt: string
  updatedAt: string
  customer: { id: string; name: string }
  plants: { plantId: string; plantName: string }[]
  messages: { createdAt: string }[]
}

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'Alle Status' },
  { value: 'OPEN', label: 'Offen' },
  { value: 'IN_REVIEW', label: 'In Prüfung' },
  { value: 'OFFER_SENT', label: 'Angebot versendet' },
  { value: 'OFFER_ACCEPTED', label: 'Angebot angenommen' },
  { value: 'OFFER_REJECTED', label: 'Angebot abgelehnt' },
  { value: 'JOB_PLANNED', label: 'Einsatz geplant' },
  { value: 'REJECTED', label: 'Abgelehnt' },
  { value: 'CLOSED', label: 'Geschlossen' },
]

export default function RequestsPage() {
  const [requests, setRequests] = useState<RequestItem[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('ALL')
  const [search, setSearch] = useState('')

  useEffect(() => {
    const params = new URLSearchParams()
    if (status !== 'ALL') params.set('status', status)
    if (search.trim()) params.set('search', search.trim())

    setLoading(true)
    fetch(`/api/requests?${params.toString()}`)
      .then(r => r.json())
      .then(data => { setRequests(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [status, search])

  const openCount = requests.filter(r => r.status === 'OPEN').length

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Anfragen</h1>
          {openCount > 0 && (
            <p className="text-sm text-gray-500 mt-0.5">{openCount} offene Anfrage{openCount !== 1 ? 'n' : ''}</p>
          )}
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <input
          type="text"
          placeholder="Suche nach Nummer, Titel, Angebot..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-4 py-2 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={status}
          onChange={e => setStatus(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {STATUS_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Lade Anfragen...</div>
      ) : requests.length === 0 ? (
        <div className="text-center py-12 text-gray-500">Keine Anfragen gefunden.</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Nummer</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Titel / Anlage</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Kunde</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Typ</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Priorität</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Aktualisiert</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {requests.map(req => (
                <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/requests/${req.id}`} className="font-mono text-blue-600 hover:text-blue-800 font-medium">
                      {req.requestNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/requests/${req.id}`} className="hover:text-blue-600">
                      <div className="font-medium text-gray-900">{req.title}</div>
                      {req.plants.length > 0 && (
                        <div className="text-xs text-gray-500 mt-0.5">
                          {req.plants.map(p => p.plantName).join(', ')}
                        </div>
                      )}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{req.customer.name}</td>
                  <td className="px-4 py-3 text-gray-600">{REQUEST_TYPE_LABELS[req.type] ?? req.type}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${REQUEST_PRIORITY_COLORS[req.priority]}`}>
                      {REQUEST_PRIORITY_LABELS[req.priority] ?? req.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${REQUEST_STATUS_COLORS[req.status]}`}>
                      {REQUEST_STATUS_LABELS[req.status] ?? req.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {format(new Date(req.updatedAt), 'dd.MM.yyyy HH:mm', { locale: de })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
