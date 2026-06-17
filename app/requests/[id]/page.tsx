'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useConfirm } from '@/components/ConfirmDialog'
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
  const confirm = useConfirm()
  const [req, setReq] = useState<RequestDetail | null>(null)
  const [loading, setLoading] = useState(true)

  const [newStatus, setNewStatus] = useState('')
  const [messageContent, setMessageContent] = useState('')
  const [serviceJobNumber, setServiceJobNumber] = useState('')
  const [saving, setSaving] = useState(false)

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
    if (res.ok) { setMessageContent(''); setNewStatus(''); setServiceJobNumber(''); loadRequest() }
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
      setOfferFile(null); setOfferNumber('')
      if (fileInputRef.current) fileInputRef.current.value = ''
      loadRequest()
    }
  }

  const handleArchive = async () => {
    if (!(await confirm({
      title: 'Anfrage archivieren',
      message: 'Soll diese Anfrage archiviert werden?',
      confirmLabel: 'Archivieren',
      danger: false,
    }))) return
    const res = await fetch(`/api/requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'archive' }),
    })
    if (res.ok) loadRequest()
  }

  const handleDelete = async () => {
    if (!(await confirm({
      title: 'Anfrage löschen',
      message: 'Soll diese Anfrage unwiderruflich gelöscht werden?',
    }))) return
    const res = await fetch(`/api/requests/${id}`, { method: 'DELETE' })
    if (res.ok) router.push('/requests')
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

  const nextStatuses = isManager ? (REQUEST_STATUS_FLOW[req.status] ?? []) : []
  const isClosed = ['CLOSED', 'REJECTED', 'ARCHIVED'].includes(req.status)

  return (
    <div className="p-6 max-w-6xl mx-auto">

      {/* Breadcrumb + Header */}
      <div className="mb-6">
        <button onClick={() => router.back()} className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 transition-colors mb-4">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Alle Anfragen
        </button>

        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap mb-2">
              <span className="font-mono text-sm font-medium text-blue-600">{req.requestNumber}</span>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${REQUEST_STATUS_COLORS[req.status]}`}>
                {REQUEST_STATUS_LABELS[req.status]}
              </span>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${REQUEST_PRIORITY_COLORS[req.priority]}`}>
                {REQUEST_PRIORITY_LABELS[req.priority]}
              </span>
              <span className="text-xs text-gray-400">{REQUEST_TYPE_LABELS[req.type] ?? req.type}</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">{req.title}</h1>
            <p className="text-sm text-gray-500 mt-1.5">
              <Link href={`/customers/${req.customer.id}`} className="hover:text-blue-600 hover:underline">{req.customer.name}</Link>
              {' · '}von {req.createdByName}
              {' · '}erstellt {format(new Date(req.createdAt), 'dd.MM.yyyy', { locale: de })}
            </p>
          </div>

          {isManager && (
            <div className="flex items-center gap-2 flex-shrink-0">
              {req.status !== 'ARCHIVED' && (
                <button
                  onClick={handleArchive}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8l1 12a2 2 0 002 2h8a2 2 0 002-2l1-12M10 12v6m4-6v6" />
                  </svg>
                  Archivieren
                </button>
              )}
              <button
                onClick={handleDelete}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Löschen
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Linke Spalte: Beschreibung + Verlauf + Manager-Aktionen */}
        <div className="lg:col-span-2 space-y-5">

          {/* Beschreibung */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Beschreibung</h2>
            <p className="text-gray-800 whitespace-pre-wrap text-sm leading-relaxed">{req.description}</p>
          </div>

          {/* Verlauf */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Verlauf</h2>
            {req.messages.length === 0 ? (
              <p className="text-sm text-gray-400 italic">Noch keine Einträge im Verlauf.</p>
            ) : (
              <div className="relative">
                <div className="absolute left-4 top-2 bottom-2 w-px bg-gray-100" />
                <div className="space-y-5">
                  {req.messages.map((msg, i) => (
                    <div key={msg.id} className="relative flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-blue-50 border-2 border-white ring-1 ring-gray-100 flex items-center justify-center flex-shrink-0 z-10 text-blue-700 text-xs font-bold shadow-sm">
                        {msg.authorName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0 pt-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                          <span className="text-sm font-semibold text-gray-900">{msg.authorName}</span>
                          <span className="text-xs text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">{ROLE_LABELS[msg.authorRole] ?? msg.authorRole}</span>
                          <span className="text-xs text-gray-400">{format(new Date(msg.createdAt), 'dd.MM.yyyy HH:mm', { locale: de })}</span>
                        </div>
                        {msg.statusChange && (
                          <div className="inline-flex items-center gap-1.5 text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-2.5 py-1 mb-2">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            {msg.statusChange.split('→').map(s => REQUEST_STATUS_LABELS[s.trim()] ?? s.trim()).join(' → ')}
                          </div>
                        )}
                        {msg.content && (
                          <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">{msg.content}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Manager: Antworten */}
          {isManager && !isClosed && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Antworten & Status</h2>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Status ändern auf</label>
                    <select
                      value={newStatus}
                      onChange={e => setNewStatus(e.target.value)}
                      className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="">— kein Statuswechsel —</option>
                      {nextStatuses.map(s => (
                        <option key={s} value={s}>{REQUEST_STATUS_LABELS[s] ?? s}</option>
                      ))}
                    </select>
                  </div>
                  {newStatus === 'JOB_PLANNED' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">Auftragsnummer des Einsatzes</label>
                      <input
                        type="text"
                        value={serviceJobNumber}
                        onChange={e => setServiceJobNumber(e.target.value)}
                        placeholder="z.B. AUF-2026-042"
                        className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Nachricht an Anfragesteller</label>
                  <textarea
                    value={messageContent}
                    onChange={e => setMessageContent(e.target.value)}
                    rows={3}
                    placeholder="Antwort verfassen..."
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={handleManagerSave}
                    disabled={saving || (!messageContent.trim() && !newStatus && !serviceJobNumber.trim())}
                    className="inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {saving ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                        </svg>
                        Speichern...
                      </>
                    ) : 'Speichern'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Manager: Angebot hochladen */}
          {isManager && !isClosed && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Angebot hochladen</h2>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Angebotsnummer *</label>
                    <input
                      type="text"
                      value={offerNumber}
                      onChange={e => setOfferNumber(e.target.value)}
                      placeholder="z.B. ANG-2026-001"
                      className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">PDF-Datei *</label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf"
                      onChange={e => setOfferFile(e.target.files?.[0] ?? null)}
                      className="text-xs text-gray-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-gray-200 file:text-xs file:bg-white file:text-gray-700 hover:file:bg-gray-50 w-full"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={handleOfferUpload}
                    disabled={uploading || !offerFile || !offerNumber.trim()}
                    className="inline-flex items-center gap-2 bg-purple-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    {uploading ? 'Hochladen...' : 'Angebot hochladen & versenden'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Rechte Spalte: Details + Angebote */}
        <div className="space-y-5">

          {/* Details */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Details</h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-xs text-gray-400 mb-0.5">Kunde</dt>
                <dd className="text-sm font-medium text-gray-900">
                  <Link href={`/customers/${req.customer.id}`} className="hover:text-blue-600 hover:underline">
                    {req.customer.name}
                  </Link>
                </dd>
              </div>
              {req.plants.length > 0 && (
                <div>
                  <dt className="text-xs text-gray-400 mb-0.5">Anlage(n)</dt>
                  <dd className="space-y-0.5">
                    {req.plants.map(p => (
                      <p key={p.plantId} className="text-sm text-gray-800">{p.plantName}</p>
                    ))}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-gray-400 mb-0.5">Typ</dt>
                <dd className="text-sm text-gray-800">{REQUEST_TYPE_LABELS[req.type] ?? req.type}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400 mb-0.5">Priorität</dt>
                <dd>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${REQUEST_PRIORITY_COLORS[req.priority]}`}>
                    {REQUEST_PRIORITY_LABELS[req.priority]}
                  </span>
                </dd>
              </div>
              {req.offerNumber && (
                <div>
                  <dt className="text-xs text-gray-400 mb-0.5">Angebotsnummer</dt>
                  <dd className="text-sm font-medium text-purple-700">{req.offerNumber}</dd>
                </div>
              )}
              {req.serviceJobNumber && (
                <div>
                  <dt className="text-xs text-gray-400 mb-0.5">Einsatz</dt>
                  <dd className="text-sm font-medium text-teal-700">{req.serviceJobNumber}</dd>
                </div>
              )}
              {req.acceptedAt && (
                <div>
                  <dt className="text-xs text-gray-400 mb-0.5">Angebot angenommen</dt>
                  <dd className="text-sm text-green-700">{format(new Date(req.acceptedAt), 'dd.MM.yyyy', { locale: de })}</dd>
                </div>
              )}
              {req.rejectedAt && (
                <div>
                  <dt className="text-xs text-gray-400 mb-0.5">Angebot abgelehnt</dt>
                  <dd className="text-sm text-red-700">{format(new Date(req.rejectedAt), 'dd.MM.yyyy', { locale: de })}</dd>
                  {req.rejectionNote && <dd className="text-xs text-gray-500 mt-0.5">{req.rejectionNote}</dd>}
                </div>
              )}
              <div className="pt-2 border-t border-gray-100">
                <dt className="text-xs text-gray-400 mb-0.5">Zuletzt aktualisiert</dt>
                <dd className="text-xs text-gray-500">{format(new Date(req.updatedAt), 'dd.MM.yyyy HH:mm', { locale: de })}</dd>
              </div>
            </dl>
          </div>

          {/* Angebote */}
          {req.offerPdfs.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Angebote ({req.offerPdfs.length})
              </h2>
              <div className="space-y-2">
                {req.offerPdfs.map(offer => (
                  <div key={offer.id} className="flex items-center justify-between gap-2 p-3 bg-purple-50 rounded-lg border border-purple-100">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{offer.offerNumber}</p>
                      <p className="text-xs text-gray-500 truncate">{offer.fileName}</p>
                      <p className="text-xs text-gray-400">{format(new Date(offer.createdAt), 'dd.MM.yy', { locale: de })}</p>
                    </div>
                    <a
                      href={offer.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-purple-200 text-purple-700 text-xs font-medium rounded-lg hover:bg-purple-100 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      PDF
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
