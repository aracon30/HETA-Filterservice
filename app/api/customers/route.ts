import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkPermission, getScopeFilter, getPermissions } from '@/lib/permissions'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }
  if (!(await checkPermission(session, 'customers', 'view'))) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const perm = await getPermissions(session.user.role, 'customers')
  const scopeFilter = getScopeFilter(session, 'customers', perm?.scope ?? null)

  const customers = await prisma.customer.findMany({
    where: scopeFilter,
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
