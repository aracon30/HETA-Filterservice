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
  if (!session?.user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }
  if (!(await checkPermission(session, 'jobs', 'view'))) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const job = await prisma.serviceJob.findUnique({
    where: { id: params.id },
    include: {
      customer: true,
      plant: true,
      checklistItems: { orderBy: { id: 'asc' } },
    },
  })

  if (!job) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json(job)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }
  if (!(await checkPermission(session, 'jobs', 'edit'))) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const body = await request.json()
  const { status, findings, recommendations, checklistItems, duration, vehicle, scheduledAt, technicianName } = body

  const updateData: Record<string, unknown> = {}

  if (status !== undefined) updateData.status = status as JobStatus
  if (findings !== undefined) updateData.findings = findings
  if (recommendations !== undefined) updateData.recommendations = recommendations
  if (duration !== undefined) updateData.duration = Number(duration)
  if (vehicle !== undefined) updateData.vehicle = vehicle || null
  if (scheduledAt !== undefined) updateData.scheduledAt = new Date(scheduledAt)
  if (technicianName !== undefined) updateData.technicianName = technicianName
  if (status === 'COMPLETED' && !body.completedAt) {
    updateData.completedAt = new Date()
  }
  if (status === 'PLANNED' || status === 'IN_PROGRESS') {
    updateData.completedAt = null
  }

  const job = await prisma.$transaction(async (tx) => {
    const updatedJob = await tx.serviceJob.update({
      where: { id: params.id },
      data: updateData,
    })

    if (checklistItems && Array.isArray(checklistItems)) {
      for (const item of checklistItems) {
        await tx.checklistItem.update({
          where: { id: item.id },
          data: { checked: item.checked },
        })
      }
    }

    return tx.serviceJob.findUnique({
      where: { id: params.id },
      include: {
        customer: true,
        plant: true,
        checklistItems: { orderBy: { id: 'asc' } },
      },
    })
  })

  return NextResponse.json(job)
}
