'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
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
  REQUEST_STATUS_FLOW,
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
  serviceJobId: string | null
  serviceJobNumber: string | null
  acceptedAt: string | null
  rejectedAt: string | null
  rejectionNote: string | null
  createdAt: string
  updatedAt: string
  customer: { id: string; name: string }
  plants: { plantId: string; plantName: string; plant?: { id: string; name: string; type: string } }[]
  messages: Message[]
  offerPdfs: Offer[]
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin',
  SERVICE_MANAGER: 'Service Manager',
  SERVICE_TECHNICIAN: 'Techniker',
  MAINTENANCE_MANAGER: 'Instandhaltungsleiter',
  MAINTENANCE_TECHNICIAN: 'Instandh.-Techniker',
  BUYER: 'Einkäufer',
}

const MANAGER_ROLES = ['ADMIN', 'SERVICE_MANAGER']

export default function RequestDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { data: session } = useSession()
  const [req, setReq] = useState<RequestDetail | null>(null)
  const [loading, setLoading] = useState(true)

  // Manager fields
  const [newStatus, setNewStatus] = useState('')
  const [messageContent, setMessageContent] = useState('')
  const [serviceJobNumber, setServiceJobNumber] = useState('')
  const [saving, setSaving] = useState(false)

  // Offer upload
  const [offerNumber, setOfferNumber] = useState('')
  const [offerFile, setOfferFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const role = session?.user?.role as string | undefined
  const isManager = role ? MANAGER_ROLES.includes(role) : false

  const loadRequest = () => {
    fetch(`/api/requests/${id}`)
      .then(r => r.json())
      .then(data => { setReq(data); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { loadRequest() }, [id])

  const handleManagerSave = async () => {
    if (!messageContent.trim() && !newStatus && !serviceJobNumber.trim()) return
    setSaving(true)
    const body: Record<string, string> = {}
    if (newStatus) body.status = newStatus
    if (messageContent.trim()) body.messageContent = messageContent
    if (serviceJobNumber.trim()) body.serviceJobNumber = serviceJobNumber

    const res = await fetch(`/api/requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setSaving(false)
    if (res.ok) {
      setMessageContent('')
      setNewStatus('')
      setServiceJobNumber('')
      loadRequest()
    }
  }

  const handleOfferUpload = async () => {
    if (!offerFile || !offerNumber.trim()) return
    setUploading(true)
    const fd = new FormData()
    fd.append('file', offerFile)
    fd.append('offerNumber', offerNumber)
    const res = await fetch(`/api/requests/${id}/offers`, { method: 'POST', body: fd })
    setUploading(false)
    if (res.ok) {
      setOfferFile(null)
      setOfferNumber('')
      if (fileInputRef.current) fileInputRef.current.value = ''
      loadRequest()
    }
  }

  const handleAcceptOffer = async () => {
    if (!confirm('Angebot wirklich annehmen? Diese Aktion kann nicht rückgängig gemacht werden.')) return
    await fetch(`/api/requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'accept_offer' }),
    })
    loadRequest()
  }

  const handleRejectOffer = async () => {
    const note = prompt('Ablehnungsgrund (optional):') ?? ''
    await fetch(`/api/requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reject_offer', rejectionNote: note }),
    })
    loadRequest()
  }

  if (loading) return <div className="p-8 text-gray-500">Lade Anfrage...</div>
  if (!req) return <div className="p-8 text-gray-500">Anfrage nicht gefunden.</div>

  const nextStatuses = isManager ? (REQUEST_STATUS_FLOW[req.status] ?? []) : []

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700 mb-3 flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Zurück
        </button>

        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="font-mono text-blue-600 font-medium">{req.requestNumber}</span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${REQUEST_STATUS_COLORS[req.status]}`}>
                {REQUEST_STATUS_LABELS[req.status]}
              </span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${REQUEST_PRIORITY_COLORS[req.priority]}`}>
                {REQUEST_PRIORITY_LABELS[req.priority]}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{req.title}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {REQUEST_TYPE_LABELS[req.type]} · {req.customer.name} · Gestellt von {req.createdByName} am {format(new Date(req.createdAt), 'dd.MM.yyyy', { locale: de })}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Details + Timeline */}
        <div className="lg:col-span-2 space-y-6">
          {/* Beschreibung */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-3">Beschreibung</h2>
            <p className="text-gray-700 whitespace-pre-wrap text-sm">{req.description}</p>
          </div>

          {/* Verlauf / Timeline */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Verlauf</h2>
            {req.messages.length === 0 ? (
              <p className="text-sm text-gray-500">Noch keine Nachrichten.</p>
            ) : (
              <div className="space-y-4">
                {req.messages.map(msg => (
                  <div key={msg.id} className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 text-blue-700 text-xs font-bold">
                      {msg.authorName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-gray-900">{msg.authorName}</span>
                        <span className="text-xs text-gray-400">{ROLE_LABELS[msg.authorRole] ?? msg.authorRole}</span>
                        <span className="text-xs text-gray-400">{format(new Date(msg.createdAt), 'dd.MM.yyyy HH:mm', { locale: de })}</span>
                      </div>
                      {msg.statusChange && (
                        <div className="text-xs text-blue-600 bg-blue-50 rounded px-2 py-0.5 inline-block mb-1">
                          Status: {msg.statusChange.split('→').map(s => REQUEST_STATUS_LABELS[s] ?? s).join(' → ')}
                        </div>
                      )}
                      {msg.content && (
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{msg.content}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Manager: Antwort / Status */}
          {isManager && req.status !== 'CLOSED' && req.status !== 'REJECTED' && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-900 mb-4">Antworten / Status ändern</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Status ändern auf</label>
                  <select
                    value={newStatus}
                    onChange={e => setNewStatus(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">— kein Statuswechsel —</option>
                    {nextStatuses.map(s => (
                      <option key={s} value={s}>{REQUEST_STATUS_LABELS[s] ?? s}</option>
                    ))}
                  </select>
                </div>
                {newStatus === 'JOB_PLANNED' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Auftragsnummer des Einsatzes</label>
                    <input
                      type="text"
                      value={serviceJobNumber}
                      onChange={e => setServiceJobNumber(e.target.value)}
                      placeholder="z.B. AUF-2026-042"
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Nachricht (optional)</label>
                  <textarea
                    value={messageContent}
                    onChange={e => setMessageContent(e.target.value)}
                    rows={3}
                    placeholder="Antwort an den Anfragesteller..."
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  onClick={handleManagerSave}
                  disabled={saving || (!messageContent.trim() && !newStatus && !serviceJobNumber.trim())}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? 'Speichern...' : 'Speichern'}
                </button>
              </div>
            </div>
          )}

          {/* Manager: Angebot hochladen */}
          {isManager && req.status !== 'CLOSED' && req.status !== 'REJECTED' && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-900 mb-4">Angebot hochladen</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Angebotsnummer *</label>
                  <input
                    type="text"
                    value={offerNumber}
                    onChange={e => setOfferNumber(e.target.value)}
                    placeholder="z.B. ANG-2026-001"
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Angebot PDF *</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    onChange={e => setOfferFile(e.target.files?.[0] ?? null)}
                    className="text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-gray-300 file:text-sm file:bg-white file:text-gray-700 hover:file:bg-gray-50"
                  />
                </div>
                <button
                  onClick={handleOfferUpload}
                  disabled={uploading || !offerFile || !offerNumber.trim()}
                  className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {uploading ? 'Hochladen...' : 'Angebot hochladen & versenden'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: Metadaten + Angebote */}
        <div className="space-y-6">
          {/* Metadaten */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <h2 className="font-semibold text-gray-900">Details</h2>
            <div>
              <p className="text-xs text-gray-500">Kunde</p>
              <p className="text-sm font-medium text-gray-900">{req.customer.name}</p>
            </div>
            {req.plants.length > 0 && (
              <div>
                <p className="text-xs text-gray-500">Anlage(n)</p>
                {req.plants.map(p => (
                  <p key={p.plantId} className="text-sm text-gray-900">{p.plantName}</p>
                ))}
              </div>
            )}
            {req.offerNumber && (
              <div>
                <p className="text-xs text-gray-500">Angebotsnummer</p>
                <p className="text-sm font-medium text-gray-900">{req.offerNumber}</p>
              </div>
            )}
            {req.serviceJobNumber && (
              <div>
                <p className="text-xs text-gray-500">Einsatz</p>
                <p className="text-sm font-medium text-gray-900">{req.serviceJobNumber}</p>
              </div>
            )}
            {req.acceptedAt && (
              <div>
                <p className="text-xs text-gray-500">Angebot angenommen am</p>
                <p className="text-sm text-green-700">{format(new Date(req.acceptedAt), 'dd.MM.yyyy', { locale: de })}</p>
              </div>
            )}
            {req.rejectedAt && (
              <div>
                <p className="text-xs text-gray-500">Angebot abgelehnt am</p>
                <p className="text-sm text-red-700">{format(new Date(req.rejectedAt), 'dd.MM.yyyy', { locale: de })}</p>
                {req.rejectionNote && <p className="text-xs text-gray-500 mt-1">{req.rejectionNote}</p>}
              </div>
            )}
          </div>

          {/* Angebote */}
          {req.offerPdfs.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-900 mb-3">Angebote</h2>
              <div className="space-y-2">
                {req.offerPdfs.map(offer => (
                  <div key={offer.id} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-gray-50 border border-gray-100">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-800 truncate">{offer.offerNumber}</p>
                      <p className="text-xs text-gray-500 truncate">{offer.fileName}</p>
                    </div>
                    <a
                      href={offer.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 text-blue-600 hover:text-blue-800"
                      title="PDF herunterladen"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </a>
                  </div>
                ))}
              </div>

              {/* External: Angebot annehmen / ablehnen */}
              {!isManager && req.status === 'OFFER_SENT' && (
                <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                  <p className="text-xs text-gray-600 font-medium">Möchten Sie das Angebot annehmen?</p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleAcceptOffer}
                      className="flex-1 bg-green-600 text-white px-3 py-2 rounded-lg text-xs font-medium hover:bg-green-700 transition-colors"
                    >
                      Angebot annehmen
                    </button>
                    <button
                      onClick={handleRejectOffer}
                      className="flex-1 bg-red-100 text-red-700 px-3 py-2 rounded-lg text-xs font-medium hover:bg-red-200 transition-colors"
                    >
                      Ablehnen
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
