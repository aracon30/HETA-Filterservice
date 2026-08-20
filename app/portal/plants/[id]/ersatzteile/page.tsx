import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getExternalPlantScope } from '@/lib/permissions'
import ErsatzteilAuswahl from '@/components/portal/ErsatzteilAuswahl'

export const dynamic = 'force-dynamic'

const EXTERNAL_ROLES = ['MAINTENANCE_MANAGER', 'MAINTENANCE_TECHNICIAN', 'BUYER']
const CAN_REQUEST_ROLES = ['MAINTENANCE_MANAGER', 'BUYER']

export default async function ErsatzteilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const role = session.user.role as string
  const customerId = session.user.customerId as string | undefined

  if (!EXTERNAL_ROLES.includes(role) || !customerId) redirect('/')

  const plant = await prisma.plant.findUnique({
    where: { id },
    select: { id: true, name: true, type: true, orderNumber: true, customerId: true, customer: { select: { name: true } } },
  })
  if (!plant || plant.customerId !== customerId) notFound()

  const ext = session.user.id
    ? await getExternalPlantScope(session.user.id, customerId, role)
    : { all: false, plantIds: [] as string[] }
  if (!ext.all && !ext.plantIds.includes(plant.id)) notFound()

  const materials = await prisma.plantMaterial.findMany({
    where: { plantId: plant.id, orderable: true },
    orderBy: { order: 'asc' },
    select: { id: true, label: true, partNumber: true, positionLabel: true, specification: true },
  })

  // Zeichnungen mit Hotspot-Positionen für die anfragbaren Ersatzteile dieser Anlage
  const orderableIds = materials.map(m => m.id)
  const positions = orderableIds.length > 0
    ? await prisma.plantMaterialPosition.findMany({
        where: { materialId: { in: orderableIds } },
        select: {
          materialId: true,
          positionX: true,
          positionY: true,
          document: { select: { id: true, title: true, fileUrl: true, mimeType: true, markerSize: true } },
        },
      })
    : []

  const drawingsById = new Map<string, { id: string; title: string; fileUrl: string; markerSize: number | null }>()
  const hotspots: { materialId: string; documentId: string; positionX: number; positionY: number }[] = []
  for (const p of positions) {
    drawingsById.set(p.document.id, { id: p.document.id, title: p.document.title, fileUrl: p.document.fileUrl, markerSize: p.document.markerSize })
    hotspots.push({ materialId: p.materialId, documentId: p.document.id, positionX: p.positionX, positionY: p.positionY })
  }

  const canRequest = CAN_REQUEST_ROLES.includes(role)

  return (
    <div className="max-w-4xl mx-auto pb-12">
      {/* ── Breadcrumb ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-6 text-sm text-gray-500">
        <Link href={`/portal/plants/${plant.id}`} className="flex items-center gap-1 hover:text-gray-700 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {plant.name}
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-gray-700 font-medium">Ersatzteile</span>
      </div>

      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">Ersatzteile — {plant.name}</h1>
        <p className="text-sm text-gray-500 mt-1">
          {plant.type} · {plant.customer.name}
        </p>
      </div>

      {materials.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-10 text-center text-gray-400">
          <svg className="w-10 h-10 mx-auto mb-3 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m-6 4h6m-6 4h4M5 5h14a1 1 0 011 1v12a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z" />
          </svg>
          <p className="text-sm">Für diese Anlage ist noch kein Ersatzteilkatalog hinterlegt.</p>
          <p className="text-xs text-gray-400 mt-1">Bitte wenden Sie sich für Ersatzteile an Ihren Ansprechpartner bei HETA.</p>
        </div>
      ) : canRequest ? (
        <ErsatzteilAuswahl
          plantId={plant.id}
          plantName={plant.name}
          plantOrderNumber={plant.orderNumber}
          parts={materials}
          drawings={Array.from(drawingsById.values())}
          hotspots={hotspots}
        />
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Pos.</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Bezeichnung</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Abmessungen / Material</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {materials.map(m => (
                <tr key={m.id}>
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs">{m.positionLabel ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-800">{m.label}</td>
                  <td className="px-4 py-3 text-gray-500">{m.specification ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-4 py-3 text-xs text-gray-400 border-t border-gray-100">
            Für die Bestellung von Ersatzteilen wenden Sie sich bitte an Ihren Ansprechpartner bei HETA.
          </p>
        </div>
      )}
    </div>
  )
}
