# Service Job Agent

## Rolle

Du verantwortest den vollständigen Lebenszyklus von Serviceeinsätzen in der HETA-Filterservice-Plattform: von der Planung über die Durchführung bis zum abgeschlossenen Servicebericht. Das schließt die Techniker-Zuweisung, den Kalender und die Rechnungsverwaltung ein.

---

## Verantwortungsbereich

- Serviceeinsatz-CRUD (Anlegen, Bearbeiten, Status-Änderung)
- Techniker-Zuweisung und Verfügbarkeitsplanung
- Kalenderansicht und Drag-and-Drop-Rescheduling
- Unterschriften (Techniker + Kunde)
- Befunde, Empfehlungen und Fertigstellung
- Rechnungsverwaltung pro Einsatz (`Invoice`)
- Serviceberichte (Ergebnisse dokumentieren)

---

## Relevante Dateien

| Datei | Zweck |
|---|---|
| `app/jobs/page.tsx` | Jobliste mit Filter (Status, Suche, Kunde) |
| `app/jobs/new/page.tsx` | Neuen Serviceeinsatz anlegen |
| `app/jobs/[id]/page.tsx` | Job-Detail, Checkliste, Unterschriften |
| `app/calendar/page.tsx` | Kalenderansicht aller Jobs |
| `app/api/jobs/route.ts` | GET (Liste), POST (Erstellen) |
| `app/api/jobs/[id]/route.ts` | GET, PUT, DELETE |
| `app/api/calendar/route.ts` | GET Kalender-Events |
| `app/api/technicians/route.ts` | GET verfügbare Techniker |
| `app/api/availability/route.ts` | GET Techniker-Verfügbarkeit |
| `components/JobCalendar.tsx` | Kalender-Komponente |
| `components/InvoicePanel.tsx` | Rechnungs-UI-Komponente |
| `components/StatusBadge.tsx` | Status-Anzeige |
| `lib/constants.ts` | `JOB_STATUS_LABELS` (Deutsche Labels) |

---

## Datenmodell

### ServiceJob

```prisma
model ServiceJob {
  id              String          @id @default(cuid())
  jobNumber       String          @unique   // Auto-generiert: SJ-1001
  status          JobStatus       @default(PLANNED)
  scheduledAt     DateTime        // Geplanter Termin
  completedAt     DateTime?       // Tatsächliches Abschlussdatum
  customerId      String
  customer        Customer        @relation(...)
  plantId         String?         // Optional — Einsatz ohne konkrete Anlage möglich
  plant           Plant?          @relation(...)
  technicianId    String?
  technician      User?           @relation("TechnicianJobs", ...)
  technicianName  String?         // Denormalisiert für historische Daten
  duration        Int             @default(480)  // Minuten (Standard: 8h)
  vehicle         String?
  technicianSignature  String?    // Base64 oder URL
  customerSignature    String?
  description     String?         // Einsatzbeschreibung
  findings        String?         // Befunde
  recommendations String?         // Empfehlungen
  checklistItems  ChecklistItem[]
  invoices        Invoice[]
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
}
```

### JobStatus-Lifecycle

```
PLANNED → IN_PROGRESS → COMPLETED
    ↓           ↓
CANCELLED   CANCELLED
```

### Invoice (Rechnung/Dokument)

```prisma
model Invoice {
  id            String      @id @default(cuid())
  customerId    String
  customer      Customer    @relation(...)
  jobId         String?
  job           ServiceJob? @relation(...)  // SetNull wenn Job gelöscht
  invoiceNumber String?
  description   String?
  amount        Float?
  fileUrl       String      // Pfad in public/uploads/
  fileName      String
  uploadedById  String
  createdAt     DateTime    @default(now())
}
```

---

## Typische Aufgaben

### Neuen Serviceeinsatz anlegen

Ablauf in `POST /api/jobs`:
1. Authentifizierung + Berechtigung prüfen
2. Job-Nummer generieren (höchste bestehende `SJ-XXXX` + 1, Fallback `SJ-1001`)
3. `ServiceJob` erstellen
4. Anlagentyp ermitteln → `getChecklistForPlantType()` oder Default
5. `ChecklistItem[]` erstellen (Checklist Agent übernimmt Template)
6. Response mit vollständigem Job inkl. Items

### Status-Änderung

```typescript
// Statusübergang mit Validierung
PUT /api/jobs/[id]
{
  status: 'IN_PROGRESS'  // oder 'COMPLETED', 'CANCELLED'
}

// Bei COMPLETED: completedAt setzen
if (body.status === 'COMPLETED') {
  data.completedAt = new Date()
}
```

### Techniker-Zuweisung

- `GET /api/technicians` — Gibt alle User mit Service-Techniker-Rollen zurück
- `GET /api/availability` — Prüft ob Techniker an einem Datum bereits einen Job hat
- Beim Speichern: `technicianId` und `technicianName` (denormalisiert) setzen

### Unterschriften

Aktuell: Unterschriften als String (Base64 oder Datei-URL) in `technicianSignature` / `customerSignature`
- Unterschrift-Pad im Job-Detail
- Bei Fertigstellung beide Unterschriften erfassen

### Rechnungsverwaltung

`components/InvoicePanel.tsx` verwaltet:
- Datei-Upload via `POST /api/upload`
- Invoice-Erstellung via `POST /api/invoices`
- Invoice-Liste mit Download-Links
- Invoice-Löschung via `DELETE /api/invoices/[id]`

---

## Kalender-Funktionen

`components/JobCalendar.tsx` verwendet `react-big-calendar`:
- Woche / Monat / Tag Ansicht
- Jobs als farbige Events (Farbe nach Status)
- Drag-and-Drop → reschedule (PUT `scheduledAt`)
- Click → Job-Detail öffnen

`GET /api/calendar` gibt Events in BigCalendar-Format zurück:
```typescript
{
  id: string
  title: string  // "SJ-1001 - Kundenname"
  start: Date
  end: Date      // start + duration Minuten
  status: JobStatus
  jobId: string
}
```

---

## API-Patterns

### GET /api/jobs mit Scope-Filter

```typescript
const scopeFilter = getScopeFilter(session, 'jobs')
// Techniker sehen nur ihre eigenen Jobs:
// { technicianId: session.user.id }
// Manager sehen alle Jobs (oder nach customerId gefiltert)
```

### Job-Nummer Generierung

```typescript
const lastJob = await prisma.serviceJob.findFirst({
  orderBy: { jobNumber: 'desc' },
  where: { jobNumber: { startsWith: 'SJ-' } }
})
const nextNumber = lastJob
  ? parseInt(lastJob.jobNumber.replace('SJ-', '')) + 1
  : 1001
const jobNumber = `SJ-${nextNumber}`
```

---

## Grenzen des Zuständigkeitsbereichs

- **Nicht:** Checklisten-Templates definieren (→ Checklist Agent)
- **Nicht:** Kundenstammdaten verwalten (→ Customer & Plant Agent)
- **Nicht:** Berechtigungslogik (→ Security Agent) — aber korrekt anwenden
- **Nicht:** DB-Schema-Änderungen (→ Database Agent)

---

## Auswirkungen auf andere Module

| Änderung | Betroffene Agenten |
|---|---|
| Neues Feld auf `ServiceJob` | Database Agent (Migration), UI/UX Agent (Formular) |
| Neuer Job-Status | Database Agent (Enum), UI/UX Agent (StatusBadge), Checklist Agent |
| Scope-Änderung für Techniker | Security Agent |
| PDF-Servicebericht | Solution Architect (Bibliothek wählen), UI/UX Agent |
| Kalender-Änderungen | UI/UX Agent |

---

## Geplante Erweiterungen

### Servicehistorie
- Timeline aller Jobs pro Anlage und Kunde
- Durchschnittliche Einsatzdauer, häufigste Befunde
- Letzte und nächste geplante Wartung

### PDF-Serviceberichte
- Automatische PDF-Generierung beim Job-Abschluss
- Inhalt: Kundendaten, Anlagendaten, Checkliste mit Status, Unterschriften
- Speicherung als `Invoice`-Datei oder eigenem Modell

### Predictive Maintenance
- Basierend auf Wartungsintervallen (`Plant.nextServiceDate`)
- Automatische Job-Erstellung wenn Wartungsfenster erreicht
- Benötigt neues `MaintenanceSchedule`-Modell (Database Agent)
