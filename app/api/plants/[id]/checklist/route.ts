import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const overrides = await prisma.plantChecklistOverride.findMany({
    where: { plantId: params.id },
    orderBy: { order: 'asc' },
  })

  return NextResponse.json(overrides)
}

// Replace all checklist overrides for this plant
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const role = session.user.role as string
  if (!['ADMIN', 'SERVICE_MANAGER'].includes(role)) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const body = await req.json()
  const items: { section: string; label: string; order: number }[] = body.items ?? []

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
    prisma.plantChecklistOverride.deleteMany({ where: { plantId: params.id } }),
    ...(items.length > 0
      ? [prisma.plantChecklistOverride.createMany({
          data: items.map((item, idx) => ({
            plantId: params.id,
            section: item.section,
            label: item.label,
            order: item.order ?? idx,
          })),
        })]
      : []),
  ])

  const updated = await prisma.plantChecklistOverride.findMany({
    where: { plantId: params.id },
    orderBy: { order: 'asc' },
  })

  return NextResponse.json(updated)
}

// Delete all overrides (reset to type default)
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const role = session.user.role as string
  if (!['ADMIN', 'SERVICE_MANAGER'].includes(role)) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  await prisma.plantChecklistOverride.deleteMany({ where: { plantId: params.id } })

  return NextResponse.json({ success: true })
}
