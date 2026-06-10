'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
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
  offerNumber?: string
  serviceJobNumber?: string
  createdAt: string
  updatedAt: string
  plants: { plantId: string; plantName: string }[]
}

const CAN_CREATE_ROLES = ['MAINTENANCE_MANAGER', 'BUYER']

export default function PortalRequestsPage() {
  const { data: session } = useSession()
  const [requests, setRequests] = useState<RequestItem[]>([])
  const [loading, setLoading] = useState(true)
  const canCreate = CAN_CREATE_ROLES.includes(session?.user?.role as string ?? '')

  useEffect(() => {
    fetch('/api/requests')
      .then(r => r.json())
      .then(data => { setRequests(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Meine Anfragen</h1>
          <p className="text-sm text-gray-500 mt-0.5">Anfragen an den HETA Servicedesk</p>
        </div>
        {canCreate && (
          <Link
            href="/portal/requests/new"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Neue Anfrage
          </Link>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Lade Anfragen...</div>
      ) : requests.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
          <p className="text-gray-500 text-sm">Noch keine Anfragen vorhanden.</p>
          {canCreate && (
            <Link href="/portal/requests/new" className="mt-3 inline-block text-sm text-blue-600 hover:text-blue-800">
              Erste Anfrage stellen →
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map(req => (
            <Link
              key={req.id}
              href={`/portal/requests/${req.id}`}
              className="block bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-mono text-blue-600 text-xs font-medium">{req.requestNumber}</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${REQUEST_STATUS_COLORS[req.status]}`}>
                      {REQUEST_STATUS_LABELS[req.status]}
                    </span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${REQUEST_PRIORITY_COLORS[req.priority]}`}>
                      {REQUEST_PRIORITY_LABELS[req.priority]}
                    </span>
                  </div>
                  <p className="font-medium text-gray-900">{req.title}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                    <span>{REQUEST_TYPE_LABELS[req.type] ?? req.type}</span>
                    {req.plants.length > 0 && (
                      <span>{req.plants.map(p => p.plantName).join(', ')}</span>
                    )}
                    {req.offerNumber && (
                      <span className="text-purple-600">Angebot: {req.offerNumber}</span>
                    )}
                    {req.serviceJobNumber && (
                      <span className="text-teal-600">Einsatz: {req.serviceJobNumber}</span>
                    )}
                  </div>
                </div>
                <div className="text-xs text-gray-400 flex-shrink-0">
                  {format(new Date(req.updatedAt), 'dd.MM.yy', { locale: de })}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
