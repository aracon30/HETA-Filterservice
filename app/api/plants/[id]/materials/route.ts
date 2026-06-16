import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const WRITE_ROLES = ['ADMIN', 'SERVICE_MANAGER', 'SERVICE_TECHNICIAN']

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const materials = await prisma.plantMaterial.findMany({
    where: { plantId: params.id },
    orderBy: { order: 'asc' },
  })
  return NextResponse.json(materials)
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  if (!WRITE_ROLES.includes(session.user.role as string)) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const body = await req.json()
  const items: { label: string; partNumber?: string; quantity: number; status: string; deliveryDate?: string | null; notes?: string | null; order: number }[] = body.materials ?? []

  if (body.clientUpdatedAt) {
    const current = await prisma.plant.findUnique({ where: { id: params.id }, select: { updatedAt: true } })
    if (!current) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
    if (new Date(body.clientUpdatedAt).getTime() !== current.updatedAt.getTime()) {
      return NextResponse.json(
        { error: 'Konflikt: Die Anlage wurde zwischenzeitlich von jemand anderem geändert. Bitte Seite neu laden.' },
        { status: 409 }
      )
    }
  }

  await prisma.$transaction([
    prisma.plantMaterial.deleteMany({ where: { plantId: params.id } }),
    prisma.plantMaterial.createMany({
      data: items.map((item, idx) => ({
        plantId: params.id,
        label: item.label,
        partNumber: item.partNumber ?? null,
        quantity: item.quantity ?? 1,
        status: item.status ?? 'TO_ORDER',
        deliveryDate: item.deliveryDate ? new Date(item.deliveryDate) : null,
        notes: item.notes ?? null,
        order: item.order ?? idx,
      })),
    }),
  ])

  const updated = await prisma.plantMaterial.findMany({
    where: { plantId: params.id },
    orderBy: { order: 'asc' },
  })
  return NextResponse.json(updated)
}

// Initialize materials from plant-type templates
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  if (!WRITE_ROLES.includes(session.user.role as string)) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const plant = await prisma.plant.findUnique({ where: { id: params.id }, select: { type: true } })
  if (!plant) return NextResponse.json({ error: 'Anlage nicht gefunden' }, { status: 404 })

  const plantType = await prisma.plantType.findUnique({
    where: { value: plant.type },
    include: { partItems: { orderBy: { order: 'asc' } } },
  })
  if (!plantType || plantType.partItems.length === 0) {
    return NextResponse.json({ error: 'Keine Vorlagen für diesen Anlagentyp' }, { status: 404 })
  }

  await prisma.$transaction([
    prisma.plantMaterial.deleteMany({ where: { plantId: params.id } }),
    prisma.plantMaterial.createMany({
      data: plantType.partItems.map((item, idx) => ({
        plantId: params.id,
        label: item.label,
        partNumber: item.partNumber ?? null,
        quantity: item.quantity,
        status: 'TO_ORDER',
        order: idx,
      })),
    }),
  ])

  const created = await prisma.plantMaterial.findMany({
    where: { plantId: params.id },
    orderBy: { order: 'asc' },
  })
  return NextResponse.json(created)
}
