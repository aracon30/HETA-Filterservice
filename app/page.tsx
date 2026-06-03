import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import Link from 'next/link'
import StatusBadge from '@/components/StatusBadge'

export const dynamic = 'force-dynamic'

const EXTERNAL_ROLES = ['MAINTENANCE_MANAGER', 'MAINTENANCE_TECHNICIAN', 'BUYER']

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value)
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  const role = session?.user?.role as string | undefined
  const isExternal = role ? EXTERNAL_ROLES.includes(role) : false
  const customerId = session?.user?.customerId as string | undefined

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const jobFilter = isExternal && customerId ? { customerId } : {}

  const [openJobs, todayJobs, opportunities, upcomingJobs] = await Promise.all([
    prisma.serviceJob.count({
      where: { ...jobFilter, status: { in: ['PLANNED', 'IN_PROGRESS'] } },
    }),
    prisma.serviceJob.count({
      where: {
        ...jobFilter,
        scheduledAt: { gte: today, lt: tomorrow },
        status: { in: ['PLANNED', 'IN_PROGRESS'] },
      },
    }),
    isExternal ? Promise.resolve([]) : prisma.opportunity.findMany({
      where: { stage: { notIn: ['WON', 'LOST'] } },
      select: { value: true },
    }),
    prisma.serviceJob.findMany({
      where: { ...jobFilter, status: { in: ['PLANNED', 'IN_PROGRESS'] } },
      include: {
        customer: { select: { name: true } },
        plants: { include: { plant: { select: { name: true } } }, orderBy: { order: 'asc' } },
      },
      orderBy: { scheduledAt: 'asc' },
      take: 5,
    }),
  ])

  const totalOpportunityValue = (opportunities as { value: number | null }[]).reduce((sum, o) => sum + (o.value ?? 0), 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            {new Date().toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        {!isExternal && (
          <div className="flex gap-3">
            <Link
              href="/jobs/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Neuer Einsatz
            </Link>
            <Link
              href="/customers"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              Neuer Kunde
            </Link>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className={`grid gap-6 mb-8 ${isExternal ? 'grid-cols-2' : 'grid-cols-3'}`}>
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
          </div>
          <div className="text-3xl font-bold text-gray-900">{openJobs}</div>
          <div className="text-sm text-gray-500 mt-1">Offene Einsätze</div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
          <div className="text-3xl font-bold text-gray-900">{todayJobs}</div>
          <div className="text-sm text-gray-500 mt-1">Einsätze heute</div>
        </div>

        {!isExternal && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="text-3xl font-bold text-gray-900">{formatCurrency(totalOpportunityValue)}</div>
            <div className="text-sm text-gray-500 mt-1">Offene Vertriebschancen ({(opportunities as any[]).length})</div>
          </div>
        )}
      </div>

      {/* Upcoming Jobs Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Nächste geplante Einsätze</h2>
          <Link href="/jobs" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
            Alle anzeigen →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Datum</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Auftragsnummer</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Kunde</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Anlage</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Techniker</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {upcomingJobs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-400">
                    Keine geplanten Einsätze
                  </td>
                </tr>
              ) : (
                upcomingJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-900">{formatDate(job.scheduledAt)}</td>
                    <td className="px-6 py-4">
                      <Link href={`/jobs/${job.id}`} className="text-sm font-medium text-blue-600 hover:text-blue-700">
                        {job.orderNumber}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{job.customer.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{(job as { plants: { plant: { name: string } }[] }).plants.length === 0 ? '—' : (job as { plants: { plant: { name: string } }[] }).plants.map((jp: { plant: { name: string } }) => jp.plant.name).join(', ')}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{job.technicianName ?? '—'}</td>
                    <td className="px-6 py-4">
                      <StatusBadge status={job.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
