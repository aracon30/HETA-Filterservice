'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import StatusBadge from '@/components/StatusBadge'
import { JOB_STATUS_LABELS } from '@/lib/constants'
import dynamic from 'next/dynamic'

const EXTERNAL_ROLES = ['MAINTENANCE_MANAGER', 'MAINTENANCE_TECHNICIAN', 'BUYER']

const JobCalendar = dynamic(() => import('@/components/JobCalendar'), { ssr: false, loading: () => (
  <div className="flex items-center justify-center h-96 text-gray-400">Kalender wird geladen...</div>
)})

interface Job {
  id: string
  orderNumber: string
  status: string
  scheduledAt: string
  technicians: { userId: string; userName: string }[]
  customer: { name: string }
  plants: { plant: { id: string; name: string } }[]
  jobMaterials: { status: string }[]
}

function MaterialBadge({ materials }: { materials: { status: string }[] }) {
  if (!materials.length) return null
  const toOrder = materials.filter(m => m.status === 'TO_ORDER').length
  const ordered = materials.filter(m => m.status === 'ORDERED').length
  const inStock = materials.filter(m => m.status === 'IN_STOCK').length
  const total = materials.length

  if (toOrder > 0)
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700 border border-orange-200">
        <span className="w-1.5 h-1.5 rounded-full bg-orange-500 flex-shrink-0" />
        {toOrder}/{total} fehlt
      </span>
    )
  if (ordered > 0)
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
        {ordered}/{total} bestellt
      </span>
    )
  if (inStock === total)
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
        Lager ✓
      </span>
    )
  return null
}

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'Alle Status' },
  { value: 'PLANNED', label: JOB_STATUS_LABELS.PLANNED },
  { value: 'IN_PROGRESS', label: JOB_STATUS_LABELS.IN_PROGRESS },
  { value: 'COMPLETED', label: JOB_STATUS_LABELS.COMPLETED },
  { value: 'CANCELLED', label: JOB_STATUS_LABELS.CANCELLED },
]

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function JobsPageInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { data: session } = useSession()
  const role = session?.user?.role as string | undefined
  const isExternal = role ? EXTERNAL_ROLES.includes(role) : false
  const [view, setView] = useState<'list' | 'calendar'>(
    (searchParams.get('view') as 'list' | 'calendar') ?? 'list'
  )
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('ALL')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const fetchJobs = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (status !== 'ALL') params.set('status', status)
    if (search) params.set('search', search)
    const res = await fetch(`/api/jobs?${params}`)
    const data = await res.json()
    setJobs(data)
    setLoading(false)
  }, [status, search])

  useEffect(() => { fetchJobs() }, [fetchJobs])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearch(searchInput)
  }

  const handleDelete = async () => {
    if (!confirmDelete) return
    setDeleting(true)
    setDeleteError(null)
    const res = await fetch(`/api/jobs/${confirmDelete}`, { method: 'DELETE' })
    if (res.ok) {
      setConfirmDelete(null)
      fetchJobs()
    } else {
      const data = await res.json()
      setDeleteError(data.error ?? 'Fehler beim Löschen')
    }
    setDeleting(false)
  }

  const switchView = (v: 'list' | 'calendar') => {
    setView(v)
    router.replace(`/jobs?view=${v}`, { scroll: false })
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Serviceeinsätze</h1>
          <p className="text-sm text-gray-500 mt-1">{jobs.length} Einsätze</p>
        </div>
        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button
              onClick={() => switchView('list')}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${view === 'list' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16"/>
              </svg>
              Liste
            </button>
            <button
              onClick={() => switchView('calendar')}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-l border-gray-200 transition-colors ${view === 'calendar' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
              </svg>
              Kalender
            </button>
          </div>
          {!isExternal && (
            <Link
              href="/jobs/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
              </svg>
              Neuer Einsatz
            </Link>
          )}
        </div>
      </div>

      {view === 'calendar' ? (
        <JobCalendar />
      ) : (
        <>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="flex gap-2 flex-wrap">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setStatus(opt.value)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
                    status === opt.value
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <form onSubmit={handleSearch} className="flex gap-2 sm:ml-auto">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Kunde oder Auftragsnummer suchen..."
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-64"
              />
              <button type="submit" className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
                Suchen
              </button>
              {search && (
                <button type="button" onClick={() => { setSearch(''); setSearchInput('') }}
                  className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700">✕</button>
              )}
            </form>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Auftragsnummer</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Datum</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Kunde</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">Anlage</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Techniker</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  {!isExternal && <th className="px-4 py-3 w-12"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={isExternal ? 6 : 7} className="px-4 py-12 text-center text-sm text-gray-400">Laden...</td></tr>
                ) : jobs.length === 0 ? (
                  <tr><td colSpan={isExternal ? 6 : 7} className="px-4 py-12 text-center text-sm text-gray-400">Keine Einsätze gefunden</td></tr>
                ) : (
                  jobs.map((job) => (
                    <tr key={job.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-4">
                        <Link href={`/jobs/${job.id}`} className="text-sm font-medium text-blue-600 hover:text-blue-700">
                          {job.orderNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-900 whitespace-nowrap">{formatDate(job.scheduledAt)}</td>
                      <td className="px-4 py-4 text-sm text-gray-900">{job.customer.name}</td>
                      <td className="px-4 py-4 text-sm text-gray-500 hidden lg:table-cell">{job.plants.length === 0 ? '—' : job.plants.map(jp => jp.plant.name).join(', ')}</td>
                      <td className="px-4 py-4 text-sm text-gray-900 hidden md:table-cell">{job.technicians.length === 0 ? '—' : job.technicians.map(t => t.userName).join(', ')}</td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <StatusBadge status={job.status} />
                          {job.status === 'PLANNED' && !isExternal && <MaterialBadge materials={job.jobMaterials} />}
                        </div>
                      </td>
                      {!isExternal && (
                        <td className="px-4 py-4 text-right">
                          <button onClick={() => { setConfirmDelete(job.id); setDeleteError(null) }}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                            </svg>
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Delete job modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmDelete(null)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Einsatz löschen</h2>
            <p className="text-sm text-gray-600 mb-4">
              Möchten Sie diesen Serviceeinsatz wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
            </p>
            {deleteError && (
              <div className="mb-4 px-3 py-2 bg-red-50 text-red-700 text-sm rounded-lg">{deleteError}</div>
            )}
            <div className="flex gap-3">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleting ? 'Löschen...' : 'Löschen'}
              </button>
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function JobsPage() {
  return (
    <Suspense>
      <JobsPageInner />
    </Suspense>
  )
}
