import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
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

  const permissions = await prisma.rolePermission.findMany({
    orderBy: [{ role: 'asc' }, { resource: 'asc' }],
  })

  return NextResponse.json(permissions)
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }
  const role = session.user.role as UserRole
  if (role !== 'ADMIN' && role !== 'SERVICE_MANAGER') {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const body = await request.json()
  const { permRole, resource, canView, canCreate, canEdit, canDelete, scope } = body

  // ADMIN permissions are immutable
  if (permRole === 'ADMIN') {
    return NextResponse.json({ error: 'Admin-Berechtigungen können nicht geändert werden' }, { status: 403 })
  }

  // SERVICE_MANAGER permissions can only be changed by ADMIN
  if (permRole === 'SERVICE_MANAGER' && role !== 'ADMIN') {
    return NextResponse.json({ error: 'Nur Administratoren können Service Manager Berechtigungen ändern' }, { status: 403 })
  }

  const permission = await prisma.rolePermission.upsert({
    where: { role_resource: { role: permRole as UserRole, resource } },
    update: { canView, canCreate, canEdit, canDelete, scope },
    create: { role: permRole as UserRole, resource, canView, canCreate, canEdit, canDelete, scope },
  })

  return NextResponse.json(permission)
}
