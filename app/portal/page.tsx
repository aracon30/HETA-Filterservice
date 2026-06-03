import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import StatusBadge from '@/components/StatusBadge'
import { checkPermission } from '@/lib/permissions'
import InvoicePanel from '@/components/InvoicePanel'

export const dynamic = 'force-dynamic'

const EXTERNAL_ROLES = ['MAINTENANCE_MANAGER', 'MAINTENANCE_TECHNICIAN', 'BUYER']

const ROLE_LABELS: Record<string, string> = {
  MAINTENANCE_MANAGER: 'Instandhaltungsleiter',
  MAINTENANCE_TECHNICIAN: 'Instandhaltungstechniker',
  BUYER: 'Einkäufer',
}

function fmtDate(date: Date | string) {
  return new Date(date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtDateTime(date: Date | string) {
  return new Date(date).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default async function PortalPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const role = session.user.role as string
  const customerId = session.user.customerId as string | undefined

  if (!EXTERNAL_ROLES.includes(role) || !customerId) redirect('/')

  // Permissions
  const canViewPlants = await checkPermission(session, 'plants', 'view')
  const canViewJobs = await checkPermission(session, 'jobs', 'view')

  // Load company data
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      _count: { select: { plants: true, jobs: true } },
    },
  })
  if (!customer) redirect('/')

  // Load plants if permitted
  const plants = canViewPlants
    ? await prisma.plant.findMany({
        where: { customerId },
        orderBy: { name: 'asc' },
      })
    : []

  // Load jobs if permitted
  const plannedJobs = (canViewJobs && role !== 'BUYER')
    ? await prisma.serviceJob.findMany({
        where: { customerId, status: { in: ['PLANNED', 'IN_PROGRESS'] } },
        include: { plant: { select: { name: true } } },
        orderBy: { scheduledAt: 'asc' },
      })
    : []

  const completedJobs = canViewJobs
    ? await prisma.serviceJob.findMany({
        where: { customerId, status: 'COMPLETED' },
        include: { plant: { select: { name: true } } },
        orderBy: { completedAt: 'desc' },
        take: 50,
      })
    : []

  // Role-specific detail level
  const showReportLink = role === 'MAINTENANCE_MANAGER' || role === 'BUYER'
  const showInvoices = role === 'BUYER'

  return (
    <div className="max-w-5xl mx-auto pb-12">

      {/* ── Company Header ─────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm mb-6 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 flex items-start gap-4">
          <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-gray-900">{customer.name}</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {ROLE_LABELS[role]} · Unternehmensportal
            </p>
          </div>
          <div className="flex gap-4 text-center text-sm flex-shrink-0">
            <div>
              <p className="text-2xl font-bold text-gray-900">{customer._count.plants}</p>
              <p className="text-xs text-gray-500">Anlagen</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{customer._count.jobs}</p>
              <p className="text-xs text-gray-500">Einsätze</p>
            </div>
          </div>
        </div>

        {/* Company details */}
        <div className="px-6 py-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          {customer.address && (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Adresse</p>
              <p className="text-gray-700 whitespace-pre-line">{customer.address}</p>
            </div>
          )}
          {customer.contactName && (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Ansprechpartner</p>
              <p className="text-gray-700">{customer.contactName}</p>
            </div>
          )}
          {customer.email && (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">E-Mail</p>
              <a href={`mailto:${customer.email}`} className="text-blue-600 hover:underline">{customer.email}</a>
            </div>
          )}
          {customer.phone && (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Telefon</p>
              <a href={`tel:${customer.phone}`} className="text-blue-600 hover:underline">{customer.phone}</a>
            </div>
          )}
          {!customer.address && !customer.contactName && !customer.email && !customer.phone && (
            <p className="col-span-4 text-gray-400 text-xs">Keine weiteren Unternehmensdaten hinterlegt.</p>
          )}
        </div>
      </div>

      {/* ── Plants ─────────────────────────────────────────────────────── */}
      {canViewPlants && (
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 bg-slate-700 rounded flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h2 className="text-base font-bold text-gray-900">Anlagen</h2>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{plants.length}</span>
          </div>

          {plants.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-sm text-gray-400">
              Keine Anlagen hinterlegt.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {plants.map(plant => (
                <div key={plant.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-900 text-sm leading-tight">{plant.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{plant.type}</p>
                      {plant.location && (
                        <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          {plant.location}
                        </p>
                      )}
                      {(plant.manufacturer || plant.model) && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {[plant.manufacturer, plant.model].filter(Boolean).join(' · ')}
                        </p>
                      )}
                      {plant.serialNumber && (
                        <p className="text-xs text-gray-300 mt-0.5">S/N: {plant.serialNumber}</p>
                      )}
                      {plant.buildYear && (
                        <p className="text-xs text-gray-400 mt-0.5">Baujahr {plant.buildYear}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── Planned / In-Progress Jobs ──────────────────────────────────── */}
      {canViewJobs && role !== 'BUYER' && (
        <section className="mb-8">
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
            {plannedJobs.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-gray-400">Keine geplanten Einsätze.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Datum</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Auftragsnummer</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Anlage</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Techniker</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {plannedJobs.map(job => (
                    <tr key={job.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-900">{fmtDateTime(job.scheduledAt)}</td>
                      <td className="px-4 py-3 font-medium text-gray-700">{job.orderNumber}</td>
                      <td className="px-4 py-3 text-gray-600">{job.plant?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{job.technicianName ?? '—'}</td>
                      <td className="px-4 py-3"><StatusBadge status={job.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      )}

      {/* ── Completed Jobs ─────────────────────────────────────────────── */}
      {canViewJobs && (
        <section className="mb-8">
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
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Auftragsnummer</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Anlage</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Techniker</th>
                    {showReportLink && (
                      <th className="px-4 py-3"></th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {completedJobs.map(job => (
                    <tr key={job.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-900">
                        {job.completedAt ? fmtDate(job.completedAt) : fmtDate(job.scheduledAt)}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-700">{job.orderNumber}</td>
                      <td className="px-4 py-3 text-gray-600">{job.plant?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{job.technicianName ?? '—'}</td>
                      {showReportLink && (
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/jobs/${job.id}`}
                            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                          >
                            Bericht ansehen
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </Link>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      )}

      {/* ── Invoices (Buyer only — Platzhalter) ────────────────────────── */}
      {showInvoices && (
        <section>
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
            <InvoicePanel customerId={customerId} canUpload={false} />
          </div>
        </section>
      )}
    </div>
  )
}
