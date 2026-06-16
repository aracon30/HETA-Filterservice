import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { DocumentType } from '@prisma/client'

// Roles that can upload restricted document types (INVOICE, SERVICE_REPORT, MANUAL, DRAWING, OTHER)
const RESTRICTED_UPLOAD_ROLES = ['ADMIN', 'SERVICE_MANAGER']

// Roles that can upload any document type including IMAGE
const ALL_UPLOAD_ROLES = [
  'ADMIN', 'SERVICE_MANAGER', 'SERVICE_TECHNICIAN',
  'MAINTENANCE_MANAGER', 'MAINTENANCE_TECHNICIAN', 'BUYER',
]

// External customer roles — can only access their own customer's plants
const EXTERNAL_ROLES = ['MAINTENANCE_MANAGER', 'MAINTENANCE_TECHNICIAN', 'BUYER']

const ALLOWED_MIME: Record<DocumentType, string[]> = {
  INVOICE:        ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  SERVICE_REPORT: ['application/pdf'],
  MANUAL:         ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  DRAWING:        ['application/pdf', 'image/png', 'image/jpeg', 'image/svg+xml'],
  IMAGE:          ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  OTHER:          [], // any
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const params = await ctx.params
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const plant = await prisma.plant.findUnique({ where: { id: params.id }, select: { customerId: true } })
  if (!plant) return NextResponse.json({ error: 'Anlage nicht gefunden' }, { status: 404 })

  // External roles: only own customer
  if (EXTERNAL_ROLES.includes(session.user.role as string) && plant.customerId !== session.user.customerId) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const documents = await prisma.plantDocument.findMany({
    where: { plantId: params.id },
    orderBy: { createdAt: 'desc' },
    include: { job: { select: { orderNumber: true } } },
  })

  return NextResponse.json(documents)
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const params = await ctx.params
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const role = session.user.role as string

  const plant = await prisma.plant.findUnique({ where: { id: params.id }, select: { customerId: true } })
  if (!plant) return NextResponse.json({ error: 'Anlage nicht gefunden' }, { status: 404 })

  // External roles cannot upload to other customers' plants
  if (EXTERNAL_ROLES.includes(role) && plant.customerId !== session.user.customerId) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  if (!ALL_UPLOAD_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Keine Upload-Berechtigung' }, { status: 403 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const type = formData.get('type') as DocumentType | null
  const title = formData.get('title') as string | null
  const description = formData.get('description') as string | null
  const jobId = formData.get('jobId') as string | null

  if (!file || !type || !title?.trim()) {
    return NextResponse.json({ error: 'Datei, Typ und Titel sind erforderlich' }, { status: 400 })
  }

  // Permission: restricted types require ADMIN or SERVICE_MANAGER
  if (type !== 'IMAGE' && !RESTRICTED_UPLOAD_ROLES.includes(role)) {
    return NextResponse.json({ error: `Nur Administratoren und Servicemanager können Dokumente vom Typ "${type}" hochladen` }, { status: 403 })
  }

  // Mime type validation (skip for OTHER type)
  const allowed = ALLOWED_MIME[type]
  if (allowed.length > 0 && !allowed.includes(file.type)) {
    return NextResponse.json({ error: `Dateityp "${file.type}" ist für "${type}" nicht erlaubt` }, { status: 400 })
  }

  // INVOICE requires a jobId
  if (type === 'INVOICE' && !jobId) {
    return NextResponse.json({ error: 'Rechnungen müssen einem Serviceeinsatz zugeordnet werden' }, { status: 400 })
  }

  // Verify jobId belongs to this plant's customer if provided
  if (jobId) {
    const job = await prisma.serviceJob.findFirst({
      where: { id: jobId, customerId: plant.customerId },
      select: { id: true },
    })
    if (!job) return NextResponse.json({ error: 'Einsatz nicht gefunden oder gehört nicht zu diesem Kunden' }, { status: 400 })
  }

  // Save file
  const ext = path.extname(file.name) || ''
  const safeName = `${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'plant-docs')
  await mkdir(uploadDir, { recursive: true })
  const filePath = path.join(uploadDir, safeName)
  const bytes = await file.arrayBuffer()
  await writeFile(filePath, Buffer.from(bytes))

  const fileUrl = `/uploads/plant-docs/${safeName}`

  const doc = await prisma.plantDocument.create({
    data: {
      plantId: params.id,
      customerId: plant.customerId,
      type,
      title: title.trim(),
      description: description?.trim() || null,
      fileUrl,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || null,
      jobId: jobId || null,
      uploadedById: session.user.id,
      uploadedByName: session.user.name ?? session.user.email ?? '—',
    },
    include: { job: { select: { orderNumber: true } } },
  })

  return NextResponse.json(doc, { status: 201 })
}
