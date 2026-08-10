# Konzept: Ersatzteilportal

Status: Entwurf · Autor: Claude (im Auftrag) · Datum: 2026-08-10

## 1. Ausgangslage

Idee (Kurzfassung des Auftrags): Für jede Anlage eines Kunden soll im Kundenportal ein
Ersatzteilkatalog hinterlegt werden. Offen ist, ob dieser als Tabelle mit Zeichnung oder als
interaktives 3D-Modell (klickbare Bauteile) umgesetzt wird. Zusätzlich soll die komplette
Anlagendokumentation im Portal verfügbar sein, um den Dokumentenversand zu vereinfachen.
Auftragsnummern und Kundenzugänge sollen wie bisher funktionieren.

Dieses Dokument ordnet die Idee in die bestehende Architektur ein, zeigt auf, was bereits
vorhanden ist, und schlägt ein konkretes Datenmodell sowie einen Umsetzungsweg vor. Es ist
bewusst als **Konzept** verfasst — die Detailentscheidung zur Darstellungsform (Tabelle+Zeichnung
vs. 3D-Modell) wird begründet vorgeschlagen, aber nicht final festgelegt, da sie von Faktoren
abhängt, die noch zu klären sind (siehe Abschnitt 8).

## 2. Ist-Stand — was schon existiert

Ein großer Teil der Idee ist im Datenmodell bereits angelegt, aber nicht für den
Ersatzteil-Anwendungsfall im Portal nutzbar gemacht:

| Baustein | Vorhanden? | Wo | Bewertung |
|---|---|---|---|
| Auftragsnummern je Kunde | ✅ | `ServiceJob.orderNumber` (`prisma/schema.prisma:304`) | Nichts zu tun |
| Kundenportal mit Rollen/Scope | ✅ | `app/portal/**`, `lib/permissions.ts` | Basis für Ersatzteilportal nutzbar |
| Anlagendokumentation im Portal | ✅ (Basis) | `PlantDocument`-Modell, `components/PlantDocuments.tsx`, eingebunden in `app/portal/plants/[id]/page.tsx:205` | Typen `MANUAL`, `DRAWING`, `IMAGE`, `OTHER` bereits vorhanden — deckt "Dokumentenversand erleichtern" schon weitgehend ab |
| Ersatzteil-Stammdaten je Anlagentyp | ✅ (intern) | `PartTypeItem` (Vorlage je `PlantType`) | Nur Label/Teilenummer/Menge, keine Zeichnung/Position |
| Ersatzteilliste je Anlage | ✅ (intern) | `PlantMaterial`, API `app/api/plants/[id]/materials/route.ts` | Nur für internes Personal (`ADMIN`, `SERVICE_MANAGER`, `SERVICE_TECHNICIAN`) lesbar/schreibbar — **nicht** im Kundenportal sichtbar, keine Bestellfunktion für Kunden |
| Ersatzteile je Auftrag | ✅ (intern) | `JobMaterial` | Wie oben, intern |
| Anfrage-/Bestellworkflow mit Kunde | ✅ | `PlantRequest`, `PlantRequestMessage`, `PlantRequestOffer` inkl. Status-Pipeline (`OPEN` → … → `JOB_PLANNED`/`CLOSED`) | Bereits generischer Workflow für Kundenanfragen (Störung, Wartung, Angebot, Information, Sonstiges) — kann für Ersatzteilbestellungen wiederverwendet werden |
| Bild/Zeichnung mit klickbaren Positionen | ❌ | — | Neu zu bauen |
| 3D-Modell-Viewer | ❌ | — | Neu zu bauen |

**Kernaussage:** Die "Ersatzteil-Idee" ist kein neues Subsystem, sondern eine Erweiterung der
bestehenden `PlantMaterial`/`PartTypeItem`-Datenstruktur um Kunden-Sichtbarkeit,
Positions-/Bildreferenzen und eine Bestellstrecke, die auf `PlantRequest` aufsetzt.

## 3. Anforderungen (abgeleitet)

1. Jeder externe Portal-Nutzer sieht — abhängig von Rolle/Scope wie bisher (`getExternalPlantScope`,
   `getScopeFilter`) — den Ersatzteilkatalog der Anlagen, für die er berechtigt ist.
2. Pro Anlage(-ntyp) existiert eine Liste von Ersatzteilen mit mindestens: Bezeichnung,
   Teilenummer, Menge/Einheit, optional Preis, optional Verfügbarkeit.
3. Ersatzteile können optional visuell verortet werden (Position auf einer Zeichnung/einem Bild,
   perspektivisch auf einem 3D-Modell).
4. Aus dem Katalog heraus kann der Kunde eine Bestellung/Anfrage auslösen (Warenkorb-artig,
   mehrere Positionen, ein `PlantRequest`).
5. Die komplette Anlagendokumentation (Handbücher, Zeichnungen, Berichte, Bilder) ist zentral im
   Portal abrufbar und herunterladbar — inklusive Sammel-Download, um Dokumentenversand per
   E-Mail zu ersetzen.
6. Mandantentrennung bleibt zwingend gewahrt (kein Kunde sieht Daten/Kataloge anderer Kunden).
7. Interne Nutzer (Service/Vertrieb) pflegen Kataloge und Zeichnungen; Kunden lesen und bestellen.

## 4. Lösungskonzept

### 4.1 Auftragsnummern & Portalzugang
Unverändert — bestehende Mechanik (`ServiceJob.orderNumber`, `EXTERNAL_ROLES`,
`getExternalPlantScope`) wird weiterverwendet. Kein Änderungsbedarf.

### 4.2 Anlagendokumentation im Portal
Die Grundlage (`PlantDocument`) existiert bereits und wird im Portal angezeigt. Vorgeschlagene
Ergänzungen, um "Dokumentenversand erleichtern" vollständig abzudecken:

- **Sammel-Download**: Endpunkt `GET /api/portal/plants/[id]/documents/zip`, der alle für den
  Nutzer sichtbaren Dokumente einer Anlage gebündelt herunterlädt (nutzt vorhandene
  Scope-Prüfung).
- **Filter/Kategorien** in `PlantDocuments`-Komponente nach `DocumentType`, da die Liste pro
  Anlage mit Doku + Katalogzeichnungen wachsen wird.
- Kein neues Datenmodell nötig — nur UI-/API-Erweiterung.

### 4.3 Ersatzteilkatalog je Anlage

**Datenmodell-Erweiterung** (Vorschlag, siehe Abschnitt 5 für Details):

- `PartTypeItem` (Vorlage je Anlagentyp) und `PlantMaterial` (konkrete Anlage) werden um
  optionale Felder `unit`, `price`, `drawingId`, `positionX`, `positionY` ergänzt — statt eines
  neuen Parallel-Modells. Das vermeidet Datenduplikation zwischen "interner Materialliste" und
  "Kundenkatalog": es ist dieselbe Datenquelle, nur mit unterschiedlicher Sichtbarkeit/Aktion je
  Rolle.
- Neues Modell `PlantDrawing` (oder Wiederverwendung von `PlantDocument` mit `type: DRAWING` plus
  Bild-Maßen) als Referenzbild für Positionsmarkierungen.
- Kunden-Sichtbarkeit wird über eine neue Ressource `parts-catalog` in `lib/permissions.ts` /
  `permissions-config.ts` gesteuert (view für externe Rollen, create/edit nur intern).

**Darstellungsform — Tabelle+Zeichnung vs. interaktives 3D-Modell:**

| Kriterium | Tabelle + Zeichnung (2D-Bild mit Positionsnummern) | Interaktives 3D-Modell |
|---|---|---|
| Datenbasis | Vorhandene Explosionszeichnungen/PDFs genügen | Erfordert CAD-Export (glTF/GLB) je Anlagentyp — muss erst beschafft/konvertiert werden |
| Umsetzungsaufwand | Gering–mittel: Bild-Hotspot-Komponente (Klick-Koordinaten auf `<img>`), Standard-Webtechnik | Hoch: 3D-Viewer (z. B. `@react-three/fiber` + `three.js` oder `<model-viewer>`), Performance/Mobilgeräte, Interaktionsdesign für Klick-Picking auf Meshes |
| Pflegeaufwand | Neue Position = X/Y-Koordinate auf bestehendem Bild eintragen | Neues Bauteil = Mesh im 3D-Modell taggen, Modellpflege durch CAD-Konstrukteur nötig |
| Bestehender Verladearm-Bestand | Vorhandene technische Zeichnungen direkt nutzbar | Für keinen Anlagentyp aktuell 3D-Daten vorhanden (Rücksprache nötig) |
| Kundennutzen | Vertraut (wie gedruckte Ersatzteilliste), funktioniert auf jedem Gerät/Browser ohne WebGL | Höherer "Wow-Effekt", intuitiver bei komplexen Baugruppen, aber nur nötig wenn Anlagen sehr komplex/verschachtelt sind |
| Risiko | Gering | Mittel–hoch (Scope-Risiko, Abhängigkeit von CAD-Daten, die evtl. nicht existieren) |

**Empfehlung:** Phase 1 mit **Tabelle + Zeichnung inkl. klickbarer Positionsmarkierungen auf
einem 2D-Bild** umsetzen (Hotspot-Overlay, keine 3D-Engine). Das deckt den Kernnutzen (Kunde
identifiziert Teil, sieht Teilenummer, bestellt) mit überschaubarem Aufwand und ohne Abhängigkeit
von noch nicht vorhandenen CAD-Daten ab. Ein interaktives 3D-Modell wird als **spätere,
optionale Ausbaustufe** vorgeschlagen (siehe `Zukunft`-Einträge in `.claude/CLAUDE.md` Abschnitt
11 — passt zu "Predictive Maintenance"/"Smart Monitoring" als längerfristige Erweiterung), sobald
für mindestens einen Anlagentyp 3D-Daten tatsächlich verfügbar sind und der Bedarf (z. B. durch
Kundenfeedback zu Phase 1) bestätigt ist.

### 4.4 Bestellworkflow

Kein neues Bestellsystem — Wiederverwendung von `PlantRequest`:

- `RequestType`-Enum um `ERSATZTEIL` ergänzen.
- Aus dem Katalog heraus wählt der Kunde Positionen (Menge je Teil) → beim Absenden wird eine
  `PlantRequest` vom Typ `ERSATZTEIL` mit den gewählten Teilen (z. B. als strukturierte Zeilen,
  analog zu `PlantRequestPlant`, neu: `PlantRequestPart`) erzeugt.
- Der bestehende Status-Fluss (`OPEN` → `IN_REVIEW` → `OFFER_SENT` → `OFFER_ACCEPTED` → ggf.
  `JOB_PLANNED`/`CLOSED`) und die Nachrichtenfunktion (`PlantRequestMessage`) werden unverändert
  genutzt — intern prüft Vertrieb/Service die Anfrage und erstellt ein Angebot
  (`PlantRequestOffer`, PDF-Upload wie bisher).

Vorteil: kein Parallelprozess, ein Team, ein Kunden-UI-Muster (`app/portal/requests/**`) für alle
Anfragearten.

### 4.5 Berechtigungen & Mandantentrennung

- Neue Ressource `parts-catalog` in `Resources`-Typ (`lib/permissions-config.ts`), Default:
  externe Rollen `view`, `SERVICE_MANAGER`/`ADMIN` volles CRUD, `SERVICE_TECHNICIAN` `view`.
  `MAINTENANCE_TECHNICIAN`/`BUYER` analog zu bestehenden Regeln für `plants`/`requests` — Scope
  richtet sich nach `getExternalPlantScope` (dieselbe Anlagen-Sichtbarkeit wie für
  Dokumente/Checklisten, kein separates Berechtigungsmodell nötig).
- API-Routen folgen dem Standardmuster aus `.claude/CLAUDE.md` Abschnitt 6 (`getServerSession` →
  `checkPermission` → `getScopeFilter`).
- Katalogdaten (`PlantMaterial`, `PlantDrawing`) sind über `plantId` an die Anlage und damit
  transitiv an `customerId` gebunden — bestehende Scope-Filter greifen ohne Sonderfall.

## 5. Datenmodell-Vorschlag (Skizze)

```prisma
model PlantDrawing {
  id          String   @id @default(cuid())
  plantId     String?
  plant       Plant?   @relation(fields: [plantId], references: [id], onDelete: Cascade)
  plantTypeId String?
  plantType   PlantType? @relation(fields: [plantTypeId], references: [id], onDelete: Cascade)
  title       String
  imageUrl    String
  width       Int
  height      Int
  createdAt   DateTime @default(now())

  parts       PlantMaterial[]  @relation("DrawingPositions")
  partItems   PartTypeItem[]   @relation("DrawingPositionsTemplate")

  @@index([plantId])
  @@index([plantTypeId])
}

// Ergänzungen an bestehenden Modellen (nicht neu, nur zusätzliche Felder):
// PartTypeItem  + unit String? + price Float? + drawingId String? + positionX Float? + positionY Float?
// PlantMaterial + unit String? + price Float? + drawingId String? + positionX Float? + positionY Float?
//               + orderable Boolean @default(true)  // ob Kunde dieses Teil bestellen darf

enum RequestType {
  STOERUNG
  WARTUNG
  ANGEBOT
  INFORMATION
  ERSATZTEIL   // neu
  SONSTIGES
}

model PlantRequestPart {
  id          String       @id @default(cuid())
  requestId   String
  request     PlantRequest @relation(fields: [requestId], references: [id], onDelete: Cascade)
  materialId  String?
  material    PlantMaterial? @relation(fields: [materialId], references: [id], onDelete: SetNull)
  label       String
  partNumber  String?
  quantity    Int          @default(1)

  @@index([requestId])
}
```

`positionX`/`positionY` als relative Koordinaten (0–1) auf der referenzierten Zeichnung,
geräte-/auflösungsunabhängig für das Hotspot-Overlay im Frontend.

## 6. Technische Umsetzung Hotspot-Overlay (Phase 1)

- Client-Komponente, die `PlantDrawing.imageUrl` als `<img>` rendert und pro Teil mit
  `positionX/positionY` einen absolut positionierten Marker-Button overlayt
  (`style={{ left: `${x*100}%`, top: `${y*100}%` }}`).
- Klick auf Marker scrollt zur/hebt die zugehörige Tabellenzeile hervor (und umgekehrt) —
  kein WebGL, keine neue Abhängigkeit nötig.
- Pflege der Positionen: einfacher Klick-auf-Bild-Editor im internen Admin-/Anlagen-Bereich
  (schreibt `positionX/positionY`), analog zu bestehenden Editor-Mustern im Projekt.

## 7. Rollout-Phasen

| Phase | Inhalt | Voraussetzung |
|---|---|---|
| 1 | Ersatzteilkatalog (Tabelle) je Anlage im Portal sichtbar machen — Wiederverwendung/Erweiterung `PlantMaterial`, neue Berechtigungsressource, Portal-UI | Keine (Daten teils vorhanden) |
| 2 | Zeichnung + Hotspot-Positionen (`PlantDrawing`), Bestellung aus Katalog via `PlantRequest`/`ERSATZTEIL` | Zeichnungen je Anlagentyp digitalisiert vorliegend |
| 3 | Dokumentenportal-Ausbau: Sammel-Download, Kategorie-Filter | Keine |
| 4 (Zukunft, optional) | Interaktives 3D-Modell für ausgewählte, komplexe Anlagentypen | CAD-Daten (glTF/GLB) vorhanden, Bedarf aus Phase 1–3 bestätigt |

Reihenfolge passt zur bestehenden Vorgehensweise in `.claude/CLAUDE.md` Abschnitt 9
(Solution Architect → DB/Prisma → Backend → Security → Frontend → QA) und zu den in Abschnitt 11
gelisteten "Zukunft"-Punkten (Ersatzteilmanagement, Smart Monitoring).

## 8. Offene Fragen (vor Umsetzungsstart zu klären)

1. Liegen für den ersten vollständigen Anlagentyp (**Verladearm**, laut `CLAUDE.md` Abschnitt 11
   "in Vorbereitung") bereits digitale Explosionszeichnungen/Ersatzteillisten vor, die als
   `PlantDrawing`-Bilder verwendet werden können?
2. Sollen Preise im Portal sichtbar sein, oder nur Teilebezeichnung/-nummer mit Mengenanfrage
   (Preis erst im Angebot, wie beim bestehenden `PlantRequestOffer`-Flow)?
3. Soll die Bestellung direkt einen Auftrag/eine Rechnung auslösen können, oder — wie
   vorgeschlagen — ausschließlich über den bestehenden Anfrage-/Angebotsprozess laufen?
4. Gibt es für 3D-Modelle (Phase 4) überhaupt einen validierten Kundenbedarf, oder reicht die
   2D-Lösung dauerhaft aus? Empfehlung: erst nach Phase 1–3 mit echtem Nutzerfeedback
   entscheiden.
5. Wer pflegt künftig Zeichnungen/Positionen — bestehendes Servicepersonal oder eine neue
   Rolle/Zuständigkeit?

## 9. Zuordnung zu bestehenden Agenten (laut `.claude/CLAUDE.md` Abschnitt 10)

- **Solution Architect**: Freigabe dieses Konzepts, Entscheidung Phase-1-Scope
- **Database/Prisma**: Migrationen für `PlantDrawing`, Feldergänzungen `PartTypeItem`/
  `PlantMaterial`, `PlantRequestPart`, Enum-Erweiterung `ERSATZTEIL`
- **Customer & Plant**: Zeichnungs-/Positionspflege-UI im internen Bereich
- **Security & Permission**: neue Ressource `parts-catalog`, Rollen-Defaults, Scope-Tests
- **UI/UX**: Portal-Katalogseite, Hotspot-Overlay, Warenkorb-artige Bestellauswahl,
  Dokumenten-Sammel-Download
- **Service Job**: Verknüpfung Bestellungen ↔ Folgeauftrag (falls Ersatzteil-Einbau zu Job wird)
- **QA Review**: Mandantentrennung der Katalogdaten, Scope-Tests für alle externen Rollen
