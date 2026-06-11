import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import bcrypt from 'bcryptjs'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@prisma/client'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
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
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }
  const role = session.user.role as UserRole
  if (role !== 'ADMIN' && role !== 'SERVICE_MANAGER') {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const body = await request.json()
  const { name, email, password, userRole, customerId, active, phone } = body

  // Only ADMIN can set privileged roles
  if (
    (userRole === 'ADMIN' || userRole === 'SERVICE_MANAGER') &&
    role !== 'ADMIN'
  ) {
    return NextResponse.json({ error: 'Nur Administratoren können diese Rolle vergeben' }, { status: 403 })
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
      return NextResponse.json({ error: 'Diese E-Mail-Adresse ist bereits vergeben.' }, { status: 409 })
    }
    throw err
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
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
