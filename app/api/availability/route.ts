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
  const technicianIdsParam = searchParams.get('technicianIds') ?? ''
  const vehiclesParam = searchParams.get('vehicles') ?? ''
  const excludeJobId = searchParams.get('excludeJobId')

  if (!dateStr) return NextResponse.json({ technicianConflicts: [], vehicleConflicts: [] })

  const start = new Date(dateStr)
  const end = new Date(start.getTime() + duration * 60 * 1000)

  const technicianIds = technicianIdsParam ? technicianIdsParam.split(',').filter(Boolean) : []
  const vehicles = vehiclesParam ? vehiclesParam.split(',').filter(Boolean) : []

  const baseJobWhere = {
    status: { in: ['PLANNED', 'IN_PROGRESS'] as ('PLANNED' | 'IN_PROGRESS')[] },
    id: excludeJobId ? { not: excludeJobId } : undefined,
    scheduledAt: { lt: end },
  }

  // Technician conflicts: find jobs via join table
  let technicianConflicts: object[] = []
  if (technicianIds.length > 0) {
    const assignments = await prisma.serviceJobTechnician.findMany({
      where: {
        userId: { in: technicianIds },
        job: baseJobWhere,
      },
      include: {
        job: {
          include: {
            customer: { select: { name: true } },
            technicians: { orderBy: { order: 'asc' } },
          },
        },
      },
    })

    technicianConflicts = assignments
      .filter(a => {
        const jobEnd = new Date(a.job.scheduledAt.getTime() + a.job.duration * 60 * 1000)
        return jobEnd > start
      })
      .map(a => ({
        id: a.job.id,
        orderNumber: a.job.orderNumber,
        scheduledAt: a.job.scheduledAt,
        duration: a.job.duration,
        technicians: a.job.technicians.map(t => ({ userId: t.userId, userName: t.userName })),
        vehicles: a.job.vehicles,
        customer: a.job.customer,
        conflictingTechnicianId: a.userId,
        conflictingTechnicianName: a.userName,
      }))
  }

  // Vehicle conflicts: find jobs that share any selected vehicle
  let vehicleConflicts: object[] = []
  if (vehicles.length > 0) {
    const jobs = await prisma.serviceJob.findMany({
      where: {
        ...baseJobWhere,
        vehicles: { hasSome: vehicles },
      },
      include: {
        customer: { select: { name: true } },
        technicians: { orderBy: { order: 'asc' } },
      },
    })

    vehicleConflicts = jobs
      .filter(j => {
        const jobEnd = new Date(j.scheduledAt.getTime() + j.duration * 60 * 1000)
        return jobEnd > start
      })
      .map(j => ({
        id: j.id,
        orderNumber: j.orderNumber,
        scheduledAt: j.scheduledAt,
        duration: j.duration,
        technicians: j.technicians.map(t => ({ userId: t.userId, userName: t.userName })),
        vehicles: j.vehicles,
        customer: j.customer,
        conflictingVehicles: j.vehicles.filter(v => vehicles.includes(v)),
      }))
  }

  return NextResponse.json({ technicianConflicts, vehicleConflicts })
}
