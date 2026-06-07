import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { checkPermission, getScopeFilter, getPermissions } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { OpportunitySource } from '@prisma/client'

interface Suggestion {
  id: string
  title: string
  reason: string
  nokItems: Array<{ label: string; section: string | null }>
  findings: string | null
  customerId: string
  customerName: string
  plantId: string | null
  plantName: string | null
  plantType: string | null
  sourceJobId: string
  sourceJobNumber: string
  source: string
  alreadyConverted: boolean
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  if (!(await checkPermission(session, 'opportunities', 'view')))
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })

  const perm = await getPermissions(session.user.role, 'jobs')
  const scopeFilter = getScopeFilter(session, 'jobs', perm?.scope ?? null)

  // Jobs with NOK checklist items
  const jobsWithNok = await prisma.serviceJob.findMany({
    where: {
      ...scopeFilter,
      checklistItems: { some: { status: 'NOK' } },
    },
    include: {
      customer: { select: { id: true, name: true } },
      plants: {
        include: { plant: { select: { id: true, name: true, serialNumber: true, type: true } } },
        orderBy: { order: 'asc' },
        take: 1,
      },
      checklistItems: {
        where: { status: 'NOK' },
        select: { label: true, section: true },
      },
      opportunities: { select: { id: true } },
    },
    orderBy: { scheduledAt: 'desc' },
    take: 100,
  })

  // Completed jobs with findings/recommendations
  const jobsWithFindings = await prisma.serviceJob.findMany({
    where: {
      ...scopeFilter,
      status: 'COMPLETED',
      OR: [
        { findings: { not: null } },
        { recommendations: { not: null } },
      ],
      opportunities: { none: {} },
    },
    include: {
      customer: { select: { id: true, name: true } },
      plants: {
        include: { plant: { select: { id: true, name: true, serialNumber: true, type: true } } },
        orderBy: { order: 'asc' },
        take: 1,
      },
      checklistItems: { where: { status: 'NOK' }, select: { label: true, section: true } },
      opportunities: { select: { id: true } },
    },
    orderBy: { scheduledAt: 'desc' },
    take: 50,
  })

  const suggestions: Suggestion[] = []

  for (const job of jobsWithNok) {
    const firstPlant = job.plants[0]?.plant ?? null
    const nokLabels = job.checklistItems.map(i => i.label).slice(0, 3).join(', ')
    suggestions.push({
      id: `nok-${job.id}`,
      title: `Mängelbehebung: ${firstPlant?.name || firstPlant?.type || 'Anlage'} bei ${job.customer.name}`,
      reason: `${job.checklistItems.length} n.i.O.-Punkt(e): ${nokLabels}`,
      nokItems: job.checklistItems,
      findings: job.findings ?? null,
      customerId: job.customer.id,
      customerName: job.customer.name,
      plantId: firstPlant?.id ?? null,
      plantName: firstPlant?.name ?? null,
      plantType: firstPlant?.type ?? null,
      sourceJobId: job.id,
      sourceJobNumber: job.orderNumber,
      source: 'CHECKLIST_NOK',
      alreadyConverted: job.opportunities.length > 0,
    })
  }

  for (const job of jobsWithFindings) {
    if (suggestions.find(s => s.sourceJobId === job.id)) continue
    const firstPlant = job.plants[0]?.plant ?? null
    suggestions.push({
      id: `findings-${job.id}`,
      title: `Folgeeinsatz: ${firstPlant?.name || firstPlant?.type || 'Anlage'} bei ${job.customer.name}`,
      reason: 'Befunde / Empfehlungen im Servicebericht',
      nokItems: [],
      findings: job.findings ?? job.recommendations ?? null,
      customerId: job.customer.id,
      customerName: job.customer.name,
      plantId: firstPlant?.id ?? null,
      plantName: firstPlant?.name ?? null,
      plantType: firstPlant?.type ?? null,
      sourceJobId: job.id,
      sourceJobNumber: job.orderNumber,
      source: 'SERVICE_REPORT',
      alreadyConverted: false,
    })
  }

  return NextResponse.json(suggestions)
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  if (!(await checkPermission(session, 'opportunities', 'create')))
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })

  const body = await request.json()
  const { title, customerId, plantId, sourceJobId, source, notes } = body

  const opportunity = await prisma.opportunity.create({
    data: {
      title,
      customerId,
      plantId: plantId || null,
      sourceJobId: sourceJobId || null,
      source: (source as OpportunitySource) || 'MANUAL',
      notes: notes || null,
      stage: 'IDENTIFIED',
    },
    include: {
      customer: { select: { id: true, name: true } },
      plant: { select: { id: true, name: true, serialNumber: true, type: true } },
      sourceJob: { select: { orderNumber: true, id: true } },
    },
  })
  return NextResponse.json(opportunity, { status: 201 })
}
