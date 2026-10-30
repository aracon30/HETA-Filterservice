import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkPermission } from '@/lib/permissions'
import { unlink } from 'fs/promises'
import path from 'path'

const EXTERNAL_ROLES = ['MAINTENANCE_MANAGER', 'MAINTENANCE_TECHNICIAN', 'BUYER']
const DELETE_ROLES = ['ADMIN', 'SERVICE_MANAGER']

// Ersatzteilportal: Größe der Hotspot-Marker-Ringe je Zeichnung anpassen
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; docId: string }> }
) {
  const params = await ctx.params
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  if (!(await checkPermission(session, 'parts_catalog', 'edit'))) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const doc = await prisma.plantDocument.findUnique({ where: { id: params.docId }, select: { plantId: true } })
  if (!doc || doc.plantId !== params.id) {
    return NextResponse.json({ error: 'Dokument nicht gefunden' }, { status: 404 })
  }

  const body = await req.json()
  if (typeof body.markerSize !== 'number' || body.markerSize < 8 || body.markerSize > 200) {
    return NextResponse.json({ error: 'Ungültige Markergröße' }, { status: 400 })
  }

  const updated = await prisma.plantDocument.update({
    where: { id: params.docId },
    data: { markerSize: Math.round(body.markerSize) },
    select: { id: true, markerSize: true },
  })

  return NextResponse.json(updated)
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; docId: string }> }
) {
  const params = await ctx.params
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const role = session.user.role as string
  if (!DELETE_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Nur Administratoren und Servicemanager können Dokumente löschen' }, { status: 403 })
  }

  const doc = await prisma.plantDocument.findUnique({
    where: { id: params.docId },
    include: { plant: { select: { customerId: true } } },
  })

  if (!doc || doc.plantId !== params.id) {
    return NextResponse.json({ error: 'Dokument nicht gefunden' }, { status: 404 })
  }

  if (EXTERNAL_ROLES.includes(role) && doc.plant.customerId !== session.user.customerId) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  // Delete the physical file (best effort — don't fail if already removed)
  try {
    const filePath = path.join(process.cwd(), 'public', doc.fileUrl)
    await unlink(filePath)
  } catch {
    // file may already be gone
  }

  await prisma.plantDocument.delete({ where: { id: params.docId } })

  return NextResponse.json({ success: true })
}
