/// <reference types="node" />
/**
 * Optionales, idempotentes Migrationsskript.
 *
 * Legt für jeden Kunden, der Anlagen oder Hotels OHNE Standort hat, einen
 * "Hauptstandort" aus der Kundenadresse an und ordnet die noch nicht
 * zugeordneten Anlagen und Hotels diesem Standort zu. So landet nach der
 * Einführung der Standort-Ebene nichts unter "Nicht zugeordnet".
 *
 * Gefahrlos mehrfach ausführbar — bereits zugeordnete Datensätze bleiben unberührt.
 *
 * Aufruf:
 *   npx ts-node --transpile-only --compiler-options '{"module":"CommonJS"}' prisma/scripts/assign-default-sites.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const DEFAULT_SITE_NAME = 'Hauptstandort'

async function main() {
  const customers = await prisma.customer.findMany({
    select: { id: true, name: true, address: true },
  })

  let created = 0
  let plantsMoved = 0
  let hotelsMoved = 0

  for (const customer of customers) {
    const unassignedPlants = await prisma.plant.count({ where: { customerId: customer.id, siteId: null } })
    const unassignedHotels = await prisma.hotel.count({ where: { customerId: customer.id, siteId: null } })
    if (unassignedPlants === 0 && unassignedHotels === 0) continue

    // Reuse an existing default site if the script ran before
    let site = await prisma.site.findFirst({
      where: { customerId: customer.id, name: DEFAULT_SITE_NAME },
      select: { id: true },
    })
    if (!site) {
      site = await prisma.site.create({
        data: {
          customerId: customer.id,
          name: DEFAULT_SITE_NAME,
          address: customer.address ?? null,
        },
        select: { id: true },
      })
      created++
    }

    if (unassignedPlants > 0) {
      const res = await prisma.plant.updateMany({
        where: { customerId: customer.id, siteId: null },
        data: { siteId: site.id },
      })
      plantsMoved += res.count
    }
    if (unassignedHotels > 0) {
      const res = await prisma.hotel.updateMany({
        where: { customerId: customer.id, siteId: null },
        data: { siteId: site.id },
      })
      hotelsMoved += res.count
    }

    console.log(`✓ ${customer.name}: ${unassignedPlants} Anlagen, ${unassignedHotels} Hotels → "${DEFAULT_SITE_NAME}"`)
  }

  console.log(`\nFertig. Standorte angelegt: ${created}, Anlagen zugeordnet: ${plantsMoved}, Hotels zugeordnet: ${hotelsMoved}.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
