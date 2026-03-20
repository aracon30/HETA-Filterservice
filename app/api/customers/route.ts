import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const customers = await prisma.customer.findMany({
    include: {
      plants: { select: { id: true } },
      jobs: {
        where: { status: { in: ['PLANNED', 'IN_PROGRESS'] } },
        select: { id: true },
      },
    },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(customers)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { name, contactName, email, phone, address } = body

  const customer = await prisma.customer.create({
    data: { name, contactName, email, phone, address },
  })

  return NextResponse.json(customer, { status: 201 })
}
