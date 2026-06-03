import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { checkPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { OpportunityStage } from '@prisma/client'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  if (!(await checkPermission(session, 'opportunities', 'edit')))
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })

  const body = await request.json()
  const { title, value, stage, notes, probability, expectedCloseAt, contactPerson, plantId } = body

  const opportunity = await prisma.opportunity.update({
    where: { id: params.id },
    data: {
      ...(title !== undefined && { title }),
      ...(value !== undefined && { value: value ? parseFloat(value) : null }),
      ...(stage !== undefined && { stage: stage as OpportunityStage }),
      ...(notes !== undefined && { notes }),
      ...(probability !== undefined && { probability: probability ? parseInt(probability) : null }),
      ...(expectedCloseAt !== undefined && { expectedCloseAt: expectedCloseAt ? new Date(expectedCloseAt) : null }),
      ...(contactPerson !== undefined && { contactPerson }),
      ...(plantId !== undefined && { plantId: plantId || null }),
    },
    include: {
      customer: { select: { id: true, name: true } },
      plant: { select: { id: true, name: true, serialNumber: true, type: true } },
      sourceJob: { select: { orderNumber: true, id: true } },
    },
  })
  return NextResponse.json(opportunity)
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  if (!(await checkPermission(session, 'opportunities', 'delete')))
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })

  await prisma.opportunity.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
