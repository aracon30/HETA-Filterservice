import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkPermission } from '@/lib/permissions'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  if (!(await checkPermission(session, 'jobs', 'view')))
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })

  const parts = await prisma.jobPart.findMany({
    where: { jobId: params.id },
    orderBy: { order: 'asc' },
  })

  return NextResponse.json(parts)
}

// Replace all job parts for this job
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  if (!(await checkPermission(session, 'jobs', 'edit')))
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })

  const body = await req.json()
  const parts: {
    id?: string
    label: string
    partNumber?: string
    quantity: number
    status: string
    deliveryDate?: string | null
    notes?: string | null
    order: number
  }[] = body.parts ?? []

  await prisma.$transaction([
    prisma.jobPart.deleteMany({ where: { jobId: params.id } }),
    prisma.jobPart.createMany({
      data: parts.map((p, idx) => ({
        jobId: params.id,
        label: p.label,
        partNumber: p.partNumber ?? null,
        quantity: p.quantity ?? 1,
        status: p.status ?? 'TO_ORDER',
        deliveryDate: p.deliveryDate ? new Date(p.deliveryDate) : null,
        notes: p.notes ?? null,
        order: p.order ?? idx,
      })),
    }),
  ])

  const updated = await prisma.jobPart.findMany({
    where: { jobId: params.id },
    orderBy: { order: 'asc' },
  })

  return NextResponse.json(updated)
}
