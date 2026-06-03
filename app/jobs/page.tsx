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
  technicianName: string | null
  customer: { name: string }
  plant: { name: string } | null
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

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/jobs/${id}`, { method: 'DELETE' })
    if (res.ok) { setConfirmDelete(null); fetchJobs() }
  }

  const switchView = (v: 'list' | 'calendar') => {
    setView(v)
    router.replace(`/jobs?view=${v}`, { scroll: false })
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Serviceeinsätze</h1>
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
          <div className="flex gap-4 mb-6">
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
            <form onSubmit={handleSearch} className="flex gap-2 ml-auto">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Kunde oder Auftragsnummer suchen..."
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
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
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Auftragsnummer</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Datum</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Kunde</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Anlage</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Techniker</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  {!isExternal && <th className="px-6 py-3"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={isExternal ? 6 : 7} className="px-6 py-12 text-center text-sm text-gray-400">Laden...</td></tr>
                ) : jobs.length === 0 ? (
                  <tr><td colSpan={isExternal ? 6 : 7} className="px-6 py-12 text-center text-sm text-gray-400">Keine Einsätze gefunden</td></tr>
                ) : (
                  jobs.map((job) => (
                    <tr key={job.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <Link href={`/jobs/${job.id}`} className="text-sm font-medium text-blue-600 hover:text-blue-700">
                          {job.orderNumber}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">{formatDate(job.scheduledAt)}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{job.customer.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{job.plant?.name ?? '—'}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{job.technicianName ?? '—'}</td>
                      <td className="px-6 py-4"><StatusBadge status={job.status} /></td>
                      {!isExternal && (
                        <td className="px-6 py-4 text-right">
                          {confirmDelete === job.id ? (
                            <div className="flex items-center justify-end gap-2">
                              <span className="text-xs text-gray-500">Löschen?</span>
                              <button onClick={() => handleDelete(job.id)}
                                className="px-2 py-1 text-xs text-white bg-red-600 rounded hover:bg-red-700">Ja</button>
                              <button onClick={() => setConfirmDelete(null)}
                                className="px-2 py-1 text-xs text-gray-600 bg-gray-100 rounded hover:bg-gray-200">Nein</button>
                            </div>
                          ) : (
                            <button onClick={() => setConfirmDelete(job.id)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                              </svg>
                            </button>
                          )}
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
