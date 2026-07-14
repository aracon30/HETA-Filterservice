# Konzept: Vorgänge-Board für Handelsvertreter

Status: Entwurf zur Abstimmung — noch nicht umgesetzt.

## 1. Ziel

Ein zentrales, rollenbasiertes Kanban-Board zur Koordination laufender Themen zwischen HETA-Innendienst und externen Handelsvertretern. Eingebunden in ServiceHub, damit es international ohne zusätzliche Infrastruktur erreichbar ist. Ergebnis der Konzeptrunde: siehe `docs/concepts/vertreter-portal-mockup.html`-Diskussion im Chat (Kanban, Rollen-Trennung, Archivieren statt Löschen für Vertreter).

## 2. Kernentscheidungen aus der Abstimmung

| Frage | Entscheidung |
|---|---|
| Wer ist der Handelsvertreter technisch? | Neue externe Rolle `SALES_AGENT`, zugeordnet zu **mehreren** Kunden (nicht 1:1 wie bisherige externe Rollen) |
| Darstellung | Kanban-Board: Offen → In Bearbeitung → Wartet auf Rückmeldung → Erledigt |
| Datenbezug | Karte optional mit Kunde/Anlage/Opportunity/Serviceeinsatz verknüpfbar, nicht zwingend |
| Sichtbarkeit intern | Nur `ADMIN` und `SERVICE_MANAGER` sehen alle Vorgänge; andere interne Rollen vorerst kein Zugriff |
| Löschrecht | `SALES_AGENT` kann archivieren, nicht endgültig löschen; `ADMIN`/`SERVICE_MANAGER` können beides |
| MVP-Umfang | Karten + Status + Kommentare, Datei-Anhänge, Fristen, Aktivitäts-/Verlaufsprotokoll |
| Explizit **nicht** in v1 | Benachrichtigungen (E-Mail/Push), manuelle Kartenreihenfolge per Drag-Sortierung, Mehrsprachigkeit der UI |

## 3. Datenmodell

Kein eigenes `Board`-Modell — ein „Board" ist nur die gefilterte Kanban-Ansicht auf `BoardCard`. Das hält das Modell schlank und deckt sich mit „optional verknüpfbar" (Zusatz-Container hätte hier keinen Mehrwert).

```prisma
enum UserRole {
  ADMIN
  SERVICE_MANAGER
  SERVICE_TECHNICIAN
  MAINTENANCE_MANAGER
  MAINTENANCE_TECHNICIAN
  BUYER
  SALES_AGENT              // neu — Handelsvertreter
}

enum BoardCardStatus {
  OPEN
  IN_PROGRESS
  WAITING
  DONE
}

enum BoardCardPriority {
  LOW
  MEDIUM
  HIGH
}

// Welcher Vertreter darf welche Kunden sehen (many-to-many)
model AgentAssignment {
  id         String   @id @default(cuid())
  userId     String
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  customerId String
  customer   Customer @relation(fields: [customerId], references: [id], onDelete: Cascade)
  createdAt  DateTime @default(now())

  @@unique([userId, customerId])
  @@index([customerId])
}

model BoardCard {
  id            String            @id @default(cuid())
  title         String
  description   String?
  status        BoardCardStatus   @default(OPEN)
  priority      BoardCardPriority @default(MEDIUM)
  dueAt         DateTime?
  archived      Boolean           @default(false)

  customerId    String?
  customer      Customer?         @relation(fields: [customerId], references: [id])
  plantId       String?
  plant         Plant?            @relation(fields: [plantId], references: [id])
  opportunityId String?
  opportunity   Opportunity?      @relation(fields: [opportunityId], references: [id])
  jobId         String?
  job           ServiceJob?       @relation(fields: [jobId], references: [id])

  assigneeId    String?
  assignee      User?             @relation("BoardCardAssignee", fields: [assigneeId], references: [id])
  createdById   String
  createdBy     User              @relation("BoardCardCreatedBy", fields: [createdById], references: [id])

  comments      BoardComment[]
  attachments   BoardAttachment[]
  activity      BoardActivity[]

  createdAt     DateTime          @default(now())
  updatedAt     DateTime          @updatedAt

  @@index([customerId])
  @@index([assigneeId])
  @@index([status])
}

model BoardComment {
  id        String    @id @default(cuid())
  cardId    String
  card      BoardCard @relation(fields: [cardId], references: [id], onDelete: Cascade)
  authorId  String
  author    User      @relation(fields: [authorId], references: [id])
  text      String
  createdAt DateTime  @default(now())

  @@index([cardId])
}

model BoardAttachment {
  id           String    @id @default(cuid())
  cardId       String
  card         BoardCard @relation(fields: [cardId], references: [id], onDelete: Cascade)
  fileName     String
  fileUrl      String
  uploadedById String
  uploadedBy   User      @relation(fields: [uploadedById], references: [id])
  createdAt    DateTime  @default(now())

  @@index([cardId])
}

// Audit-Trail: wer hat wann Status/Zuständigkeit/Archivierung geändert
model BoardActivity {
  id        String    @id @default(cuid())
  cardId    String
  card      BoardCard @relation(fields: [cardId], references: [id], onDelete: Cascade)
  actorId   String
  actor     User      @relation(fields: [actorId], references: [id])
  action    String    // "created" | "status_changed" | "priority_changed" | "assignee_changed" | "archived" | "restored"
  fromValue String?
  toValue   String?
  createdAt DateTime  @default(now())

  @@index([cardId])
}
```

Ergänzend auf bestehenden Modellen: `User` bekommt Relations `agentAssignments`, `boardCardsAssigned`, `boardCardsCreated`, `boardComments`, `boardAttachments`, `boardActivity`; `Customer` bekommt `agentAssignments`, `boardCards`; `Plant`, `Opportunity`, `ServiceJob` bekommen jeweils `boardCards`.

## 4. Berechtigungen

Neue Ressource `boards` in `lib/permissions-config.ts`:

| Rolle | view | create | edit | delete | scope |
|---|---|---|---|---|---|
| `ADMIN` | ✓ | ✓ | ✓ | ✓ | all |
| `SERVICE_MANAGER` | ✓ | ✓ | ✓ | ✓ | all |
| `SALES_AGENT` | ✓ | ✓ | ✓ | ✗ | eigene zugewiesene Kunden |
| alle anderen | ✗ | ✗ | ✗ | ✗ | — |

„Archivieren" ist technisch ein `edit` (Feld `archived`), kein `delete` — deshalb kann `SALES_AGENT` archivieren, obwohl `canDelete` false ist. Das endgültige Löschen prüft in der API-Route zusätzlich explizit `checkPermission(session, 'boards', 'delete')`.

Erweiterung von `getScopeFilter()` in `lib/permissions.ts` (neuer Zweig, analog zum bestehenden `EXTERNAL_ROLES`-Muster):

```ts
if (role === 'SALES_AGENT' && resource === 'boards' && userId) {
  const assignments = await prisma.agentAssignment.findMany({
    where: { userId },
    select: { customerId: true },
  })
  const customerIds = assignments.map(a => a.customerId)
  return {
    OR: [
      { customerId: { in: customerIds } },
      { createdById: userId, customerId: null }, // eigene, kundenlose Vorgänge
    ],
  }
}
```

Damit sieht ein Vertreter auch Karten, die intern jemand anderem zugewiesen sind, solange sie zu seinem Kunden gehören — Sichtbarkeit hängt an der Kundenzuordnung, nicht am „Zuständigen".

## 5. API-Routen

| Route | Methoden | Zweck |
|---|---|---|
| `/api/boards/cards` | GET, POST | Liste (scope-gefiltert, Query-Parameter `customerId`, `status`, `assigneeId`, `includeArchived`) / Anlegen |
| `/api/boards/cards/[id]` | GET, PATCH, DELETE | Detail inkl. Kommentare/Anhänge/Verlauf / Update (Status, Priorität, Titel, Beschreibung, Fälligkeit, Zuständiger, `archived`) / endgültiges Löschen (nur bei `delete`-Recht) |
| `/api/boards/cards/[id]/comments` | POST | Kommentar hinzufügen |
| `/api/boards/cards/[id]/attachments` | POST | Datei-Upload (gleiches Muster wie bestehende Uploads: `public/uploads/`, sanitisierte Dateinamen) |
| `/api/admin/agent-assignments` | GET, POST, DELETE | Admin verwaltet Vertreter-↔-Kunden-Zuordnung |

Jede Route folgt dem Standard-Pattern aus `CLAUDE.md`: `getServerSession()` → `checkPermission()` → `getScopeFilter()`.

## 6. Frontend

- `app/vorgaenge/page.tsx` — interne Ansicht (`ADMIN`/`SERVICE_MANAGER`), Filter nach Vertreter statt Kunde, echtes Löschen möglich
- `app/portal/vorgaenge/page.tsx` — Vertreter-Ansicht, Filter nach zugewiesenen Kunden, nur Archivieren
- `components/BoardView.tsx` — gemeinsame Kanban-Komponente (Spalten, Drag & Drop, Karten), von beiden Seiten genutzt
- `components/BoardCardDrawer.tsx` — Detail-Slide-over (Status-Dropdown, Beschreibung, Fakten, Anhänge, Verlauf, Kommentare)
- `components/NewBoardCardModal.tsx` — Karte anlegen
- `components/Sidebar.tsx` — neuer interner Nav-Punkt „Vorgänge" (Rolle `['ADMIN','SERVICE_MANAGER']`, gleiches Muster wie „Vertrieb"); neuer Badge-Zweig für `SALES_AGENT` (kein `customerName`, stattdessen „N Kunden zugewiesen")
- `app/portal/page.tsx` — muss um einen `SALES_AGENT`-Zweig erweitert werden; dieser hat anders als die bisherigen externen Rollen kein `customerId` auf der Session, sondern lädt seine Kunden über `AgentAssignment`
- `app/admin/users/**` — bei Rolle `SALES_AGENT` zusätzliches Formularfeld „Zugewiesene Kunden" (Mehrfachauswahl), schreibt `AgentAssignment`
- Optional, später: Tab „Vorgänge" auf der bestehenden Kunden-Detailseite (`app/customers/[id]`), der `BoardView` gefiltert auf diesen einen Kunden einbettet

## 7. Umsetzungsschritte (folgt dem Workflow aus Abschnitt 9 der CLAUDE.md)

1. **Datenmodell**: Migration mit obigem Schema (`npx prisma migrate dev --name add_board_cards`), `prisma generate`
2. **Security**: Ressource `boards` in `permissions-config.ts`, Scope-Zweig in `getScopeFilter()`, neue Rolle `SALES_AGENT` überall dort ergänzen, wo `UserRole` unterschieden wird (Sidebar, Portal-Routing, Rollen-Labels)
3. **Backend**: API-Routen wie oben, inkl. Upload-Reuse für Anhänge
4. **Admin**: Vertreter-Anlage + Kunden-Zuordnung in der Benutzerverwaltung
5. **Frontend**: `BoardView`, Drawer, Modal, beide Einstiegsseiten, Sidebar-Eintrag
6. **QA**: TypeScript-Check, Mandantentrennung gezielt testen (Vertreter A darf Vorgänge von Vertreter B nicht sehen/anlegen/ändern können), Review gegen bestehende Patterns

## 8. Offene Punkte für später (bewusst nicht in v1)

- Benachrichtigungen bei neuer Karte/Kommentar/Statuswechsel
- Manuelle Sortierung innerhalb einer Spalte (v1 sortiert automatisch nach Fälligkeit/Erstellungsdatum)
- Mehrsprachige UI (aktuell rein deutsch, wie der Rest von ServiceHub)
