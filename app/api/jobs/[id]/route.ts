import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { JobStatus } from '@prisma/client'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
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
  const body = await request.json()
  const { status, findings, recommendations, checklistItems } = body

  const updateData: Record<string, unknown> = {}

  if (status !== undefined) updateData.status = status as JobStatus
  if (findings !== undefined) updateData.findings = findings
  if (recommendations !== undefined) updateData.recommendations = recommendations
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
