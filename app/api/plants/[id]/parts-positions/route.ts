import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkPermission } from '@/lib/permissions'

// GET: alle Hotspot-Positionen der Ersatzteile dieser Anlage (für den internen Editor)
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const positions = await prisma.plantMaterialPosition.findMany({
    where: { material: { plantId: params.id } },
    select: { id: true, materialId: true, documentId: true, positionX: true, positionY: true },
  })
  return NextResponse.json(positions)
}

// POST: eine Position anlegen/aktualisieren (Klick auf die Zeichnung im internen Editor)
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  if (!(await checkPermission(session, 'parts_catalog', 'edit'))) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const body = await req.json()
  const { materialId, documentId, positionX, positionY } = body

  if (!materialId || !documentId || typeof positionX !== 'number' || typeof positionY !== 'number') {
    return NextResponse.json({ error: 'Ungültige Position' }, { status: 400 })
  }

  // Sicherstellen, dass Material und Zeichnung wirklich zu dieser Anlage gehören —
  // verhindert Verknüpfungen über Anlagengrenzen hinweg.
  const [material, document] = await Promise.all([
    prisma.plantMaterial.findUnique({ where: { id: materialId }, select: { plantId: true } }),
    prisma.plantDocument.findUnique({ where: { id: documentId }, select: { plantId: true } }),
  ])
  if (!material || material.plantId !== params.id) {
    return NextResponse.json({ error: 'Ersatzteil nicht gefunden' }, { status: 404 })
  }
  if (!document || document.plantId !== params.id) {
    return NextResponse.json({ error: 'Zeichnung nicht gefunden' }, { status: 404 })
  }

  const position = await prisma.plantMaterialPosition.upsert({
    where: { materialId_documentId: { materialId, documentId } },
    create: {
      materialId,
      documentId,
      positionX: Math.min(1, Math.max(0, positionX)),
      positionY: Math.min(1, Math.max(0, positionY)),
    },
    update: {
      positionX: Math.min(1, Math.max(0, positionX)),
      positionY: Math.min(1, Math.max(0, positionY)),
    },
  })

  return NextResponse.json(position, { status: 201 })
}

// DELETE: eine Position entfernen — ?id=<positionId>
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  if (!(await checkPermission(session, 'parts_catalog', 'edit'))) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const positionId = req.nextUrl.searchParams.get('id')
  if (!positionId) return NextResponse.json({ error: 'id fehlt' }, { status: 400 })

  const position = await prisma.plantMaterialPosition.findUnique({
    where: { id: positionId },
    select: { material: { select: { plantId: true } } },
  })
  if (!position || position.material.plantId !== params.id) {
    return NextResponse.json({ error: 'Position nicht gefunden' }, { status: 404 })
  }

  await prisma.plantMaterialPosition.delete({ where: { id: positionId } })
  return NextResponse.json({ ok: true })
}
