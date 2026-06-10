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

const STATUS_GROUPS = [
  {
    label: 'Handlungsbedarf',
    statuses: ['OFFER_SENT'],
    accent: 'border-l-purple-400',
    description: 'Angebote warten auf Ihre Rückmeldung',
  },
  {
    label: 'In Bearbeitung',
    statuses: ['OPEN', 'IN_REVIEW', 'OFFER_ACCEPTED', 'OFFER_REJECTED', 'JOB_PLANNED'],
    accent: 'border-l-blue-400',
    description: null,
  },
  {
    label: 'Abgeschlossen',
    statuses: ['CLOSED', 'REJECTED', 'ARCHIVED'],
    accent: 'border-l-gray-300',
    description: null,
  },
]

function groupRequests(requests: RequestItem[]) {
  return STATUS_GROUPS.map(group => ({
    ...group,
    items: requests.filter(r => group.statuses.includes(r.status)),
  })).filter(g => g.items.length > 0)
}

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

  const groups = groupRequests(requests)
  const pendingOffers = requests.filter(r => r.status === 'OFFER_SENT').length

  return (
    <div className="p-6 max-w-3xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Meine Anfragen</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {loading ? '...' : requests.length === 0
              ? 'Noch keine Anfragen gestellt'
              : `${requests.length} Anfrage${requests.length !== 1 ? 'n' : ''} insgesamt`
            }
          </p>
        </div>
        {canCreate && (
          <Link
            href="/portal/requests/new"
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Neue Anfrage
          </Link>
        )}
      </div>

      {/* Pending offer banner */}
      {pendingOffers > 0 && (
        <div className="mb-6 bg-purple-50 border border-purple-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-purple-900">
              {pendingOffers === 1 ? 'Ein Angebot wartet' : `${pendingOffers} Angebote warten`} auf Ihre Rückmeldung
            </p>
            <p className="text-xs text-purple-600 mt-0.5">Bitte prüfen und annehmen oder ablehnen</p>
          </div>
        </div>
      )}

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
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
          <p className="text-gray-600 font-medium text-sm">Noch keine Anfragen vorhanden</p>
          <p className="text-gray-400 text-xs mt-1 mb-4">Stellen Sie Ihre erste Anfrage an den HETA Servicedesk</p>
          {canCreate && (
            <Link
              href="/portal/requests/new"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Erste Anfrage stellen
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(group => (
            <div key={group.label}>
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{group.label}</h2>
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-100 text-gray-500 text-xs font-medium">
                  {group.items.length}
                </span>
                {group.description && (
                  <span className="text-xs text-gray-400">· {group.description}</span>
                )}
              </div>
              <div className="space-y-2">
                {group.items.map(req => (
                  <Link
                    key={req.id}
                    href={`/portal/requests/${req.id}`}
                    className={`block bg-white rounded-xl border border-gray-200 border-l-4 ${group.accent} px-4 py-3.5 hover:shadow-sm hover:border-r-blue-200 transition-all group`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        {/* Title row */}
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-mono text-xs text-gray-400">{req.requestNumber}</span>
                          <span className="font-semibold text-gray-900 group-hover:text-blue-700 truncate">{req.title}</span>
                        </div>

                        {/* Meta row */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${REQUEST_STATUS_COLORS[req.status]}`}>
                            {REQUEST_STATUS_LABELS[req.status]}
                          </span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${REQUEST_PRIORITY_COLORS[req.priority]}`}>
                            {REQUEST_PRIORITY_LABELS[req.priority]}
                          </span>
                          <span className="text-xs text-gray-400">{REQUEST_TYPE_LABELS[req.type] ?? req.type}</span>
                          {req.plants.length > 0 && (
                            <span className="text-xs text-gray-400 flex items-center gap-1">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
                              </svg>
                              {req.plants.map(p => p.plantName).join(', ')}
                            </span>
                          )}
                          {req.offerNumber && (
                            <span className="text-xs text-purple-600 font-medium">Angebot {req.offerNumber}</span>
                          )}
                          {req.serviceJobNumber && (
                            <span className="text-xs text-teal-600 font-medium">Einsatz {req.serviceJobNumber}</span>
                          )}
                        </div>
                      </div>

                      {/* Right: date + arrow */}
                      <div className="flex-shrink-0 flex flex-col items-end gap-1">
                        <span className="text-xs text-gray-400">
                          {format(new Date(req.updatedAt), 'dd.MM.yy', { locale: de })}
                        </span>
                        <svg className="w-4 h-4 text-gray-300 group-hover:text-blue-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
