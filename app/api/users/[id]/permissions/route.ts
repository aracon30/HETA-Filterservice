import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const RESOURCES = ['customers', 'plants', 'jobs', 'checklist', 'opportunities', 'users']

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params
  const session = await getServerSession(authOptions)
  if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SERVICE_MANAGER')) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const userPerms = await prisma.userPermission.findMany({
    where: { userId: params.id },
  })

  // Build full set: user-specific or null (meaning "use role default")
  const result = RESOURCES.map(resource => {
    const p = userPerms.find(up => up.resource === resource)
    return {
      resource,
      hasOverride: !!p,
      canView: p?.canView ?? null,
      canCreate: p?.canCreate ?? null,
      canEdit: p?.canEdit ?? null,
      canDelete: p?.canDelete ?? null,
      scope: p?.scope ?? null,
    }
  })

  return NextResponse.json(result)
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params
  const session = await getServerSession(authOptions)
  if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SERVICE_MANAGER')) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const body = await req.json()
  // body: Array of { resource, canView, canCreate, canEdit, canDelete, scope, remove? }
  const perms: {
    resource: string
    canView: boolean
    canCreate: boolean
    canEdit: boolean
    canDelete: boolean
    scope: string
    remove?: boolean
  }[] = body

  for (const p of perms) {
    if (p.remove) {
      await prisma.userPermission.deleteMany({
        where: { userId: params.id, resource: p.resource },
      })
    } else {
      await prisma.userPermission.upsert({
        where: { userId_resource: { userId: params.id, resource: p.resource } },
        create: {
          userId: params.id,
          resource: p.resource,
          canView: p.canView,
          canCreate: p.canCreate,
          canEdit: p.canEdit,
          canDelete: p.canDelete,
          scope: p.scope ?? 'all',
        },
        update: {
          canView: p.canView,
          canCreate: p.canCreate,
          canEdit: p.canEdit,
          canDelete: p.canDelete,
          scope: p.scope ?? 'all',
        },
      })
    }
  }

  return NextResponse.json({ ok: true })
}
