import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkPermission } from '@/lib/permissions'

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const params = await ctx.params
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  if (!(await checkPermission(session, 'jobs', 'view'))) return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })

  const materials = await prisma.jobMaterial.findMany({
    where: { jobId: params.id },
    orderBy: { order: 'asc' },
  })

  return NextResponse.json(materials)
}

export async function PUT(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const params = await ctx.params
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  if (!(await checkPermission(session, 'jobs', 'edit'))) return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })

  const body = await request.json()
  const { materials } = body as {
    materials: {
      id?: string
      plantId: string
      plantName: string
      label: string
      partNumber?: string | null
      quantity: number
      status: string
      deliveryDate?: string | null
      notes?: string | null
      order: number
    }[]
  }

  if (!Array.isArray(materials)) {
    return NextResponse.json({ error: 'materials muss ein Array sein' }, { status: 400 })
  }

  const clientUpdatedAt = (body as { clientUpdatedAt?: string }).clientUpdatedAt
  if (clientUpdatedAt) {
    const current = await prisma.serviceJob.findUnique({ where: { id: params.id }, select: { updatedAt: true } })
    if (!current) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
    if (new Date(clientUpdatedAt).getTime() !== current.updatedAt.getTime()) {
      return NextResponse.json(
        { error: 'Konflikt: Der Einsatz wurde zwischenzeitlich von jemand anderem geändert. Bitte Seite neu laden.' },
        { status: 409 }
      )
    }
  }

  const updated = await prisma.$transaction([
    prisma.jobMaterial.deleteMany({ where: { jobId: params.id } }),
    prisma.jobMaterial.createMany({
      data: materials.map((m, idx) => ({
        jobId: params.id,
        plantId: m.plantId,
        plantName: m.plantName,
        label: m.label,
        partNumber: m.partNumber ?? null,
        quantity: m.quantity,
        status: m.status,
        deliveryDate: m.deliveryDate ? new Date(m.deliveryDate) : null,
        notes: m.notes ?? null,
        order: m.order ?? idx,
      })),
    }),
  ])

  const result = await prisma.jobMaterial.findMany({
    where: { jobId: params.id },
    orderBy: { order: 'asc' },
  })

  return NextResponse.json(result)
}
