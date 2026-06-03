import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { OpportunityStage, OpportunitySource } from '@prisma/client'
import { checkPermission, getScopeFilter, getPermissions } from '@/lib/permissions'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }
  if (!(await checkPermission(session, 'opportunities', 'view'))) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const perm = await getPermissions(session.user.role, 'opportunities')
  const scopeFilter = getScopeFilter(session, 'opportunities', perm?.scope ?? null)

  const opportunities = await prisma.opportunity.findMany({
    where: scopeFilter,
    include: {
      customer: { select: { id: true, name: true } },
      plant: { select: { id: true, name: true, serialNumber: true, type: true } },
      sourceJob: { select: { orderNumber: true, id: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(opportunities)
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }
  if (!(await checkPermission(session, 'opportunities', 'create'))) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const body = await request.json()
  const {
    title, value, stage, customerId, notes,
    probability, expectedCloseAt, contactPerson, plantId, source, sourceJobId,
  } = body

  const opportunity = await prisma.opportunity.create({
    data: {
      title,
      value: value ? parseFloat(value) : null,
      stage: (stage as OpportunityStage) || 'IDENTIFIED',
      customerId,
      notes: notes || null,
      probability: probability ? parseInt(probability) : null,
      expectedCloseAt: expectedCloseAt ? new Date(expectedCloseAt) : null,
      contactPerson: contactPerson || null,
      plantId: plantId || null,
      source: (source as OpportunitySource) || 'MANUAL',
      sourceJobId: sourceJobId || null,
    },
    include: {
      customer: { select: { id: true, name: true } },
      plant: { select: { id: true, name: true, serialNumber: true, type: true } },
      sourceJob: { select: { orderNumber: true, id: true } },
    },
  })

  return NextResponse.json(opportunity, { status: 201 })
}
