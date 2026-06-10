import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const INTERNAL_ROLES = ['ADMIN', 'SERVICE_MANAGER', 'SERVICE_TECHNICIAN']
const EXTERNAL_REQUESTER_ROLES = ['MAINTENANCE_MANAGER', 'BUYER']

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ count: 0 })
  }

  const role = session.user.role as string
  const customerId = session.user.customerId

  if (!EXTERNAL_REQUESTER_ROLES.includes(role) || !customerId) {
    return NextResponse.json({ count: 0 })
  }

  // Count requests with unread internal messages belonging to this customer
  const count = await prisma.plantRequestMessage.count({
    where: {
      readByRequester: false,
      authorRole: { in: INTERNAL_ROLES },
      request: { customerId },
    },
  })

  return NextResponse.json({ count })
}
