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
      plants: {
        include: {
          plant: {
            select: {
              id: true,
              name: true,
              type: true,
              checklistOverrides: { orderBy: { order: 'asc' } },
            },
          },
        },
        orderBy: { order: 'asc' },
      },
    },
  })

  if (!job) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
  if (!['PLANNED', 'IN_PROGRESS'].includes(job.status)) {
    return NextResponse.json({ error: 'Checkliste kann nur bei geplanten oder laufenden Einsätzen aktualisiert werden' }, { status: 409 })
  }

  type ChecklistEntry = { jobId: string; label: string; section: string | null; plantId: string | null; status: string; checked: boolean }
  let newItems: ChecklistEntry[] = []

  if (job.plants.length > 0) {
    for (const jp of job.plants) {
      const plant = jp.plant
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

      newItems = newItems.concat(items.map(i => ({
        jobId: params.id,
        label: i.label,
        section: i.section ?? null,
        plantId: plant.id,
        status: 'open',
        checked: false,
      })))
    }
  }

  if (newItems.length === 0) {
    newItems = DEFAULT_CHECKLIST_ITEMS.map(label => ({
      jobId: params.id,
      label,
      section: null,
      plantId: null,
      status: 'open',
      checked: false,
    }))
  }

  await prisma.$transaction([
    prisma.checklistItem.deleteMany({ where: { jobId: params.id } }),
    prisma.checklistItem.createMany({ data: newItems }),
  ])

  const updated = await prisma.serviceJob.findUnique({
    where: { id: params.id },
    include: {
      customer: true,
      plants: { include: { plant: true }, orderBy: { order: 'asc' } },
      checklistItems: { orderBy: { id: 'asc' } },
    },
  })

  return NextResponse.json(updated)
}
