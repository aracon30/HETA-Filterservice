import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import InvoicePanel from '@/components/InvoicePanel'

function fmtDate(d: Date | string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtEur(amount: number | null | undefined) {
  if (!amount) return '—'
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount)
}

function quarterLabel(date: Date) {
  const q = Math.floor(date.getMonth() / 3) + 1
  return `Q${q} ${date.getFullYear()}`
}

export default async function BuyerDashboard({
  userId,
  customerId,
}: {
  userId: string
  customerId: string
}) {
  const [customer, plants, completedJobs, invoices] = await Promise.all([
    prisma.customer.findUnique({ where: { id: customerId } }),
    prisma.plant.findMany({
      where: { customerId },
      select: { id: true },
    }),
    prisma.serviceJob.findMany({
      where: { customerId, status: 'COMPLETED' },
      include: {
        plants: { include: { plant: { select: { name: true } } }, orderBy: { order: 'asc' } },
        technicians: { orderBy: { order: 'asc' } },
      },
      orderBy: { completedAt: 'desc' },
      take: 30,
    }),
    prisma.invoice.findMany({
      where: { customerId },
      include: { job: { select: { orderNumber: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  if (!customer) return null

  // Quarterly cost chart data (last 8 quarters)
  const quarterMap = new Map<string, number>()
  for (const inv of invoices) {
    if (!inv.amount) continue
    const label = quarterLabel(new Date(inv.createdAt))
    quarterMap.set(label, (quarterMap.get(label) ?? 0) + inv.amount)
  }
  const allQuarters = Array.from(quarterMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-8)
  const maxAmount = Math.max(...allQuarters.map(q => q[1]), 1)
  const totalInvoiceAmount = invoices.reduce((s, i) => s + (i.amount ?? 0), 0)

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
            <p className="text-sm text-gray-500 mt-0.5">Einkäufer · Unternehmensportal</p>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-3 divide-x divide-gray-100">
          <div className="px-6 py-4 text-center">
            <p className="text-3xl font-bold text-gray-900">{invoices.length}</p>
            <p className="text-xs text-gray-500 mt-0.5">Rechnungen</p>
          </div>
          <div className="px-6 py-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{fmtEur(totalInvoiceAmount)}</p>
            <p className="text-xs text-gray-500 mt-0.5">Gesamtvolumen</p>
          </div>
          <div className="px-6 py-4 text-center">
            <p className="text-3xl font-bold text-gray-900">{completedJobs.length}</p>
            <p className="text-xs text-gray-500 mt-0.5">Abgeschlossene Einsätze</p>
          </div>
        </div>
      </div>

      {/* ── Kostenentwicklung (Quartalschart) ────────────────────────────── */}
      {allQuarters.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 bg-indigo-600 rounded flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h2 className="text-base font-bold text-gray-900">Kostenentwicklung</h2>
            <span className="text-xs text-gray-400">pro Quartal</span>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
            <div className="flex items-end gap-3 h-40">
              {allQuarters.map(([label, amount]) => (
                <div key={label} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                  <p className="text-xs font-medium text-gray-600 tabular-nums">
                    {fmtEur(amount)}
                  </p>
                  <div className="w-full flex items-end" style={{ height: '96px' }}>
                    <div
                      className="w-full bg-indigo-500 rounded-t hover:bg-indigo-600 transition-colors"
                      style={{ height: `${Math.max((amount / maxAmount) * 96, 4)}px` }}
                      title={`${label}: ${fmtEur(amount)}`}
                    />
                  </div>
                  <p className="text-xs text-gray-400 truncate w-full text-center">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

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

      {/* ── Abgeschlossene Einsätze ───────────────────────────────────────── */}
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
