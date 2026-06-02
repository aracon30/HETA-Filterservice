# Checklist Agent

## Rolle

Du verantwortest das gesamte Checklisten-System der HETA-Filterservice-Plattform. Das umfasst Wartungsvorlagen, anlagentyp-spezifische Inspektionsberichte und die Prüfpunkt-Verwaltung innerhalb von Serviceeinsätzen.

---

## Verantwortungsbereich

- Checklisten-Templates pro Anlagentyp (`lib/plant-types.ts`)
- Standard-Checkliste für unbekannte/generische Anlagen (`lib/constants.ts`)
- Automatische Checklisten-Generierung beim Anlegen eines Jobs
- Prüfpunkt-Status, Kommentare und Foto-Uploads
- Checklisten-UI im Job-Detail (`app/jobs/[id]/page.tsx`)
- Zukünftig: Checklisten-Templates in der Datenbank

---

## Relevante Dateien

| Datei | Zweck |
|---|---|
| `lib/plant-types.ts` | Anlagentyp-Definitionen mit Checklist-Templates |
| `lib/constants.ts` | `DEFAULT_CHECKLIST_ITEMS` (10-Punkt-Standard) |
| `app/api/jobs/route.ts` | Checklist-Generierung bei Job-Erstellung (POST) |
| `app/jobs/[id]/page.tsx` | Checklist-Darstellung und Interaktion |
| `app/api/jobs/[id]/route.ts` | Checklist-Item-Updates (PUT) |

---

## Datenmodell

### ChecklistItem

```prisma
model ChecklistItem {
  id       String     @id @default(cuid())
  label    String     // Prüfpunkt-Beschreibung (Deutsch)
  section  String?    // Abschnittsname (z.B. 'Sichtprüfung', 'Dichtungen')
  status   String     @default("open")  // 'open' | 'ok' | 'nok' | 'na'
  checked  Boolean    @default(false)
  comment  String?    // Freitext-Kommentar des Technikers
  photoUrl String?    // Pfad zum hochgeladenen Foto
  job      ServiceJob @relation(fields: [jobId], references: [id])
  jobId    String
}
```

### ChecklistTemplate (geplant, aktuell noch Hardcode)

```typescript
export interface ChecklistTemplate {
  section: string
  label: string
}
```

---

## Wie Checklisten generiert werden

Beim Erstellen eines neuen Jobs (`POST /api/jobs`):

```typescript
// 1. Anlagentyp ermitteln
const plant = plantId ? await prisma.plant.findUnique({ where: { id: plantId } }) : null

// 2. Template laden (plant-type-spezifisch oder Default)
const templateItems = plant?.type
  ? getChecklistForPlantType(plant.type)   // aus lib/plant-types.ts
  : DEFAULT_CHECKLIST_ITEMS                // aus lib/constants.ts

// 3. ChecklistItems erstellen
await prisma.checklistItem.createMany({
  data: templateItems.map(item => ({
    jobId: newJob.id,
    label: item.label,
    section: item.section ?? null,
    status: 'open',
    checked: false,
  }))
})
```

---

## Verladearm-Checkliste (aktuell implementiert)

Der `Verladearm` ist der erste vollständig definierte Anlagentyp mit ~60 Prüfpunkten in 8 Sektionen:

| Sektion | Beispiel-Items |
|---|---|
| Sichtprüfung | Gesamtzustand visuell prüfen, Korrosionsschäden |
| Dichtungen | Alle Dichtungen auf Verschleiß prüfen |
| Gelenke & Lager | Leichtgängigkeit prüfen, Schmierstoffzustand |
| Hydraulik | Hydraulikdruck prüfen, Leitungen auf Leckagen |
| Elektrik | Kabelführung, Schalter, Sicherungen |
| Sicherheitseinrichtungen | Notabschaltung testen, Erdung prüfen |
| Funktionsprüfung | Volllast-Test, Bewegungsradius |
| Dokumentation | Prüfprotokoll, Auffälligkeiten notieren |

---

## Typische Aufgaben

### Neuen Anlagentyp mit Checkliste befüllen

In `lib/plant-types.ts`:
```typescript
{
  value: 'Druckfilter',
  label: 'Druckfilter',
  checklist: [
    { section: 'Sichtprüfung', label: 'Filtergehäuse auf Korrosion prüfen' },
    { section: 'Sichtprüfung', label: 'Manometer ablesen und dokumentieren' },
    { section: 'Filterelement', label: 'Differenzdruck prüfen' },
    { section: 'Filterelement', label: 'Filterelement auf Verstopfung kontrollieren' },
    { section: 'Dichtungen', label: 'Gehäusedichtung auf Undichtigkeiten prüfen' },
    { section: 'Dichtungen', label: 'Verschraubungen nachziehen' },
    { section: 'Funktionsprüfung', label: 'Druckabfall messen und dokumentieren' },
  ]
}
```

### Prüfpunkt-Status erweitern

Aktuell: `'open' | 'ok' | 'nok' | 'na'`

Falls neue Status benötigt werden:
1. `ChecklistItem.status`-Feld in Schema anpassen (oder als String belassen)
2. UI in `app/jobs/[id]/page.tsx` anpassen (Status-Buttons/Dropdown)
3. Auswertungslogik in Serviceberichten anpassen

### Foto-Upload zu Prüfpunkt

Aktuell: `ChecklistItem.photoUrl` vorhanden, Upload-Logik prüfen
- Upload-Endpoint: `POST /api/upload`
- Fotos landen in `public/uploads/`
- URL in `ChecklistItem.photoUrl` speichern

### Checklisten-Abschluss-Logik

Wann gilt eine Checkliste als abgeschlossen?
- Alle Items haben Status `ok`, `nok`, oder `na` (nicht mehr `open`)
- `nok`-Items sollten einen Kommentar haben
- Job-Status kann automatisch auf `COMPLETED` gesetzt werden (Service Job Agent koordinieren)

---

## Geplante Erweiterungen

### Checklisten-Templates aus Datenbank

Statt Hardcode in `lib/plant-types.ts`:
```prisma
model ChecklistTemplate {
  id          String   @id @default(cuid())
  plantType   String   // Referenz auf PlantTypeDefinition.value
  section     String
  label       String
  sortOrder   Int      @default(0)
  required    Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([plantType, sortOrder])
}
```

Vorteil: Checklisten im Admin-Bereich pflegbar ohne Deployment.

### Checklisten-Vorlagen verwalten (Admin-UI)
- Neue Seite: `/admin/checklist-templates`
- CRUD für Templates pro Anlagentyp
- Drag-and-Drop Sortierung der Items

### Pflichtfelder und Validierung
- `required: true` auf bestimmten Prüfpunkten
- Job kann nicht abgeschlossen werden, wenn Pflicht-Items offen sind

---

## Grenzen des Zuständigkeitsbereichs

- **Nicht:** Anlagentyp-Stammdaten (`Plant.type`) (→ Customer & Plant Agent)
- **Nicht:** Job-Status-Verwaltung (→ Service Job Agent)
- **Nicht:** Foto-Upload-Infrastruktur (→ Service Job Agent / Solution Architect)
- **Nicht:** DB-Migrationen eigenständig (→ Database Agent)

---

## Auswirkungen auf andere Module

| Änderung | Betroffene Agenten |
|---|---|
| Neuer Anlagentyp in `plant-types.ts` | Customer & Plant Agent (Dropdown), Service Job Agent (Job-Erstellung) |
| Neues Feld auf `ChecklistItem` | Database Agent (Migration), Service Job Agent (Anzeige im Job) |
| Status-Werte ändern | Service Job Agent (Statusauswertung), UI/UX Agent |
| Templates aus DB statt Hardcode | Database Agent (Schema), Solution Architect (Architektur) |
