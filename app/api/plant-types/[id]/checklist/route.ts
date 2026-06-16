import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const items = await prisma.plantTypeChecklistItem.findMany({
    where: { plantTypeId: params.id },
    orderBy: { order: 'asc' },
  })

  return NextResponse.json(items)
}

// Replace all checklist items for this plant type
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const role = session.user.role as string
  if (!['ADMIN', 'SERVICE_MANAGER'].includes(role)) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const body = await req.json()
  const items: { section: string; label: string; order: number }[] = body.items ?? []

  await prisma.$transaction([
    prisma.plantTypeChecklistItem.deleteMany({ where: { plantTypeId: params.id } }),
    prisma.plantTypeChecklistItem.createMany({
      data: items.map((item, idx) => ({
        plantTypeId: params.id,
        section: item.section,
        label: item.label,
        order: item.order ?? idx,
      })),
    }),
  ])

  const updated = await prisma.plantTypeChecklistItem.findMany({
    where: { plantTypeId: params.id },
    orderBy: { order: 'asc' },
  })

  return NextResponse.json(updated)
}
