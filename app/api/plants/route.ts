import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const customerId = searchParams.get('customerId')

  const plants = await prisma.plant.findMany({
    where: customerId ? { customerId } : undefined,
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(plants)
}
