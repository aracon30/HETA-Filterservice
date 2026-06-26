import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { getExternalPlantScope } from '@/lib/permissions'

function fmtDate(d: Date | string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
function fmtDateTime(d: Date | string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default async function TechnicianDashboard({
  userId,
  customerId,
}: {
  userId: string
  customerId: string
}) {
  const ext = await getExternalPlantScope(userId, customerId, 'MAINTENANCE_TECHNICIAN')
  const plantIds = ext.plantIds

  const [customer, plants, plannedJobs, completedJobs] = await Promise.all([
    prisma.customer.findUnique({ where: { id: customerId } }),
    plantIds.length > 0
      ? prisma.plant.findMany({
          where: { id: { in: plantIds }, customerId },
          include: { site: { select: { id: true, name: true, city: true } } },
          orderBy: { name: 'asc' },
        })
      : Promise.resolve([]),
    plantIds.length > 0
      ? prisma.serviceJob.findMany({
          where: {
            customerId,
            status: { in: ['PLANNED', 'IN_PROGRESS'] },
            plants: { some: { plantId: { in: plantIds } } },
          },
          include: {
            plants: { include: { plant: { select: { name: true } } }, orderBy: { order: 'asc' } },
            technicians: { orderBy: { order: 'asc' } },
          },
          orderBy: { scheduledAt: 'asc' },
          take: 20,
        })
      : Promise.resolve([]),
    plantIds.length > 0
      ? prisma.serviceJob.findMany({
          where: {
            customerId,
            status: 'COMPLETED',
            plants: { some: { plantId: { in: plantIds } } },
          },
          include: {
            plants: { include: { plant: { select: { name: true } } }, orderBy: { order: 'asc' } },
            technicians: { orderBy: { order: 'asc' } },
            checklistItems: { select: { status: true } },
          },
          orderBy: { completedAt: 'desc' },
          take: 30,
        })
      : Promise.resolve([]),
  ])

  if (!customer) return null

  // Last completed job date per plant
  const lastJobMap = new Map<string, Date | null>()
  for (const p of plants) lastJobMap.set(p.id, null)
  for (const job of completedJobs) {
    for (const jp of job.plants) {
      if (!lastJobMap.has(jp.plantId)) continue
      if (!lastJobMap.get(jp.plantId)) {
        lastJobMap.set(jp.plantId, job.completedAt ?? job.scheduledAt)
      }
    }
  }

  const nextJob = plannedJobs[0]

  // Group plants by site
  type PlantItem = (typeof plants)[number]
  type SiteGroup = { id: string | null; name: string; city: string | null; plants: PlantItem[] }
  const siteGroupMap = new Map<string | null, SiteGroup>()
  for (const plant of plants) {
    const key = plant.siteId ?? null
    if (!siteGroupMap.has(key)) {
      siteGroupMap.set(key, {
        id: key,
        name: plant.site?.name ?? 'Ohne Standort',
        city: plant.site?.city ?? null,
        plants: [],
      })
    }
    siteGroupMap.get(key)!.plants.push(plant)
  }
  const siteGroups = Array.from(siteGroupMap.values()).sort((a, b) => {
    if (a.id === null) return 1
    if (b.id === null) return -1
    return a.name.localeCompare(b.name)
  })

  return (
    <div className="max-w-5xl mx-auto pb-12 space-y-5">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-5 flex items-center gap-4 border-b border-gray-100">
          <div className="w-11 h-11 bg-teal-700 rounded-xl flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-gray-900">{customer.name}</h1>
            <p className="text-xs text-gray-400 mt-0.5">Instandhaltungstechniker · Unternehmensportal</p>
          </div>
          <div className="text-center flex-shrink-0 bg-gray-50 rounded-xl px-4 py-2">
            <p className="text-2xl font-bold text-gray-900">{plants.length}</p>
            <p className="text-xs text-gray-500">Meine Anlagen</p>
          </div>
        </div>
      </div>

      {/* ── Nächster Einsatz ─────────────────────────────────────────────── */}
      {nextJob && (
        <div className="bg-teal-700 rounded-xl shadow-sm px-6 py-5 text-white flex items-start gap-5">
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

      {/* ── Meine Anlagen ─────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <h2 className="text-sm font-bold text-gray-900">Meine Anlagen</h2>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{plants.length}</span>
        </div>

        {plants.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-sm text-gray-400">
            Ihnen sind noch keine Anlagen zugeordnet. Bitte wenden Sie sich an Ihren Administrator.
          </div>
        ) : (
          <div className="space-y-4">
            {siteGroups.map(group => (
              <div key={group.id ?? '__none__'}>
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    {group.name}
                    {group.city && <span className="font-normal text-gray-400 normal-case tracking-normal ml-1">· {group.city}</span>}
                  </span>
                  <span className="text-xs text-gray-300 bg-gray-100 px-1.5 py-0.5 rounded-full">{group.plants.length}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {group.plants.map(plant => {
                    const lastDate = lastJobMap.get(plant.id) ?? null
                    const hasService = !!lastDate
                    return (
                      <Link
                        key={plant.id}
                        href={`/portal/plants/${plant.id}`}
                        className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-all group flex flex-col overflow-hidden"
                      >
                        <div className="px-4 py-4 flex items-start gap-3 flex-1">
                          <div className="w-9 h-9 bg-teal-50 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-teal-100 transition-colors">
                            <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-gray-900 text-sm leading-tight group-hover:text-teal-700 transition-colors truncate">
                              {plant.name}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">{plant.type}</p>
                          </div>
                          <svg className="w-4 h-4 text-gray-200 group-hover:text-teal-400 flex-shrink-0 mt-0.5 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                        <div className={`px-4 py-2.5 border-t text-xs flex items-center gap-1.5 ${hasService ? 'border-gray-50 text-gray-400' : 'border-orange-50 bg-orange-50/50 text-orange-500'}`}>
                          {hasService ? (
                            <>
                              <svg className="w-3 h-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Letzter Service: <span className="text-gray-600 font-medium">{fmtDate(lastDate)}</span>
                            </>
                          ) : (
                            <>
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Kein Service dokumentiert
                            </>
                          )}
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
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
                    job.status === 'IN_PROGRESS' ? 'bg-yellow-100 text-yellow-700' : 'bg-teal-50 text-teal-700'
                  }`}>
                    {job.status === 'IN_PROGRESS' ? 'In Bearbeitung' : 'Geplant'}
                  </span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Servicehistorie ───────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-sm font-bold text-gray-900">Servicehistorie</h2>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{completedJobs.length}</span>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          {completedJobs.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-gray-400">Noch keine abgeschlossenen Einsätze.</p>
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
                      <td className="px-4 py-3 text-gray-400 text-xs hidden md:table-cell">
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
                        <Link
                          href={`/portal/jobs/${job.id}/checklist`}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                          </svg>
                          Checkliste
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  )
}
