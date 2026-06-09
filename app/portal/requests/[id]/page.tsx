'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
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

interface Message {
  id: string
  authorName: string
  authorRole: string
  content: string
  statusChange: string | null
  createdAt: string
}

interface Offer {
  id: string
  offerNumber: string
  fileUrl: string
  fileName: string
  uploadedByName: string
  createdAt: string
}

interface RequestDetail {
  id: string
  requestNumber: string
  title: string
  description: string
  type: string
  priority: string
  status: string
  createdByName: string
  offerNumber: string | null
  serviceJobNumber: string | null
  acceptedAt: string | null
  rejectedAt: string | null
  rejectionNote: string | null
  createdAt: string
  updatedAt: string
  plants: { plantId: string; plantName: string }[]
  messages: Message[]
  offerPdfs: Offer[]
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'HETA Service',
  SERVICE_MANAGER: 'HETA Service',
  SERVICE_TECHNICIAN: 'HETA Techniker',
  MAINTENANCE_MANAGER: 'Instandhaltungsleiter',
  MAINTENANCE_TECHNICIAN: 'Instandh.-Techniker',
  BUYER: 'Einkäufer',
}

const INTERNAL_ROLES = ['ADMIN', 'SERVICE_MANAGER', 'SERVICE_TECHNICIAN']

export default function PortalRequestDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [req, setReq] = useState<RequestDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [rejectNote, setRejectNote] = useState('')
  const [showRejectForm, setShowRejectForm] = useState(false)

  const loadRequest = () => {
    fetch(`/api/requests/${id}`)
      .then(r => r.json())
      .then(data => { setReq(data); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { loadRequest() }, [id])

  const handleAccept = async () => {
    if (!confirm('Angebot annehmen? Diese Bestätigung ist verbindlich.')) return
    setActionLoading(true)
    await fetch(`/api/requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'accept_offer' }),
    })
    setActionLoading(false)
    loadRequest()
  }

  const handleReject = async () => {
    setActionLoading(true)
    await fetch(`/api/requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reject_offer', rejectionNote: rejectNote }),
    })
    setActionLoading(false)
    setShowRejectForm(false)
    loadRequest()
  }

  if (loading) return <div className="p-8 text-gray-500">Lade Anfrage...</div>
  if (!req) return <div className="p-8 text-gray-500">Anfrage nicht gefunden.</div>

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <Link href="/portal/requests" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-3">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Zurück zu Anfragen
        </Link>

        <div className="flex items-start gap-3 flex-wrap">
          <span className="font-mono text-blue-600 font-medium text-sm">{req.requestNumber}</span>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${REQUEST_STATUS_COLORS[req.status]}`}>
            {REQUEST_STATUS_LABELS[req.status]}
          </span>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${REQUEST_PRIORITY_COLORS[req.priority]}`}>
            {REQUEST_PRIORITY_LABELS[req.priority]}
          </span>
        </div>
        <h1 className="text-xl font-bold text-gray-900 mt-2">{req.title}</h1>
        <p className="text-sm text-gray-500 mt-1">
          {REQUEST_TYPE_LABELS[req.type]} · {format(new Date(req.createdAt), 'dd.MM.yyyy', { locale: de })}
        </p>
      </div>

      <div className="space-y-5">
        {/* Beschreibung */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-2 text-sm">Ihre Anfrage</h2>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{req.description}</p>
          {req.plants.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-500">Betroffene Anlage(n): {req.plants.map(p => p.plantName).join(', ')}</p>
            </div>
          )}
        </div>

        {/* Angebote — prominente Darstellung wenn vorhanden */}
        {req.offerPdfs.length > 0 && (
          <div className={`rounded-xl border p-5 ${req.status === 'OFFER_SENT' ? 'bg-purple-50 border-purple-200' : 'bg-white border-gray-200'}`}>
            <h2 className="font-semibold text-gray-900 mb-3 text-sm">
              {req.status === 'OFFER_SENT' ? '🔔 Angebot eingegangen' : 'Angebote'}
            </h2>
            <div className="space-y-2 mb-4">
              {req.offerPdfs.map(offer => (
                <div key={offer.id} className="flex items-center justify-between gap-3 bg-white rounded-lg border border-gray-200 p-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Angebot {offer.offerNumber}</p>
                    <p className="text-xs text-gray-500">{offer.fileName} · {format(new Date(offer.createdAt), 'dd.MM.yyyy', { locale: de })}</p>
                  </div>
                  <a
                    href={offer.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    PDF
                  </a>
                </div>
              ))}
            </div>

            {req.status === 'OFFER_SENT' && (
              <div className="space-y-3">
                {!showRejectForm ? (
                  <div className="flex gap-2">
                    <button
                      onClick={handleAccept}
                      disabled={actionLoading}
                      className="flex-1 bg-green-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      {actionLoading ? '...' : '✓ Angebot annehmen'}
                    </button>
                    <button
                      onClick={() => setShowRejectForm(true)}
                      className="flex-1 bg-red-100 text-red-700 py-2.5 rounded-lg text-sm font-medium hover:bg-red-200 transition-colors"
                    >
                      Angebot ablehnen
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <textarea
                      value={rejectNote}
                      onChange={e => setRejectNote(e.target.value)}
                      rows={2}
                      placeholder="Ablehnungsgrund (optional)..."
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleReject}
                        disabled={actionLoading}
                        className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                      >
                        {actionLoading ? '...' : 'Ablehnung bestätigen'}
                      </button>
                      <button
                        onClick={() => setShowRejectForm(false)}
                        className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        Abbrechen
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {req.status === 'OFFER_ACCEPTED' && (
              <p className="text-sm text-green-700 font-medium">
                ✓ Angebot angenommen am {req.acceptedAt ? format(new Date(req.acceptedAt), 'dd.MM.yyyy', { locale: de }) : '—'}
              </p>
            )}
            {req.status === 'OFFER_REJECTED' && (
              <p className="text-sm text-red-700">
                Angebot abgelehnt{req.rejectionNote ? `: ${req.rejectionNote}` : ''}
              </p>
            )}
          </div>
        )}

        {/* Einsatz geplant */}
        {req.serviceJobNumber && (
          <div className="bg-teal-50 border border-teal-200 rounded-xl p-5">
            <h2 className="font-semibold text-teal-900 mb-1 text-sm">Einsatz geplant</h2>
            <p className="text-sm text-teal-800">
              Ihr Serviceeinsatz wurde mit der Auftragsnummer <strong>{req.serviceJobNumber}</strong> angelegt.
            </p>
          </div>
        )}

        {/* Verlauf */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4 text-sm">Kommunikationsverlauf</h2>
          {req.messages.length === 0 ? (
            <p className="text-sm text-gray-500">Ihre Anfrage wurde übermittelt. Wir melden uns in Kürze.</p>
          ) : (
            <div className="space-y-4">
              {req.messages.map(msg => {
                const isInternal = INTERNAL_ROLES.includes(msg.authorRole)
                return (
                  <div key={msg.id} className={`flex gap-3 ${isInternal ? '' : 'flex-row-reverse'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${isInternal ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                      {msg.authorName.charAt(0).toUpperCase()}
                    </div>
                    <div className={`flex-1 min-w-0 ${isInternal ? '' : 'text-right'}`}>
                      <div className={`flex items-center gap-2 mb-1 ${isInternal ? '' : 'justify-end'}`}>
                        <span className="text-xs font-medium text-gray-700">
                          {isInternal ? 'HETA Service' : msg.authorName}
                        </span>
                        <span className="text-xs text-gray-400">
                          {format(new Date(msg.createdAt), 'dd.MM.yyyy HH:mm', { locale: de })}
                        </span>
                      </div>
                      {msg.statusChange && (
                        <div className="text-xs text-blue-600 bg-blue-50 rounded px-2 py-0.5 inline-block mb-1">
                          {REQUEST_STATUS_LABELS[msg.statusChange.split('→')[1]] ?? msg.statusChange}
                        </div>
                      )}
                      {msg.content && (
                        <div className={`inline-block max-w-full text-sm rounded-xl px-3 py-2 ${isInternal ? 'bg-blue-50 text-gray-800 text-left' : 'bg-gray-100 text-gray-800'}`}>
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
