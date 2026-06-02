import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DEFAULT_CHECKLIST_ITEMS } from '@/lib/constants'
import { getChecklistForPlantType } from '@/lib/plant-types'

// Replaces all checklist items of a job with the current template (plant override → type template → default).
// Only allowed for ADMIN and SERVICE_MANAGER on PLANNED jobs.
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const role = session.user.role as string
  if (!['ADMIN', 'SERVICE_MANAGER'].includes(role)) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const job = await prisma.serviceJob.findUnique({
    where: { id: params.id },
    select: {
      status: true,
      plantId: true,
      plant: {
        select: {
          type: true,
          checklistOverrides: { orderBy: { order: 'asc' } },
        },
      },
    },
  })

  if (!job) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
  if (job.status !== 'PLANNED') {
    return NextResponse.json({ error: 'Checkliste kann nur bei geplanten Einsätzen aktualisiert werden' }, { status: 409 })
  }

  // Resolve template (same priority as job creation)
  let newItems: { label: string; section?: string }[] = []

  if (job.plant) {
    if (job.plant.checklistOverrides.length > 0) {
      newItems = job.plant.checklistOverrides.map(o => ({ label: o.label, section: o.section }))
    } else {
      const plantType = await prisma.plantType.findUnique({
        where: { value: job.plant.type },
        include: { items: { orderBy: { order: 'asc' } } },
      })
      if (plantType && plantType.items.length > 0) {
        newItems = plantType.items.map(i => ({ label: i.label, section: i.section }))
      } else {
        const legacy = getChecklistForPlantType(job.plant.type)
        if (legacy.length > 0) newItems = legacy
      }
    }
  }

  if (newItems.length === 0) {
    newItems = DEFAULT_CHECKLIST_ITEMS.map(label => ({ label }))
  }

  await prisma.$transaction([
    prisma.checklistItem.deleteMany({ where: { jobId: params.id } }),
    prisma.checklistItem.createMany({
      data: newItems.map(item => ({
        jobId: params.id,
        label: item.label,
        section: item.section ?? null,
        status: 'open',
        checked: false,
      })),
    }),
  ])

  const updated = await prisma.serviceJob.findUnique({
    where: { id: params.id },
    include: { customer: true, plant: true, checklistItems: { orderBy: { id: 'asc' } } },
  })

  return NextResponse.json(updated)
}
