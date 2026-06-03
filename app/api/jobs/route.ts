import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DEFAULT_CHECKLIST_ITEMS } from '@/lib/constants'
import { getChecklistForPlantType } from '@/lib/plant-types'
import { JobStatus } from '@prisma/client'
import { checkPermission, getScopeFilter, getPermissions } from '@/lib/permissions'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }
  if (!(await checkPermission(session, 'jobs', 'view'))) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const search = searchParams.get('search')
  const customerIdParam = searchParams.get('customerId')

  const perm = await getPermissions(session.user.role, 'jobs')
  const scopeFilter = getScopeFilter(session, 'jobs', perm?.scope ?? null)

  const where: Record<string, unknown> = { ...scopeFilter }

  if (customerIdParam) where.customerId = customerIdParam

  if (status && status !== 'ALL') {
    where.status = status as JobStatus
  }

  if (search) {
    where.OR = [
      { orderNumber: { contains: search, mode: 'insensitive' } },
      { customer: { name: { contains: search, mode: 'insensitive' } } },
      { technicians: { some: { userName: { contains: search, mode: 'insensitive' } } } },
    ]
  }

  const jobs = await prisma.serviceJob.findMany({
    where,
    include: {
      customer: { select: { id: true, name: true } },
      plants: { include: { plant: { select: { id: true, name: true, type: true } } }, orderBy: { order: 'asc' } },
      technicians: { orderBy: { order: 'asc' } },
    },
    orderBy: { scheduledAt: 'desc' },
  })

  return NextResponse.json(jobs)
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }
  if (!(await checkPermission(session, 'jobs', 'create'))) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const body = await request.json()
  const { customerId, plantIds, technicianIds, vehicles, scheduledAt, description, duration, orderNumber } = body

  if (!orderNumber) {
    return NextResponse.json({ error: 'Auftragsnummer ist erforderlich' }, { status: 400 })
  }

  const selectedPlantIds: string[] = Array.isArray(plantIds) ? plantIds : []
  const selectedTechnicianIds: string[] = Array.isArray(technicianIds) ? technicianIds : []
  const selectedVehicles: string[] = Array.isArray(vehicles) ? vehicles.filter(Boolean) : []

  // Build checklist items per plant (override → type template → default)
  type ChecklistEntry = { label: string; section?: string; plantId?: string }
  let allChecklistItems: ChecklistEntry[] = []

  if (selectedPlantIds.length > 0) {
    for (const pid of selectedPlantIds) {
      const plant = await prisma.plant.findUnique({
        where: { id: pid },
        select: { id: true, name: true, type: true, checklistOverrides: { orderBy: { order: 'asc' } } },
      })
      if (!plant) continue

      let items: { label: string; section?: string }[] = []
      if (plant.checklistOverrides.length > 0) {
        items = plant.checklistOverrides.map(o => ({ label: o.label, section: o.section }))
      } else {
        const plantType = await prisma.plantType.findUnique({
          where: { value: plant.type },
          include: { items: { orderBy: { order: 'asc' } } },
        })
        if (plantType && plantType.items.length > 0) {
          items = plantType.items.map(i => ({ label: i.label, section: i.section }))
        } else {
          const legacy = getChecklistForPlantType(plant.type)
          if (legacy.length > 0) items = legacy
        }
      }
      if (items.length === 0) items = DEFAULT_CHECKLIST_ITEMS.map(l => ({ label: l }))

      allChecklistItems = allChecklistItems.concat(items.map(i => ({ ...i, plantId: plant.id })))
    }
  }

  if (allChecklistItems.length === 0) {
    allChecklistItems = DEFAULT_CHECKLIST_ITEMS.map(label => ({ label }))
  }

  // Build part items per plant type template
  type PartEntry = { label: string; partNumber?: string; quantity: number }
  let allPartItems: PartEntry[] = []

  if (selectedPlantIds.length > 0) {
    for (const pid of selectedPlantIds) {
      const plant = await prisma.plant.findUnique({ where: { id: pid }, select: { type: true } })
      if (!plant) continue
      const plantType = await prisma.plantType.findUnique({
        where: { value: plant.type },
        include: { partItems: { orderBy: { order: 'asc' } } },
      })
      if (plantType && plantType.partItems.length > 0) {
        allPartItems = allPartItems.concat(plantType.partItems.map(i => ({
          label: i.label,
          partNumber: i.partNumber ?? undefined,
          quantity: i.quantity,
        })))
      }
    }
  }

  // Resolve technician names for denormalization
  const technicianRecords = selectedTechnicianIds.length > 0
    ? await prisma.user.findMany({ where: { id: { in: selectedTechnicianIds } }, select: { id: true, name: true } })
    : []

  const job = await prisma.serviceJob.create({
    data: {
      orderNumber,
      customerId,
      scheduledAt: new Date(scheduledAt),
      description,
      duration: duration ? Number(duration) : 480,
      vehicles: selectedVehicles,
      plants: selectedPlantIds.length > 0
        ? { create: selectedPlantIds.map((pid, idx) => ({ plantId: pid, order: idx })) }
        : undefined,
      technicians: technicianRecords.length > 0
        ? { create: technicianRecords.map((t, idx) => ({ userId: t.id, userName: t.name, order: idx })) }
        : undefined,
      checklistItems: { create: allChecklistItems },
      parts: allPartItems.length > 0
        ? { create: allPartItems.map((p, idx) => ({ ...p, order: idx, status: 'TO_ORDER' })) }
        : undefined,
    },
    include: {
      customer: true,
      plants: { include: { plant: true }, orderBy: { order: 'asc' } },
      technicians: { orderBy: { order: 'asc' } },
      checklistItems: true,
      parts: true,
    },
  })

  return NextResponse.json(job, { status: 201 })
}
