import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkPermission } from '@/lib/permissions'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  if (!(await checkPermission(session, 'customers', 'view')))
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })

  const customerId = request.nextUrl.searchParams.get('customerId')

  const checks = await prisma.acquisitionCheck.findMany({
    where: customerId ? { customerId } : undefined,
    include: { customer: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(checks)
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  if (!(await checkPermission(session, 'customers', 'create')))
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })

  const body = await request.json()
  const { customerId, plants, mood, nextStep, note } = body

  if (!customerId) return NextResponse.json({ error: 'Kunden-ID fehlt' }, { status: 400 })

  const check = await prisma.acquisitionCheck.create({
    data: {
      customerId,
      plants: plants ?? [],
      mood,
      nextStep,
      note,
      createdById: session.user.id,
      createdByName: session.user.name ?? '',
    },
    include: { customer: { select: { id: true, name: true } } },
  })

  return NextResponse.json(check, { status: 201 })
}
