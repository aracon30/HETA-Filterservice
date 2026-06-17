import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkPermission, getScopeFilter } from '@/lib/permissions'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  if (!(await checkPermission(session, 'sites', 'view')))
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })

  const customerId = request.nextUrl.searchParams.get('customerId')
  if (!customerId) return NextResponse.json({ error: 'customerId fehlt' }, { status: 400 })

  // External users may only see their own customer's sites
  if (session.user.customerId && session.user.customerId !== customerId)
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })

  const scopeFilter = await getScopeFilter(session, 'sites')

  const sites = await prisma.site.findMany({
    where: { ...scopeFilter, customerId },
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { plants: true, contacts: true, hotels: true } },
    },
  })

  return NextResponse.json(sites)
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

  const site = await prisma.site.create({
    data: {
      customerId: body.customerId,
      name: body.name.trim(),
      address: body.address?.trim() || null,
      zip: body.zip?.trim() || null,
      city: body.city?.trim() || null,
      note: body.note?.trim() || null,
    },
  })

  return NextResponse.json(site, { status: 201 })
}
