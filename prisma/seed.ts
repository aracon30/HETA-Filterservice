import { PrismaClient, JobStatus, OpportunityStage } from '@prisma/client'

const prisma = new PrismaClient()

const DEFAULT_CHECKLIST = [
  'Sichtprüfung Gehäuse und Dichtungen',
  'Differenzdruckmessung durchgeführt',
  'Filterelemente auf Zustand geprüft',
  'Reinigung Filtergehäuse',
  'Dichtheit nach Zusammenbau geprüft',
  'Betriebsparameter dokumentiert (Druck, Durchfluss, Temperatur)',
  'Ventile und Armaturen geprüft',
  'Elektrische Anschlüsse geprüft (falls vorhanden)',
  'Kundenpersonal eingewiesen',
  'Servicebericht unterzeichnet',
]

async function main() {
  console.log('Seeding database...')

  // Clean up
  await prisma.checklistItem.deleteMany()
  await prisma.serviceJob.deleteMany()
  await prisma.opportunity.deleteMany()
  await prisma.plant.deleteMany()
  await prisma.customer.deleteMany()

  // Customer 1: Chemiewerk Rhein GmbH
  const customer1 = await prisma.customer.create({
    data: {
      name: 'Chemiewerk Rhein GmbH',
      contactName: 'Dr. Thomas Bremer',
      email: 't.bremer@chemiewerk-rhein.de',
      phone: '+49 221 98765-0',
      address: 'Industriestraße 12, 50668 Köln',
    },
  })

  const plant1a = await prisma.plant.create({
    data: {
      name: 'Filteranlage A – Produktionslinie 1',
      type: 'Druckfilter',
      serialNumber: 'DF-2021-001',
      location: 'Halle A, Ebene 2',
      installedAt: new Date('2021-03-15'),
      customerId: customer1.id,
    },
  })

  const plant1b = await prisma.plant.create({
    data: {
      name: 'Filteranlage B – Kühlwasserkreislauf',
      type: 'Bandfilter',
      serialNumber: 'BF-2019-042',
      location: 'Technikraum Ost',
      installedAt: new Date('2019-07-01'),
      customerId: customer1.id,
    },
  })

  // Customer 2: Metallwerk Saar AG
  const customer2 = await prisma.customer.create({
    data: {
      name: 'Metallwerk Saar AG',
      contactName: 'Ingrid Hoffmann',
      email: 'i.hoffmann@metallwerk-saar.de',
      phone: '+49 681 4455-200',
      address: 'Saarbrücker Weg 5, 66111 Saarbrücken',
    },
  })

  const plant2a = await prisma.plant.create({
    data: {
      name: 'Zentralfiltration Schmierstoffe',
      type: 'Magnetfilter',
      serialNumber: 'MF-2020-007',
      location: 'Maschinenhalle 3',
      installedAt: new Date('2020-11-20'),
      customerId: customer2.id,
    },
  })

  const plant2b = await prisma.plant.create({
    data: {
      name: 'Prozesswasseraufbereitung',
      type: 'Mehrschichtfilter',
      serialNumber: 'MSF-2022-015',
      location: 'Außenbereich Süd',
      installedAt: new Date('2022-02-14'),
      customerId: customer2.id,
    },
  })

  // Customer 3: Pharmalogistik Bayern GmbH
  const customer3 = await prisma.customer.create({
    data: {
      name: 'Pharmalogistik Bayern GmbH',
      contactName: 'Markus Steinberger',
      email: 'm.steinberger@pharmalogistik-by.de',
      phone: '+49 89 34567-100',
      address: 'Münchner Str. 88, 80331 München',
    },
  })

  const plant3a = await prisma.plant.create({
    data: {
      name: 'Reinstwasserfilter RO-Anlage',
      type: 'Umkehrosmosefilter',
      serialNumber: 'RO-2023-003',
      location: 'Reinraum EG',
      installedAt: new Date('2023-01-10'),
      customerId: customer3.id,
    },
  })

  const plant3b = await prisma.plant.create({
    data: {
      name: 'HEPA-Luftfiltration Lager',
      type: 'HEPA-Filter',
      serialNumber: 'HEPA-2022-011',
      location: 'Lagergebäude B',
      installedAt: new Date('2022-09-05'),
      customerId: customer3.id,
    },
  })

  // Service Jobs
  let jobCounter = 1000

  const createJob = async (
    customerId: string,
    plantId: string | null,
    status: JobStatus,
    scheduledAt: Date,
    technicianName: string,
    description: string,
    findings?: string,
    recommendations?: string,
    completedAt?: Date
  ) => {
    jobCounter++
    return prisma.serviceJob.create({
      data: {
        jobNumber: `SJ-${jobCounter}`,
        status,
        scheduledAt,
        completedAt,
        customerId,
        plantId,
        technicianName,
        description,
        findings,
        recommendations,
        checklistItems: {
          create: DEFAULT_CHECKLIST.map((label, i) => ({
            label,
            checked: status === JobStatus.COMPLETED ? true : i < 3 && status === JobStatus.IN_PROGRESS,
          })),
        },
      },
    })
  }

  // Jobs for Customer 1
  await createJob(
    customer1.id, plant1a.id, JobStatus.COMPLETED,
    new Date('2024-01-15'), 'Klaus Meier',
    'Halbjährliche Wartung Druckfilter Produktionslinie 1',
    'Filterelemente stark verschmutzt, Dichtung am Einlassflansch leicht undicht',
    'Dichtung ausgetauscht, Filterelemente erneuert. Nächste Wartung in 6 Monaten.',
    new Date('2024-01-15')
  )

  await createJob(
    customer1.id, plant1b.id, JobStatus.IN_PROGRESS,
    new Date('2024-03-18'), 'Anna Schulz',
    'Inspektion Bandfilter Kühlwasserkreislauf – Routinecheck',
    'Bandverschleiß im normalen Bereich',
    undefined,
    undefined
  )

  await createJob(
    customer1.id, plant1a.id, JobStatus.PLANNED,
    new Date('2024-04-10'), 'Klaus Meier',
    'Halbjährliche Wartung Druckfilter – Frühjahrsservice',
    undefined, undefined, undefined
  )

  // Jobs for Customer 2
  await createJob(
    customer2.id, plant2a.id, JobStatus.COMPLETED,
    new Date('2024-02-20'), 'Peter Baum',
    'Reinigung und Inspektion Magnetfilter',
    'Starke Metallpartikel-Ansammlung. System arbeitete nahe Kapazitätsgrenze.',
    'Reinigungsintervall von 3 auf 2 Monate reduzieren.',
    new Date('2024-02-20')
  )

  await createJob(
    customer2.id, plant2b.id, JobStatus.PLANNED,
    new Date('2024-03-25'), 'Anna Schulz',
    'Jahresinspektion Mehrschichtfilter Prozesswasseraufbereitung',
    undefined, undefined, undefined
  )

  await createJob(
    customer2.id, plant2a.id, JobStatus.PLANNED,
    new Date('2024-04-20'), 'Peter Baum',
    'Routinereinigung Magnetfilter (2-Monats-Intervall)',
    undefined, undefined, undefined
  )

  // Jobs for Customer 3
  await createJob(
    customer3.id, plant3a.id, JobStatus.COMPLETED,
    new Date('2024-01-30'), 'Klaus Meier',
    'Quartalsservice RO-Anlage – Membranprüfung',
    'Membranen in gutem Zustand. Leitfähigkeit Permeat: 2,1 µS/cm (Grenzwert: 5 µS/cm).',
    'Anlage in einwandfreiem Betriebszustand. Nächster Service in 3 Monaten.',
    new Date('2024-01-30')
  )

  await createJob(
    customer3.id, plant3b.id, JobStatus.PLANNED,
    new Date('2024-03-22'), 'Anna Schulz',
    'Jährlicher Filterwechsel HEPA-Anlage Lager B',
    undefined, undefined, undefined
  )

  // Opportunities
  await prisma.opportunity.create({
    data: {
      title: 'Erweiterung Filtration Produktionslinie 2',
      value: 85000,
      stage: OpportunityStage.PROPOSAL,
      customerId: customer1.id,
      notes: 'Anfrage für zweite Produktionslinie. Angebot wurde am 05.03.2024 übergeben. Entscheidung erwartet bis Ende März.',
    },
  })

  await prisma.opportunity.create({
    data: {
      title: 'Wartungsvertrag 2-Jahres Premium',
      value: 24000,
      stage: OpportunityStage.QUALIFIED,
      customerId: customer2.id,
      notes: 'Interesse an Langzeitwartungsvertrag für beide Anlagen. Budgetfreigabe läuft.',
    },
  })

  await prisma.opportunity.create({
    data: {
      title: 'Neue RO-Anlage Reinraum OG',
      value: 120000,
      stage: OpportunityStage.IDENTIFIED,
      customerId: customer3.id,
      notes: 'Geplante Erweiterung Reinraum Obergeschoss. Gespräch mit Technikleitung vereinbart.',
    },
  })

  console.log('Seeding complete!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
