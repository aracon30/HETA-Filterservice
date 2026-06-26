import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import InvoicePanel from '@/components/InvoicePanel'
import { getExternalPlantScope } from '@/lib/permissions'

function fmtDate(d: Date | string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
function fmtDateTime(d: Date | string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

type PlantHealth = 'green' | 'yellow' | 'red'

function plantHealth(lastJobDate: Date | null, nioCount: number): PlantHealth {
  if (!lastJobDate) return 'red'
  const days = (Date.now() - lastJobDate.getTime()) / 86_400_000
  if (days > 730) return 'red'
  if (days > 365 || nioCount > 0) return 'yellow'
  return 'green'
}

const HEALTH_CONFIG: Record<PlantHealth, {
  dot: string; label: string; border: string; bg: string; text: string; pill: string
}> = {
  green:  { dot: 'bg-green-500',  label: 'Aktuell',   border: 'border-l-green-400',  bg: 'bg-green-50',  text: 'text-green-700',  pill: 'bg-green-100 text-green-700' },
  yellow: { dot: 'bg-yellow-400', label: 'Zu prüfen', border: 'border-l-yellow-400', bg: 'bg-yellow-50', text: 'text-yellow-700', pill: 'bg-yellow-100 text-yellow-700' },
  red:    { dot: 'bg-red-500',    label: 'Überfällig', border: 'border-l-red-400',   bg: 'bg-red-50',    text: 'text-red-700',   pill: 'bg-red-100 text-red-700' },
}

export default async function ManagerDashboard({
  userId,
  customerId,
}: {
  userId: string
  customerId: string
}) {
  const ext = await getExternalPlantScope(userId, customerId, 'MAINTENANCE_MANAGER')

  const plantWhere = ext.all
    ? { customerId }
    : { customerId, id: { in: ext.plantIds.length > 0 ? ext.plantIds : ['__none__'] } }

  const [customer, plants, plannedJobs, completedJobs] = await Promise.all([
    prisma.customer.findUnique({ where: { id: customerId } }),
    prisma.plant.findMany({
      where: plantWhere,
      include: { site: { select: { name: true } } },
      orderBy: { name: 'asc' },
    }),
    prisma.serviceJob.findMany({
      where: {
        customerId,
        status: { in: ['PLANNED', 'IN_PROGRESS'] },
        ...(ext.all ? {} : { plants: { some: { plantId: { in: ext.plantIds.length > 0 ? ext.plantIds : ['__none__'] } } } }),
      },
      include: {
        plants: { include: { plant: { select: { name: true } } }, orderBy: { order: 'asc' } },
        technicians: { orderBy: { order: 'asc' } },
      },
      orderBy: { scheduledAt: 'asc' },
      take: 20,
    }),
    prisma.serviceJob.findMany({
      where: {
        customerId,
        status: 'COMPLETED',
        ...(ext.all ? {} : { plants: { some: { plantId: { in: ext.plantIds.length > 0 ? ext.plantIds : ['__none__'] } } } }),
      },
      include: {
        plants: { include: { plant: { select: { name: true } } }, orderBy: { order: 'asc' } },
        technicians: { orderBy: { order: 'asc' } },
        checklistItems: { select: { status: true } },
      },
      orderBy: { completedAt: 'desc' },
      take: 30,
    }),
  ])

  if (!customer) return null

  // Build plant health map
  const plantHealthMap = new Map<string, { date: Date | null; nioCount: number }>()
  for (const plant of plants) plantHealthMap.set(plant.id, { date: null, nioCount: 0 })
  for (const job of completedJobs) {
    for (const jp of job.plants) {
      const entry = plantHealthMap.get(jp.plantId)
      if (entry && !entry.date) {
        const jobDate = job.completedAt ?? job.scheduledAt
        const nioCount = job.checklistItems.filter(i => i.status === 'nio').length
        plantHealthMap.set(jp.plantId, { date: jobDate, nioCount })
      }
    }
  }

  const greenCount  = plants.filter(p => plantHealth(plantHealthMap.get(p.id)?.date ?? null, plantHealthMap.get(p.id)?.nioCount ?? 0) === 'green').length
  const yellowCount = plants.filter(p => plantHealth(plantHealthMap.get(p.id)?.date ?? null, plantHealthMap.get(p.id)?.nioCount ?? 0) === 'yellow').length
  const redCount    = plants.filter(p => plantHealth(plantHealthMap.get(p.id)?.date ?? null, plantHealthMap.get(p.id)?.nioCount ?? 0) === 'red').length

  const totalNio = completedJobs.reduce((s, j) => s + j.checklistItems.filter(i => i.status === 'nio').length, 0)
  const hasAlerts = redCount > 0 || totalNio > 0

  const nextJob = plannedJobs[0]

  return (
    <div className="max-w-5xl mx-auto pb-12 space-y-5">

      {/* ── Alert Banner ─────────────────────────────────────────────────── */}
      {hasAlerts && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-800">Handlungsbedarf</p>
            <div className="mt-1 flex flex-wrap gap-3 text-xs text-red-700">
              {redCount > 0 && (
                <span>{redCount} Anlage{redCount !== 1 ? 'n' : ''} überfällig oder ohne Service</span>
              )}
              {totalNio > 0 && (
                <span>{totalNio} offene Mängel in abgeschlossenen Einsätzen</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Header + KPIs ────────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-5 flex items-center gap-4 border-b border-gray-100">
          <div className="w-11 h-11 bg-slate-800 rounded-xl flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">{customer.name}</h1>
            <p className="text-xs text-gray-400 mt-0.5">Instandhaltungsleiter · Unternehmensportal</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4">
          <div className="px-5 py-5 text-center border-r border-gray-100">
            <p className="text-3xl font-bold text-gray-900">{plants.length}</p>
            <p className="text-xs text-gray-500 mt-1 font-medium">Anlagen gesamt</p>
          </div>
          <div className="px-5 py-5 text-center border-r border-gray-100 bg-green-50/60">
            <p className="text-3xl font-bold text-green-600">{greenCount}</p>
            <p className="text-xs text-green-700 mt-1 font-medium">Aktuell</p>
          </div>
          <div className="px-5 py-5 text-center border-r border-gray-100 bg-yellow-50/60">
            <p className="text-3xl font-bold text-yellow-500">{yellowCount}</p>
            <p className="text-xs text-yellow-700 mt-1 font-medium">Zu prüfen</p>
          </div>
          <div className={`px-5 py-5 text-center ${redCount > 0 ? 'bg-red-50/60' : ''}`}>
            <p className={`text-3xl font-bold ${redCount > 0 ? 'text-red-600' : 'text-gray-300'}`}>{redCount}</p>
            <p className={`text-xs mt-1 font-medium ${redCount > 0 ? 'text-red-700' : 'text-gray-400'}`}>Überfällig</p>
          </div>
        </div>
      </div>

      {/* ── Nächster Einsatz (prominent if exists) ───────────────────────── */}
      {nextJob && (
        <div className="bg-blue-600 rounded-xl shadow-sm px-6 py-5 text-white flex items-start gap-5">
          <div className="flex-shrink-0 bg-white/20 rounded-lg px-3 py-2 text-center min-w-[52px]">
            <p className="text-2xl font-bold leading-none">
              {new Date(nextJob.scheduledAt).getDate().toString().padStart(2, '0')}
            </p>
            <p className="text-xs font-semibold uppercase mt-0.5 opacity-80">
              {new Date(nextJob.scheduledAt).toLocaleDateString('de-DE', { month: 'short' })}
            </p>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide opacity-70 mb-1">Nächster Einsatz</p>
            <p className="font-bold text-base leading-tight">{nextJob.orderNumber}</p>
            <p className="text-sm opacity-80 mt-1">{nextJob.plants.map(jp => jp.plant.name).join(', ') || '—'}</p>
            {nextJob.technicians.length > 0 && (
              <p className="text-xs opacity-60 mt-1">{nextJob.technicians.map(t => t.userName).join(', ')}</p>
            )}
          </div>
          <div className="flex-shrink-0 text-right">
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
              nextJob.status === 'IN_PROGRESS' ? 'bg-yellow-400 text-yellow-900' : 'bg-white/20 text-white'
            }`}>
              {nextJob.status === 'IN_PROGRESS' ? 'In Bearbeitung' : 'Geplant'}
            </span>
            <p className="text-xs opacity-60 mt-2">{fmtDateTime(nextJob.scheduledAt).split(', ')[1]}</p>
          </div>
        </div>
      )}

      {/* ── Anlagen-Statusübersicht ───────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <h2 className="text-sm font-bold text-gray-900">Anlagen-Status</h2>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{plants.length}</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />Aktuell</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />Zu prüfen</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />Überfällig</span>
          </div>
        </div>

        {plants.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-sm text-gray-400">
            Keine Anlagen sichtbar.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {plants.map(plant => {
              const entry = plantHealthMap.get(plant.id)
              const health = plantHealth(entry?.date ?? null, entry?.nioCount ?? 0)
              const cfg = HEALTH_CONFIG[health]
              return (
                <Link
                  key={plant.id}
                  href={`/portal/plants/${plant.id}`}
                  className="bg-white border border-gray-200 border-l-4 rounded-xl shadow-sm hover:shadow-md transition-all group flex items-start gap-0 overflow-hidden"
                  style={{ borderLeftColor: health === 'green' ? '#4ade80' : health === 'yellow' ? '#facc15' : '#f87171' }}
                >
                  <div className="flex-1 min-w-0 px-4 py-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 text-sm leading-tight group-hover:text-blue-700 transition-colors truncate">
                          {plant.name}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">{plant.type}</p>
                        {plant.site && <p className="text-xs text-gray-400">{plant.site.name}</p>}
                      </div>
                      <span className={`flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.pill}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                        {cfg.label}
                      </span>
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-50 flex items-center justify-between">
                      <p className="text-xs text-gray-400">
                        {entry?.date
                          ? <>Letzter Service <span className="text-gray-600 font-medium">{fmtDate(entry.date)}</span></>
                          : <span className="text-red-400">Kein Service dokumentiert</span>
                        }
                      </p>
                      {(entry?.nioCount ?? 0) > 0 && (
                        <span className="text-xs text-red-600 font-medium">{entry!.nioCount} Mangel{entry!.nioCount !== 1 ? 'punkte' : 'punkt'}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center self-stretch px-3 text-gray-200 group-hover:text-blue-400 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {/* ── Weitere geplante Einsätze ─────────────────────────────────────── */}
      {plannedJobs.length > 1 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <h2 className="text-sm font-bold text-gray-900">Weitere geplante Einsätze</h2>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{plannedJobs.length - 1}</span>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm divide-y divide-gray-50">
            {plannedJobs.slice(1).map(job => {
              const isPast = new Date(job.scheduledAt) < new Date() && job.status === 'PLANNED'
              return (
                <div key={job.id} className="px-5 py-4 flex items-center gap-4">
                  <div className={`flex-shrink-0 text-center w-10 ${isPast ? 'text-red-500' : 'text-gray-700'}`}>
                    <p className="text-base font-bold leading-none">
                      {new Date(job.scheduledAt).getDate().toString().padStart(2, '0')}
                    </p>
                    <p className="text-xs uppercase font-medium opacity-60">
                      {new Date(job.scheduledAt).toLocaleDateString('de-DE', { month: 'short' })}
                    </p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{job.orderNumber}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{job.plants.map(jp => jp.plant.name).join(', ') || '—'}</p>
                  </div>
                  <span className={`flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    job.status === 'IN_PROGRESS' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-50 text-blue-600'
                  }`}>
                    {job.status === 'IN_PROGRESS' ? 'In Bearbeitung' : 'Geplant'}
                  </span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Abgeschlossene Einsätze ───────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-sm font-bold text-gray-900">Abgeschlossene Einsätze</h2>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{completedJobs.length}</span>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          {completedJobs.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-gray-400">Keine abgeschlossenen Einsätze.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Datum</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Auftrag</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Anlage</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Ergebnis</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {completedJobs.map(job => {
                  const nioItems = job.checklistItems.filter(i => i.status === 'nio').length
                  const ioItems  = job.checklistItems.filter(i => i.status === 'io').length
                  return (
                    <tr key={job.id} className={`hover:bg-gray-50 ${nioItems > 0 ? 'bg-red-50/30' : ''}`}>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                        {fmtDate(job.completedAt ?? job.scheduledAt)}
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-800">{job.orderNumber}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs hidden md:table-cell">
                        {job.plants.map(jp => jp.plant.name).join(', ') || '—'}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {job.checklistItems.length === 0 ? (
                          <span className="text-xs text-gray-300">—</span>
                        ) : nioItems > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                            {nioItems} Mangel{nioItems !== 1 ? 'punkte' : 'punkt'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                            {ioItems} i.O.
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <Link
                            href={`/portal/jobs/${job.id}/checklist`}
                            className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                            </svg>
                            Checkliste
                          </Link>
                          <a
                            href={`/api/jobs/${job.id}/report`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            PDF
                          </a>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* ── Rechnungen ────────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h2 className="text-sm font-bold text-gray-900">Rechnungen</h2>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
          <InvoicePanel customerId={customerId} canUpload={false} />
        </div>
      </section>
    </div>
  )
}
