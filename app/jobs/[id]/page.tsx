'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import StatusBadge from '@/components/StatusBadge'
import InvoicePanel from '@/components/InvoicePanel'

const EXTERNAL_ROLES = ['MAINTENANCE_MANAGER', 'MAINTENANCE_TECHNICIAN', 'BUYER']

// Normalize legacy /uploads/ URLs to the auth-protected /api/files/ route
function toFileUrl(url: string): string {
  if (!url) return url
  if (url.startsWith('/uploads/')) return `/api/files/${url.slice('/uploads/'.length)}`
  return url
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface ChecklistItem {
  id: string
  label: string
  section: string | null
  plantId: string | null
  status: 'open' | 'io' | 'nio'
  checked: boolean
  comment: string | null
  photoUrl: string | null
}

interface PlantContact {
  user: { id: string; name: string; email: string | null; phone: string | null }
}

interface PlantInfo {
  id: string
  name: string
  type: string
  serialNumber: string | null
  location: string | null
  manufacturer: string | null
  model: string | null
  buildYear: number | null
  externalUsers: PlantContact[]
}

interface JobMaterial {
  id: string
  plantId: string
  plantName: string
  label: string
  partNumber: string | null
  quantity: number
  status: string
  deliveryDate: string | null
  notes: string | null
  order: number
}

interface Job {
  id: string
  orderNumber: string
  status: string
  scheduledAt: string
  completedAt: string | null
  updatedAt: string
  technicianSignature: string | null
  customerSignature: string | null
  duration: number
  description: string | null
  findings: string | null
  recommendations: string | null
  workTimeEntries: { date: string; startTime: string; endTime: string }[] | null
  customer: { id: string; name: string; address: string | null; contactName: string | null }
  site: {
    id: string
    name: string
    address: string | null
    zip: string | null
    city: string | null
    hotels: { id: string; name: string; address: string | null; phone: string | null; note: string | null }[]
  } | null
  plants: { plant: PlantInfo }[]
  technicians: { userId: string; userName: string }[]
  vehicles: string[]
  checklistItems: ChecklistItem[]
  jobMaterials: JobMaterial[]
}

function MaterialRow({ mat, onStatus, onDelivery, onNotes, onDelete }: {
  mat: JobMaterial
  onStatus: (s: string) => void
  onDelivery: (v: string | null) => void
  onNotes: (v: string | null) => void
  onDelete?: () => void
}) {
  return (
    <div className={`p-4 rounded-lg border ${
      mat.status === 'IN_STOCK' ? 'bg-green-50 border-green-200' :
      mat.status === 'TO_ORDER' ? 'bg-orange-50 border-orange-200' :
      mat.status === 'ORDERED'  ? 'bg-blue-50 border-blue-200' :
      'bg-gray-50 border-gray-200'
    }`}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900">{mat.label}</p>
          {mat.partNumber && <p className="text-xs text-gray-500 font-mono mt-0.5">{mat.partNumber}</p>}
          <p className="text-xs text-gray-500 mt-0.5">Menge: {mat.quantity}</p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
          {(['TO_ORDER', 'ORDERED', 'IN_STOCK', 'NOT_NEEDED'] as const).map(s => (
            <button key={s} type="button" onClick={() => onStatus(s)}
              className={`px-2 py-1 text-xs font-medium rounded-md border transition-colors ${
                mat.status === s
                  ? s === 'TO_ORDER' ? 'bg-orange-500 text-white border-orange-500'
                    : s === 'ORDERED'  ? 'bg-blue-500 text-white border-blue-500'
                    : s === 'IN_STOCK' ? 'bg-green-600 text-white border-green-600'
                    : 'bg-gray-500 text-white border-gray-500'
                  : 'bg-white text-gray-500 border-gray-300 hover:border-gray-400'
              }`}>
              {s === 'TO_ORDER' ? 'Bestellen' : s === 'ORDERED' ? 'Bestellt' : s === 'IN_STOCK' ? 'Im Lager' : 'Nicht nötig'}
            </button>
          ))}
          {onDelete && (
            <button type="button" onClick={onDelete}
              className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors ml-1"
              title="Entfernen">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
      {mat.status === 'ORDERED' && (
        <div className="mt-3 flex items-center gap-2">
          <label className="text-xs text-gray-500 flex-shrink-0">Liefertermin:</label>
          <input
            type="date"
            value={mat.deliveryDate ? mat.deliveryDate.slice(0, 10) : ''}
            min="2000-01-01" max="2099-12-31"
            onChange={e => {
              const val = e.target.value
              const year = parseInt(val.split('-')[0] ?? '0', 10)
              if (!val || year <= 9999) onDelivery(val || null)
            }}
            className="px-2 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}
      <input
        type="text"
        value={mat.notes ?? ''}
        onChange={e => onNotes(e.target.value || null)}
        placeholder="Notiz..."
        className="mt-2 w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
      />
    </div>
  )
}

type Step = 'verify' | 'inspection' | 'findings' | 'summary'

const STEPS: { key: Step; label: string; short: string }[] = [
  { key: 'verify',     label: 'Anlagenprüfung',    short: '1' },
  { key: 'inspection', label: 'Inspektionsbericht', short: '2' },
  { key: 'findings',   label: 'Befunde',            short: '3' },
  { key: 'summary',    label: 'Abschluss',           short: '4' },
]

function fmt(date: string) {
  return new Date(date).toLocaleString('de-DE', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function fmtShort(date: string) {
  return new Date(date).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function fmtDate(date: string) {
  return new Date(date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function PartStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'TO_ORDER':
      return <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-orange-100 text-orange-700">Zu bestellen</span>
    case 'ORDERED':
      return <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700">Bestellt</span>
    case 'IN_STOCK':
      return <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700">Im Lager</span>
    case 'NOT_NEEDED':
      return <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-500">Nicht benötigt</span>
    default:
      return <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-500">{status}</span>
  }
}

// ─── Signature Canvas ────────────────────────────────────────────────────────

function SignatureCanvas({ label, value, onChange }: {
  label: string
  value: string
  onChange: (data: string) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const [hasSignature, setHasSignature] = useState(!!value)

  useEffect(() => {
    if (value && canvasRef.current) {
      const img = new Image()
      img.onload = () => {
        const ctx = canvasRef.current?.getContext('2d')
        if (ctx && canvasRef.current) {
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
          ctx.drawImage(img, 0, 0)
        }
      }
      img.src = value
    }
  }, [])

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      }
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    drawing.current = true
    const ctx = canvasRef.current!.getContext('2d')!
    const pos = getPos(e)
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
  }

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    if (!drawing.current) return
    const ctx = canvasRef.current!.getContext('2d')!
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#1e293b'
    const pos = getPos(e)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
  }

  const endDraw = () => {
    if (!drawing.current) return
    drawing.current = false
    const data = canvasRef.current!.toDataURL()
    onChange(data)
    setHasSignature(true)
  }

  const clear = () => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    onChange('')
    setHasSignature(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        {hasSignature && (
          <button type="button" onClick={clear} className="text-xs text-red-500 hover:text-red-700">
            Löschen
          </button>
        )}
      </div>
      <div className="relative border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 touch-none">
        <canvas
          ref={canvasRef}
          width={600}
          height={160}
          className="w-full h-32 cursor-crosshair touch-none rounded-lg"
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
        {!hasSignature && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-sm text-gray-400">Hier unterschreiben</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Checklist Item Row ───────────────────────────────────────────────────────

function InspectionItemRow({ item, onChange, onPhotoUpload, uploading, onDelete }: {
  item: ChecklistItem
  onChange: (update: Partial<ChecklistItem>) => void
  onPhotoUpload: (itemId: string, file: File) => void
  uploading: string | null
  onDelete?: () => void
}) {
  return (
    <div className={`p-4 rounded-lg border transition-colors ${
      item.status === 'io'  ? 'bg-green-50 border-green-200' :
      item.status === 'nio' ? 'bg-red-50 border-red-200' :
      'bg-white border-gray-200'
    }`}>
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-800">{item.label}</p>
        </div>
        <div className="flex gap-2 flex-shrink-0 items-center">
          <button
            type="button"
            onClick={() => onChange({ status: item.status === 'io' ? 'open' : 'io' })}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors ${
              item.status === 'io'
                ? 'bg-green-600 text-white border-green-600'
                : 'bg-white text-gray-500 border-gray-300 hover:border-green-400 hover:text-green-600'
            }`}
          >
            i.O.
          </button>
          <button
            type="button"
            onClick={() => onChange({ status: item.status === 'nio' ? 'open' : 'nio' })}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors ${
              item.status === 'nio'
                ? 'bg-red-600 text-white border-red-600'
                : 'bg-white text-gray-500 border-gray-300 hover:border-red-400 hover:text-red-600'
            }`}
          >
            n.i.O.
          </button>
          {onDelete && (
            <button type="button" onClick={onDelete}
              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Punkt entfernen">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {(item.status === 'nio' || item.comment) && (
        <textarea
          value={item.comment ?? ''}
          onChange={e => onChange({ comment: e.target.value })}
          placeholder="Kommentar / Bemerkung..."
          rows={2}
          className="mt-3 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-white"
        />
      )}
      {item.status === 'io' && !item.comment && (
        <button
          type="button"
          onClick={() => onChange({ comment: '' })}
          className="mt-2 text-xs text-gray-400 hover:text-gray-600"
        >
          + Kommentar hinzufügen
        </button>
      )}

      <div className="mt-3 flex items-center gap-3">
        <label className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border cursor-pointer transition-colors ${
          uploading === item.id ? 'opacity-50' : 'bg-white border-gray-200 hover:bg-gray-50'
        }`}>
          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {uploading === item.id ? 'Lädt...' : 'Foto'}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            disabled={!!uploading}
            onChange={e => {
              const file = e.target.files?.[0]
              if (file) onPhotoUpload(item.id, file)
              e.target.value = ''
            }}
          />
        </label>
        {item.photoUrl && (
          <a href={toFileUrl(item.photoUrl)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
            <img
              src={toFileUrl(item.photoUrl)}
              className="w-8 h-8 object-cover rounded border"
              alt=""
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
            Foto ansehen
          </a>
        )}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function JobInspectionPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const { data: session } = useSession()
  const role = session?.user?.role as string | undefined
  const isExternal = role ? EXTERNAL_ROLES.includes(role) : false

  const [job, setJob] = useState<Job | null>(null)
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState<Step>('verify')
  const [saving, setSaving] = useState(false)
  const [uploadingItem, setUploadingItem] = useState<string | null>(null)

  const [checklist, setChecklist] = useState<ChecklistItem[]>([])
  const [findings, setFindings] = useState('')
  const [recommendations, setRecommendations] = useState('')
  const [techSignature, setTechSignature] = useState('')
  const [customerSignature, setCustomerSignature] = useState('')

  const [activeView, setActiveView] = useState<'wizard' | 'materials'>('wizard')
  const [jobMaterials, setJobMaterials] = useState<JobMaterial[]>([])
  const [savingMaterials, setSavingMaterials] = useState(false)
  const [showAddJobMaterial, setShowAddJobMaterial] = useState(false)
  const [newJobMaterial, setNewJobMaterial] = useState({ label: '', partNumber: '', quantity: 1 })

  type WorkTimeEntry = { date: string; startTime: string; endTime: string }
  const [workTimeEntries, setWorkTimeEntries] = useState<WorkTimeEntry[]>([
    { date: new Date().toISOString().slice(0, 10), startTime: '', endTime: '' },
  ])

  const [conflictError, setConflictError] = useState<string | null>(null)
  const jobUpdatedAt = useRef<string>('')

  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [reloadingChecklist, setReloadingChecklist] = useState(false)
  const [confirmReload, setConfirmReload] = useState(false)
  const [forceReload, setForceReload] = useState(false)

  const [showAddCustomItem, setShowAddCustomItem] = useState(false)
  const [newCustomItemLabel, setNewCustomItemLabel] = useState('')
  const [deletedChecklistItemIds, setDeletedChecklistItemIds] = useState<Set<string>>(new Set())

  const canReloadChecklist =
    ['ADMIN', 'SERVICE_MANAGER'].includes(role ?? '') &&
    ['PLANNED', 'IN_PROGRESS'].includes(job?.status ?? '')

  const handleReloadChecklist = async (force = false) => {
    setReloadingChecklist(true)
    setConfirmReload(false)
    const res = await fetch(`/api/jobs/${id}/reload-checklist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ force }),
    })
    if (res.status === 409) {
      const data = await res.json()
      if (data.requiresForce) {
        setConflictError(data.error)
        setForceReload(true)
        setReloadingChecklist(false)
        return
      }
    }
    if (res.ok) {
      const updated: Job = await res.json()
      setChecklist(updated.checklistItems.map(i => ({ ...i, status: (i.status as 'open' | 'io' | 'nio') || 'open' })))
      setConflictError(null)
      setForceReload(false)
    }
    setReloadingChecklist(false)
  }

  const loadJob = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw API response before typed mapping
    const data: any = await fetch(`/api/jobs/${id}`).then(r => r.json())
    const typedJob: Job = {
      ...data,
      technicians: data.technicians ?? [],
      vehicles: data.vehicles ?? [],
      jobMaterials: data.jobMaterials ?? [],
    }
    setJob(typedJob)
    jobUpdatedAt.current = typedJob.updatedAt
    setJobMaterials(typedJob.jobMaterials)
    setChecklist(typedJob.checklistItems.map(i => ({ ...i, status: (i.status as 'open' | 'io' | 'nio') || (i.checked ? 'io' : 'open') })))
    setFindings(typedJob.findings ?? '')
    setRecommendations(typedJob.recommendations ?? '')
    setTechSignature(typedJob.technicianSignature ?? '')
    setCustomerSignature(typedJob.customerSignature ?? '')
    setLoading(false)
    setConflictError(null)
    if (typedJob.status === 'COMPLETED') setStep('summary')
  }, [id])

  useEffect(() => { loadJob() }, [loadJob])

  const save = async (extra?: Record<string, unknown>) => {
    setSaving(true)
    setConflictError(null)
    const res = await fetch(`/api/jobs/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        findings,
        recommendations,
        checklistItems: checklist.filter(i => !i.id.startsWith('__new__')),
        newChecklistItems: checklist.filter(i => i.id.startsWith('__new__')).map(i => ({ label: i.label, section: i.section, plantId: i.plantId, status: i.status, comment: i.comment })),
        deletedChecklistItemIds: Array.from(deletedChecklistItemIds),
        technicianSignature: techSignature,
        customerSignature,
        clientUpdatedAt: jobUpdatedAt.current,
        ...extra,
      }),
    })
    if (res.status === 409) {
      const data = await res.json()
      setConflictError(data.error)
      setSaving(false)
      return false
    }
    if (res.ok) {
      const updated = await res.json()
      jobUpdatedAt.current = updated.updatedAt
      if (updated.checklistItems) {
        setChecklist(updated.checklistItems.map((i: ChecklistItem) => ({ ...i, status: (i.status as 'open' | 'io' | 'nio') || 'open' })))
        setDeletedChecklistItemIds(new Set())
      }
    }
    setSaving(false)
    return true
  }

  const handlePhotoUpload = async (itemId: string, file: File) => {
    setUploadingItem(itemId)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/upload', { method: 'POST', body: fd })
    if (res.ok) {
      const { url } = await res.json()
      setChecklist(prev => prev.map(i => i.id === itemId ? { ...i, photoUrl: url } : i))
    } else {
      alert('Foto-Upload fehlgeschlagen. Bitte erneut versuchen.')
    }
    setUploadingItem(null)
  }

  const updateItem = (itemId: string, update: Partial<ChecklistItem>) => {
    setChecklist(prev => prev.map(i => i.id === itemId ? { ...i, ...update } : i))
  }

  const handleFinish = async () => {
    setSaving(true)
    const isManagerOrAdmin = ['ADMIN', 'SERVICE_MANAGER'].includes(role ?? '')
    if (!isManagerOrAdmin && job?.status === 'PLANNED') {
      await fetch(`/api/jobs/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'IN_PROGRESS' }),
      })
      setJob(prev => prev ? { ...prev, status: 'IN_PROGRESS' } : prev)
    }
    setSaving(false)
    setStep('inspection')
  }

  const handleComplete = async () => {
    const ok = await save({ complete: true, workTimeEntries: workTimeEntries.filter(e => e.date && e.startTime && e.endTime) })
    if (ok) await loadJob()
  }

  const handleDelete = async () => {
    setDeleting(true)
    const res = await fetch(`/api/jobs/${id}`, { method: 'DELETE' })
    if (res.ok) router.push('/jobs')
    else setDeleting(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400 text-sm">Laden...</div>
      </div>
    )
  }

  if (!job) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Einsatz nicht gefunden.</p>
        <Link href="/jobs" className="text-blue-600 hover:underline mt-2 inline-block">Zurück</Link>
      </div>
    )
  }

  const isCompleted = job.status === 'COMPLETED'
  const stepIdx = STEPS.findIndex(s => s.key === step)

  const plantMap = new Map(job.plants.map(jp => [jp.plant.id, jp.plant.name]))

  const byPlant: { plantId: string | null; plantName: string; sections: Record<string, ChecklistItem[]> }[] = []
  const plantOrder: string[] = []
  const plantSections: Record<string, Record<string, ChecklistItem[]>> = {}

  checklist.filter(item => item.section !== 'Einsatzspezifisch').forEach(item => {
    const pid = item.plantId ?? null
    const key = pid ?? '__none__'
    if (!plantSections[key]) {
      plantSections[key] = {}
      plantOrder.push(key)
    }
    const sec = item.section ?? 'Allgemein'
    if (!plantSections[key][sec]) plantSections[key][sec] = []
    plantSections[key][sec].push(item)
  })

  for (const key of plantOrder) {
    byPlant.push({
      plantId: key === '__none__' ? null : key,
      plantName: key === '__none__' ? '' : (plantMap.get(key) ?? 'Anlage'),
      sections: plantSections[key],
    })
  }

  const sections: Record<string, ChecklistItem[]> = {}
  checklist.forEach(item => {
    const sec = item.section ?? 'Allgemein'
    if (!sections[sec]) sections[sec] = []
    sections[sec].push(item)
  })

  const totalItems = checklist.length
  const doneItems = checklist.filter(i => i.status !== 'open').length
  const nioItems = checklist.filter(i => i.status === 'nio').length

  const technicianNames = job.technicians.map(t => t.userName).join(', ') || '—'
  const vehiclesDisplay = job.vehicles.join(', ') || null

  const technicianReadOnly = role === 'MAINTENANCE_TECHNICIAN'

  // ── External read-only view ────────────────────────────────────────────────
  if (isExternal && (!isCompleted || technicianReadOnly)) {
    return (
      <div className="max-w-2xl mx-auto pb-12">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/jobs" className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-xl font-bold text-gray-900">{job.orderNumber}</h1>
          <StatusBadge status={job.status} />
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
          <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Datum</p>
              <p className="font-medium text-gray-900">{fmt(job.scheduledAt)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Techniker</p>
              <p className="font-medium text-gray-900">{technicianNames}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Kunde</p>
              <p className="font-medium text-gray-900">{job.customer.name}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Anlagen</p>
              {job.plants.length === 0
                ? <p className="font-medium text-gray-900">—</p>
                : job.plants.map(jp => (
                    <p key={jp.plant.id} className="font-medium text-gray-900">{jp.plant.name} <span className="text-xs text-gray-400">({jp.plant.type})</span></p>
                  ))
              }
            </div>
            {job.plants.some(jp => jp.plant.location) && (
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Standorte</p>
                {job.plants.filter(jp => jp.plant.location).map(jp => (
                  <p key={jp.plant.id} className="font-medium text-gray-900">{jp.plant.location}</p>
                ))}
              </div>
            )}
          </div>
          {job.description && (
            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Beschreibung</p>
              <p className="text-sm text-gray-700">{job.description}</p>
            </div>
          )}
        </div>

        {!isCompleted && (
          <p className="mt-6 text-center text-sm text-gray-400">
            Das Protokoll ist nach Abschluss der Inspektion einsehbar.
          </p>
        )}
        {isCompleted && technicianReadOnly && (
          <p className="mt-6 text-center text-sm text-gray-400">
            Der vollständige Inspektionsbericht ist für diese Rolle nicht zugänglich.
          </p>
        )}
      </div>
    )
  }

  // ── Completed summary ──────────────────────────────────────────────────────
  if (isCompleted && step === 'summary') {
    return (
      <div className="max-w-3xl mx-auto pb-12">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/jobs" className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-xl font-bold text-gray-900">{job.orderNumber} — Inspektionsbericht</h1>
          <StatusBadge status={job.status} />
          <a
            href={`/api/jobs/${job.id}/report`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            PDF herunterladen
          </a>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 flex items-center gap-3">
          <svg className="w-6 h-6 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-green-800">Inspektion abgeschlossen</p>
            <p className="text-xs text-green-700">{job.completedAt ? fmtShort(job.completedAt) : '—'} · {technicianNames}</p>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Kunde</p>
            <p className="font-medium">{job.customer.name}</p>
            {job.customer.address && <p className="text-gray-500 text-xs">{job.customer.address}</p>}
          </div>
          {job.plants.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Anlagen</p>
              {job.plants.map(jp => (
                <div key={jp.plant.id} className="mb-0.5">
                  <p className="font-medium">{jp.plant.name}</p>
                  <p className="text-xs text-gray-500">{jp.plant.type}{jp.plant.serialNumber ? ` · SN: ${jp.plant.serialNumber}` : ''}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">
            Inspektionsbericht · {doneItems}/{totalItems} geprüft · {nioItems} n.i.O.
          </h2>
          {Object.entries(sections).map(([sec, items]) => (
            <div key={sec} className="mb-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{sec}</h3>
              <div className="space-y-1">
                {items.map(item => (
                  <div key={item.id} className="flex items-start gap-3 text-sm py-1.5 border-b border-gray-100 last:border-0">
                    <span className={`flex-shrink-0 inline-flex items-center px-2 py-0.5 text-xs font-bold rounded ${
                      item.status === 'io'  ? 'bg-green-100 text-green-700' :
                      item.status === 'nio' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-400'
                    }`}>
                      {item.status === 'io' ? 'i.O.' : item.status === 'nio' ? 'n.i.O.' : '—'}
                    </span>
                    <div className="flex-1">
                      <p className={item.status === 'nio' ? 'text-red-800 font-medium' : 'text-gray-700'}>{item.label}</p>
                      {item.comment && <p className="text-xs text-gray-500 mt-0.5 italic">{item.comment}</p>}
                    </div>
                    {item.photoUrl && (
                      <a href={item.photoUrl} target="_blank" rel="noopener noreferrer">
                        <img src={item.photoUrl} className="w-10 h-10 object-cover rounded border" alt="" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {(findings || recommendations) && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4 grid grid-cols-1 gap-4">
            {findings && (
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Befunde</h3>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{findings}</p>
              </div>
            )}
            {recommendations && (
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Empfehlungen</h3>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{recommendations}</p>
              </div>
            )}
          </div>
        )}

        {job.workTimeEntries && (job.workTimeEntries as { date: string; startTime: string; endTime: string }[]).length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Geleistete Arbeitszeit</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 border-b border-gray-100">
                  <th className="text-left pb-2 font-medium">Datum</th>
                  <th className="text-left pb-2 font-medium">Beginn</th>
                  <th className="text-left pb-2 font-medium">Ende</th>
                </tr>
              </thead>
              <tbody>
                {(job.workTimeEntries as { date: string; startTime: string; endTime: string }[]).map((e, i) => (
                  <tr key={i} className="border-b border-gray-50 last:border-0">
                    <td className="py-1.5 text-gray-800">{new Date(e.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
                    <td className="py-1.5 text-gray-800">{e.startTime}</td>
                    <td className="py-1.5 text-gray-800">{e.endTime}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-xl p-5 grid grid-cols-2 gap-6">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Techniker · {technicianNames}</p>
            {techSignature
              ? <img src={techSignature} className="w-full h-24 object-contain border rounded bg-gray-50" alt="Unterschrift Techniker" />
              : <div className="w-full h-24 border rounded bg-gray-50 flex items-center justify-center text-xs text-gray-400">Keine Unterschrift</div>
            }
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Kunde · {job.customer.name}</p>
            {customerSignature
              ? <img src={customerSignature} className="w-full h-24 object-contain border rounded bg-gray-50" alt="Unterschrift Kunde" />
              : <div className="w-full h-24 border rounded bg-gray-50 flex items-center justify-center text-xs text-gray-400">Keine Unterschrift</div>
            }
          </div>
        </div>

        {!isExternal && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mt-6">
            <InvoicePanel
              customerId={job.customer.id}
              canUpload={role === 'ADMIN' || role === 'SERVICE_MANAGER'}
              preselectedJobId={job.id}
            />
          </div>
        )}
      </div>
    )
  }

  const showMaterialsTab = ['ADMIN', 'SERVICE_MANAGER', 'SERVICE_TECHNICIAN'].includes(role ?? '')
  const toOrderCount = jobMaterials.filter(m => m.status === 'TO_ORDER').length
  const inStockCount = jobMaterials.filter(m => m.status === 'IN_STOCK').length
  const totalMats = jobMaterials.filter(m => m.status !== 'NOT_NEEDED').length
  const allMatsReady = totalMats === 0 || inStockCount === totalMats

  const handleSaveMaterials = async () => {
    setSavingMaterials(true)
    await fetch(`/api/jobs/${id}/materials`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ materials: jobMaterials }),
    })
    setSavingMaterials(false)
  }

  // ── Wizard ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto pb-12">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/jobs" className="text-gray-400 hover:text-gray-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900">{job.orderNumber}</h1>
            <StatusBadge status={job.status} />
          </div>
          <p className="text-sm text-gray-500">{fmt(job.scheduledAt)}</p>
        </div>
        {!isExternal && (!confirmDelete ? (
          <button onClick={() => setConfirmDelete(true)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Löschen?</span>
            <button onClick={handleDelete} disabled={deleting} className="px-2 py-1 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
              {deleting ? '...' : 'Ja'}
            </button>
            <button onClick={() => setConfirmDelete(false)} className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-lg">Nein</button>
          </div>
        ))}
      </div>

      {/* Conflict banner */}
      {conflictError && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-300 rounded-xl flex items-start gap-3">
          <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <div className="flex-1 text-sm text-amber-800">
            <p className="font-medium mb-1">Bearbeitungskonflikt</p>
            <p>{conflictError}</p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => loadJob()}
                className="px-3 py-1.5 bg-amber-600 text-white text-xs font-medium rounded-lg hover:bg-amber-700 transition-colors"
              >
                Neu laden
              </button>
              {forceReload && (
                <button
                  onClick={() => handleReloadChecklist(true)}
                  className="px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 transition-colors"
                >
                  Trotzdem neu laden (Daten verwerfen)
                </button>
              )}
              <button
                onClick={() => { setConflictError(null); setForceReload(false) }}
                className="px-3 py-1.5 bg-white text-amber-700 text-xs font-medium rounded-lg border border-amber-300 hover:bg-amber-50 transition-colors"
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View toggle */}
      {showMaterialsTab && (
        <div className="flex gap-2 mb-6 border-b border-gray-200">
          <button
            onClick={() => setActiveView('wizard')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeView === 'wizard'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Einsatz
          </button>
          <button
            onClick={() => setActiveView('materials')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeView === 'materials'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Materialien
            {jobMaterials.length > 0 && (
              <span className={`inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 text-xs font-bold rounded-full ${
                toOrderCount > 0
                  ? 'bg-orange-100 text-orange-700'
                  : 'bg-green-100 text-green-700'
              }`}>
                {toOrderCount > 0 ? toOrderCount : jobMaterials.length}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Materials panel */}
      {activeView === 'materials' && showMaterialsTab && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-base font-semibold text-gray-900 mb-1">Materialbedarf für diesen Einsatz</h2>
            <p className="text-sm text-gray-500 mb-4">Bitte vor Einsatzbeginn sicherstellen, dass alle Teile verfügbar sind.</p>

            {/* Status summary */}
            {jobMaterials.length > 0 && (
              <div className={`flex items-center gap-3 p-3 rounded-lg mb-4 ${allMatsReady ? 'bg-green-50 border border-green-200' : 'bg-orange-50 border border-orange-200'}`}>
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${allMatsReady ? 'bg-green-500' : 'bg-orange-500'}`} />
                <p className={`text-sm font-medium ${allMatsReady ? 'text-green-800' : 'text-orange-800'}`}>
                  {inStockCount} von {totalMats} Material{totalMats !== 1 ? 'ien' : ''} im Lager
                  {toOrderCount > 0 && ` · ${toOrderCount} noch zu bestellen`}
                </p>
              </div>
            )}

            {/* Plant materials */}
            {jobMaterials.filter(m => m.plantId !== '__job__').length === 0 && jobMaterials.filter(m => m.plantId === '__job__').length === 0 ? (
              <div className="py-6 text-center text-gray-400 text-sm">
                <p>Keine Anlagen-Materialien hinterlegt.</p>
                <p className="text-xs mt-1">Ggf. erst Materialliste in den Anlageninformationen pflegen.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {Array.from(new Map(jobMaterials.filter(m => m.plantId !== '__job__').map(m => [m.plantId, m.plantName]))).map(([plantId, plantName]) => (
                  <div key={plantId}>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full" />
                      {plantName}
                    </h3>
                    <div className="space-y-3">
                      {jobMaterials.filter(m => m.plantId === plantId).map((mat, idx) => {
                        const globalIdx = jobMaterials.indexOf(mat)
                        return <MaterialRow key={mat.id ?? `${plantId}-${idx}`} mat={mat} onStatus={s => setJobMaterials(prev => prev.map((m, i) => i === globalIdx ? { ...m, status: s } : m))} onDelivery={val => setJobMaterials(prev => prev.map((m, i) => i === globalIdx ? { ...m, deliveryDate: val } : m))} onNotes={val => setJobMaterials(prev => prev.map((m, i) => i === globalIdx ? { ...m, notes: val } : m))} />
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Job-specific materials section */}
            <div className="mt-6 border-t border-gray-100 pt-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                  <div className="w-2 h-2 bg-purple-500 rounded-full" />
                  Einsatzspezifisch
                </h3>
                {!showAddJobMaterial && (
                  <button
                    type="button"
                    onClick={() => setShowAddJobMaterial(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Hinzufügen
                  </button>
                )}
              </div>

              {/* Add form */}
              {showAddJobMaterial && (
                <div className="mb-4 p-4 bg-purple-50 border border-purple-200 rounded-xl">
                  <p className="text-xs font-medium text-purple-800 mb-3">Neues einsatzspezifisches Material</p>
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Bezeichnung *"
                      value={newJobMaterial.label}
                      onChange={e => setNewJobMaterial(prev => ({ ...prev, label: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                    />
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Artikelnummer (optional)"
                        value={newJobMaterial.partNumber}
                        onChange={e => setNewJobMaterial(prev => ({ ...prev, partNumber: e.target.value }))}
                        className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white font-mono"
                      />
                      <input
                        type="number"
                        min={1}
                        value={newJobMaterial.quantity}
                        onChange={e => setNewJobMaterial(prev => ({ ...prev, quantity: Math.max(1, parseInt(e.target.value) || 1) }))}
                        className="w-20 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                        title="Menge"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      type="button"
                      onClick={() => {
                        if (!newJobMaterial.label.trim()) return
                        const newMat: JobMaterial = {
                          id: `__new__${Date.now()}`,
                          plantId: '__job__',
                          plantName: 'Einsatzspezifisch',
                          label: newJobMaterial.label.trim(),
                          partNumber: newJobMaterial.partNumber.trim() || null,
                          quantity: newJobMaterial.quantity,
                          status: 'TO_ORDER',
                          deliveryDate: null,
                          notes: null,
                          order: jobMaterials.length,
                        }
                        setJobMaterials(prev => [...prev, newMat])
                        setNewJobMaterial({ label: '', partNumber: '', quantity: 1 })
                        setShowAddJobMaterial(false)
                      }}
                      className="flex-1 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      Hinzufügen
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowAddJobMaterial(false); setNewJobMaterial({ label: '', partNumber: '', quantity: 1 }) }}
                      className="px-4 py-2 bg-white text-gray-600 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                    >
                      Abbrechen
                    </button>
                  </div>
                </div>
              )}

              {/* Job-specific list */}
              {jobMaterials.filter(m => m.plantId === '__job__').length === 0 && !showAddJobMaterial ? (
                <p className="text-xs text-gray-400 py-2">Keine einsatzspezifischen Materialien.</p>
              ) : (
                <div className="space-y-3">
                  {jobMaterials.filter(m => m.plantId === '__job__').map((mat) => {
                    const globalIdx = jobMaterials.indexOf(mat)
                    return (
                      <MaterialRow
                        key={mat.id}
                        mat={mat}
                        onStatus={s => setJobMaterials(prev => prev.map((m, i) => i === globalIdx ? { ...m, status: s } : m))}
                        onDelivery={val => setJobMaterials(prev => prev.map((m, i) => i === globalIdx ? { ...m, deliveryDate: val } : m))}
                        onNotes={val => setJobMaterials(prev => prev.map((m, i) => i === globalIdx ? { ...m, notes: val } : m))}
                        onDelete={() => setJobMaterials(prev => prev.filter((_, i) => i !== globalIdx))}
                      />
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <button
            onClick={handleSaveMaterials}
            disabled={savingMaterials}
            className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {savingMaterials ? 'Speichern...' : 'Materialien speichern'}
          </button>
        </div>
      )}

      {/* Step indicator + wizard steps */}
      {activeView === 'wizard' && <>
      <div className="flex items-center mb-8">
        {STEPS.map((s, i) => (
          <div key={s.key} className="flex items-center flex-1 last:flex-none">
            <button
              onClick={() => i < stepIdx || isCompleted ? setStep(s.key) : undefined}
              className={`flex items-center gap-2 ${i <= stepIdx || isCompleted ? 'cursor-pointer' : 'cursor-default'}`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                i < stepIdx || isCompleted ? 'bg-green-600 text-white' :
                i === stepIdx ? 'bg-blue-600 text-white' :
                'bg-gray-200 text-gray-500'
              }`}>
                {i < stepIdx || isCompleted
                  ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                  : s.short
                }
              </div>
              <span className={`text-xs font-medium hidden sm:block ${i === stepIdx ? 'text-blue-600' : i < stepIdx ? 'text-green-600' : 'text-gray-400'}`}>
                {s.label}
              </span>
            </button>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 ${i < stepIdx ? 'bg-green-600' : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step 1 */}
      {step === 'verify' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <h2 className="text-base font-semibold text-blue-900 mb-1">Schritt 1: Anlagenprüfung</h2>
            <p className="text-sm text-blue-700">Bitte überprüfen Sie, ob Sie sich an der richtigen Anlage befinden.</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Kunde</h3>
            <div className="space-y-1 text-sm">
              <p className="font-semibold text-gray-900 text-base">{job.customer.name}</p>
              {job.customer.contactName && <p className="text-gray-600">Ansprechpartner: {job.customer.contactName}</p>}
              {job.customer.address && <p className="text-gray-600">{job.customer.address}</p>}
            </div>
          </div>

          {job.site && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Standort</h3>
              <div className="space-y-1 text-sm">
                <p className="font-semibold text-gray-900 text-base">{job.site.name}</p>
                {(job.site.address || job.site.zip || job.site.city) && (
                  <p className="text-gray-600">
                    {[job.site.address, [job.site.zip, job.site.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')}
                  </p>
                )}
              </div>
              {job.site.hotels.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Hotel</p>
                  <div className="space-y-2">
                    {job.site.hotels.map(hotel => (
                      <div key={hotel.id} className="text-sm">
                        <span className="font-medium text-gray-900">{hotel.name}</span>
                        {hotel.address && <span className="text-gray-500"> · {hotel.address}</span>}
                        {hotel.phone && <a href={`tel:${hotel.phone}`} className="text-blue-600 hover:underline ml-1">· {hotel.phone}</a>}
                        {hotel.note && <div className="text-xs text-gray-400 italic mt-0.5">{hotel.note}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {job.plants.length === 0 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
              Keine Anlage zugewiesen.
            </div>
          ) : (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Anlagen ({job.plants.length})</h3>
              {job.plants.map(({ plant }) => (
                <div key={plant.id} className="bg-white border border-gray-200 rounded-xl p-5">
                  <p className="font-semibold text-gray-900 text-sm mb-2">{plant.name} <span className="text-xs font-normal text-gray-400">({plant.type})</span></p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {plant.manufacturer && (
                      <div>
                        <p className="text-xs text-gray-500">Hersteller</p>
                        <p className="text-gray-800">{plant.manufacturer}{plant.model ? ` · ${plant.model}` : ''}</p>
                      </div>
                    )}
                    {plant.buildYear && (
                      <div>
                        <p className="text-xs text-gray-500">Baujahr</p>
                        <p className="text-gray-800">{plant.buildYear}</p>
                      </div>
                    )}
                    {plant.serialNumber && (
                      <div>
                        <p className="text-xs text-gray-500">Seriennummer</p>
                        <p className="text-gray-800 font-mono">{plant.serialNumber}</p>
                      </div>
                    )}
                    {plant.location && (
                      <div>
                        <p className="text-xs text-gray-500">Standort</p>
                        <p className="text-gray-800">{plant.location}</p>
                      </div>
                    )}
                  </div>
                  {plant.externalUsers.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-gray-100">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Ansprechpartner</p>
                      <div className="space-y-2">
                        {plant.externalUsers.map(({ user }) => (
                          <div key={user.id} className="flex items-center gap-3 text-sm">
                            <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                              <svg className="w-3.5 h-3.5 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-gray-900">{user.name}</p>
                              <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                                {user.email && (
                                  <a href={`mailto:${user.email}`} className="text-blue-600 hover:underline truncate">{user.email}</a>
                                )}
                                {user.phone && <span>{user.phone}</span>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Einsatzdetails</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {job.technicians.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500">Techniker</p>
                  <p className="font-medium text-gray-800">{technicianNames}</p>
                </div>
              )}
              {vehiclesDisplay && (
                <div>
                  <p className="text-xs text-gray-500">Fahrzeug</p>
                  <p className="font-medium text-gray-800">{vehiclesDisplay}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-gray-500">Datum</p>
                <p className="font-medium text-gray-800">{fmtShort(job.scheduledAt)}</p>
              </div>
              {job.description && (
                <div className="col-span-2">
                  <p className="text-xs text-gray-500">Beschreibung</p>
                  <p className="text-gray-800">{job.description}</p>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={handleFinish}
            disabled={saving}
            className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            ✓ Anlage bestätigt — Inspektion starten
          </button>
        </div>
      )}

      {/* Step 2 */}
      {step === 'inspection' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-blue-900">Schritt 2: Inspektionsbericht</h2>
              <p className="text-sm text-blue-700">{doneItems}/{totalItems} geprüft · {nioItems > 0 ? `${nioItems} n.i.O.` : 'alle i.O.'}</p>
            </div>
            <div className="flex items-center gap-3">
              {canReloadChecklist && (
                confirmReload ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-amber-700">Checkliste ersetzen?</span>
                    <button
                      onClick={() => handleReloadChecklist()}
                      disabled={reloadingChecklist}
                      className="px-2 py-1 text-xs bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
                    >
                      {reloadingChecklist ? '...' : 'Ja'}
                    </button>
                    <button onClick={() => setConfirmReload(false)} className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-lg">Nein</button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmReload(true)}
                    title="Checkliste auf aktuellen Standard aktualisieren"
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Aktualisieren
                  </button>
                )
              )}
              <div className="text-right">
                <div className="text-2xl font-bold text-blue-700">{totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0}%</div>
              </div>
            </div>
          </div>

          <div className="w-full bg-gray-100 rounded-full h-2">
            <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${totalItems > 0 ? (doneItems / totalItems) * 100 : 0}%` }} />
          </div>

          {byPlant.map(group => (
            <div key={group.plantId ?? '__none__'}>
              {group.plantName && (
                <div className="flex items-center gap-2 mb-2 mt-4 first:mt-0">
                  <div className="w-2 h-2 bg-blue-500 rounded-full" />
                  <h3 className="text-sm font-bold text-blue-900">{group.plantName}</h3>
                </div>
              )}
              {Object.entries(group.sections).map(([sec, items]) => {
                const secDone = items.filter(i => i.status !== 'open').length
                const secNio = items.filter(i => i.status === 'nio').length
                return (
                  <div key={sec} className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-3">
                    <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-gray-800">{sec}</h4>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        secNio > 0 ? 'bg-red-100 text-red-700' :
                        secDone === items.length ? 'bg-green-100 text-green-700' :
                        'bg-gray-100 text-gray-500'
                      }`}>
                        {secDone}/{items.length}
                      </span>
                    </div>
                    <div className="p-3 space-y-2">
                      {items.map(item => (
                        <InspectionItemRow
                          key={item.id}
                          item={item}
                          onChange={update => updateItem(item.id, update)}
                          onPhotoUpload={handlePhotoUpload}
                          uploading={uploadingItem}
                        />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}

          {/* Job-specific checklist items */}
          <div className="bg-white border border-purple-200 rounded-xl overflow-hidden mb-3">
            <div className="px-4 py-3 bg-purple-50 border-b border-purple-200 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-purple-800 flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full" />
                Einsatzspezifisch
              </h4>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-700`}>
                  {checklist.filter(i => i.section === 'Einsatzspezifisch' && !i.id.startsWith('__deleted__')).length}
                </span>
                {!showAddCustomItem && (
                  <button
                    type="button"
                    onClick={() => setShowAddCustomItem(true)}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-purple-700 bg-white border border-purple-200 rounded-lg hover:bg-purple-50 transition-colors"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Hinzufügen
                  </button>
                )}
              </div>
            </div>
            <div className="p-3 space-y-2">
              {checklist.filter(i => i.section === 'Einsatzspezifisch').map(item => (
                <InspectionItemRow
                  key={item.id}
                  item={item}
                  onChange={update => updateItem(item.id, update)}
                  onPhotoUpload={handlePhotoUpload}
                  uploading={uploadingItem}
                  onDelete={() => {
                    if (!item.id.startsWith('__new__')) {
                      setDeletedChecklistItemIds(prev => new Set(Array.from(prev).concat(item.id)))
                    }
                    setChecklist(prev => prev.filter(i => i.id !== item.id))
                  }}
                />
              ))}
              {checklist.filter(i => i.section === 'Einsatzspezifisch').length === 0 && !showAddCustomItem && (
                <p className="text-xs text-gray-400 py-2 text-center">Keine einsatzspezifischen Punkte.</p>
              )}
              {showAddCustomItem && (
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl">
                  <input
                    type="text"
                    placeholder="Bezeichnung des Prüfpunkts *"
                    value={newCustomItemLabel}
                    onChange={e => setNewCustomItemLabel(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && newCustomItemLabel.trim()) {
                        setChecklist(prev => [...prev, {
                          id: `__new__${Date.now()}`,
                          label: newCustomItemLabel.trim(),
                          section: 'Einsatzspezifisch',
                          plantId: null,
                          status: 'open',
                          checked: false,
                          comment: null,
                          photoUrl: null,
                        }])
                        setNewCustomItemLabel('')
                        setShowAddCustomItem(false)
                      }
                    }}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white mb-2"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (!newCustomItemLabel.trim()) return
                        setChecklist(prev => [...prev, {
                          id: `__new__${Date.now()}`,
                          label: newCustomItemLabel.trim(),
                          section: 'Einsatzspezifisch',
                          plantId: null,
                          status: 'open',
                          checked: false,
                          comment: null,
                          photoUrl: null,
                        }])
                        setNewCustomItemLabel('')
                        setShowAddCustomItem(false)
                      }}
                      className="flex-1 py-1.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      Hinzufügen
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowAddCustomItem(false); setNewCustomItemLabel('') }}
                      className="px-4 py-1.5 bg-white text-gray-600 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                    >
                      Abbrechen
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep('verify')} className="flex-1 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200">
              ← Zurück
            </button>
            <button
              onClick={async () => { await save(); setStep('findings') }}
              disabled={saving}
              className="flex-2 px-8 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Speichern...' : 'Weiter →'}
            </button>
          </div>
        </div>
      )}

      {/* Step 3 */}
      {step === 'findings' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <h2 className="text-base font-semibold text-blue-900">Schritt 3: Befunde & Empfehlungen</h2>
            <p className="text-sm text-blue-700">Zusammenfassung der Feststellungen und Handlungsempfehlungen.</p>
          </div>

          {nioItems > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
              <p className="font-semibold mb-1">{nioItems} n.i.O. Punkt{nioItems > 1 ? 'e' : ''} festgestellt</p>
              {checklist.filter(i => i.status === 'nio').map(i => (
                <div key={i.id} className="text-xs mt-1">• {i.label}{i.comment ? `: ${i.comment}` : ''}</div>
              ))}
            </div>
          )}

          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Befunde</label>
              <textarea
                value={findings}
                onChange={e => setFindings(e.target.value)}
                rows={5}
                placeholder="Festgestellte Mängel, Auffälligkeiten, Messungen..."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Empfehlungen</label>
              <textarea
                value={recommendations}
                onChange={e => setRecommendations(e.target.value)}
                rows={4}
                placeholder="Empfohlene Maßnahmen, Wartungsintervalle, Ersatzteile..."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep('inspection')} className="flex-1 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200">
              ← Zurück
            </button>
            <button
              onClick={async () => { await save(); setStep('summary') }}
              disabled={saving}
              className="flex-2 px-8 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Speichern...' : 'Weiter →'}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Abschluss */}
      {step === 'summary' && !isCompleted && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <h2 className="text-base font-semibold text-blue-900">Schritt 4: Zusammenfassung & Abschluss</h2>
            <p className="text-sm text-blue-700">Bitte überprüfen Sie die Angaben und unterschreiben Sie.</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5 text-sm">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Übersicht</h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-2xl font-bold text-gray-800">{totalItems}</p>
                <p className="text-xs text-gray-500">Geprüft</p>
              </div>
              <div className="bg-green-50 rounded-lg p-3">
                <p className="text-2xl font-bold text-green-700">{checklist.filter(i => i.status === 'io').length}</p>
                <p className="text-xs text-green-600">i.O.</p>
              </div>
              <div className={`rounded-lg p-3 ${nioItems > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                <p className={`text-2xl font-bold ${nioItems > 0 ? 'text-red-700' : 'text-gray-400'}`}>{nioItems}</p>
                <p className={`text-xs ${nioItems > 0 ? 'text-red-600' : 'text-gray-400'}`}>n.i.O.</p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Geleistete Arbeitszeit</h3>
            {workTimeEntries.map((entry, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <div className="flex-1 grid grid-cols-3 gap-2">
                  <div>
                    {idx === 0 && <p className="text-xs text-gray-400 mb-1">Datum</p>}
                    <input
                      type="date"
                      value={entry.date}
                      min="2000-01-01"
                      max="2099-12-31"
                      onChange={e => {
                        const val = e.target.value
                        const year = parseInt(val.split('-')[0] ?? '0', 10)
                        if (!val || year <= 9999) setWorkTimeEntries(prev => prev.map((r, i) => i === idx ? { ...r, date: val } : r))
                      }}
                      className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    {idx === 0 && <p className="text-xs text-gray-400 mb-1">Beginn</p>}
                    <input
                      type="time"
                      value={entry.startTime}
                      onChange={e => setWorkTimeEntries(prev => prev.map((r, i) => i === idx ? { ...r, startTime: e.target.value } : r))}
                      className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    {idx === 0 && <p className="text-xs text-gray-400 mb-1">Ende</p>}
                    <input
                      type="time"
                      value={entry.endTime}
                      onChange={e => setWorkTimeEntries(prev => prev.map((r, i) => i === idx ? { ...r, endTime: e.target.value } : r))}
                      className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                {workTimeEntries.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setWorkTimeEntries(prev => prev.filter((_, i) => i !== idx))}
                    className="mt-4 p-1.5 text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"
                    title="Eintrag entfernen"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => setWorkTimeEntries(prev => [
                ...prev,
                { date: new Date().toISOString().slice(0, 10), startTime: '', endTime: '' },
              ])}
              className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Weiteren Tag hinzufügen
            </button>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-5">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Unterschriften</h3>
            <SignatureCanvas
              label={`Techniker: ${technicianNames}`}
              value={techSignature}
              onChange={setTechSignature}
            />
            <SignatureCanvas
              label={`Kunde: ${job.customer.name}`}
              value={customerSignature}
              onChange={setCustomerSignature}
            />
          </div>

          {(!techSignature || !customerSignature) && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700 flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <span>
                {!techSignature && !customerSignature
                  ? 'Beide Unterschriften (Techniker und Kunde) sind erforderlich.'
                  : !techSignature
                  ? 'Unterschrift des Technikers fehlt.'
                  : 'Unterschrift des Kunden fehlt.'}
              </span>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => setStep('findings')} className="flex-1 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200">
              ← Zurück
            </button>
            <button
              onClick={handleComplete}
              disabled={saving || !techSignature || !customerSignature}
              className="flex-2 px-8 py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Wird abgeschlossen...' : '✓ Abschließen & Speichern'}
            </button>
          </div>
        </div>
      )}
      </>}
    </div>
  )
}
