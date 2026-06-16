import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import bcrypt from 'bcryptjs'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@prisma/client'
import { ROLE_LABELS } from '@/lib/permissions-config'

// Builds a 409 error that names the account already using the email, so an admin
// can find it even when it sits inside a collapsed customer group in the UI.
async function emailTakenResponse(email: string) {
  const existing = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    include: { customer: { select: { name: true } } },
  })
  if (!existing) {
    return NextResponse.json({ error: 'Diese E-Mail-Adresse ist bereits vergeben.' }, { status: 409 })
  }
  const roleLabel = ROLE_LABELS[existing.role] ?? existing.role
  const customerPart = existing.customer ? `, ${existing.customer.name}` : ''
  return NextResponse.json(
    {
      error: `Diese E-Mail-Adresse ist bereits vergeben: ${existing.name} (${roleLabel}${customerPart}).`,
    },
    { status: 409 }
  )
}

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
  const { name, password, userRole, customerId, phone } = body
  // Normalize email so case/whitespace variants don't slip past the unique
  // constraint (PostgreSQL @unique is case-sensitive) and create near-duplicates.
  const email = typeof body.email === 'string' ? body.email.trim() : ''

  if (!email) {
    return NextResponse.json({ error: 'E-Mail-Adresse ist erforderlich' }, { status: 400 })
  }

  // Only ADMIN can create ADMIN or SERVICE_MANAGER users
  if (
    (userRole === 'ADMIN' || userRole === 'SERVICE_MANAGER') &&
    role !== 'ADMIN'
  ) {
    return NextResponse.json({ error: 'Nur Administratoren können diese Rolle vergeben' }, { status: 403 })
  }

  // Case-insensitive duplicate check with a message that identifies the existing
  // account (it may be hidden inside a collapsed customer group in the UI).
  const duplicate = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true },
  })
  if (duplicate) {
    return emailTakenResponse(email)
  }

  const hashedPassword = await bcrypt.hash(password, 12)

  try {
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: userRole as UserRole,
        customerId: customerId || null,
        phone: phone || null,
        mustChangePassword: true,
      },
      include: { customer: { select: { id: true, name: true } } },
    })

    const { password: _pw, ...safeUser } = user
    return NextResponse.json(safeUser, { status: 201 })
  } catch (err) {
    const e = err as { code?: string }
    if (e.code === 'P2002') {
      // Race condition between the check above and the insert.
      return emailTakenResponse(email)
    }
    throw err
  }
}
