import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkPermission } from '@/lib/permissions'
import type { AcquisitionPlant } from '@/lib/acquisition-types'
import { ACQUISITION_PLANT_TYPES } from '@/lib/acquisition-types'

function plantTypeLabel(types: string[]) {
  return types.map((t) => ACQUISITION_PLANT_TYPES.find((p) => p.value === t)?.label ?? t).join(' + ')
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  if (!(await checkPermission(session, 'plants', 'create')))
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })

  const { id } = await params
  const check = await prisma.acquisitionCheck.findUnique({ where: { id } })
  if (!check) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

  const body = await request.json()
  const checkWithSite = check as typeof check & { siteId?: string | null }
  const siteId: string | null = body.siteId ?? checkWithSite.siteId ?? null

  // Validate site belongs to customer
  if (siteId) {
    const site = await prisma.site.findUnique({ where: { id: siteId }, select: { customerId: true } })
    if (!site || site.customerId !== check.customerId)
      return NextResponse.json({ error: 'Ungültiger Standort' }, { status: 400 })
  }

  const acquisitionPlants = check.plants as AcquisitionPlant[]

  const created = await prisma.$transaction(
    acquisitionPlants.map((plant, i) => {
      const typePrimary = plant.types[0] ?? 'other'
      const name = plant.modelDesignation
        ? `${plant.modelDesignation}${plant.manufacturer ? ' (' + plant.manufacturer + ')' : ''}`
        : plant.manufacturer
        ? `${plantTypeLabel(plant.types)} — ${plant.manufacturer}`
        : `${plantTypeLabel(plant.types) || 'Anlage'} ${i + 1}`

      const buildYearNum = plant.buildYear ? parseInt(plant.buildYear) : null

      return prisma.plant.create({
        data: {
          name,
          type: typePrimary,
          customerId: check.customerId,
          siteId: siteId || null,
          manufacturer: plant.manufacturer || null,
          model: plant.modelDesignation || null,
          serialNumber: plant.serialNumber || null,
          buildYear: buildYearNum && !isNaN(buildYearNum) ? buildYearNum : null,
          description: [
            plant.medium ? `Medium: ${plant.medium}` : '',
            plant.operatingPressure ? `Betriebsdruck: ${plant.operatingPressure}` : '',
            plant.flowRate ? `Durchfluss: ${plant.flowRate}` : '',
            plant.nominalPower ? `Nennleistung: ${plant.nominalPower}` : '',
            plant.operatingHours ? `Betriebsstunden: ${plant.operatingHours}` : '',
            plant.additionalInfo ?? '',
          ].filter(Boolean).join('\n') || null,
        },
      })
    })
  )

  return NextResponse.json({ created: created.length, plants: created })
}
