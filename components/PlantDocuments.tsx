'use client'

import { useEffect, useRef, useState } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type DocType = 'INVOICE' | 'SERVICE_REPORT' | 'MANUAL' | 'DRAWING' | 'IMAGE' | 'OTHER'

interface Job {
  id: string
  orderNumber: string
  scheduledAt: string
}

interface PlantDoc {
  id: string
  type: DocType
  title: string
  description: string | null
  fileUrl: string
  fileName: string
  fileSize: number | null
  mimeType: string | null
  jobId: string | null
  job: { orderNumber: string } | null
  uploadedByName: string
  createdAt: string
}

interface Props {
  plantId: string
  customerId: string
  role: string
}

// ─── Config ───────────────────────────────────────────────────────────────────

const DOC_TYPES: { value: DocType; label: string; icon: string; restricted: boolean }[] = [
  { value: 'INVOICE',        label: 'Rechnung',            icon: '🧾', restricted: true  },
  { value: 'SERVICE_REPORT', label: 'Servicebericht',      icon: '📋', restricted: true  },
  { value: 'MANUAL',         label: 'Bedienungsanleitung', icon: '📖', restricted: true  },
  { value: 'DRAWING',        label: 'Zeichnung / Plan',    icon: '📐', restricted: true  },
  { value: 'IMAGE',          label: 'Bild / Foto',         icon: '🖼️', restricted: false },
  { value: 'OTHER',          label: 'Sonstiges',           icon: '📎', restricted: true  },
]

const RESTRICTED_ROLES = ['ADMIN', 'SERVICE_MANAGER']
const ALL_UPLOAD_ROLES = ['ADMIN', 'SERVICE_MANAGER', 'SERVICE_TECHNICIAN', 'MAINTENANCE_MANAGER', 'MAINTENANCE_TECHNICIAN', 'BUYER']
const DELETE_ROLES = ['ADMIN', 'SERVICE_MANAGER']

function fmtSize(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function typeLabel(t: DocType) {
  return DOC_TYPES.find(d => d.value === t)?.label ?? t
}

function typeIcon(t: DocType) {
  return DOC_TYPES.find(d => d.value === t)?.icon ?? '📄'
}

function isImage(mimeType: string | null) {
  return mimeType?.startsWith('image/') ?? false
}

// ─── Upload modal ─────────────────────────────────────────────────────────────

function UploadModal({ plantId, customerId, role, jobs, onClose, onUploaded }: {
  plantId: string
  customerId: string
  role: string
  jobs: Job[]
  onClose: () => void
  onUploaded: (doc: PlantDoc) => void
}) {
  const [type, setType] = useState<DocType>('MANUAL')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [jobId, setJobId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const canUploadRestricted = RESTRICTED_ROLES.includes(role)
  const availableTypes = DOC_TYPES.filter(d => !d.restricted || canUploadRestricted)

  // Reset jobId when type changes away from INVOICE
  useEffect(() => {
    if (type !== 'INVOICE') setJobId('')
  }, [type])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) { setError('Bitte eine Datei auswählen'); return }
    if (!title.trim()) { setError('Titel ist erforderlich'); return }
    if (type === 'INVOICE' && !jobId) { setError('Bitte einen Serviceeinsatz auswählen'); return }

    setUploading(true)
    setError(null)

    const fd = new FormData()
    fd.append('file', file)
    fd.append('type', type)
    fd.append('title', title.trim())
    fd.append('description', description.trim())
    if (jobId) fd.append('jobId', jobId)

    const res = await fetch(`/api/plants/${plantId}/documents`, { method: 'POST', body: fd })
    const json = await res.json()

    if (!res.ok) {
      setError(json.error ?? 'Upload fehlgeschlagen')
      setUploading(false)
      return
    }

    onUploaded(json)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Dokument hochladen</h2>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Type */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Dokumenttyp</label>
            <div className="grid grid-cols-2 gap-2">
              {availableTypes.map(d => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => setType(d.value)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    type === d.value
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <span>{d.icon}</span>
                  <span className="truncate">{d.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Job link for invoices */}
          {type === 'INVOICE' && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                Serviceeinsatz <span className="text-red-500">*</span>
              </label>
              <select
                value={jobId}
                onChange={e => setJobId(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Einsatz auswählen...</option>
                {jobs.map(j => (
                  <option key={j.id} value={j.id}>
                    {j.orderNumber} · {fmtDate(j.scheduledAt)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Titel <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
              placeholder="z. B. Wartungsanleitung Verladearm 2024"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Beschreibung (optional)</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* File */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Datei <span className="text-red-500">*</span>
            </label>
            <input
              ref={fileRef}
              type="file"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
              accept={
                type === 'IMAGE'
                  ? 'image/*'
                  : type === 'INVOICE'
                  ? '.pdf,.doc,.docx,.xls,.xlsx'
                  : type === 'MANUAL'
                  ? '.pdf,.doc,.docx'
                  : type === 'DRAWING'
                  ? '.pdf,.png,.jpg,.jpeg,.svg'
                  : type === 'SERVICE_REPORT'
                  ? '.pdf'
                  : undefined
              }
              className="w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {file && (
              <p className="mt-1 text-xs text-gray-400">{file.name} · {fmtSize(file.size)}</p>
            )}
          </div>

          {error && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={uploading}
              className="flex-1 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {uploading ? 'Lädt hoch...' : 'Hochladen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PlantDocuments({ plantId, customerId, role }: Props) {
  const [docs, setDocs] = useState<PlantDoc[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState<DocType | 'ALL'>('ALL')
  const [showUpload, setShowUpload] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<PlantDoc | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [previewDoc, setPreviewDoc] = useState<PlantDoc | null>(null)

  const canUpload = ALL_UPLOAD_ROLES.includes(role)
  const canDelete = DELETE_ROLES.includes(role)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch(`/api/plants/${plantId}/documents`).then(r => r.json()),
      fetch(`/api/jobs?customer=${customerId}`).then(r => r.json()),
    ]).then(([d, j]) => {
      setDocs(Array.isArray(d) ? d : [])
      setJobs(Array.isArray(j) ? j : [])
      setLoading(false)
    })
  }, [plantId, customerId])

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    await fetch(`/api/plants/${plantId}/documents/${deleteTarget.id}`, { method: 'DELETE' })
    setDocs(prev => prev.filter(d => d.id !== deleteTarget.id))
    setDeleteTarget(null)
    setDeleting(false)
  }

  const filtered = filterType === 'ALL' ? docs : docs.filter(d => d.type === filterType)

  const typeCounts = docs.reduce<Record<string, number>>((acc, d) => {
    acc[d.type] = (acc[d.type] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="mt-4 pt-4 border-t border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Dokumente {docs.length > 0 && <span className="ml-1 text-gray-400">({docs.length})</span>}
        </h4>
        {canUpload && (
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Hochladen
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-xs text-gray-400 py-2">Lädt...</p>
      ) : docs.length === 0 ? (
        <p className="text-xs text-gray-400 py-2">Noch keine Dokumente hinterlegt.</p>
      ) : (
        <>
          {/* Type filter */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            <button
              onClick={() => setFilterType('ALL')}
              className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                filterType === 'ALL' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              Alle ({docs.length})
            </button>
            {DOC_TYPES.filter(d => typeCounts[d.value]).map(d => (
              <button
                key={d.value}
                onClick={() => setFilterType(d.value)}
                className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                  filterType === d.value ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {d.icon} {d.label} ({typeCounts[d.value]})
              </button>
            ))}
          </div>

          {/* Document list */}
          <div className="space-y-1.5">
            {filtered.map(doc => (
              <div key={doc.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-gray-100 hover:border-gray-200 hover:bg-gray-50 group transition-colors">

                {/* Thumbnail or icon */}
                {isImage(doc.mimeType) ? (
                  <button onClick={() => setPreviewDoc(doc)} className="flex-shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={doc.fileUrl} alt={doc.title} className="w-10 h-10 object-cover rounded border" />
                  </button>
                ) : (
                  <span className="flex-shrink-0 text-xl leading-none">{typeIcon(doc.type)}</span>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{doc.title}</p>
                  <p className="text-xs text-gray-400 truncate">
                    <span className="text-gray-500">{typeLabel(doc.type)}</span>
                    {doc.job && <span> · Einsatz {doc.job.orderNumber}</span>}
                    {doc.fileSize && <span> · {fmtSize(doc.fileSize)}</span>}
                    <span> · {fmtDate(doc.createdAt)}</span>
                  </p>
                  {doc.description && (
                    <p className="text-xs text-gray-400 truncate mt-0.5 italic">{doc.description}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <a
                    href={doc.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    download={doc.fileName}
                    className="p-1.5 text-gray-300 hover:text-blue-600 rounded transition-colors"
                    title="Herunterladen"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </a>
                  {canDelete && (
                    <button
                      onClick={() => setDeleteTarget(doc)}
                      className="p-1.5 text-gray-300 hover:text-red-500 rounded transition-colors"
                      title="Löschen"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Upload modal */}
      {showUpload && (
        <UploadModal
          plantId={plantId}
          customerId={customerId}
          role={role}
          jobs={jobs}
          onClose={() => setShowUpload(false)}
          onUploaded={doc => setDocs(prev => [doc, ...prev])}
        />
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDeleteTarget(null)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-2">Dokument löschen</h2>
            <p className="text-sm text-gray-600 mb-5">
              <span className="font-medium">{deleteTarget.title}</span> wird unwiderruflich gelöscht.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200"
              >
                Abbrechen
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2.5 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Löscht...' : 'Löschen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image preview */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setPreviewDoc(null)}>
          <div className="absolute inset-0 bg-black/70" />
          <div className="relative max-w-4xl max-h-[90vh] mx-4" onClick={e => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewDoc.fileUrl} alt={previewDoc.title} className="max-h-[85vh] max-w-full object-contain rounded-lg shadow-2xl" />
            <div className="absolute bottom-0 left-0 right-0 p-3 bg-black/50 rounded-b-lg flex items-center justify-between">
              <p className="text-white text-sm font-medium truncate">{previewDoc.title}</p>
              <div className="flex gap-2 flex-shrink-0 ml-3">
                <a
                  href={previewDoc.fileUrl}
                  download={previewDoc.fileName}
                  className="px-3 py-1 bg-white/20 hover:bg-white/30 text-white text-xs rounded-lg transition-colors"
                  onClick={e => e.stopPropagation()}
                >
                  Herunterladen
                </a>
                <button
                  onClick={() => setPreviewDoc(null)}
                  className="px-3 py-1 bg-white/20 hover:bg-white/30 text-white text-xs rounded-lg transition-colors"
                >
                  Schließen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
