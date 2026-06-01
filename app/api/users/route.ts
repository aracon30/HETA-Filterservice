import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import bcrypt from 'bcryptjs'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@prisma/client'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }
  const role = session.user.role as UserRole
  if (role !== 'ADMIN' && role !== 'SERVICE_MANAGER') {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const users = await prisma.user.findMany({
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
  const { name, email, password, userRole, customerId } = body

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
    },
    include: { customer: { select: { id: true, name: true } } },
  })

  // Don't return password
  const { password: _pw, ...safeUser } = user
  return NextResponse.json(safeUser, { status: 201 })
}
