import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkPermission, getScopeFilter } from '@/lib/permissions'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  if (!(await checkPermission(session, 'contacts', 'view')))
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })

  const sp = request.nextUrl.searchParams
  const customerId = sp.get('customerId')
  const siteId = sp.get('siteId')
  const plantId = sp.get('plantId')
  if (!customerId) return NextResponse.json({ error: 'customerId fehlt' }, { status: 400 })

  // External users may only see their own customer's contacts
  if (session.user.customerId && session.user.customerId !== customerId)
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })

  const scopeFilter = await getScopeFilter(session, 'contacts')

  const where: Record<string, unknown> = { ...scopeFilter, customerId }
  if (siteId) where.siteId = siteId
  if (plantId) where.plantId = plantId

  const contacts = await prisma.contact.findMany({
    where,
    orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }],
    include: { user: { select: { id: true, name: true } } },
  })

  return NextResponse.json(contacts)
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const role = session.user.role as string
  if (!['ADMIN', 'SERVICE_MANAGER'].includes(role))
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })

  const body = await request.json()
  if (!body.customerId || !body.name?.trim())
    return NextResponse.json({ error: 'customerId und name sind erforderlich' }, { status: 400 })

  // A contact hangs on at most one level: site OR plant (none = company-wide)
  if (body.siteId && body.plantId)
    return NextResponse.json({ error: 'Kontakt kann nicht gleichzeitig Standort und Anlage zugeordnet sein' }, { status: 400 })

  // Validate the referenced site/plant belongs to the given customer
  if (body.siteId) {
    const site = await prisma.site.findUnique({ where: { id: body.siteId }, select: { customerId: true } })
    if (!site || site.customerId !== body.customerId)
      return NextResponse.json({ error: 'Ungültiger Standort' }, { status: 400 })
  }
  if (body.plantId) {
    const plant = await prisma.plant.findUnique({ where: { id: body.plantId }, select: { customerId: true } })
    if (!plant || plant.customerId !== body.customerId)
      return NextResponse.json({ error: 'Ungültige Anlage' }, { status: 400 })
  }

  const contact = await prisma.contact.create({
    data: {
      customerId: body.customerId,
      siteId: body.siteId || null,
      plantId: body.plantId || null,
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

  return NextResponse.json(contact, { status: 201 })
}
