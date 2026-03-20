import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { OpportunityStage } from '@prisma/client'

export async function GET() {
  const opportunities = await prisma.opportunity.findMany({
    include: {
      customer: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(opportunities)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { title, value, stage, customerId, notes } = body

  const opportunity = await prisma.opportunity.create({
    data: {
      title,
      value: value ? parseFloat(value) : null,
      stage: (stage as OpportunityStage) || 'IDENTIFIED',
      customerId,
      notes,
    },
    include: {
      customer: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json(opportunity, { status: 201 })
}
