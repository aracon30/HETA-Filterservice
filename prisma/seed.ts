import { PrismaClient, UserRole } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Clean up
  await prisma.checklistItem.deleteMany()
  await prisma.serviceJob.deleteMany()
  await prisma.opportunity.deleteMany()
  await prisma.plantChecklistOverride.deleteMany()
  await prisma.plant.deleteMany()
  await prisma.plantTypeChecklistItem.deleteMany()
  await prisma.plantType.deleteMany()
  await prisma.user.deleteMany()
  await prisma.customer.deleteMany()

  // Plant types with checklists
  await prisma.plantType.create({
    data: {
      value: 'Verladearm',
      label: 'Verladearm',
      items: {
        create: [
          { section: 'Unterlagen', label: 'Unbedenklichkeitsbescheinigung vorhanden', order: 0 },
          { section: 'Unterlagen', label: 'Freigabeschein vorhanden', order: 1 },
          { section: 'Unterlagen', label: 'Sicherheitsunterweisung durchgeführt', order: 2 },
          { section: 'Visuelle Begutachtung', label: 'Oberfläche geprüft', order: 3 },
          { section: 'Visuelle Begutachtung', label: 'Schnittstellen geprüft', order: 4 },
          { section: 'Visuelle Begutachtung', label: 'Winkel geprüft', order: 5 },
          { section: 'Visuelle Begutachtung', label: 'Kupplung geprüft', order: 6 },
          { section: 'Visuelle Begutachtung', label: 'Gesamteindruck geprüft', order: 7 },
          { section: 'Federzylinder', label: 'Sichtprüfung Federzylinder', order: 8 },
          { section: 'Federzylinder', label: 'Vollständigkeitsüberprüfung Federzylinder', order: 9 },
          { section: 'Federzylinder', label: 'Balancierung geprüft', order: 10 },
          { section: 'Federzylinder', label: 'Sicherheit Federzylinder geprüft', order: 11 },
          { section: 'Drehgelenke – Leckagen', label: 'Drehgelenk 1 auf Leckage geprüft', order: 12 },
          { section: 'Drehgelenke – Leckagen', label: 'Drehgelenk 2 auf Leckage geprüft', order: 13 },
          { section: 'Drehgelenke – Leckagen', label: 'Drehgelenk 3 auf Leckage geprüft', order: 14 },
          { section: 'Drehgelenke – Leckagen', label: 'Drehgelenk 4 auf Leckage geprüft', order: 15 },
          { section: 'Drehgelenke – Leckagen', label: 'Drehgelenk 5 auf Leckage geprüft', order: 16 },
          { section: 'Drehgelenke – Leckagen', label: 'Drehgelenk 6 auf Leckage geprüft', order: 17 },
          { section: 'Drehgelenke – Leichtgängigkeit & Verschleiß', label: 'Drehgelenk 1 Leichtgängigkeit und Verschleiß', order: 18 },
          { section: 'Drehgelenke – Leichtgängigkeit & Verschleiß', label: 'Drehgelenk 2 Leichtgängigkeit und Verschleiß', order: 19 },
          { section: 'Drehgelenke – Leichtgängigkeit & Verschleiß', label: 'Drehgelenk 3 Leichtgängigkeit und Verschleiß', order: 20 },
          { section: 'Drehgelenke – Leichtgängigkeit & Verschleiß', label: 'Drehgelenk 4 Leichtgängigkeit und Verschleiß', order: 21 },
          { section: 'Drehgelenke – Leichtgängigkeit & Verschleiß', label: 'Drehgelenk 5 Leichtgängigkeit und Verschleiß', order: 22 },
          { section: 'Drehgelenke – Leichtgängigkeit & Verschleiß', label: 'Drehgelenk 6 Leichtgängigkeit und Verschleiß', order: 23 },
          { section: 'Drehgelenke – Vollständigkeit', label: 'Drehgelenk 1 Vollständigkeit geprüft', order: 24 },
          { section: 'Drehgelenke – Vollständigkeit', label: 'Drehgelenk 2 Vollständigkeit geprüft', order: 25 },
          { section: 'Drehgelenke – Vollständigkeit', label: 'Drehgelenk 3 Vollständigkeit geprüft', order: 26 },
          { section: 'Drehgelenke – Vollständigkeit', label: 'Drehgelenk 4 Vollständigkeit geprüft', order: 27 },
          { section: 'Drehgelenke – Vollständigkeit', label: 'Drehgelenk 5 Vollständigkeit geprüft', order: 28 },
          { section: 'Drehgelenke – Vollständigkeit', label: 'Drehgelenk 6 Vollständigkeit geprüft', order: 29 },
        ],
      },
    },
  })

  for (const typeValue of ['Druckfilter', 'Saugfilter', 'Rücklauffilter', 'Belüftungsfilter', 'Filteraggregat', 'Sonstige']) {
    await prisma.plantType.create({ data: { value: typeValue, label: typeValue } })
  }

  // Admin user
  await prisma.user.create({
    data: {
      name: 'Administrator',
      email: 'admin@heta.de',
      password: await bcrypt.hash('Admin1234!', 12),
      role: UserRole.ADMIN,
    },
  })

  console.log('Seeding complete!')
  console.log('')
  console.log('Admin-Zugangsdaten:')
  console.log('  E-Mail:   admin@heta.de')
  console.log('  Passwort: Admin1234!')
  console.log('')
  console.log('Bitte das Passwort nach dem ersten Login ändern!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
