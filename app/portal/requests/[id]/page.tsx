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

const INTERNAL_ROLES = ['ADMIN', 'SERVICE_MANAGER', 'SERVICE_TECHNICIAN']

const STATUS_STEPS = [
  { status: 'OPEN', label: 'Eingegangen' },
  { status: 'IN_REVIEW', label: 'In Prüfung' },
  { status: 'OFFER_SENT', label: 'Angebot erhalten' },
  { status: 'OFFER_ACCEPTED', label: 'Angebot angenommen' },
  { status: 'JOB_PLANNED', label: 'Einsatz geplant' },
  { status: 'CLOSED', label: 'Abgeschlossen' },
]

const STATUS_STEP_INDEX: Record<string, number> = Object.fromEntries(STATUS_STEPS.map((s, i) => [s.status, i]))

function StatusTracker({ status }: { status: string }) {
  if (['REJECTED', 'ARCHIVED', 'OFFER_REJECTED'].includes(status)) return null
  const currentIdx = STATUS_STEP_INDEX[status] ?? 0
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Status Ihrer Anfrage</h2>
      <div className="flex items-center gap-0">
        {STATUS_STEPS.map((step, i) => {
          const done = i < currentIdx
          const active = i === currentIdx
          const last = i === STATUS_STEPS.length - 1
          return (
            <div key={step.status} className="flex items-center flex-1 min-w-0">
              <div className="flex flex-col items-center flex-shrink-0">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 transition-colors ${
                  done ? 'bg-blue-600 border-blue-600 text-white' :
                  active ? 'bg-blue-50 border-blue-500 text-blue-600' :
                  'bg-white border-gray-200 text-gray-300'
                }`}>
                  {done ? (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <div className={`w-2 h-2 rounded-full ${active ? 'bg-blue-500' : 'bg-gray-200'}`} />
                  )}
                </div>
                <span className={`text-xs mt-1.5 text-center leading-tight w-16 ${active ? 'text-blue-600 font-medium' : done ? 'text-gray-500' : 'text-gray-300'}`}>
                  {step.label}
                </span>
              </div>
              {!last && (
                <div className={`flex-1 h-0.5 mx-1 mb-5 ${i < currentIdx ? 'bg-blue-400' : 'bg-gray-100'}`} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

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

  if (loading) return (
    <div className="flex items-center justify-center p-16 text-gray-400 gap-2">
      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
      </svg>
      <span className="text-sm">Lade Anfrage...</span>
    </div>
  )
  if (!req) return <div className="p-8 text-center text-gray-500 text-sm">Anfrage nicht gefunden.</div>

  return (
    <div className="p-6 max-w-2xl mx-auto">

      {/* Back */}
      <Link href="/portal/requests" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 transition-colors mb-5">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Alle Anfragen
      </Link>

      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <span className="font-mono text-xs font-medium text-gray-400">{req.requestNumber}</span>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${REQUEST_STATUS_COLORS[req.status]}`}>
            {REQUEST_STATUS_LABELS[req.status]}
          </span>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${REQUEST_PRIORITY_COLORS[req.priority]}`}>
            {REQUEST_PRIORITY_LABELS[req.priority]}
          </span>
        </div>
        <h1 className="text-xl font-bold text-gray-900 leading-tight">{req.title}</h1>
        <p className="text-sm text-gray-400 mt-1">
          {REQUEST_TYPE_LABELS[req.type]}
          {req.plants.length > 0 && ` · ${req.plants.map(p => p.plantName).join(', ')}`}
          {' · '}{format(new Date(req.createdAt), 'dd.MM.yyyy', { locale: de })}
        </p>
      </div>

      {/* Status Tracker */}
      <StatusTracker status={req.status} />

      {/* Offer Action Banner */}
      {req.status === 'OFFER_SENT' && req.offerPdfs.length > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-5 mb-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-9 h-9 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-purple-900">Angebot eingegangen</p>
              <p className="text-sm text-purple-700 mt-0.5">Bitte prüfen Sie das Angebot und geben Sie Ihre Rückmeldung.</p>
            </div>
          </div>

          {/* PDF Links */}
          <div className="space-y-2 mb-4">
            {req.offerPdfs.map(offer => (
              <a
                key={offer.id}
                href={offer.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-3 bg-white rounded-lg border border-purple-200 px-4 py-3 hover:border-purple-400 transition-colors group"
              >
                <div>
                  <p className="text-sm font-semibold text-gray-900">Angebot {offer.offerNumber}</p>
                  <p className="text-xs text-gray-400">{offer.fileName} · {format(new Date(offer.createdAt), 'dd.MM.yyyy', { locale: de })}</p>
                </div>
                <div className="flex items-center gap-1.5 text-purple-600 group-hover:text-purple-800 text-xs font-medium">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  PDF öffnen
                </div>
              </a>
            ))}
          </div>

          {!showRejectForm ? (
            <div className="flex gap-3">
              <button
                onClick={handleAccept}
                disabled={actionLoading}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-green-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                {actionLoading ? 'Bitte warten...' : 'Angebot annehmen'}
              </button>
              <button
                onClick={() => setShowRejectForm(true)}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-white border border-red-200 text-red-600 py-2.5 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors"
              >
                Ablehnen
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <textarea
                value={rejectNote}
                onChange={e => setRejectNote(e.target.value)}
                rows={2}
                placeholder="Ablehnungsgrund (optional)..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-400"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleReject}
                  disabled={actionLoading}
                  className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {actionLoading ? 'Bitte warten...' : 'Ablehnung bestätigen'}
                </button>
                <button
                  onClick={() => setShowRejectForm(false)}
                  className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Offer result states */}
      {req.status === 'OFFER_ACCEPTED' && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3.5 mb-5 flex items-center gap-3">
          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-green-900">Angebot angenommen</p>
            {req.acceptedAt && <p className="text-xs text-green-700">am {format(new Date(req.acceptedAt), 'dd.MM.yyyy', { locale: de })}</p>}
          </div>
        </div>
      )}

      {req.status === 'OFFER_REJECTED' && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3.5 mb-5">
          <p className="text-sm font-semibold text-red-900">Angebot abgelehnt</p>
          {req.rejectionNote && <p className="text-xs text-red-700 mt-0.5">{req.rejectionNote}</p>}
        </div>
      )}

      {req.serviceJobNumber && (
        <div className="bg-teal-50 border border-teal-200 rounded-xl px-4 py-3.5 mb-5 flex items-center gap-3">
          <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-teal-900">Serviceeinsatz angelegt</p>
            <p className="text-xs text-teal-700">Auftragsnummer: <strong>{req.serviceJobNumber}</strong></p>
          </div>
        </div>
      )}

      {/* Alte Angebote (nicht OFFER_SENT) */}
      {req.offerPdfs.length > 0 && req.status !== 'OFFER_SENT' && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Angebote</h2>
          <div className="space-y-2">
            {req.offerPdfs.map(offer => (
              <a
                key={offer.id}
                href={offer.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5 hover:bg-gray-100 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-gray-800">Angebot {offer.offerNumber}</p>
                  <p className="text-xs text-gray-400">{offer.fileName}</p>
                </div>
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Beschreibung */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Ihre Anfrage</h2>
        <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{req.description}</p>
        {req.plants.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-1.5 text-xs text-gray-500">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
            </svg>
            {req.plants.map(p => p.plantName).join(', ')}
          </div>
        )}
      </div>

      {/* Kommunikationsverlauf */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Kommunikationsverlauf</h2>
        {req.messages.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-gray-400">Ihre Anfrage ist eingegangen.</p>
            <p className="text-xs text-gray-300 mt-1">Wir melden uns in Kürze bei Ihnen.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {req.messages.map(msg => {
              const isInternal = INTERNAL_ROLES.includes(msg.authorRole)
              return (
                <div key={msg.id} className={`flex gap-3 ${isInternal ? '' : 'flex-row-reverse'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${isInternal ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                    {isInternal ? 'H' : msg.authorName.charAt(0).toUpperCase()}
                  </div>
                  <div className={`flex-1 min-w-0 ${isInternal ? '' : 'flex flex-col items-end'}`}>
                    <div className={`flex items-center gap-2 mb-1 ${isInternal ? '' : 'flex-row-reverse'}`}>
                      <span className="text-xs font-semibold text-gray-700">
                        {isInternal ? 'HETA Service' : msg.authorName}
                      </span>
                      <span className="text-xs text-gray-400">
                        {format(new Date(msg.createdAt), 'dd.MM.yy HH:mm', { locale: de })}
                      </span>
                    </div>
                    {msg.statusChange && (
                      <div className="inline-flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 rounded-lg px-2.5 py-1 mb-1.5">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        {REQUEST_STATUS_LABELS[msg.statusChange.split('→')[1]?.trim()] ?? msg.statusChange}
                      </div>
                    )}
                    {msg.content && (
                      <div className={`inline-block max-w-sm text-sm rounded-2xl px-4 py-2.5 ${
                        isInternal
                          ? 'bg-blue-50 text-gray-800 rounded-tl-sm'
                          : 'bg-gray-100 text-gray-800 rounded-tr-sm'
                      }`}>
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
  )
}
