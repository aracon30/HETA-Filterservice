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
          include: { site: { select: { name: true } } },
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
          },
          orderBy: { completedAt: 'desc' },
          take: 30,
        })
      : Promise.resolve([]),
  ])

  if (!customer) return null

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
            <p className="text-sm text-gray-500 mt-0.5">Instandhaltungstechniker · Unternehmensportal</p>
          </div>
          <div className="text-center flex-shrink-0">
            <p className="text-2xl font-bold text-gray-900">{plants.length}</p>
            <p className="text-xs text-gray-500">Meine Anlagen</p>
          </div>
        </div>
      </div>

      {/* ── Meine Anlagen ─────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 bg-slate-700 rounded flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h2 className="text-base font-bold text-gray-900">Meine Anlagen</h2>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{plants.length}</span>
        </div>

        {plants.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-sm text-gray-400">
            Ihnen sind noch keine Anlagen zugeordnet. Bitte wenden Sie sich an Ihren Administrator.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {plants.map(plant => (
              <Link
                key={plant.id}
                href={`/portal/plants/${plant.id}`}
                className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:border-blue-300 hover:shadow-md transition-all group flex items-start gap-3"
              >
                <div className="w-9 h-9 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-blue-50 transition-colors">
                  <svg className="w-5 h-5 text-slate-500 group-hover:text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900 text-sm leading-tight group-hover:text-blue-700 transition-colors truncate">
                    {plant.name}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{plant.type}</p>
                  {plant.site && <p className="text-xs text-gray-400 mt-0.5">{plant.site.name}</p>}
                </div>
                <svg className="w-4 h-4 text-gray-300 group-hover:text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ── Geplante Einsätze ─────────────────────────────────────────────── */}
      {plannedJobs.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-base font-bold text-gray-900">Geplante Einsätze</h2>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{plannedJobs.length}</span>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Datum</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Auftrag</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Anlage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {plannedJobs.map(job => (
                  <tr key={job.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{fmtDateTime(job.scheduledAt)}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{job.orderNumber}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs hidden md:table-cell">
                      {job.plants.map(jp => jp.plant.name).join(', ') || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── Servicehistorie mit Checklisten-Link ─────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 bg-green-600 rounded flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-base font-bold text-gray-900">Servicehistorie</h2>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{completedJobs.length}</span>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          {completedJobs.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-gray-400">Noch keine abgeschlossenen Einsätze.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Abgeschlossen</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Auftrag</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Anlage</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {completedJobs.map(job => (
                  <tr key={job.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                      {fmtDate(job.completedAt ?? job.scheduledAt)}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800">{job.orderNumber}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs hidden md:table-cell">
                      {job.plants.map(jp => jp.plant.name).join(', ') || '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/portal/jobs/${job.id}/checklist`}
                        className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                        </svg>
                        Checkliste
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  )
}
