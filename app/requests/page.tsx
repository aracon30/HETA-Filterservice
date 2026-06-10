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
  { value: 'ARCHIVED', label: 'Archiviert' },
]

const PRIORITY_ICON: Record<string, string> = {
  CRITICAL: '🔴',
  URGENT: '🟠',
  NORMAL: '🔵',
  LOW: '⚪',
}

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
  const urgentCount = requests.filter(r => r.priority === 'CRITICAL' || r.priority === 'URGENT').length

  return (
    <div className="p-6 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Anfragen</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {loading ? '...' : `${requests.length} Anfrage${requests.length !== 1 ? 'n' : ''}`}
            {openCount > 0 && ` · ${openCount} offen`}
            {urgentCount > 0 && ` · ${urgentCount} dringend`}
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex gap-3 mb-6 flex-wrap items-center">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Nummer, Titel, Angebot..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_OPTIONS.map(o => (
            <button
              key={o.value}
              onClick={() => setStatus(o.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                status === o.value
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400 gap-2">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          <span className="text-sm">Lade Anfragen...</span>
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-16">
          <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-sm text-gray-400">Keine Anfragen gefunden</p>
        </div>
      ) : (
        <div className="space-y-2">
          {requests.map(req => (
            <Link
              key={req.id}
              href={`/requests/${req.id}`}
              className="block bg-white border border-gray-200 rounded-xl px-5 py-4 hover:border-blue-300 hover:shadow-sm transition-all group"
            >
              <div className="flex items-start gap-4">

                {/* Priority dot */}
                <div className="mt-0.5 flex-shrink-0 text-sm leading-none" title={REQUEST_PRIORITY_LABELS[req.priority]}>
                  {PRIORITY_ICON[req.priority] ?? '⚪'}
                </div>

                {/* Main content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-gray-400 shrink-0">{req.requestNumber}</span>
                    <span className="font-semibold text-gray-900 group-hover:text-blue-700 truncate">{req.title}</span>
                  </div>

                  <div className="flex items-center gap-3 mt-1.5 flex-wrap text-xs text-gray-500">
                    {/* Customer */}
                    <span className="flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      <Link
                        href={`/customers/${req.customer.id}`}
                        onClick={e => e.stopPropagation()}
                        className="hover:text-blue-600 hover:underline"
                      >
                        {req.customer.name}
                      </Link>
                    </span>

                    {/* Plants */}
                    {req.plants.length > 0 && (
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
                        </svg>
                        {req.plants.map(p => p.plantName).join(', ')}
                      </span>
                    )}

                    {/* Type */}
                    <span className="flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                      {REQUEST_TYPE_LABELS[req.type] ?? req.type}
                    </span>

                    {/* Offer number */}
                    {req.offerNumber && (
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Angebot {req.offerNumber}
                      </span>
                    )}

                    {/* Requester */}
                    <span className="text-gray-400">von {req.createdByName}</span>
                  </div>
                </div>

                {/* Right side: status + date */}
                <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${REQUEST_STATUS_COLORS[req.status]}`}>
                    {REQUEST_STATUS_LABELS[req.status] ?? req.status}
                  </span>
                  <span className="text-xs text-gray-400">
                    {format(new Date(req.updatedAt), 'dd.MM.yy HH:mm', { locale: de })}
                  </span>
                </div>

              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
