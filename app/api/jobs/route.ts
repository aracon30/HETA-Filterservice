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
      { jobNumber: { contains: search, mode: 'insensitive' } },
      { customer: { name: { contains: search, mode: 'insensitive' } } },
    ]
  }

  const jobs = await prisma.serviceJob.findMany({
    where,
    include: {
      customer: { select: { id: true, name: true } },
      plant: { select: { id: true, name: true } },
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
  const { customerId, plantId, scheduledAt, technicianName, technicianId, description, duration, vehicle } = body

  // Generate job number
  const count = await prisma.serviceJob.count()
  const jobNumber = `SJ-${String(count + 1001).padStart(4, '0')}`

  // Determine checklist: plant override → plant-type template → default
  let checklistItems: { label: string; section?: string }[] = []
  if (plantId) {
    const plant = await prisma.plant.findUnique({
      where: { id: plantId },
      select: {
        type: true,
        checklistOverrides: { orderBy: { order: 'asc' } },
      },
    })
    if (plant) {
      if (plant.checklistOverrides.length > 0) {
        checklistItems = plant.checklistOverrides.map(o => ({ label: o.label, section: o.section }))
      } else {
        const plantType = await prisma.plantType.findUnique({
          where: { value: plant.type },
          include: { items: { orderBy: { order: 'asc' } } },
        })
        if (plantType && plantType.items.length > 0) {
          checklistItems = plantType.items.map(i => ({ label: i.label, section: i.section }))
        } else {
          const legacy = getChecklistForPlantType(plant.type)
          if (legacy.length > 0) checklistItems = legacy
        }
      }
    }
  }
  if (checklistItems.length === 0) {
    checklistItems = DEFAULT_CHECKLIST_ITEMS.map(label => ({ label }))
  }

  const job = await prisma.serviceJob.create({
    data: {
      jobNumber,
      customerId,
      plantId: plantId || null,
      scheduledAt: new Date(scheduledAt),
      technicianName,
      technicianId: technicianId || null,
      description,
      duration: duration ? Number(duration) : 480,
      vehicle: vehicle || null,
      checklistItems: {
        create: checklistItems,
      },
    },
    include: {
      customer: true,
      plant: true,
      checklistItems: true,
    },
  })

  return NextResponse.json(job, { status: 201 })
}
