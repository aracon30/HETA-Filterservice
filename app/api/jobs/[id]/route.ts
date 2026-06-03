import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { JobStatus } from '@prisma/client'
import { checkPermission } from '@/lib/permissions'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  if (!(await checkPermission(session, 'jobs', 'view'))) return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })

  const job = await prisma.serviceJob.findUnique({
    where: { id: params.id },
    include: {
      customer: true,
      plants: { include: { plant: true }, orderBy: { order: 'asc' } },
      technicians: { orderBy: { order: 'asc' } },
      checklistItems: { orderBy: { id: 'asc' } },
    },
  })

  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(job)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  if (!(await checkPermission(session, 'jobs', 'edit'))) return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })

  const body = await request.json()
  const {
    status, findings, recommendations, checklistItems,
    duration, vehicles, scheduledAt, technicianIds,
    technicianSignature, customerSignature, complete, workTimeEntries,
  } = body

  const updateData: Record<string, unknown> = {}

  if (status !== undefined) updateData.status = status as JobStatus
  if (findings !== undefined) updateData.findings = findings
  if (recommendations !== undefined) updateData.recommendations = recommendations
  if (duration !== undefined) updateData.duration = Number(duration)
  if (vehicles !== undefined) updateData.vehicles = Array.isArray(vehicles) ? vehicles.filter(Boolean) : []
  if (scheduledAt !== undefined) updateData.scheduledAt = new Date(scheduledAt)
  if (technicianSignature !== undefined) updateData.technicianSignature = technicianSignature
  if (customerSignature !== undefined) updateData.customerSignature = customerSignature
  if (workTimeEntries !== undefined) updateData.workTimeEntries = workTimeEntries

  if (complete) {
    updateData.status = 'COMPLETED'
    updateData.completedAt = new Date()
  } else if (status === 'COMPLETED') {
    updateData.completedAt = new Date()
  } else if (status === 'PLANNED' || status === 'IN_PROGRESS') {
    updateData.completedAt = null
  }

  const job = await prisma.$transaction(async (tx) => {
    await tx.serviceJob.update({ where: { id: params.id }, data: updateData })

    // Update technician assignments if provided
    if (technicianIds !== undefined && Array.isArray(technicianIds)) {
      await tx.serviceJobTechnician.deleteMany({ where: { jobId: params.id } })
      if (technicianIds.length > 0) {
        const techUsers = await tx.user.findMany({ where: { id: { in: technicianIds } }, select: { id: true, name: true } })
        await tx.serviceJobTechnician.createMany({
          data: techUsers.map((t, idx) => ({ jobId: params.id, userId: t.id, userName: t.name, order: idx })),
        })
      }
    }

    if (checklistItems && Array.isArray(checklistItems)) {
      for (const item of checklistItems) {
        await tx.checklistItem.update({
          where: { id: item.id },
          data: {
            status: item.status ?? 'open',
            checked: item.status === 'io',
            comment: item.comment ?? null,
            photoUrl: item.photoUrl ?? undefined,
          },
        })
      }
    }

    return tx.serviceJob.findUnique({
      where: { id: params.id },
      include: { customer: true, plants: { include: { plant: true }, orderBy: { order: 'asc' } }, checklistItems: { orderBy: { id: 'asc' } } },
    })
  })

  return NextResponse.json(job)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  if (!(await checkPermission(session, 'jobs', 'delete'))) return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })

  await prisma.$transaction([
    prisma.checklistItem.deleteMany({ where: { jobId: params.id } }),
    prisma.serviceJob.delete({ where: { id: params.id } }),
  ])

  return NextResponse.json({ success: true })
}
