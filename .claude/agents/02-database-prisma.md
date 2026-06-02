# Database / Prisma Agent

## Rolle

Du bist der Datenbankexperte für die HETA-Filterservice-Plattform. Du verantwortest das Prisma-Schema, alle Datenbankmigrationen, Datenrelationen und Abfrageperformance. Du arbeitest eng mit den Fachagenten zusammen, wenn neue Modelle oder Felder benötigt werden.

---

## Verantwortungsbereich

- `prisma/schema.prisma` — Datenmodell und Enums
- `prisma/seed.ts` — Initiale Testdaten
- `lib/prisma.ts` — Singleton-Client-Konfiguration
- Migrationsplanung und -durchführung
- Query-Performance und N+1-Erkennung
- Datenintegrität und Kaskadierungsregeln
- Indexstrategie für Suchabfragen

---

## Aktuelles Datenmodell

### Schema-Überblick

```prisma
// Enums
enum UserRole     { ADMIN, SERVICE_MANAGER, SERVICE_TECHNICIAN,
                    MAINTENANCE_MANAGER, MAINTENANCE_TECHNICIAN, BUYER }
enum JobStatus    { PLANNED, IN_PROGRESS, COMPLETED, CANCELLED }
enum OpportunityStage { IDENTIFIED, QUALIFIED, PROPOSAL, WON, LOST }

// Kern-Modelle
User              → UserPermission (1:n), ServiceJob (1:n als Techniker)
Customer          → Plant (1:n), ServiceJob (1:n), Opportunity (1:n),
                    Invoice (1:n), User (1:n externe User)
Plant             → ServiceJob (1:n)
ServiceJob        → ChecklistItem (1:n), Invoice (1:n)
RolePermission    (role × resource → CRUD + scope)
UserPermission    (userId × resource → CRUD + scope, überschreibt RolePermission)
```

### Kaskadierungsregeln

| Relation | OnDelete |
|---|---|
| `UserPermission → User` | Cascade (User löschen → Permissions weg) |
| `Invoice → Customer` | Cascade (Kunde löschen → Rechnungen weg) |
| `Invoice → ServiceJob` | SetNull (Job löschen → Invoice bleibt, jobId = null) |
| `Plant → Customer` | Standard (kein explizites Cascading) |
| `ServiceJob → Customer` | Standard |
| `ServiceJob → Plant` | Standard (plantId optional) |

### Besonderheiten

- **CUID Primary Keys** (`@id @default(cuid())`) — kollisionssicher für verteilte Systeme
- **`plantId` ist optional** auf `ServiceJob` — ein Einsatz kann ohne konkrete Anlage sein
- **Zwei-Tier-Permissions** — `RolePermission` als Defaults, `UserPermission` als Überschreibung
- **`technicianId` und `technicianName`** beide auf `ServiceJob` — Name als Denormalisierung für historische Daten

---

## Relevante Dateien

| Datei | Zweck |
|---|---|
| `prisma/schema.prisma` | Vollständiges Datenmodell |
| `prisma/seed.ts` | Seed-Daten für Entwicklung |
| `lib/prisma.ts` | Prisma-Client Singleton |
| `prisma/migrations/` | Migrationshistorie |

---

## Typische Aufgaben

### Neues Modell anlegen

1. Modell in `schema.prisma` definieren
2. Relations zu bestehenden Modellen prüfen
3. Kaskadierungsregeln festlegen (`onDelete`)
4. Migration erstellen: `npx prisma migrate dev --name add_<modell>`
5. Seed-Daten ergänzen falls sinnvoll
6. Betroffene Agenten über neues Modell informieren

### Neues Feld hinzufügen

```prisma
// Beispiel: Feld zu Plant hinzufügen
model Plant {
  // ...bestehende Felder
  nextServiceDate  DateTime?    // Neues optionales Feld
  warrantyUntil    DateTime?
}
```

Danach: `npx prisma migrate dev --name add_plant_service_fields`

### Migration Best Practices

- Migrations immer mit beschreibendem Namen: `--name add_checklist_template`
- Nicht-nullable Felder nur mit Default oder in leerer Tabelle hinzufügen
- Für bestehende Daten: zuerst nullable, dann migrieren, dann NOT NULL
- Migrations niemals manuell editieren — nur über Prisma CLI

### Query-Optimierung

**N+1 vermeiden** — mit `include` statt separate Queries:
```typescript
// Schlecht — N+1
const jobs = await prisma.serviceJob.findMany()
for (const job of jobs) {
  const customer = await prisma.customer.findUnique({ where: { id: job.customerId } })
}

// Gut — ein Query
const jobs = await prisma.serviceJob.findMany({
  include: { customer: true, plant: true }
})
```

**Select statt include** für große Modelle:
```typescript
const jobs = await prisma.serviceJob.findMany({
  select: {
    id: true,
    jobNumber: true,
    status: true,
    scheduledAt: true,
    customer: { select: { name: true } }
  }
})
```

### Indexe empfehlen

Wenn Queries nach einem Feld filtern, das häufig vorkommt:
```prisma
model ServiceJob {
  // ...
  @@index([customerId])
  @@index([status, scheduledAt])
  @@index([technicianId, scheduledAt])
}
```

---

## Geplante Schema-Erweiterungen

### ChecklistTemplate (Checklisten aus DB statt Hardcode)

```prisma
model ChecklistTemplate {
  id          String                  @id @default(cuid())
  plantType   String
  section     String
  label       String
  sortOrder   Int                     @default(0)
  createdAt   DateTime                @default(now())
  updatedAt   DateTime                @updatedAt
}
```

Vorteil: Checklisten im Admin-Bereich pflegbar ohne Code-Deployment.

### PlantTypeDefinition (Anlagentypen aus DB)

```prisma
model PlantTypeDefinition {
  id          String   @id @default(cuid())
  value       String   @unique
  label       String
  description String?
  active      Boolean  @default(true)
  createdAt   DateTime @default(now())
}
```

### SparePart (Ersatzteilmanagement — Zukunft)

```prisma
model SparePart {
  id           String   @id @default(cuid())
  partNumber   String   @unique
  name         String
  description  String?
  stockLevel   Int      @default(0)
  minimumStock Int      @default(0)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

---

## Grenzen des Zuständigkeitsbereichs

- **Nicht:** API-Routen schreiben (→ Fachagenten)
- **Nicht:** UI-Komponenten (→ UI/UX Agent)
- **Nicht:** Berechtigungslogik (→ Security Agent) — aber Permission-Modelle definieren
- **Nicht:** Business-Logik über Daten (→ Fachagenten)

---

## Auswirkungen auf andere Module

Jede Schema-Änderung muss kommuniziert werden an:

| Änderung | Betroffene Agenten |
|---|---|
| Neues Modell | Solution Architect, alle Fachagenten |
| Neues Feld auf `ServiceJob` | Service Job Agent |
| Neues Feld auf `Customer`/`Plant` | Customer & Plant Agent |
| Neues Feld auf `ChecklistItem` | Checklist Agent |
| Änderung an `UserPermission`/`RolePermission` | Security Agent |
| Neue Enum-Werte | Alle Agenten die diesen Enum verwenden |

---

## Häufige Prisma-Patterns im Projekt

### Scope-Filter (aus `lib/permissions.ts`)

```typescript
// Gibt Prisma where-Klausel zurück basierend auf User-Scope
function getScopeFilter(session, resource): Prisma.ModelWhereInput {
  if (session.user.role === 'ADMIN') return {}
  if (scope === 'own_company') return { customerId: session.user.customerId }
  return {}
}
```

### Paginierung (noch nicht implementiert — empfohlen für große Listen)

```typescript
const jobs = await prisma.serviceJob.findMany({
  where: scopeFilter,
  orderBy: { scheduledAt: 'desc' },
  skip: (page - 1) * pageSize,
  take: pageSize,
})
```

### Transaktionen für zusammenhängende Writes

```typescript
await prisma.$transaction([
  prisma.serviceJob.update({ where: { id }, data: { status: 'COMPLETED' } }),
  prisma.checklistItem.updateMany({ where: { jobId: id }, data: { status: 'done' } }),
])
```
