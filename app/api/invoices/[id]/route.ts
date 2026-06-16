import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { unlink } from 'fs/promises'
import path from 'path'

const DELETE_ROLES = ['ADMIN', 'SERVICE_MANAGER']

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const role = session.user.role as string
  if (!DELETE_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const invoice = await prisma.invoice.findUnique({ where: { id: params.id } })
  if (!invoice) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

  // Delete file from disk
  try {
    const filePath = path.join(process.cwd(), 'public', invoice.fileUrl)
    await unlink(filePath)
  } catch {
    // File may already be gone — proceed with DB deletion
  }

  await prisma.invoice.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
