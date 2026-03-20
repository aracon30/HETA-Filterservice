import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { DEFAULT_CHECKLIST_ITEMS } from '@/lib/constants'
import { JobStatus } from '@prisma/client'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const search = searchParams.get('search')

  const where: Record<string, unknown> = {}

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
  const body = await request.json()
  const { customerId, plantId, scheduledAt, technicianName, description } = body

  // Generate job number
  const count = await prisma.serviceJob.count()
  const jobNumber = `SJ-${String(count + 1001).padStart(4, '0')}`

  const job = await prisma.serviceJob.create({
    data: {
      jobNumber,
      customerId,
      plantId: plantId || null,
      scheduledAt: new Date(scheduledAt),
      technicianName,
      description,
      checklistItems: {
        create: DEFAULT_CHECKLIST_ITEMS.map((label) => ({ label })),
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
