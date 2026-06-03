import { PrismaClient, JobStatus, OpportunityStage, UserRole } from '@prisma/client'
import bcrypt from 'bcryptjs'

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
  await prisma.plantChecklistOverride.deleteMany()
  await prisma.plant.deleteMany()
  await prisma.plantTypeChecklistItem.deleteMany()
  await prisma.plantType.deleteMany()
  await prisma.user.deleteMany()
  await prisma.customer.deleteMany()
  await prisma.rolePermission.deleteMany()

  // Seed plant types with checklists
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
    plantIds: string[],
    status: JobStatus,
    scheduledAt: Date,
    _technicianName: string,
    description: string,
    findings?: string,
    recommendations?: string,
    completedAt?: Date,
    duration: number = 60,
    _vehicle?: string
  ) => {
    jobCounter++
    return prisma.serviceJob.create({
      data: {
        orderNumber: `K-${String(jobCounter).padStart(5, '0')}.25-DEMO`,
        status,
        scheduledAt,
        completedAt,
        customerId,
        plants: plantIds.length > 0
          ? { create: plantIds.map((pid, idx) => ({ plantId: pid, order: idx })) }
          : undefined,
        vehicles: [],
        description,
        findings,
        recommendations,
        duration,
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
    customer1.id, [plant1a.id], JobStatus.COMPLETED,
    new Date('2024-01-15'), 'Klaus Meier',
    'Halbjährliche Wartung Druckfilter Produktionslinie 1',
    'Filterelemente stark verschmutzt, Dichtung am Einlassflansch leicht undicht',
    'Dichtung ausgetauscht, Filterelemente erneuert. Nächste Wartung in 6 Monaten.',
    new Date('2024-01-15'), 180, 'HH-HE 123'
  )

  await createJob(
    customer1.id, [plant1b.id], JobStatus.IN_PROGRESS,
    new Date('2024-03-18'), 'Anna Schulz',
    'Inspektion Bandfilter Kühlwasserkreislauf – Routinecheck',
    'Bandverschleiß im normalen Bereich',
    undefined,
    undefined, 90, 'HH-ST 456'
  )

  await createJob(
    customer1.id, [plant1a.id, plant1b.id], JobStatus.PLANNED,
    new Date('2024-04-10'), 'Klaus Meier',
    'Halbjährliche Wartung – Frühjahrsservice (beide Anlagen)',
    undefined, undefined, undefined, 480, 'HH-HE 123'
  )

  // Jobs for Customer 2
  await createJob(
    customer2.id, [plant2a.id], JobStatus.COMPLETED,
    new Date('2024-02-20'), 'Peter Baum',
    'Reinigung und Inspektion Magnetfilter',
    'Starke Metallpartikel-Ansammlung. System arbeitete nahe Kapazitätsgrenze.',
    'Reinigungsintervall von 3 auf 2 Monate reduzieren.',
    new Date('2024-02-20'), 120, 'HH-PB 789'
  )

  await createJob(
    customer2.id, [plant2a.id, plant2b.id], JobStatus.PLANNED,
    new Date('2024-03-25'), 'Anna Schulz',
    'Jahresinspektion – Magnetfilter und Mehrschichtfilter',
    undefined, undefined, undefined, 480, 'HH-ST 456'
  )

  await createJob(
    customer2.id, [plant2a.id], JobStatus.PLANNED,
    new Date('2024-04-20'), 'Peter Baum',
    'Routinereinigung Magnetfilter (2-Monats-Intervall)',
    undefined, undefined, undefined, 60, 'HH-PB 789'
  )

  // Jobs for Customer 3
  await createJob(
    customer3.id, [plant3a.id], JobStatus.COMPLETED,
    new Date('2024-01-30'), 'Klaus Meier',
    'Quartalsservice RO-Anlage – Membranprüfung',
    'Membranen in gutem Zustand. Leitfähigkeit Permeat: 2,1 µS/cm (Grenzwert: 5 µS/cm).',
    'Anlage in einwandfreiem Betriebszustand. Nächster Service in 3 Monaten.',
    new Date('2024-01-30'), 180, 'HH-HE 123'
  )

  await createJob(
    customer3.id, [plant3a.id, plant3b.id], JobStatus.PLANNED,
    new Date('2024-03-22'), 'Anna Schulz',
    'Jährlicher Filterwechsel – RO-Anlage und HEPA-Anlage Lager B',
    undefined, undefined, undefined, 480, 'HH-ST 456'
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

  // ─── Users ───────────────────────────────────────────────────────────────
  console.log('Creating users...')

  const hashPw = (pw: string) => bcrypt.hash(pw, 12)

  await prisma.user.create({
    data: {
      name: 'Administrator',
      email: 'admin@heta.de',
      password: await hashPw('Admin1234!'),
      role: UserRole.ADMIN,
    },
  })

  await prisma.user.create({
    data: {
      name: 'Service Manager',
      email: 'manager@heta.de',
      password: await hashPw('Manager1234!'),
      role: UserRole.SERVICE_MANAGER,
    },
  })

  await prisma.user.create({
    data: {
      name: 'Techniker Intern',
      email: 'techniker@heta.de',
      password: await hashPw('Tech1234!'),
      role: UserRole.SERVICE_TECHNICIAN,
    },
  })

  await prisma.user.create({
    data: {
      name: 'Instandhaltungsleiter Chemiewerk',
      email: 'instandhaltung@chemiewerk.de',
      password: await hashPw('Kunde1234!'),
      role: UserRole.MAINTENANCE_MANAGER,
      customerId: customer1.id,
    },
  })

  await prisma.user.create({
    data: {
      name: 'Techniker Chemiewerk',
      email: 'techniker@chemiewerk.de',
      password: await hashPw('Kunde1234!'),
      role: UserRole.MAINTENANCE_TECHNICIAN,
      customerId: customer1.id,
    },
  })

  await prisma.user.create({
    data: {
      name: 'Einkäufer Chemiewerk',
      email: 'einkauf@chemiewerk.de',
      password: await hashPw('Kunde1234!'),
      role: UserRole.BUYER,
      customerId: customer1.id,
    },
  })

  // ─── Role Permissions ─────────────────────────────────────────────────────
  console.log('Creating role permissions...')

  type PermInput = {
    role: UserRole
    resource: string
    canView: boolean
    canCreate: boolean
    canEdit: boolean
    canDelete: boolean
    scope: string
  }

  const permissions: PermInput[] = [
    // ADMIN – all CRUD, all resources, scope=all (immutable)
    ...['customers', 'plants', 'jobs', 'checklist', 'opportunities', 'users'].map((r) => ({
      role: UserRole.ADMIN, resource: r,
      canView: true, canCreate: true, canEdit: true, canDelete: true, scope: 'all',
    })),

    // SERVICE_MANAGER – full operational access, view-only users
    ...['customers', 'plants', 'jobs', 'checklist', 'opportunities'].map((r) => ({
      role: UserRole.SERVICE_MANAGER, resource: r,
      canView: true, canCreate: true, canEdit: true, canDelete: true, scope: 'all',
    })),
    { role: UserRole.SERVICE_MANAGER, resource: 'users', canView: true, canCreate: false, canEdit: false, canDelete: false, scope: 'all' },

    // SERVICE_TECHNICIAN
    { role: UserRole.SERVICE_TECHNICIAN, resource: 'customers', canView: true, canCreate: false, canEdit: false, canDelete: false, scope: 'all' },
    { role: UserRole.SERVICE_TECHNICIAN, resource: 'plants', canView: true, canCreate: false, canEdit: false, canDelete: false, scope: 'all' },
    { role: UserRole.SERVICE_TECHNICIAN, resource: 'jobs', canView: true, canCreate: true, canEdit: true, canDelete: false, scope: 'all' },
    { role: UserRole.SERVICE_TECHNICIAN, resource: 'checklist', canView: true, canCreate: false, canEdit: true, canDelete: false, scope: 'all' },
    { role: UserRole.SERVICE_TECHNICIAN, resource: 'opportunities', canView: false, canCreate: false, canEdit: false, canDelete: false, scope: 'all' },
    { role: UserRole.SERVICE_TECHNICIAN, resource: 'users', canView: false, canCreate: false, canEdit: false, canDelete: false, scope: 'all' },

    // MAINTENANCE_MANAGER – externe Rolle: nur Lesen, kein Vertrieb/Benutzer
    { role: UserRole.MAINTENANCE_MANAGER, resource: 'customers',     canView: true,  canCreate: false, canEdit: false, canDelete: false, scope: 'own_company' },
    { role: UserRole.MAINTENANCE_MANAGER, resource: 'plants',        canView: true,  canCreate: false, canEdit: false, canDelete: false, scope: 'own_company' },
    { role: UserRole.MAINTENANCE_MANAGER, resource: 'jobs',          canView: true,  canCreate: false, canEdit: false, canDelete: false, scope: 'own_company' },
    { role: UserRole.MAINTENANCE_MANAGER, resource: 'checklist',     canView: false, canCreate: false, canEdit: false, canDelete: false, scope: 'all' },
    { role: UserRole.MAINTENANCE_MANAGER, resource: 'opportunities', canView: false, canCreate: false, canEdit: false, canDelete: false, scope: 'all' },
    { role: UserRole.MAINTENANCE_MANAGER, resource: 'users',         canView: false, canCreate: false, canEdit: false, canDelete: false, scope: 'all' },

    // MAINTENANCE_TECHNICIAN – externe Rolle: nur Lesen, kein Vertrieb/Benutzer
    { role: UserRole.MAINTENANCE_TECHNICIAN, resource: 'customers',     canView: true,  canCreate: false, canEdit: false, canDelete: false, scope: 'own_company' },
    { role: UserRole.MAINTENANCE_TECHNICIAN, resource: 'plants',        canView: true,  canCreate: false, canEdit: false, canDelete: false, scope: 'own_plant' },
    { role: UserRole.MAINTENANCE_TECHNICIAN, resource: 'jobs',          canView: true,  canCreate: false, canEdit: false, canDelete: false, scope: 'own_plant' },
    { role: UserRole.MAINTENANCE_TECHNICIAN, resource: 'checklist',     canView: true,  canCreate: false, canEdit: false, canDelete: false, scope: 'own_plant' },
    { role: UserRole.MAINTENANCE_TECHNICIAN, resource: 'opportunities', canView: false, canCreate: false, canEdit: false, canDelete: false, scope: 'all' },
    { role: UserRole.MAINTENANCE_TECHNICIAN, resource: 'users',         canView: false, canCreate: false, canEdit: false, canDelete: false, scope: 'all' },

    // BUYER – externe Rolle: nur Lesen, kein Vertrieb/Benutzer
    { role: UserRole.BUYER, resource: 'customers',     canView: true,  canCreate: false, canEdit: false, canDelete: false, scope: 'own_company' },
    { role: UserRole.BUYER, resource: 'plants',        canView: true,  canCreate: false, canEdit: false, canDelete: false, scope: 'own_company' },
    { role: UserRole.BUYER, resource: 'jobs',          canView: true,  canCreate: false, canEdit: false, canDelete: false, scope: 'own_company' },
    { role: UserRole.BUYER, resource: 'checklist',     canView: false, canCreate: false, canEdit: false, canDelete: false, scope: 'all' },
    { role: UserRole.BUYER, resource: 'opportunities', canView: false, canCreate: false, canEdit: false, canDelete: false, scope: 'all' },
    { role: UserRole.BUYER, resource: 'users',         canView: false, canCreate: false, canEdit: false, canDelete: false, scope: 'all' },
  ]

  for (const perm of permissions) {
    await prisma.rolePermission.create({ data: perm })
  }

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
