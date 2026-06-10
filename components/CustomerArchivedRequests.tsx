'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface ArchivedRequest {
  id: string
  requestNumber: string
  title: string
  createdByName: string
  updatedAt: string
}

export default function CustomerArchivedRequests({ customerId }: { customerId: string }) {
  const [requests, setRequests] = useState<ArchivedRequest[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/requests?customerId=${customerId}&status=ARCHIVED&noPlant=true`)
      .then(r => r.json())
      .then(data => { setRequests(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [customerId])

  if (loading || requests.length === 0) return null

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mt-6">
      <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8l1 12a2 2 0 002 2h8a2 2 0 002-2l1-12M10 12v6m4-6v6" />
        </svg>
        Archivierte Anfragen (ohne Anlage)
      </h2>
      <div className="space-y-1">
        {requests.map(req => (
          <Link
            key={req.id}
            href={`/requests/${req.id}`}
            className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors group"
          >
            <div className="min-w-0 flex-1">
              <span className="font-mono text-xs text-gray-400 mr-1.5">{req.requestNumber}</span>
              <span className="text-sm text-gray-700 group-hover:text-blue-600">{req.title}</span>
            </div>
            <div className="flex-shrink-0 flex items-center gap-3 text-xs text-gray-400">
              <span>{req.createdByName}</span>
              <span>{new Date(req.updatedAt).toLocaleDateString('de-DE')}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
