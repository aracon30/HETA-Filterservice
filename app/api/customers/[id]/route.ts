import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkPermission, ROLE_PERMISSIONS } from '@/lib/permissions'

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  if (!(await checkPermission(session, 'customers', 'view')))
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })

  // Scope check: external users may only see their own customer
  if (session.user.customerId && params.id !== session.user.customerId)
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })

  // For own_plant scope, only return assigned plants
  const role = session.user.role as string
  const plantScope = ROLE_PERMISSIONS[role]?.plants?.scope ?? 'all'
  let plantWhere: Record<string, unknown> = {}

  if (plantScope === 'own_plant' && session.user.id) {
    const assignments = await prisma.plantExternalUser.findMany({
      where: { userId: session.user.id },
      select: { plantId: true },
    })
    const plantIds = assignments.map(a => a.plantId)
    plantWhere = { id: { in: plantIds.length > 0 ? plantIds : ['__none__'] } }
  }

  const customer = await prisma.customer.findUnique({
    where: { id: params.id },
    include: {
      plants: {
        where: plantWhere,
        orderBy: { name: 'asc' },
        include: {
          _count: { select: { jobPlants: true } },
          defaultTechnician: { select: { id: true, name: true } },
          externalUsers: { include: { user: { select: { id: true, name: true } } } },
        },
      },
      users: {
        where: { active: true },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          externalPlants: {
            select: { plant: { select: { id: true, name: true } } },
          },
        },
        orderBy: { name: 'asc' },
      },
      _count: { select: { jobs: true } },
    },
  })

  if (!customer) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

  return NextResponse.json(customer)
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params
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

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const role = session.user.role as string
  if (!['ADMIN', 'SERVICE_MANAGER'].includes(role)) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Count inside the transaction to avoid TOCTOU race
      const activeJobs = await tx.serviceJob.count({
        where: { customerId: params.id, status: { in: ['PLANNED', 'IN_PROGRESS'] } },
      })
      if (activeJobs > 0) {
        throw Object.assign(new Error('ACTIVE_JOBS'), { count: activeJobs })
      }

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
  } catch (err) {
    const e = err as Error & { count?: number }
    if (e.message === 'ACTIVE_JOBS') {
      return NextResponse.json(
        { error: `Kunde hat ${e.count} aktive Einsätze und kann nicht gelöscht werden.` },
        { status: 409 }
      )
    }
    throw err
  }

  return NextResponse.json({ success: true })
}
