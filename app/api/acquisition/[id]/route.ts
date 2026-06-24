import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkPermission } from '@/lib/permissions'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  if (!(await checkPermission(session, 'customers', 'view')))
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })

  const { id } = await params
  const check = await prisma.acquisitionCheck.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, name: true, address: true } },
    },
  })

  if (!check) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
  return NextResponse.json(check)
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  if (!(await checkPermission(session, 'customers', 'delete')))
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })

  const { id } = await params
  await prisma.acquisitionCheck.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
