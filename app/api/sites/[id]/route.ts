import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkPermission } from '@/lib/permissions'

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  if (!(await checkPermission(session, 'sites', 'view')))
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })

  const site = await prisma.site.findUnique({
    where: { id: params.id },
    include: {
      contacts: { orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }] },
      hotels: { orderBy: { name: 'asc' } },
      plants: { orderBy: { name: 'asc' } },
    },
  })

  if (!site) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

  // External users may only see their own customer's site
  if (session.user.customerId && site.customerId !== session.user.customerId)
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })

  return NextResponse.json(site)
}

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

  const site = await prisma.site.update({
    where: { id: params.id },
    data: {
      name: body.name.trim(),
      address: body.address?.trim() || null,
      zip: body.zip?.trim() || null,
      city: body.city?.trim() || null,
      note: body.note?.trim() || null,
    },
  })

  return NextResponse.json(site)
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const role = session.user.role as string
  if (!['ADMIN', 'SERVICE_MANAGER'].includes(role))
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })

  // Plants fall back to "no site" (onDelete: SetNull); site contacts/hotels cascade.
  await prisma.site.delete({ where: { id: params.id } })

  return NextResponse.json({ success: true })
}
