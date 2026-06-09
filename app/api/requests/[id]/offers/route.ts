import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkPermission } from '@/lib/permissions'
import path from 'path'
import fs from 'fs'

const MANAGER_ROLES = ['ADMIN', 'SERVICE_MANAGER']
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'offers')

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }

  const role = session.user.role as string
  if (!MANAGER_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }
  if (!(await checkPermission(session, 'requests', 'edit'))) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const existing = await prisma.plantRequest.findUnique({ where: { id: params.id } })
  if (!existing) {
    return NextResponse.json({ error: 'Anfrage nicht gefunden' }, { status: 404 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const offerNumber = formData.get('offerNumber') as string | null

  if (!file) {
    return NextResponse.json({ error: 'Keine Datei hochgeladen' }, { status: 400 })
  }
  if (!offerNumber?.trim()) {
    return NextResponse.json({ error: 'Angebotsnummer ist erforderlich' }, { status: 400 })
  }
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    return NextResponse.json({ error: 'Nur PDF-Dateien erlaubt' }, { status: 400 })
  }

  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true })
  }

  const timestamp = Date.now()
  const randomHex = Math.random().toString(16).slice(2, 8)
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const fileName = `${timestamp}-${randomHex}-${safeName}`
  const filePath = path.join(UPLOAD_DIR, fileName)

  const buffer = Buffer.from(await file.arrayBuffer())
  fs.writeFileSync(filePath, buffer)

  const offer = await prisma.plantRequestOffer.create({
    data: {
      requestId: params.id,
      offerNumber: offerNumber.trim(),
      fileUrl: `/uploads/offers/${fileName}`,
      fileName: file.name,
      uploadedById: session.user.id,
      uploadedByName: session.user.name ?? 'Unbekannt',
    },
  })

  // Update offerNumber on the request and set status to OFFER_SENT
  await prisma.plantRequest.update({
    where: { id: params.id },
    data: {
      offerNumber: offerNumber.trim(),
      status: 'OFFER_SENT',
    },
  })

  await prisma.plantRequestMessage.create({
    data: {
      requestId: params.id,
      authorId: session.user.id,
      authorName: session.user.name ?? 'Unbekannt',
      authorRole: role,
      content: `Angebot ${offerNumber.trim()} wurde hochgeladen und versendet.`,
      statusChange: existing.status !== 'OFFER_SENT' ? `${existing.status}→OFFER_SENT` : null,
    },
  })

  return NextResponse.json(offer, { status: 201 })
}
