'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import StatusBadge from '@/components/StatusBadge'
import { JOB_STATUS_LABELS } from '@/lib/constants'

interface ChecklistItem {
  id: string
  label: string
  section: string | null
  checked: boolean
}

interface Job {
  id: string
  jobNumber: string
  status: string
  scheduledAt: string
  completedAt: string | null
  technicianName: string | null
  duration: number
  vehicle: string | null
  description: string | null
  findings: string | null
  recommendations: string | null
  customer: { id: string; name: string }
  plant: { id: string; name: string; type: string } | null
  checklistItems: ChecklistItem[]
}

const STATUS_OPTIONS = [
  { value: 'PLANNED', label: JOB_STATUS_LABELS.PLANNED },
  { value: 'IN_PROGRESS', label: JOB_STATUS_LABELS.IN_PROGRESS },
  { value: 'COMPLETED', label: JOB_STATUS_LABELS.COMPLETED },
  { value: 'CANCELLED', label: JOB_STATUS_LABELS.CANCELLED },
]

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('de-DE', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  })
}

export default function JobDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [job, setJob] = useState<Job | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [findings, setFindings] = useState('')
  const [recommendations, setRecommendations] = useState('')
  const [status, setStatus] = useState('')
  const [checklist, setChecklist] = useState<ChecklistItem[]>([])

  useEffect(() => {
    fetch(`/api/jobs/${id}`)
      .then((r) => r.json())
      .then((data: Job) => {
        setJob(data)
        setFindings(data.findings ?? '')
        setRecommendations(data.recommendations ?? '')
        setStatus(data.status)
        setChecklist(data.checklistItems)
        setLoading(false)
      })
  }, [id])

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    await fetch(`/api/jobs/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status,
        findings,
        recommendations,
        checklistItems: checklist,
      }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)

    // Refresh job data
    const updated = await fetch(`/api/jobs/${id}`).then((r) => r.json())
    setJob(updated)
  }

  const handleDelete = async () => {
    setDeleting(true)
    const res = await fetch(`/api/jobs/${id}`, { method: 'DELETE' })
    if (res.ok) router.push('/jobs')
    else setDeleting(false)
  }

  const toggleCheckItem = (itemId: string) => {
    setChecklist((prev) =>
      prev.map((item) => item.id === itemId ? { ...item, checked: !item.checked } : item)
    )
  }

  const checkedCount = checklist.filter((i) => i.checked).length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Laden...</div>
      </div>
    )
  }

  if (!job) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Einsatz nicht gefunden.</p>
        <Link href="/jobs" className="text-blue-600 hover:underline mt-2 inline-block">Zurück zur Liste</Link>
      </div>
    )
  }

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-start gap-4 mb-8">
        <Link href="/jobs" className="mt-1 text-gray-400 hover:text-gray-600 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-gray-900">{job.jobNumber}</h1>
            <StatusBadge status={job.status} />
            <div className="ml-auto flex gap-2">
              {!confirmDelete ? (
                <button onClick={() => setConfirmDelete(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                  </svg>
                  Löschen
                </button>
              ) : (
                <>
                  <span className="text-sm text-gray-500 self-center">Wirklich löschen?</span>
                  <button onClick={handleDelete} disabled={deleting}
                    className="px-3 py-1.5 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50">
                    {deleting ? '...' : 'Ja, löschen'}
                  </button>
                  <button onClick={() => setConfirmDelete(false)}
                    className="px-3 py-1.5 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">
                    Abbrechen
                  </button>
                </>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-6 text-sm text-gray-500">
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {formatDate(job.scheduledAt)}
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              {job.customer.name}
            </span>
            {job.plant && (
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {job.plant.name} ({job.plant.type})
              </span>
            )}
            {job.technicianName && (
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                {job.technicianName}
              </span>
            )}
          </div>
          {job.description && (
            <p className="mt-3 text-sm text-gray-600 bg-gray-50 rounded-lg px-4 py-3">{job.description}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main content */}
        <div className="col-span-2 space-y-6">
          {/* Findings */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Befunde</h2>
            <textarea
              value={findings}
              onChange={(e) => setFindings(e.target.value)}
              rows={5}
              placeholder="Befunde des Einsatzes eintragen..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Recommendations */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Empfehlungen</h2>
            <textarea
              value={recommendations}
              onChange={(e) => setRecommendations(e.target.value)}
              rows={5}
              placeholder="Empfehlungen für den Kunden..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Checklist */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900">Checkliste</h2>
              <span className="text-sm text-gray-500">
                {checkedCount}/{checklist.length} abgehakt
              </span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1.5 mb-5">
              <div
                className="bg-blue-600 h-1.5 rounded-full transition-all"
                style={{ width: checklist.length > 0 ? `${(checkedCount / checklist.length) * 100}%` : '0%' }}
              />
            </div>
            {(() => {
              // Group by section
              const hasSections = checklist.some(i => i.section)
              if (!hasSections) {
                return (
                  <div className="space-y-3">
                    {checklist.map((item) => (
                      <ChecklistRow key={item.id} item={item} onToggle={toggleCheckItem} />
                    ))}
                  </div>
                )
              }
              const sections: Record<string, typeof checklist> = {}
              checklist.forEach(item => {
                const sec = item.section ?? 'Allgemein'
                if (!sections[sec]) sections[sec] = []
                sections[sec].push(item)
              })
              return (
                <div className="space-y-5">
                  {Object.entries(sections).map(([sec, items]) => {
                    const secChecked = items.filter(i => i.checked).length
                    return (
                      <div key={sec}>
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{sec}</h3>
                          <span className="text-xs text-gray-400">{secChecked}/{items.length}</span>
                        </div>
                        <div className="space-y-2 pl-1 border-l-2 border-gray-100">
                          {items.map(item => (
                            <ChecklistRow key={item.id} item={item} onToggle={toggleCheckItem} />
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Status ändern</h3>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {saving ? 'Speichern...' : saved ? '✓ Gespeichert' : 'Speichern'}
            </button>
          </div>

          {/* Info */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Informationen</h3>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-gray-500">Kunde</dt>
                <dd className="text-gray-900 font-medium mt-0.5">{job.customer.name}</dd>
              </div>
              {job.plant && (
                <div>
                  <dt className="text-gray-500">Anlage</dt>
                  <dd className="text-gray-900 font-medium mt-0.5">{job.plant.name}</dd>
                </div>
              )}
              {job.technicianName && (
                <div>
                  <dt className="text-gray-500">Techniker</dt>
                  <dd className="text-gray-900 font-medium mt-0.5">{job.technicianName}</dd>
                </div>
              )}
              {job.vehicle && (
                <div>
                  <dt className="text-gray-500">Fahrzeug</dt>
                  <dd className="text-gray-900 font-medium mt-0.5">{job.vehicle}</dd>
                </div>
              )}
              <div>
                <dt className="text-gray-500">Dauer</dt>
                <dd className="text-gray-900 font-medium mt-0.5">
                  {job.duration >= 60
                    ? `${Math.floor(job.duration / 60)} Std.${job.duration % 60 > 0 ? ` ${job.duration % 60} Min.` : ''}`
                    : `${job.duration} Min.`}
                </dd>
              </div>
              {job.completedAt && (
                <div>
                  <dt className="text-gray-500">Abgeschlossen</dt>
                  <dd className="text-gray-900 font-medium mt-0.5">
                    {new Date(job.completedAt).toLocaleDateString('de-DE')}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </div>
    </div>
  )
}

function ChecklistRow({ item, onToggle }: { item: { id: string; label: string; checked: boolean }; onToggle: (id: string) => void }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <input
        type="checkbox"
        checked={item.checked}
        onChange={() => onToggle(item.id)}
        className="mt-0.5 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
      />
      <span className={`text-sm ${item.checked ? 'line-through text-gray-400' : 'text-gray-700'}`}>
        {item.label}
      </span>
    </label>
  )
}
