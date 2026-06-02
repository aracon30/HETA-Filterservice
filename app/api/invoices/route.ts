import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeFile } from 'fs/promises'
import path from 'path'

const UPLOAD_ROLES = ['ADMIN', 'SERVICE_MANAGER']
const VIEW_ROLES = ['ADMIN', 'SERVICE_MANAGER', 'BUYER']

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const role = session.user.role as string
  if (!VIEW_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const customerId = searchParams.get('customerId')

  // External BUYER can only see their own company's invoices
  if (role === 'BUYER') {
    const buyerCustomerId = session.user.customerId
    if (!buyerCustomerId || (customerId && customerId !== buyerCustomerId)) {
      return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
    }
    const invoices = await prisma.invoice.findMany({
      where: { customerId: buyerCustomerId },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(invoices)
  }

  // Internal: can filter by customerId
  const where = customerId ? { customerId } : {}
  const invoices = await prisma.invoice.findMany({
    where,
    include: { customer: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(invoices)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const role = session.user.role as string
  if (!UPLOAD_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Nur Admins und Service Manager können Rechnungen hochladen' }, { status: 403 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const customerId = formData.get('customerId') as string | null
  const invoiceNumber = formData.get('invoiceNumber') as string | null
  const description = formData.get('description') as string | null
  const amount = formData.get('amount') as string | null

  if (!file) return NextResponse.json({ error: 'Keine Datei angegeben' }, { status: 400 })
  if (!customerId) return NextResponse.json({ error: 'Kein Kunde angegeben' }, { status: 400 })

  // Only allow PDF
  if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'Nur PDF-Dateien erlaubt' }, { status: 400 })
  }

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  const safeOriginal = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}-${safeOriginal}`
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'invoices')
  await writeFile(path.join(uploadDir, fileName), buffer)

  const invoice = await prisma.invoice.create({
    data: {
      customerId,
      invoiceNumber: invoiceNumber || null,
      description: description || null,
      amount: amount ? parseFloat(amount) : null,
      fileUrl: `/uploads/invoices/${fileName}`,
      fileName: file.name,
      uploadedById: session.user.id,
    },
  })

  return NextResponse.json(invoice, { status: 201 })
}
