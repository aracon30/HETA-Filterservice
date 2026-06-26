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

const HEALTH_CONFIG: Record<PlantHealth, { dot: string; label: string; border: string }> = {
  green:  { dot: 'bg-green-500',  label: 'Aktuell',      border: 'border-green-200' },
  yellow: { dot: 'bg-yellow-400', label: 'Prüfen',        border: 'border-yellow-200' },
  red:    { dot: 'bg-red-500',    label: 'Überfällig',    border: 'border-red-200' },
}

function HealthDot({ health }: { health: PlantHealth }) {
  const c = HEALTH_CONFIG[health]
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block w-2.5 h-2.5 rounded-full ${c.dot} flex-shrink-0`} />
      <span className={`text-xs font-medium ${health === 'green' ? 'text-green-700' : health === 'yellow' ? 'text-yellow-700' : 'text-red-700'}`}>
        {c.label}
      </span>
    </span>
  )
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
      include: {
        site: { select: { name: true } },
      },
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

  // Build plant health map using most recent completed job per plant
  const plantHealthMap = new Map<string, { date: Date | null; nioCount: number }>()
  for (const plant of plants) {
    plantHealthMap.set(plant.id, { date: null, nioCount: 0 })
  }
  for (const job of completedJobs) {
    for (const jp of job.plants) {
      const entry = plantHealthMap.get(jp.plantId)
      if (entry && !entry.date) {
        const jobDate = job.completedAt ?? job.scheduledAt
        const nioCount = job.checklistItems.filter(
          i => i.status === 'nio' && (jp.plantId ? true : true) // plant-level filter would need plantId on checklistItem
        ).length
        plantHealthMap.set(jp.plantId, { date: jobDate, nioCount })
      }
    }
  }

  // KPI summary
  const greenCount  = plants.filter(p => plantHealth(plantHealthMap.get(p.id)?.date ?? null, plantHealthMap.get(p.id)?.nioCount ?? 0) === 'green').length
  const yellowCount = plants.filter(p => plantHealth(plantHealthMap.get(p.id)?.date ?? null, plantHealthMap.get(p.id)?.nioCount ?? 0) === 'yellow').length
  const redCount    = plants.filter(p => plantHealth(plantHealthMap.get(p.id)?.date ?? null, plantHealthMap.get(p.id)?.nioCount ?? 0) === 'red').length

  const visibleSiteIds = Array.from(new Set(plants.map(p => p.siteId).filter((x): x is string => !!x)))

  return (
    <div className="max-w-5xl mx-auto pb-12 space-y-6">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 flex items-start gap-4">
          <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">{customer.name}</h1>
            <p className="text-sm text-gray-500 mt-0.5">Instandhaltungsleiter · Unternehmensportal</p>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-gray-100">
          <div className="px-6 py-4 text-center">
            <p className="text-3xl font-bold text-gray-900">{plants.length}</p>
            <p className="text-xs text-gray-500 mt-0.5">Anlagen gesamt</p>
          </div>
          <div className="px-6 py-4 text-center">
            <p className="text-3xl font-bold text-green-600">{greenCount}</p>
            <p className="text-xs text-gray-500 mt-0.5">Aktuell</p>
          </div>
          <div className="px-6 py-4 text-center">
            <p className="text-3xl font-bold text-yellow-500">{yellowCount}</p>
            <p className="text-xs text-gray-500 mt-0.5">Zu prüfen</p>
          </div>
          <div className="px-6 py-4 text-center">
            <p className="text-3xl font-bold text-red-500">{redCount}</p>
            <p className="text-xs text-gray-500 mt-0.5">Überfällig</p>
          </div>
        </div>
      </div>

      {/* ── Anlagen-Statusübersicht ───────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 bg-slate-700 rounded flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h2 className="text-base font-bold text-gray-900">Anlagen-Status</h2>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{plants.length}</span>
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
                  className={`bg-white border rounded-xl p-4 shadow-sm hover:shadow-md transition-all group flex items-start gap-3 ${cfg.border}`}
                >
                  <div className={`w-2.5 h-2.5 rounded-full ${cfg.dot} mt-1.5 flex-shrink-0`} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900 text-sm leading-tight group-hover:text-blue-700 transition-colors truncate">
                      {plant.name}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{plant.type}</p>
                    {plant.site && (
                      <p className="text-xs text-gray-400 mt-0.5">{plant.site.name}</p>
                    )}
                    <div className="mt-2">
                      <HealthDot health={health} />
                    </div>
                    {entry?.date && (
                      <p className="text-xs text-gray-300 mt-1">
                        Letzter Service: {fmtDate(entry.date)}
                      </p>
                    )}
                    {!entry?.date && (
                      <p className="text-xs text-red-400 mt-1">Kein Service dokumentiert</p>
                    )}
                  </div>
                  <svg className="w-4 h-4 text-gray-300 group-hover:text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              )
            })}
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> Service &lt; 12 Monate</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400" /> Service 12–24 Monate oder Mängel</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Kein Service oder &gt; 24 Monate</span>
        </div>
      </section>

      {/* ── Nächste Einsätze ──────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-base font-bold text-gray-900">Nächste Einsätze</h2>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{plannedJobs.length}</span>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          {plannedJobs.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-gray-400">Keine geplanten Einsätze.</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {plannedJobs.map(job => {
                const isToday = new Date(job.scheduledAt).toDateString() === new Date().toDateString()
                const isPast = new Date(job.scheduledAt) < new Date() && job.status === 'PLANNED'
                return (
                  <div key={job.id} className="px-5 py-4 flex items-start gap-4">
                    <div className={`flex-shrink-0 text-center w-12 ${isPast ? 'text-red-500' : isToday ? 'text-blue-600' : 'text-gray-700'}`}>
                      <p className="text-lg font-bold leading-none">
                        {new Date(job.scheduledAt).getDate().toString().padStart(2, '0')}
                      </p>
                      <p className="text-xs uppercase font-medium">
                        {new Date(job.scheduledAt).toLocaleDateString('de-DE', { month: 'short' })}
                      </p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{job.orderNumber}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {job.plants.map(jp => jp.plant.name).join(', ') || '—'}
                      </p>
                      {job.technicians.length > 0 && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {job.technicians.map(t => t.userName).join(', ')}
                        </p>
                      )}
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        job.status === 'IN_PROGRESS'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {job.status === 'IN_PROGRESS' ? 'In Bearbeitung' : 'Geplant'}
                      </span>
                      <p className="text-xs text-gray-400 mt-1">{fmtDateTime(job.scheduledAt).split(', ')[1]}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {/* ── Abgeschlossene Einsätze mit Checklisten-Link ─────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 bg-green-600 rounded flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-base font-bold text-gray-900">Abgeschlossene Einsätze</h2>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{completedJobs.length}</span>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          {completedJobs.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-gray-400">Keine abgeschlossenen Einsätze.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Abgeschlossen</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Auftrag</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Anlage</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Mängel</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {completedJobs.map(job => {
                  const nioItems = job.checklistItems.filter(i => i.status === 'nio').length
                  return (
                    <tr key={job.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                        {fmtDate(job.completedAt ?? job.scheduledAt)}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-800">{job.orderNumber}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs hidden md:table-cell">
                        {job.plants.map(jp => jp.plant.name).join(', ') || '—'}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        {nioItems > 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                            {nioItems} Mangel{nioItems !== 1 ? 'punkte' : 'punkt'}
                          </span>
                        ) : (
                          <span className="text-xs text-green-600 font-medium">Keine Mängel</span>
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
          <div className="w-6 h-6 bg-gray-700 rounded flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h2 className="text-base font-bold text-gray-900">Rechnungen</h2>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
          <InvoicePanel customerId={customerId} canUpload={false} />
        </div>
      </section>
    </div>
  )
}
