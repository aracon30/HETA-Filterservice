import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkPermission, getScopeFilter } from '@/lib/permissions'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }
  if (!(await checkPermission(session, 'customers', 'view'))) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const scopeFilter = await getScopeFilter(session, 'customers')

  const q = request.nextUrl.searchParams.get('q')?.trim()
  const searchFilter = q
    ? {
        OR: [
          { name: { contains: q, mode: 'insensitive' as const } },
          { contactName: { contains: q, mode: 'insensitive' as const } },
          { email: { contains: q, mode: 'insensitive' as const } },
          { phone: { contains: q, mode: 'insensitive' as const } },
          { address: { contains: q, mode: 'insensitive' as const } },
          // Suche auch in den dahinterliegenden Anlagen
          {
            plants: {
              some: {
                OR: [
                  { name: { contains: q, mode: 'insensitive' as const } },
                  { type: { contains: q, mode: 'insensitive' as const } },
                  { serialNumber: { contains: q, mode: 'insensitive' as const } },
                  { location: { contains: q, mode: 'insensitive' as const } },
                  { manufacturer: { contains: q, mode: 'insensitive' as const } },
                  { model: { contains: q, mode: 'insensitive' as const } },
                ],
              },
            },
          },
        ],
      }
    : {}

  const customers = await prisma.customer.findMany({
    where: { AND: [scopeFilter, searchFilter] },
    include: {
      plants: { select: { id: true } },
      jobs: {
        where: { status: { in: ['PLANNED', 'IN_PROGRESS'] } },
        select: { id: true },
      },
    },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(customers)
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }
  if (!(await checkPermission(session, 'customers', 'create'))) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const body = await request.json()
  const { name, contactName, email, phone, address } = body

  const customer = await prisma.customer.create({
    data: { name, contactName, email, phone, address },
  })

  return NextResponse.json(customer, { status: 201 })
}
