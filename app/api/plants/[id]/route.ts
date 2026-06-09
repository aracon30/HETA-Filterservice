import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const plant = await prisma.plant.findUnique({
    where: { id: params.id },
    include: {
      defaultTechnician: { select: { id: true, name: true } },
      externalUsers: { include: { user: { select: { id: true, name: true } } } },
    },
  })
  if (!plant) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

  // External roles may only access plants belonging to their own customer
  const role = session.user.role as string
  const externalRoles = ['MAINTENANCE_MANAGER', 'MAINTENANCE_TECHNICIAN', 'BUYER']
  if (externalRoles.includes(role) && plant.customerId !== session.user.customerId) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  return NextResponse.json(plant)
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const role = session.user.role as string
  if (!['ADMIN', 'SERVICE_MANAGER', 'SERVICE_TECHNICIAN'].includes(role)) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const body = await req.json()

  if (body.clientUpdatedAt) {
    const current = await prisma.plant.findUnique({ where: { id: params.id }, select: { updatedAt: true } })
    if (!current) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
    if (new Date(body.clientUpdatedAt).getTime() !== current.updatedAt.getTime()) {
      return NextResponse.json(
        { error: 'Konflikt: Die Anlage wurde zwischenzeitlich von jemand anderem geändert. Bitte Seite neu laden.' },
        { status: 409 }
      )
    }
  }

  const plant = await prisma.plant.update({
    where: { id: params.id },
    data: {
      name: body.name,
      type: body.type,
      serialNumber: body.serialNumber || null,
      location: body.location || null,
      installedAt: body.installedAt ? new Date(body.installedAt) : null,
      buildYear: body.buildYear ?? null,
      description: body.description || null,
      contactPerson: body.contactPerson || null,
      manufacturer: body.manufacturer || null,
      model: body.model || null,
      defaultTechnicianId: body.defaultTechnicianId ?? null,
    },
  })

  // Sync external users
  if (body.externalUserIds !== undefined) {
    await prisma.plantExternalUser.deleteMany({ where: { plantId: params.id } })
    if (Array.isArray(body.externalUserIds) && body.externalUserIds.length > 0) {
      await prisma.plantExternalUser.createMany({
        data: body.externalUserIds.map((userId: string) => ({ plantId: params.id, userId })),
      })
    }
  }

  const updatedPlant = await prisma.plant.findUnique({
    where: { id: params.id },
    include: {
      defaultTechnician: { select: { id: true, name: true } },
      externalUsers: { include: { user: { select: { id: true, name: true } } } },
    },
  })

  return NextResponse.json(updatedPlant)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const role = session.user.role as string
  if (!['ADMIN', 'SERVICE_MANAGER'].includes(role)) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const activeJobs = await prisma.serviceJobPlant.count({
    where: { plantId: params.id, job: { status: { in: ['PLANNED', 'IN_PROGRESS'] } } },
  })
  if (activeJobs > 0) {
    return NextResponse.json(
      { error: `Anlage hat ${activeJobs} aktive Einsätze und kann nicht gelöscht werden.` },
      { status: 409 }
    )
  }

  await prisma.plant.delete({ where: { id: params.id } })

  return NextResponse.json({ success: true })
}
