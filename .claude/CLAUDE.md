# HETA-Filterservice — Projektdokumentation

## 1. Projektbeschreibung

HETA-Filterservice ist eine industrielle Serviceplattform zur Verwaltung von Serviceeinsätzen, Anlagen und Kundendaten für das Unternehmen HETA. Die Plattform unterstützt interne Servicetechniker, Servicemanager und externe Kundenzugänge über ein rollenbasiertes Berechtigungssystem.

**Zielgruppe:**
- Interne Servicetechniker und -manager (Planung, Durchführung, Dokumentation)
- Interne Kaufleute und Maintenance-Teams
- Externe Kunden (eingeschränktes Portal für eigene Anlagen und Aufträge)

**Kernfunktionen:**
- Serviceeinsatz-Planung und -Verwaltung mit Kalenderansicht
- Anlagentyp-spezifische Checklisten und Inspektionsberichte
- Kunden- und Anlagenverwaltung
- Verkaufschancen (Opportunities / Pipeline)
- Rechnungsverwaltung mit Datei-Upload
- Rollenbasiertes Berechtigungssystem mit Scope-Filterung
- Admin-Bereich (Benutzerverwaltung, Backup/Restore, Server-Update)

---

## 2. Architekturübersicht

```
┌─────────────────────────────────────────────────────────┐
│                     Next.js 14 App Router                │
├───────────────────────┬─────────────────────────────────┤
│    Frontend (RSC/Client)   │    API Routes (Server)      │
│    app/**/page.tsx         │    app/api/**/route.ts      │
│    components/**           │                             │
├───────────────────────┴─────────────────────────────────┤
│                    lib/ (Shared Logic)                    │
│    auth.ts │ permissions.ts │ prisma.ts │ plant-types.ts │
├─────────────────────────────────────────────────────────┤
│                   Prisma ORM + PostgreSQL                 │
└─────────────────────────────────────────────────────────┘
```

**Request-Flow:**
1. `middleware.ts` prüft JWT-Token → unauthentifiziert → Redirect `/login`
2. API-Route ruft `getServerSession()` → 401 wenn keine Session
3. `checkPermission(session, resource, action)` → 403 wenn keine Berechtigung
4. `getScopeFilter(session, resource)` → filtert Prisma-Query nach Mandant
5. Prisma führt Query aus → JSON-Response

---

## 3. Tech Stack

| Schicht | Technologie | Version |
|---|---|---|
| Framework | Next.js (App Router) | 14.1.0 |
| Sprache | TypeScript | ^5 |
| Styling | Tailwind CSS | ^3.3.0 |
| Authentifizierung | NextAuth.js (JWT + CredentialsProvider) | ^4.24.14 |
| Datenbank | PostgreSQL | — |
| ORM | Prisma | ^5.9.1 |
| Passwort-Hashing | bcryptjs | ^3.0.3 |
| Datumsverarbeitung | date-fns (DE-Locale) | ^4.4.0 |
| Kalender | react-big-calendar | ^1.20.0 |
| Prozessmanager | PM2 | Produktion |

---

## 4. Datenmodellübersicht

### Modelle und Relationen

```
User ──────────────────────► Customer (optional: externe User)
  │                               │
  │ assignedJobs                  ├── Plant[]
  │                               ├── ServiceJob[]
  ▼                               ├── Opportunity[]
ServiceJob ◄────────────── Plant  ├── Invoice[]
  │                               └── User[]
  ├── ChecklistItem[]
  └── Invoice[]

UserPermission (userId + resource → CRUD-Flags + scope)
RolePermission (role + resource → CRUD-Flags + scope)
```

### Modelle im Überblick

| Modell | Beschreibung | Schlüsselfelder |
|---|---|---|
| `User` | Systemnutzer | `role`, `customerId`, `active` |
| `UserPermission` | User-spezifische Berechtigungsüberschreibung | `userId`, `resource`, `scope` |
| `RolePermission` | Rollen-Standardberechtigungen | `role`, `resource`, `scope` |
| `Customer` | Kunden / Mandanten | `name`, `contactName`, `email` |
| `Plant` | Anlagen bei Kunden | `type`, `serialNumber`, `customerId` |
| `ServiceJob` | Serviceeinsätze | `jobNumber`, `status`, `scheduledAt` |
| `ChecklistItem` | Prüfpunkte eines Jobs | `label`, `section`, `status`, `checked` |
| `Invoice` | Rechnungen / Dokumente | `fileUrl`, `customerId`, `jobId` |
| `Opportunity` | Verkaufschancen | `stage`, `value`, `customerId` |

### Enums

```typescript
enum UserRole { ADMIN, SERVICE_MANAGER, SERVICE_TECHNICIAN,
                MAINTENANCE_MANAGER, MAINTENANCE_TECHNICIAN, BUYER }

enum JobStatus { PLANNED, IN_PROGRESS, COMPLETED, CANCELLED }

enum OpportunityStage { IDENTIFIED, QUALIFIED, PROPOSAL, WON, LOST }
```

---

## 5. Rollenmodell

### Rollen und Zugriffsebenen

| Rolle | Beschreibung | Scope |
|---|---|---|
| `ADMIN` | Vollzugriff, Systemverwaltung | `all` |
| `SERVICE_MANAGER` | Serviceleitung, alle Jobs und Kunden | `all` |
| `SERVICE_TECHNICIAN` | Techniker, eigene Jobs und zugewiesene Anlagen | `own_company` / `own` |
| `MAINTENANCE_MANAGER` | Wartungsleitung | `all` |
| `MAINTENANCE_TECHNICIAN` | Wartungstechniker | `own_company` |
| `BUYER` | Einkauf, nur Opportunities und Rechnungen | eingeschränkt |

### Scope-Konzept

- `all` — Zugriff auf alle Datensätze (Admin, Manager)
- `own_company` — Nur Datensätze des eigenen Kunden (`customerId`-Filter)
- `own_plant` — Nur Datensätze eigener Anlagen

**Externe User** (mit gesetztem `customerId`) landen automatisch im Kundenportal (`/portal`) und sehen nur ihre eigenen Daten.

---

## 6. Coding Standards

### TypeScript

- Keine `any`-Typen ohne expliziten Kommentar warum
- Prisma-generierte Typen direkt verwenden (kein redundantes Re-Typing)
- Session-Typen aus `types/next-auth.d.ts` verwenden
- Alle API-Responses als `NextResponse.json(...)` zurückgeben

### API-Routen Pattern

```typescript
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await checkPermission(session, 'resource', 'view')))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const scopeFilter = getScopeFilter(session, 'resource')
  const data = await prisma.model.findMany({ where: scopeFilter, ... })
  return NextResponse.json(data)
}
```

### Komponenten

- Server Components für datenlastige Seiten bevorzugen
- `'use client'` nur wenn nötig (Hooks, Event-Handler, Browser-APIs)
- Tailwind-Klassen direkt im JSX (kein `@apply` außer in `globals.css`)
- Deutsche Labels und Fehlermeldungen in der UI

### Datenbankzugriff

- Immer den Singleton-Client aus `lib/prisma.ts` verwenden
- Transaktionen für mehrere zusammenhängende Writes (`prisma.$transaction`)
- `include` statt separate Queries für Relations
- Keine Raw-SQL außer für Performance-kritische Fälle

---

## 7. Entwicklungsregeln

### Neue Datenbankfelder / Modelle

1. Schema in `prisma/schema.prisma` anpassen
2. `npx prisma migrate dev --name beschreibung` ausführen
3. `prisma/seed.ts` bei Bedarf anpassen
4. Prisma-Client neu generieren: `npx prisma generate`
5. Betroffene API-Routen anpassen
6. Types prüfen (TypeScript-Compiler)

### Neue Anlagentypen und Checklisten

1. Eintrag in `lib/plant-types.ts` → `PLANT_TYPES`-Array
2. `checklist`-Array mit Sektionen und Items befüllen
3. Funktion `getChecklistForPlantType()` greift automatisch darauf zu
4. Kein Backend-Code nötig — Checklist-Generierung in `/api/jobs` läuft automatisch

### Neue Berechtigungen / Ressourcen

1. Ressource in `lib/permissions.ts` → `Resources`-Typ ergänzen
2. Default-Berechtigungen in Seed oder Migration anlegen
3. `getScopeFilter()` bei Bedarf erweitern
4. Frontend-Zugriffe mit `checkPermission()` absichern

### Neue Features — Checkliste

- [ ] Datenmodell mit DB-Agent klären
- [ ] API-Route mit Auth + Permission Guard
- [ ] Scope-Filter prüfen (Mandantentrennung!)
- [ ] Frontend-Komponente (Server oder Client?)
- [ ] Sidebar-Navigation ergänzen (mit Rollenfilter)
- [ ] Seed-Daten bei Bedarf

---

## 8. Sicherheitsrichtlinien

### Authentifizierung

- Alle Routen außer `/login` und `/api/auth/*` sind durch `middleware.ts` geschützt
- Session läuft nach 8 Stunden ab (JWT `maxAge`)
- Passwörter werden mit `bcryptjs` gehasht (kein Klartext)

### Autorisierung

- **Jede API-Route** muss `getServerSession()` aufrufen
- **Jede API-Route** muss `checkPermission()` aufrufen
- **Jede listenbasierte API-Route** muss `getScopeFilter()` verwenden
- Frontend-Guards sind ergänzend, niemals alleinige Absicherung

### Mandantentrennung

- Externe User haben immer ein `customerId` gesetzt
- `getScopeFilter()` gibt bei `own_company`-Scope automatisch `{ customerId }` zurück
- Niemals direkte User-ID-Parameter aus dem Request vertrauen — immer aus Session lesen

### Dateiuploads

- Uploads landen in `public/uploads/` (lokal)
- Dateinamen werden sanitisiert (keine Pfad-Traversal-Möglichkeit)
- Nur authentifizierte User können hochladen

### Admin-Endpoints

- `/api/admin/**` nur für `ADMIN`-Rolle
- Backup-Downloads sind direkter Datenbankzugriff — entsprechend schützen

---

## 9. Vorgehensweise bei neuen Features

### Schritt 1 — Analyse (Solution Architect Agent)
- Einordnung in bestehende Architektur
- Betroffene Modelle und Abhängigkeiten identifizieren
- Anderen Agenten zuweisen

### Schritt 2 — Datenmodell (Database / Prisma Agent)
- Schema-Änderungen designen
- Migration erstellen
- Relations und Indexes definieren

### Schritt 3 — Backend (Service Job / Customer / Checklist Agent)
- API-Route mit Auth + Permission Guard
- Scope-Filter einbauen
- Business-Logik implementieren

### Schritt 4 — Security (Security & Permission Agent)
- Neue Ressource in Permissions aufnehmen
- Rollenberechtigungen setzen
- Mandantentrennung prüfen

### Schritt 5 — Frontend (UI/UX Agent)
- Seiten und Komponenten bauen
- Formulare mit Validierung
- Sidebar-Navigation ergänzen

### Schritt 6 — Review (QA Review Agent)
- TypeScript-Typsicherheit prüfen
- Alle API-Routen auf Auth + Scope geprüft?
- Konsistenz mit bestehenden Patterns?

---

## 10. Agenten-Referenz

| Agent | Datei | Zuständigkeit |
|---|---|---|
| Solution Architect | `agents/01-solution-architect.md` | Gesamtarchitektur, Entscheidungen |
| Database / Prisma | `agents/02-database-prisma.md` | Schema, Migrationen, Performance |
| Customer & Plant | `agents/03-customer-plant.md` | Kunden, Anlagen, Anlagentypen |
| Checklist | `agents/04-checklist.md` | Checklisten, Wartungsvorlagen |
| Service Job | `agents/05-service-job.md` | Jobs, Berichte, Technikerworkflow |
| Security & Permission | `agents/06-security-permission.md` | Auth, Rollen, Mandantentrennung |
| UI / UX | `agents/07-ui-ux.md` | Komponenten, Formulare, Dashboards |
| QA Review | `agents/08-qa-review.md` | Architektur-, Sicherheits-, TS-Prüfung |

---

## 11. Geplante Erweiterungen

| Feature | Status | Betroffene Agenten |
|---|---|---|
| Anlagentyp-spezifische Checklisten aus DB | Geplant | DB, Checklist |
| Verladearm als erster vollständiger Anlagentyp | In Vorbereitung | Customer/Plant, Checklist |
| Kundenportal (Erweiterung) | Geplant | UI/UX, Security |
| Servicehistorie mit Timeline | Geplant | Service Job, UI/UX |
| Predictive Maintenance | Zukunft | DB, Service Job |
| Ersatzteilmanagement | Zukunft | DB, Customer/Plant |
| Smart Monitoring / IoT | Zukunft | DB, Solution Architect |
| PDF-Serviceberichte | Geplant | Service Job, UI/UX |
