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

export default function PlantArchivedRequests({ plantId }: { plantId: string }) {
  const [requests, setRequests] = useState<ArchivedRequest[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/requests?plantId=${plantId}&status=ARCHIVED`)
      .then(r => r.json())
      .then(data => { setRequests(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [plantId])

  if (loading || requests.length === 0) return null

  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8l1 12a2 2 0 002 2h8a2 2 0 002-2l1-12M10 12v6m4-6v6" />
        </svg>
        Archivierte Anfragen
      </p>
      <div className="space-y-1">
        {requests.map(req => (
          <Link
            key={req.id}
            href={`/requests/${req.id}`}
            className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 transition-colors group"
          >
            <div className="min-w-0 flex-1">
              <span className="font-mono text-xs text-gray-400 mr-1.5">{req.requestNumber}</span>
              <span className="text-xs text-gray-700 group-hover:text-blue-600 truncate">{req.title}</span>
            </div>
            <span className="flex-shrink-0 text-xs text-gray-400">
              {new Date(req.updatedAt).toLocaleDateString('de-DE')}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
