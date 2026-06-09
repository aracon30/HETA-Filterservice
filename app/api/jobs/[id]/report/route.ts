import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkPermission } from '@/lib/permissions'
import { createElement } from 'react'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  if (!(await checkPermission(session, 'jobs', 'view'))) return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })

  const job = await prisma.serviceJob.findUnique({
    where: { id: params.id },
    include: {
      customer: true,
      plants: { include: { plant: true }, orderBy: { order: 'asc' } },
      technicians: { orderBy: { order: 'asc' } },
      checklistItems: { orderBy: { id: 'asc' } },
    },
  })

  if (!job) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

  const role = session.user.role as string
  const externalRoles = ['MAINTENANCE_MANAGER', 'MAINTENANCE_TECHNICIAN', 'BUYER']
  if (externalRoles.includes(role) && job.customerId !== session.user.customerId) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const data = {
    orderNumber: job.orderNumber,
    scheduledAt: job.scheduledAt.toISOString(),
    completedAt: job.completedAt?.toISOString() ?? null,
    customer: {
      name: job.customer.name,
      address: job.customer.address ?? null,
      contactName: job.customer.contactName ?? null,
      email: job.customer.email ?? null,
      phone: job.customer.phone ?? null,
    },
    plants: job.plants.map(jp => ({
      name: jp.plant.name,
      type: jp.plant.type,
      serialNumber: jp.plant.serialNumber ?? null,
      location: jp.plant.location ?? null,
      manufacturer: jp.plant.manufacturer ?? null,
      model: jp.plant.model ?? null,
      buildYear: jp.plant.buildYear ?? null,
    })),
    technicians: job.technicians.map(t => ({ userName: t.userName })),
    vehicles: job.vehicles,
    description: job.description ?? null,
    findings: job.findings ?? null,
    recommendations: job.recommendations ?? null,
    workTimeEntries: (job.workTimeEntries as { date: string; startTime: string; endTime: string }[] | null) ?? null,
    checklistItems: job.checklistItems.map(c => ({
      id: c.id,
      label: c.label,
      section: c.section ?? null,
      status: c.status,
      comment: c.comment ?? null,
      photoUrl: c.photoUrl ?? null,
    })),
    technicianSignature: job.technicianSignature ?? null,
    customerSignature: job.customerSignature ?? null,
  }

  try {
    // Both imports must be dynamic so only one instance of @react-pdf/renderer is loaded
    const [{ renderToBuffer }, { ServiceReportPDF }] = await Promise.all([
      import('@react-pdf/renderer'),
      import('@/lib/pdf/ServiceReportPDF'),
    ])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = await renderToBuffer(createElement(ServiceReportPDF, { data }) as any)
    const uint8 = new Uint8Array(buffer)

    const fileName = `Servicebericht_${job.orderNumber.replace(/[^a-zA-Z0-9-]/g, '_')}.pdf`

    return new NextResponse(uint8, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': uint8.length.toString(),
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack : undefined
    console.error('[report] PDF generation failed:', msg, stack)
    return NextResponse.json({ error: 'PDF-Erstellung fehlgeschlagen', detail: msg }, { status: 500 })
  }
}
