import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkPermission, getScopeFilter } from '@/lib/permissions'
import { JobStatus } from '@prisma/client'
import { addMinutes } from 'date-fns'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }
  if (!(await checkPermission(session, 'jobs', 'view'))) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const technician = searchParams.get('technician')
  const status = searchParams.get('status')

  const scopeFilter = await getScopeFilter(session, 'jobs')

  const where: Record<string, unknown> = { ...scopeFilter }

  if (from || to) {
    where.scheduledAt = {}
    if (from) (where.scheduledAt as Record<string, unknown>).gte = new Date(from)
    if (to) (where.scheduledAt as Record<string, unknown>).lte = new Date(to)
  }

  if (technician) {
    where.technicians = { some: { userName: technician } }
  }

  if (status && status !== 'ALL') {
    where.status = status as JobStatus
  }

  const jobs = await prisma.serviceJob.findMany({
    where,
    include: {
      customer: { select: { id: true, name: true, address: true } },
      plants: { include: { plant: { select: { id: true, name: true, location: true } } }, orderBy: { order: 'asc' } },
      technicians: { orderBy: { order: 'asc' } },
    },
    orderBy: { scheduledAt: 'asc' },
  })

  const events = jobs.map((job) => ({
    id: job.id,
    orderNumber: job.orderNumber,
    title: job.customer.name,
    start: job.scheduledAt,
    end: addMinutes(job.scheduledAt, job.duration),
    status: job.status,
    technicians: job.technicians.map(t => ({ userId: t.userId, userName: t.userName })),
    vehicles: job.vehicles,
    duration: job.duration,
    description: job.description,
    customer: {
      name: job.customer.name,
      address: job.customer.address,
    },
    plants: job.plants.map(jp => ({ name: jp.plant.name, location: jp.plant.location })),
  }))

  return NextResponse.json(events)
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }
  if (!(await checkPermission(session, 'jobs', 'edit'))) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const body = await request.json()
  const { id, scheduledAt, duration } = body

  if (!id) {
    return NextResponse.json({ error: 'ID erforderlich' }, { status: 400 })
  }

  const updateData: Record<string, unknown> = {}
  if (scheduledAt !== undefined) updateData.scheduledAt = new Date(scheduledAt)
  if (duration !== undefined) updateData.duration = Number(duration)

  const job = await prisma.serviceJob.update({
    where: { id },
    data: updateData,
    include: {
      customer: { select: { id: true, name: true, address: true } },
      plants: { include: { plant: { select: { id: true, name: true, location: true } } }, orderBy: { order: 'asc' } },
      technicians: { orderBy: { order: 'asc' } },
    },
  })

  return NextResponse.json({
    id: job.id,
    orderNumber: job.orderNumber,
    title: job.customer.name,
    start: job.scheduledAt,
    end: addMinutes(job.scheduledAt, job.duration),
    status: job.status,
    technicians: job.technicians.map(t => ({ userId: t.userId, userName: t.userName })),
    vehicles: job.vehicles,
    duration: job.duration,
    customer: { name: job.customer.name, address: job.customer.address },
    plants: job.plants.map(jp => ({ name: jp.plant.name, location: jp.plant.location })),
  })
}
