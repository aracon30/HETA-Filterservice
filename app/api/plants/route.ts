import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkPermission, getScopeFilter, getPermissions } from '@/lib/permissions'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }
  if (!(await checkPermission(session, 'plants', 'view'))) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const customerId = searchParams.get('customerId')

  const perm = await getPermissions(session.user.role, 'plants')
  const scopeFilter = getScopeFilter(session, 'plants', perm?.scope ?? null)

  const where: Record<string, unknown> = { ...scopeFilter }
  if (customerId) {
    // Merge customerId with scope filter (scope already restricts to own company)
    where.customerId = customerId
  }

  const plants = await prisma.plant.findMany({
    where,
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(plants)
}
