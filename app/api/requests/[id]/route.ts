import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkPermission, getScopeFilter } from '@/lib/permissions'
import { RequestStatus } from '@prisma/client'

const MANAGER_ROLES = ['ADMIN', 'SERVICE_MANAGER']
const INTERNAL_ROLES = ['ADMIN', 'SERVICE_MANAGER', 'SERVICE_TECHNICIAN']
const EXTERNAL_REQUESTER_ROLES = ['MAINTENANCE_MANAGER', 'BUYER']

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }
  if (!(await checkPermission(session, 'requests', 'view'))) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const scopeFilter = await getScopeFilter(session, 'requests')

  const found = await prisma.plantRequest.findFirst({
    where: { id: params.id, ...scopeFilter },
    include: {
      customer: { select: { id: true, name: true } },
      plants: { include: { plant: { select: { id: true, name: true, type: true } } } },
      messages: { orderBy: { createdAt: 'asc' } },
      offerPdfs: { orderBy: { createdAt: 'asc' } },
    },
  })

  if (!found) {
    return NextResponse.json({ error: 'Anfrage nicht gefunden' }, { status: 404 })
  }

  // Mark internal messages as read when external requester opens the detail page
  const role = session.user.role as string
  if (EXTERNAL_REQUESTER_ROLES.includes(role)) {
    await prisma.plantRequestMessage.updateMany({
      where: {
        requestId: params.id,
        readByRequester: false,
        authorRole: { in: INTERNAL_ROLES },
      },
      data: { readByRequester: true },
    })
  }

  return NextResponse.json(found)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }
  if (!(await checkPermission(session, 'requests', 'edit'))) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const role = session.user.role as string
  const isManager = MANAGER_ROLES.includes(role)

  const scopeFilter = await getScopeFilter(session, 'requests')
  const existing = await prisma.plantRequest.findFirst({
    where: { id: params.id, ...scopeFilter },
  })
  if (!existing) {
    return NextResponse.json({ error: 'Anfrage nicht gefunden' }, { status: 404 })
  }

  const body = await request.json()

  // Manager-only fields
  if (!isManager) {
    // External users can only accept/reject an offer
    const { action, rejectionNote } = body

    if (action === 'accept_offer') {
      if (existing.status !== 'OFFER_SENT') {
        return NextResponse.json({ error: 'Kein Angebot zum Annehmen vorhanden' }, { status: 400 })
      }
      const updated = await prisma.plantRequest.update({
        where: { id: params.id },
        data: { status: 'OFFER_ACCEPTED', acceptedAt: new Date() },
      })
      await prisma.plantRequestMessage.create({
        data: {
          requestId: params.id,
          authorId: session.user.id,
          authorName: session.user.name ?? 'Unbekannt',
          authorRole: role,
          content: 'Angebot wurde angenommen.',
          statusChange: 'OFFER_SENT→OFFER_ACCEPTED',
        },
      })
      return NextResponse.json(updated)
    }

    if (action === 'reject_offer') {
      if (existing.status !== 'OFFER_SENT') {
        return NextResponse.json({ error: 'Kein Angebot zum Ablehnen vorhanden' }, { status: 400 })
      }
      const updated = await prisma.plantRequest.update({
        where: { id: params.id },
        data: {
          status: 'OFFER_REJECTED',
          rejectedAt: new Date(),
          rejectionNote: rejectionNote ?? null,
        },
      })
      await prisma.plantRequestMessage.create({
        data: {
          requestId: params.id,
          authorId: session.user.id,
          authorName: session.user.name ?? 'Unbekannt',
          authorRole: role,
          content: rejectionNote
            ? `Angebot abgelehnt: ${rejectionNote}`
            : 'Angebot wurde abgelehnt.',
          statusChange: 'OFFER_SENT→OFFER_REJECTED',
        },
      })
      return NextResponse.json(updated)
    }

    return NextResponse.json({ error: 'Keine Berechtigung für diese Aktion' }, { status: 403 })
  }

  // Manager: status change + message + optional fields
  const {
    status,
    messageContent,
    offerNumber,
    serviceJobId,
    serviceJobNumber,
  } = body

  const updateData: Record<string, unknown> = {}
  const oldStatus = existing.status

  if (status && status !== oldStatus) {
    updateData.status = status as RequestStatus
  }
  if (offerNumber !== undefined) updateData.offerNumber = offerNumber
  if (serviceJobId !== undefined) updateData.serviceJobId = serviceJobId
  if (serviceJobNumber !== undefined) updateData.serviceJobNumber = serviceJobNumber

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.plantRequest.update({
      where: { id: params.id },
      data: updateData,
    })

    if (messageContent?.trim() || (status && status !== oldStatus)) {
      await tx.plantRequestMessage.create({
        data: {
          requestId: params.id,
          authorId: session.user.id,
          authorName: session.user.name ?? 'Unbekannt',
          authorRole: role,
          content: messageContent?.trim() ?? '',
          statusChange: status && status !== oldStatus ? `${oldStatus}→${status}` : null,
        },
      })
    }

    return result
  })

  return NextResponse.json(updated)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }
  if (!(await checkPermission(session, 'requests', 'delete'))) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  await prisma.plantRequest.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
