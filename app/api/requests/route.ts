import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkPermission, getScopeFilter } from '@/lib/permissions'
import { RequestType, RequestPriority } from '@prisma/client'

const MANAGER_ROLES = ['ADMIN', 'SERVICE_MANAGER']
const REQUEST_CREATOR_ROLES = ['MAINTENANCE_MANAGER', 'BUYER']

async function generateRequestNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `ANF-${year}-`
  const latest = await prisma.plantRequest.findFirst({
    where: { requestNumber: { startsWith: prefix } },
    orderBy: { requestNumber: 'desc' },
    select: { requestNumber: true },
  })
  const next = latest
    ? parseInt(latest.requestNumber.replace(prefix, ''), 10) + 1
    : 1
  return `${prefix}${String(next).padStart(3, '0')}`
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }
  if (!(await checkPermission(session, 'requests', 'view'))) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const search = searchParams.get('search')
  const plantId = searchParams.get('plantId')

  const scopeFilter = await getScopeFilter(session, 'requests')
  const where: Record<string, unknown> = { ...scopeFilter }

  if (status && status !== 'ALL') {
    where.status = status
  }

  if (plantId) {
    where.plants = { some: { plantId } }
  }

  if (search) {
    where.OR = [
      { requestNumber: { contains: search, mode: 'insensitive' } },
      { title: { contains: search, mode: 'insensitive' } },
      { offerNumber: { contains: search, mode: 'insensitive' } },
    ]
  }

  const requests = await prisma.plantRequest.findMany({
    where,
    include: {
      customer: { select: { id: true, name: true } },
      plants: { select: { plantId: true, plantName: true } },
      messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      offerPdfs: { orderBy: { createdAt: 'desc' } },
    },
    orderBy: { updatedAt: 'desc' },
  })

  return NextResponse.json(requests)
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }

  const role = session.user.role as string
  if (!REQUEST_CREATOR_ROLES.includes(role) && !MANAGER_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }
  if (!(await checkPermission(session, 'requests', 'create'))) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const customerId = session.user.customerId
  if (!customerId) {
    return NextResponse.json({ error: 'Kein Unternehmen zugeordnet' }, { status: 400 })
  }

  const body = await request.json()
  const { title, description, type, priority, plantIds } = body

  if (!title?.trim()) {
    return NextResponse.json({ error: 'Titel ist erforderlich' }, { status: 400 })
  }
  if (!description?.trim()) {
    return NextResponse.json({ error: 'Beschreibung ist erforderlich' }, { status: 400 })
  }

  const selectedPlantIds: string[] = Array.isArray(plantIds) ? plantIds : []

  let plantsData: { plantId: string; plantName: string }[] = []
  if (selectedPlantIds.length > 0) {
    const plants = await prisma.plant.findMany({
      where: { id: { in: selectedPlantIds }, customerId },
      select: { id: true, name: true },
    })
    plantsData = plants.map(p => ({ plantId: p.id, plantName: p.name }))
  }

  const requestNumber = await generateRequestNumber()

  const newRequest = await prisma.plantRequest.create({
    data: {
      requestNumber,
      title: title.trim(),
      description: description.trim(),
      type: (type as RequestType) ?? 'SONSTIGES',
      priority: (priority as RequestPriority) ?? 'NORMAL',
      customerId,
      createdById: session.user.id,
      createdByName: session.user.name ?? 'Unbekannt',
      plants: plantsData.length > 0
        ? { create: plantsData }
        : undefined,
    },
    include: {
      customer: { select: { id: true, name: true } },
      plants: { select: { plantId: true, plantName: true } },
      messages: true,
      offerPdfs: true,
    },
  })

  return NextResponse.json(newRequest, { status: 201 })
}
