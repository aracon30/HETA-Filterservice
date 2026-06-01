import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const dateStr = searchParams.get('date')
  const duration = Number(searchParams.get('duration') ?? 480)
  const technicianId = searchParams.get('technicianId')
  const vehicle = searchParams.get('vehicle')
  const excludeJobId = searchParams.get('excludeJobId')

  if (!dateStr) return NextResponse.json({ technicianConflicts: [], vehicleConflicts: [] })

  const start = new Date(dateStr)
  const end = new Date(start.getTime() + duration * 60 * 1000)

  // Find jobs that overlap with [start, end]
  // Overlap: jobStart < end AND jobEnd > start
  const baseWhere = {
    status: { in: ['PLANNED', 'IN_PROGRESS'] as ('PLANNED' | 'IN_PROGRESS')[] },
    id: excludeJobId ? { not: excludeJobId } : undefined,
    scheduledAt: { lt: end },
  }

  const overlapping = await prisma.serviceJob.findMany({
    where: baseWhere,
    select: {
      id: true,
      jobNumber: true,
      scheduledAt: true,
      duration: true,
      technicianName: true,
      technicianId: true,
      vehicle: true,
      customer: { select: { name: true } },
    },
  })

  // Filter to jobs where jobEnd > start (Prisma can't compute derived end time)
  const realOverlaps = overlapping.filter((j) => {
    const jobEnd = new Date(j.scheduledAt.getTime() + j.duration * 60 * 1000)
    return jobEnd > start
  })

  const technicianConflicts = technicianId
    ? realOverlaps.filter((j) => j.technicianId === technicianId)
    : []

  const vehicleConflicts = vehicle
    ? realOverlaps.filter((j) => j.vehicle === vehicle)
    : []

  return NextResponse.json({ technicianConflicts, vehicleConflicts })
}
