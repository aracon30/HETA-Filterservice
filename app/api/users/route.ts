import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import bcrypt from 'bcryptjs'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@prisma/client'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }
  const role = session.user.role as UserRole
  if (role !== 'ADMIN' && role !== 'SERVICE_MANAGER') {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const roleFilter = searchParams.get('role')
  const customerIdFilter = searchParams.get('customerId')

  const where: Record<string, unknown> = {}
  if (roleFilter) where.role = roleFilter as UserRole
  if (customerIdFilter) where.customerId = customerIdFilter

  const users = await prisma.user.findMany({
    where,
    include: { customer: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(users)
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }
  const role = session.user.role as UserRole
  if (role !== 'ADMIN' && role !== 'SERVICE_MANAGER') {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const body = await request.json()
  const { name, email, password, userRole, customerId, phone } = body

  // Only ADMIN can create ADMIN or SERVICE_MANAGER users
  if (
    (userRole === 'ADMIN' || userRole === 'SERVICE_MANAGER') &&
    role !== 'ADMIN'
  ) {
    return NextResponse.json({ error: 'Nur Administratoren können diese Rolle vergeben' }, { status: 403 })
  }

  const hashedPassword = await bcrypt.hash(password, 12)

  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      role: userRole as UserRole,
      customerId: customerId || null,
      phone: phone || null,
    },
    include: { customer: { select: { id: true, name: true } } },
  })

  // Don't return password
  const { password: _pw, ...safeUser } = user
  return NextResponse.json(safeUser, { status: 201 })
}
