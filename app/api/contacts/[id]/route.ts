import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const role = session.user.role as string
  if (!['ADMIN', 'SERVICE_MANAGER'].includes(role))
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })

  const body = await req.json()
  if (!body.name?.trim())
    return NextResponse.json({ error: 'Name ist erforderlich' }, { status: 400 })

  const contact = await prisma.contact.update({
    where: { id: params.id },
    data: {
      userId: body.userId || null,
      name: body.name.trim(),
      role: body.role?.trim() || null,
      email: body.email?.trim() || null,
      phone: body.phone?.trim() || null,
      isPrimary: Boolean(body.isPrimary),
      note: body.note?.trim() || null,
    },
    include: { user: { select: { id: true, name: true } } },
  })

  return NextResponse.json(contact)
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const role = session.user.role as string
  if (!['ADMIN', 'SERVICE_MANAGER'].includes(role))
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })

  await prisma.contact.delete({ where: { id: params.id } })

  return NextResponse.json({ success: true })
}
