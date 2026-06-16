import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import bcrypt from 'bcryptjs'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@prisma/client'
import { ROLE_LABELS } from '@/lib/permissions-config'

// Builds a 409 error that names the account already using the email, so an admin
// can find it even when it sits inside a collapsed customer group in the UI.
// `excludeId` omits the user being edited from the lookup.
async function emailTakenResponse(email: string, excludeId?: string) {
  const existing = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' }, NOT: { id: excludeId } },
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

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const params = await ctx.params
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }
  const role = session.user.role as UserRole
  if (role !== 'ADMIN' && role !== 'SERVICE_MANAGER') {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const user = await prisma.user.findUnique({
    where: { id: params.id },
    include: { customer: { select: { id: true, name: true } } },
  })
  if (!user) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

  const { password: _pw, ...safeUser } = user
  return NextResponse.json(safeUser)
}

export async function PUT(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const params = await ctx.params
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }
  const role = session.user.role as UserRole
  if (role !== 'ADMIN' && role !== 'SERVICE_MANAGER') {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const body = await request.json()
  const { name, password, userRole, customerId, active, phone } = body
  // Normalize email so case/whitespace variants don't slip past the unique
  // constraint (PostgreSQL @unique is case-sensitive) and create near-duplicates.
  const email = body.email !== undefined ? String(body.email).trim() : undefined

  // Only ADMIN can set privileged roles
  if (
    (userRole === 'ADMIN' || userRole === 'SERVICE_MANAGER') &&
    role !== 'ADMIN'
  ) {
    return NextResponse.json({ error: 'Nur Administratoren können diese Rolle vergeben' }, { status: 403 })
  }

  // Protect privileged accounts: only ADMIN may modify existing ADMIN/SERVICE_MANAGER
  // users (prevents a SERVICE_MANAGER from resetting an admin's password, email or
  // active flag and thereby escalating privileges).
  if (role !== 'ADMIN') {
    const target = await prisma.user.findUnique({
      where: { id: params.id },
      select: { role: true },
    })
    if (!target) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
    if (target.role === 'ADMIN' || target.role === 'SERVICE_MANAGER') {
      return NextResponse.json(
        { error: 'Nur Administratoren können privilegierte Konten bearbeiten' },
        { status: 403 }
      )
    }
  }

  if (email !== undefined && !email) {
    return NextResponse.json({ error: 'E-Mail-Adresse ist erforderlich' }, { status: 400 })
  }

  // Case-insensitive duplicate check (excluding the user being edited) with a
  // message that identifies the existing account holding the email.
  if (email !== undefined) {
    const duplicate = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' }, NOT: { id: params.id } },
      select: { id: true },
    })
    if (duplicate) {
      return emailTakenResponse(email, params.id)
    }
  }

  const updateData: Record<string, unknown> = {}
  if (name !== undefined) updateData.name = name
  if (email !== undefined) updateData.email = email
  if (userRole !== undefined) updateData.role = userRole as UserRole
  if (customerId !== undefined) updateData.customerId = customerId || null
  if (active !== undefined) updateData.active = active
  if (phone !== undefined) updateData.phone = phone || null
  if (password) {
    updateData.password = await bcrypt.hash(password, 12)
  }

  try {
    const user = await prisma.user.update({
      where: { id: params.id },
      data: updateData,
      include: { customer: { select: { id: true, name: true } } },
    })

    const { password: _pw, ...safeUser } = user
    return NextResponse.json(safeUser)
  } catch (err) {
    const e = err as { code?: string }
    if (e.code === 'P2002') {
      // Race condition between the check above and the update.
      return emailTakenResponse(email ?? '', params.id)
    }
    throw err
  }
}

export async function DELETE(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const params = await ctx.params
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }
  const role = session.user.role as UserRole
  if (role !== 'ADMIN') {
    return NextResponse.json({ error: 'Nur Administratoren können Benutzer löschen' }, { status: 403 })
  }

  await prisma.user.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
