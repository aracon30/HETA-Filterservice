import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkPermission, getScopeFilter } from '@/lib/permissions'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }
  if (!(await checkPermission(session, 'plants', 'view'))) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const customerId = searchParams.get('customerId')
  const siteId = searchParams.get('siteId')

  const scopeFilter = await getScopeFilter(session, 'plants')

  const where: Record<string, unknown> = { ...scopeFilter }
  if (customerId) {
    // Merge customerId with scope filter (scope already restricts to own company)
    where.customerId = customerId
  }
  if (siteId) where.siteId = siteId

  const plants = await prisma.plant.findMany({
    where,
    orderBy: { name: 'asc' },
    include: {
      defaultTechnician: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json(plants)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const role = session.user.role as string
  if (!['ADMIN', 'SERVICE_MANAGER', 'SERVICE_TECHNICIAN'].includes(role)) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const body = await req.json()

  // Validate the referenced site belongs to the given customer
  if (body.siteId) {
    const site = await prisma.site.findUnique({ where: { id: body.siteId }, select: { customerId: true } })
    if (!site || site.customerId !== body.customerId)
      return NextResponse.json({ error: 'Ungültiger Standort' }, { status: 400 })
  }

  const plant = await prisma.plant.create({
    data: {
      name: body.name,
      type: body.type,
      customerId: body.customerId,
      siteId: body.siteId || null,
      serialNumber: body.serialNumber || null,
      location: body.location || null,
      installedAt: body.installedAt ? new Date(body.installedAt) : null,
      buildYear: body.buildYear ?? null,
      description: body.description || null,
      contactPerson: body.contactPerson || null,
      manufacturer: body.manufacturer || null,
      model: body.model || null,
    },
  })

  return NextResponse.json(plant, { status: 201 })
}
