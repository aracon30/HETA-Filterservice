import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkPermission } from '@/lib/permissions'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const customer = await prisma.customer.findUnique({
    where: { id: params.id },
    include: {
      plants: {
        orderBy: { name: 'asc' },
        include: { _count: { select: { jobPlants: true } } },
      },
      _count: { select: { jobs: true } },
    },
  })

  if (!customer) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

  if (!(await checkPermission(session, 'customers', 'view')))
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })

  // Scope check: external users may only see their own customer
  if (session.user.customerId && customer.id !== session.user.customerId)
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })

  return NextResponse.json(customer)
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const role = session.user.role as string
  if (!['ADMIN', 'SERVICE_MANAGER'].includes(role)) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const body = await req.json()
  const customer = await prisma.customer.update({
    where: { id: params.id },
    data: {
      name: body.name,
      contactName: body.contactName || null,
      email: body.email || null,
      phone: body.phone || null,
      address: body.address || null,
    },
  })

  return NextResponse.json(customer)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const role = session.user.role as string
  if (!['ADMIN', 'SERVICE_MANAGER'].includes(role)) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  // Block if active jobs exist
  const activeJobs = await prisma.serviceJob.count({
    where: { customerId: params.id, status: { in: ['PLANNED', 'IN_PROGRESS'] } },
  })
  if (activeJobs > 0) {
    return NextResponse.json(
      { error: `Kunde hat ${activeJobs} aktive Einsätze und kann nicht gelöscht werden.` },
      { status: 409 }
    )
  }

  await prisma.$transaction(async (tx) => {
    // Erst alle Job-Checklisten löschen
    const jobs = await tx.serviceJob.findMany({
      where: { customerId: params.id },
      select: { id: true },
    })
    const jobIds = jobs.map(j => j.id)
    if (jobIds.length > 0) {
      await tx.checklistItem.deleteMany({ where: { jobId: { in: jobIds } } })
    }
    await tx.serviceJob.deleteMany({ where: { customerId: params.id } })
    await tx.plant.deleteMany({ where: { customerId: params.id } })
    await tx.opportunity.deleteMany({ where: { customerId: params.id } })
    await tx.customer.delete({ where: { id: params.id } })
  })

  return NextResponse.json({ success: true })
}
