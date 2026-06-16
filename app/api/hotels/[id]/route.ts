import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const role = session.user.role as string
  if (!['ADMIN', 'SERVICE_MANAGER'].includes(role))
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })

  const body = await request.json()
  if (!body.name?.trim())
    return NextResponse.json({ error: 'Name ist erforderlich' }, { status: 400 })

  const hotel = await prisma.hotel.update({
    where: { id: params.id },
    data: {
      name: body.name.trim(),
      address: body.address?.trim() || null,
      phone: body.phone?.trim() || null,
      note: body.note?.trim() || null,
    },
  })

  return NextResponse.json(hotel)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const role = session.user.role as string
  if (!['ADMIN', 'SERVICE_MANAGER'].includes(role))
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })

  await prisma.hotel.delete({ where: { id: params.id } })

  return NextResponse.json({ success: true })
}
