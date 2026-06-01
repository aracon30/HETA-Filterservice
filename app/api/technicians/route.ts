import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const technicians = await prisma.user.findMany({
    where: {
      role: { in: ['ADMIN', 'SERVICE_MANAGER', 'SERVICE_TECHNICIAN'] },
      active: true,
    },
    select: { id: true, name: true, role: true },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(technicians)
}
