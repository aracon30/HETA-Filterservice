import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getExternalPlantScope } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

const CHECKLIST_ROLES = ['MAINTENANCE_MANAGER', 'MAINTENANCE_TECHNICIAN']

function StatusBadge({ status }: { status: string }) {
  if (status === 'io') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
      </svg>
      i.O.
    </span>
  )
  if (status === 'nio') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
      </svg>
      n.i.O.
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      Offen
    </span>
  )
}

export default async function PortalChecklistPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const role = session.user.role as string
  const customerId = session.user.customerId as string | undefined

  const userId = session.user.id as string | undefined
  if (!CHECKLIST_ROLES.includes(role) || !customerId || !userId) redirect('/portal')

  const job = await prisma.serviceJob.findUnique({
    where: { id },
    include: {
      plants: {
        include: { plant: { select: { id: true, name: true } } },
        orderBy: { order: 'asc' },
      },
      technicians: { orderBy: { order: 'asc' } },
      checklistItems: {
        orderBy: [{ section: 'asc' }, { id: 'asc' }],
      },
    },
  })

  if (!job || job.customerId !== customerId) notFound()

  // Only allow viewing checklist of completed jobs
  if (job.status !== 'COMPLETED') redirect('/portal')

  // For MAINTENANCE_TECHNICIAN: only if they have access to at least one job plant
  if (role === 'MAINTENANCE_TECHNICIAN') {
    const ext = await getExternalPlantScope(userId as string, customerId, role)
    const jobPlantIds = job.plants.map(jp => jp.plantId)
    const hasAccess = ext.all || jobPlantIds.some(pid => ext.plantIds.includes(pid))
    if (!hasAccess) notFound()
  }

  // Group checklist by section
  const sections = new Map<string, typeof job.checklistItems>()
  for (const item of job.checklistItems) {
    const sec = item.section ?? 'Allgemein'
    if (!sections.has(sec)) sections.set(sec, [])
    sections.get(sec)!.push(item)
  }

  const totalItems = job.checklistItems.length
  const ioItems   = job.checklistItems.filter(i => i.status === 'io').length
  const nioItems  = job.checklistItems.filter(i => i.status === 'nio').length
  const openItems = job.checklistItems.filter(i => i.status === 'open' || !i.status).length

  const completedDate = job.completedAt ?? job.scheduledAt

  return (
    <div className="max-w-3xl mx-auto pb-12">

      {/* ── Breadcrumb ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-6 text-sm text-gray-500">
        <Link href="/portal" className="flex items-center gap-1 hover:text-gray-700 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Portal
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-gray-700 font-medium">Checkliste {job.orderNumber}</span>
      </div>

      {/* ── Job Header ────────────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mb-6">
        <div className="px-6 py-5 border-b border-gray-100">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                Prüfprotokoll {job.orderNumber}
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Abgeschlossen am {new Date(completedDate).toLocaleDateString('de-DE', {
                  day: '2-digit', month: 'long', year: 'numeric',
                })}
              </p>
            </div>
            <span className="flex-shrink-0 inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Abgeschlossen
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            {job.plants.length > 0 && (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">Anlage(n)</p>
                <p className="text-gray-700">{job.plants.map(jp => jp.plant.name).join(', ')}</p>
              </div>
            )}
            {job.technicians.length > 0 && (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">Techniker</p>
                <p className="text-gray-700">{job.technicians.map(t => t.userName).join(', ')}</p>
              </div>
            )}
          </div>
        </div>

        {/* Summary bar */}
        {totalItems > 0 && (
          <div className="px-6 py-4 grid grid-cols-3 gap-4 bg-gray-50">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{ioItems}</p>
              <p className="text-xs text-gray-500 mt-0.5">In Ordnung</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">{nioItems}</p>
              <p className="text-xs text-gray-500 mt-0.5">Mängel</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-400">{openItems}</p>
              <p className="text-xs text-gray-500 mt-0.5">Offen / N/A</p>
            </div>
          </div>
        )}

        {/* Progress bar */}
        {totalItems > 0 && (
          <div className="px-6 py-3 border-t border-gray-100">
            <div className="flex h-2 rounded-full overflow-hidden gap-0.5">
              {ioItems > 0 && (
                <div
                  className="bg-green-400 rounded-full"
                  style={{ width: `${(ioItems / totalItems) * 100}%` }}
                />
              )}
              {nioItems > 0 && (
                <div
                  className="bg-red-400 rounded-full"
                  style={{ width: `${(nioItems / totalItems) * 100}%` }}
                />
              )}
              {openItems > 0 && (
                <div
                  className="bg-gray-200 rounded-full"
                  style={{ width: `${(openItems / totalItems) * 100}%` }}
                />
              )}
            </div>
            <p className="text-xs text-gray-400 mt-1.5">
              {ioItems} von {totalItems} Prüfpunkten in Ordnung
            </p>
          </div>
        )}
      </div>

      {/* ── Checklist sections ────────────────────────────────────────────── */}
      {sections.size === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-sm text-gray-400">
          Keine Prüfpunkte in diesem Einsatz dokumentiert.
        </div>
      ) : (
        <div className="space-y-4">
          {Array.from(sections.entries()).map(([section, items]) => {
            const sectionIo  = items.filter(i => i.status === 'io').length
            const sectionNio = items.filter(i => i.status === 'nio').length
            return (
              <div key={section} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
                  <h2 className="text-sm font-bold text-gray-800">{section}</h2>
                  <div className="flex items-center gap-2 text-xs">
                    {sectionNio > 0 && (
                      <span className="text-red-600 font-medium">{sectionNio} Mangel{sectionNio !== 1 ? 'punkte' : 'punkt'}</span>
                    )}
                    <span className="text-gray-400">{sectionIo}/{items.length} i.O.</span>
                  </div>
                </div>
                <div className="divide-y divide-gray-50">
                  {items.map(item => (
                    <div
                      key={item.id}
                      className={`px-5 py-3.5 flex items-start gap-4 ${item.status === 'nio' ? 'bg-red-50/50' : ''}`}
                    >
                      <div className="flex-shrink-0 mt-0.5">
                        <StatusBadge status={item.status ?? 'open'} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800">{item.label}</p>
                        {item.comment && (
                          <p className="text-xs text-gray-500 mt-1 italic">{item.comment}</p>
                        )}
                        {item.photoUrl && (
                          <a
                            href={item.photoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 mt-1"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Foto ansehen
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Findings / Recommendations ────────────────────────────────────── */}
      {(job.findings || job.recommendations) && (
        <div className="mt-6 space-y-4">
          {job.findings && (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
              <h2 className="text-sm font-bold text-gray-800 mb-2">Befunde & Feststellungen</h2>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{job.findings}</p>
            </div>
          )}
          {job.recommendations && (
            <div className="bg-white border border-amber-200 rounded-xl shadow-sm p-5 bg-amber-50/30">
              <h2 className="text-sm font-bold text-gray-800 mb-2">Empfehlungen</h2>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{job.recommendations}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
