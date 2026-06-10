import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import PlantDocuments from '@/components/PlantDocuments'

export const dynamic = 'force-dynamic'

const EXTERNAL_ROLES = ['MAINTENANCE_MANAGER', 'MAINTENANCE_TECHNICIAN', 'BUYER']

const ROLE_LABELS: Record<string, string> = {
  MAINTENANCE_MANAGER: 'Instandhaltungsleiter',
  MAINTENANCE_TECHNICIAN: 'Instandhaltungstechniker',
  BUYER: 'Einkäufer',
}

function fmtDate(date: Date | string | null) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtDateTime(date: Date | string | null) {
  if (!date) return '—'
  return new Date(date).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ─── Status badge ──────────────────────────────────────────────────────────────
function StatusChip({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    PLANNED:     { label: 'Geplant',        cls: 'bg-blue-100 text-blue-700' },
    IN_PROGRESS: { label: 'In Bearbeitung', cls: 'bg-yellow-100 text-yellow-700' },
    COMPLETED:   { label: 'Abgeschlossen',  cls: 'bg-green-100 text-green-700' },
    CANCELLED:   { label: 'Abgebrochen',    cls: 'bg-red-100 text-red-700' },
  }
  const s = map[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600' }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>
      {s.label}
    </span>
  )
}

// ─── Data field ────────────────────────────────────────────────────────────────
function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (!value) return null
  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-sm text-gray-800">{value}</p>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export default async function PortalPlantPage({
  params,
}: {
  params: { id: string }
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const role = session.user.role as string
  const customerId = session.user.customerId as string | undefined

  if (!EXTERNAL_ROLES.includes(role) || !customerId) redirect('/')

  // Load plant — must belong to this user's customer
  const plant = await prisma.plant.findUnique({
    where: { id: params.id },
    include: {
      customer: { select: { id: true, name: true } },
      _count: { select: { jobPlants: true } },
    },
  })

  if (!plant || plant.customerId !== customerId) notFound()

  // Archived requests for this plant
  const archivedRequests = await prisma.plantRequest.findMany({
    where: {
      customerId,
      status: 'ARCHIVED',
      plants: { some: { plantId: plant.id } },
    },
    include: {
      plants: { select: { plantName: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })

  // Completed service jobs that involved this plant
  const jobs = await prisma.serviceJob.findMany({
    where: {
      customerId,
      plants: { some: { plantId: plant.id } },
    },
    include: {
      technicians: { orderBy: { order: 'asc' } },
      plants: { include: { plant: { select: { name: true } } }, orderBy: { order: 'asc' } },
    },
    orderBy: { scheduledAt: 'desc' },
    take: 50,
  })

  const completedJobs = jobs.filter(j => j.status === 'COMPLETED')
  const plannedJobs   = jobs.filter(j => j.status === 'PLANNED' || j.status === 'IN_PROGRESS')

  const showReportLink = role === 'MAINTENANCE_MANAGER' || role === 'BUYER'

  return (
    <div className="max-w-4xl mx-auto pb-12">

      {/* ── Breadcrumb ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-6 text-sm text-gray-500">
        <Link href="/portal" className="flex items-center gap-1 hover:text-gray-700 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {plant.customer.name}
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-gray-700 font-medium truncate">{plant.name}</span>
      </div>

      {/* ── Plant header ──────────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mb-5">
        <div className="px-6 py-5 flex items-start gap-4">
          <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-gray-900 leading-tight">{plant.name}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-full font-medium">
                {plant.type}
              </span>
              {plant.location && (
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {plant.location}
                </span>
              )}
            </div>
          </div>
          <div className="text-center flex-shrink-0">
            <p className="text-2xl font-bold text-gray-900">{plant._count.jobPlants}</p>
            <p className="text-xs text-gray-500">Einsätze</p>
          </div>
        </div>

        {/* Technical data grid */}
        <div className="border-t border-gray-100 px-6 py-5 grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-4">
          <Field label="Anlagentyp"      value={plant.type} />
          <Field label="Hersteller"      value={plant.manufacturer} />
          <Field label="Modell"          value={plant.model} />
          <Field label="Seriennummer"    value={plant.serialNumber} />
          <Field label="Baujahr"         value={plant.buildYear} />
          <Field label="In Betrieb seit" value={plant.installedAt ? fmtDate(plant.installedAt) : null} />
          <Field label="Standort"        value={plant.location} />
          <Field label="Ansprechperson"  value={plant.contactPerson} />
          {plant.description && (
            <div className="col-span-2 sm:col-span-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Beschreibung</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{plant.description}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Documents ─────────────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 mb-5">
        <div className="flex items-center gap-2 mb-1">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h2 className="text-sm font-bold text-gray-900">Dokumente & Medien</h2>
        </div>
        <PlantDocuments plantId={plant.id} customerId={customerId} role={role} />
      </div>

      {/* ── Planned / active jobs ──────────────────────────────────────────── */}
      {plannedJobs.length > 0 && role !== 'BUYER' && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mb-5">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <h2 className="text-sm font-bold text-gray-900">Geplante Einsätze</h2>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{plannedJobs.length}</span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Datum</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Auftrag</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Techniker</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {plannedJobs.map(job => (
                <tr key={job.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-700">{fmtDateTime(job.scheduledAt)}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">{job.orderNumber}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {job.technicians.length === 0 ? '—' : job.technicians.map(t => t.userName).join(', ')}
                  </td>
                  <td className="px-4 py-3"><StatusChip status={job.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Service history ────────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <h2 className="text-sm font-bold text-gray-900">Servicehistorie</h2>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{completedJobs.length}</span>
        </div>

        {completedJobs.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-gray-400">
            Noch keine abgeschlossenen Einsätze für diese Anlage.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Abgeschlossen</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Auftrag</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Techniker</th>
                {showReportLink && (
                  <th className="px-4 py-2.5" />
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {completedJobs.map(job => (
                <tr key={job.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-700">
                    {fmtDate(job.completedAt ?? job.scheduledAt)}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-800">{job.orderNumber}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs hidden sm:table-cell">
                    {job.technicians.length === 0 ? '—' : job.technicians.map(t => t.userName).join(', ')}
                  </td>
                  {showReportLink && (
                    <td className="px-4 py-3 text-right">
                      <a
                        href={`/api/jobs/${job.id}/report`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        PDF
                      </a>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Archived requests ─────────────────────────────────────────────── */}
      {archivedRequests.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mb-5">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8l1 12a2 2 0 002 2h8a2 2 0 002-2l1-12M10 12v6m4-6v6" />
              </svg>
              Anfragen-Archiv
            </h2>
          </div>
          <div className="divide-y divide-gray-50">
            {archivedRequests.map(req => (
              <div key={req.id} className="px-6 py-3 flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-gray-400">{req.requestNumber}</span>
                    <span className="text-sm text-gray-800 font-medium truncate">{req.title}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(req.updatedAt).toLocaleDateString('de-DE')} · {req.createdByName}
                  </p>
                </div>
                <span className="flex-shrink-0 text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">
                  Archiviert
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
