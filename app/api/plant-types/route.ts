import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const plantTypes = await prisma.plantType.findMany({
    include: { items: { orderBy: { order: 'asc' } } },
    orderBy: { label: 'asc' },
  })

  return NextResponse.json(plantTypes)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const role = session.user.role as string
  if (!['ADMIN', 'SERVICE_MANAGER'].includes(role)) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const body = await req.json()
  const { value, label } = body

  if (!value || !label) {
    return NextResponse.json({ error: 'Wert und Bezeichnung erforderlich' }, { status: 400 })
  }

  try {
    const plantType = await prisma.plantType.create({
      data: { value, label },
      include: { items: true },
    })
    return NextResponse.json(plantType, { status: 201 })
  } catch (err) {
    const e = err as { code?: string }
    if (e.code === 'P2002') {
      return NextResponse.json({ error: 'Anlagentyp mit diesem Wert existiert bereits' }, { status: 409 })
    }
    throw err
  }
}
