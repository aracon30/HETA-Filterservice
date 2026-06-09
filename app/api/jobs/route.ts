import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DEFAULT_CHECKLIST_ITEMS } from '@/lib/constants'
import { getChecklistForPlantType } from '@/lib/plant-types'
import { JobStatus } from '@prisma/client'
import { checkPermission, getScopeFilter } from '@/lib/permissions'

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

  const scopeFilter = getScopeFilter(session, 'jobs')

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
      jobMaterials: { select: { status: true } },
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

  // Build job materials snapshot from plant materials
  type JobMatEntry = { plantId: string; plantName: string; label: string; partNumber?: string | null; quantity: number; status: string; order: number }
  const allJobMaterials: JobMatEntry[] = []

  if (selectedPlantIds.length > 0) {
    // Single query for all plants with both checklist overrides and materials
    const plants = await prisma.plant.findMany({
      where: { id: { in: selectedPlantIds } },
      select: {
        id: true, name: true, type: true,
        checklistOverrides: { orderBy: { order: 'asc' } },
        materials: { orderBy: { order: 'asc' } },
      },
    })

    const typesNeeded = Array.from(new Set(plants.filter(p => p.checklistOverrides.length === 0).map(p => p.type)))
    const plantTypesMap: Record<string, { items: { label: string; section: string | null }[] }> = typesNeeded.length > 0
      ? Object.fromEntries(
          (await prisma.plantType.findMany({
            where: { value: { in: typesNeeded } },
            include: { items: { orderBy: { order: 'asc' } } },
          })).map(pt => [pt.value, pt])
        )
      : {}

    for (const pid of selectedPlantIds) {
      const plant = plants.find(p => p.id === pid)
      if (!plant) continue

      let items: { label: string; section?: string }[] = []
      if (plant.checklistOverrides.length > 0) {
        items = plant.checklistOverrides.map(o => ({ label: o.label, section: o.section ?? undefined }))
      } else {
        const plantType = plantTypesMap[plant.type]
        if (plantType && plantType.items.length > 0) {
          items = plantType.items.map(i => ({ label: i.label, section: i.section ?? undefined }))
        } else {
          const legacy = getChecklistForPlantType(plant.type)
          if (legacy.length > 0) items = legacy
        }
      }
      if (items.length === 0) items = DEFAULT_CHECKLIST_ITEMS.map(l => ({ label: l }))
      allChecklistItems = allChecklistItems.concat(items.map(i => ({ ...i, plantId: plant.id })))

      plant.materials.forEach(m => {
        allJobMaterials.push({
          plantId: plant.id,
          plantName: plant.name,
          label: m.label,
          partNumber: m.partNumber,
          quantity: m.quantity,
          status: m.status,
          order: allJobMaterials.length,
        })
      })
    }
  }

  if (allChecklistItems.length === 0) {
    allChecklistItems = DEFAULT_CHECKLIST_ITEMS.map(label => ({ label }))
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
      jobMaterials: allJobMaterials.length > 0
        ? { create: allJobMaterials }
        : undefined,
    },
    include: {
      customer: true,
      plants: { include: { plant: true }, orderBy: { order: 'asc' } },
      technicians: { orderBy: { order: 'asc' } },
      checklistItems: true,
      jobMaterials: { orderBy: { order: 'asc' } },
    },
  })

  return NextResponse.json(job, { status: 201 })
}
