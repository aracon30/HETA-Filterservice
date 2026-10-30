# Konzept: Ersatzteilportal

Status: Konzept abgestimmt, bereit für Umsetzung (Phase 0/1a) · Datum: 2026-08-10

## 1. Ziel

Für jede Anlage eines Kunden wird im Kundenportal ein Ersatzteilkatalog hinterlegt. Zusätzlich
wird die komplette Anlagendokumentation im Portal verfügbar gemacht, um den Dokumentenversand
per E-Mail zu ersetzen. Auftragsnummern und Kundenzugänge funktionieren wie bisher.

**Kernentscheidungen:**

- Darstellung als **2D-Zeichnung mit klickbaren Positionsmarkierungen (Hotspots)**, kein
  interaktives 3D-Modell (Begründung: Abschnitt 4.3).
- Katalog-Datenquelle ist die bereits vorhandene, ingenieurseitig kuratierte
  **„Empfohlene Ersatzteile"-Liste** pro Auftrag/Anlage (liegt als Excel vor) — nicht die volle
  Fertigungsstückliste (Abschnitt 4.3, 4.6).
- Ersatzteilanfragen laufen über **denselben Prozess** wie heutige Wartungsanfragen
  (`PlantRequest`, neue Kategorie „Ersatzteil"), kein separater Bereich, kein automatischer
  Auftrag/keine Rechnung (Abschnitt 4.4).
- **Keine Preise im Portal sichtbar** — Kunde stellt eine Anfrage mit Menge, Preis kommt wie
  bisher erst im individuellen Angebot.
- Einstieg über einen Button **„Ersatzteile anfragen"** auf der Anlagen-Detailseite im Portal
  (Abschnitt 4.4).
- **Pflege** (Anlegen/Bearbeiten von Ersatzteilen und Zeichnungen) ist vorerst ausschließlich
  `ADMIN` und `SERVICE_MANAGER` vorbehalten (Abschnitt 4.5).
- **Pilot:** Kantenspaltfilter, Typ KS-401.13.065, Kunde Follmann, Auftrag K-04532-24
  (Abschnitt 7).

## 2. Ist-Stand — was schon existiert

Ein großer Teil ist im Datenmodell bereits angelegt, aber nicht für den Ersatzteil-Anwendungsfall
im Kundenportal nutzbar gemacht:

| Baustein | Vorhanden? | Wo | Bewertung |
|---|---|---|---|
| Auftragsnummern je Kunde | ✅ | `ServiceJob.orderNumber` | Nichts zu tun |
| Kundenportal mit Rollen/Scope | ✅ | `app/portal/**`, `lib/permissions.ts` | Basis für Ersatzteilportal nutzbar |
| Anlagendokumentation im Portal | ✅ (Basis) | `PlantDocument`, `components/PlantDocuments.tsx`, eingebunden in `app/portal/plants/[id]/page.tsx` | Typen `MANUAL`, `DRAWING`, `IMAGE`, `OTHER` bereits vorhanden — deckt Dokumentenversand schon weitgehend ab |
| Ersatzteil-Stammdaten je Anlagentyp | ✅ (intern) | `PartTypeItem` (Vorlage je `PlantType`) | Nur Label/Teilenummer/Menge, keine Zeichnung/Position. Begrenzt nützlich, da Anlagen auftragsbezogen individuell konstruiert werden — Katalog gehört primär an die einzelne Anlage, nicht an den generischen Typ |
| Ersatzteilliste je Anlage | ✅ (intern) | `PlantMaterial`, `app/api/plants/[id]/materials/route.ts` | Nur für internes Personal lesbar/schreibbar — nicht im Kundenportal sichtbar, keine Anfragefunktion für Kunden |
| Ersatzteile je Auftrag | ✅ (intern) | `JobMaterial` | Wie oben, intern |
| Anfrage-/Angebotsworkflow mit Kunde | ✅ | `PlantRequest`, `PlantRequestMessage`, `PlantRequestOffer`, Status-Pipeline `OPEN` → … → `JOB_PLANNED`/`CLOSED` | Generischer Workflow für Kundenanfragen — wird für Ersatzteilanfragen wiederverwendet |
| Bild/Zeichnung mit klickbaren Positionen | ❌ | — | Neu zu bauen |
| 3D-Modell-Viewer | — | — | Nicht Teil dieses Konzepts (siehe Abschnitt 4.3) |

Die Ersatzteil-Idee ist damit kein neues Subsystem, sondern eine Erweiterung der bestehenden
`PlantMaterial`-Datenstruktur um Kunden-Sichtbarkeit, Positions-/Bildreferenzen und eine
Anfragestrecke, die auf `PlantRequest` aufsetzt.

## 3. Anforderungen

1. Jeder externe Portal-Nutzer sieht — abhängig von Rolle/Scope wie bisher
   (`getExternalPlantScope`, `getScopeFilter`) — den Ersatzteilkatalog der Anlagen, für die er
   berechtigt ist.
2. Pro Anlage existiert eine Liste von Ersatzteilen mit: Positionsnummer (wie auf der
   Zeichnung/Stückliste, z. B. „3.2"), Bezeichnung, Abmessungen/Material, empfohlene Menge,
   optional Artikelnummer. Keine Preise.
3. Ersatzteile können optional visuell verortet werden — auf einer oder auf mehreren Zeichnungen
   gleichzeitig (z. B. Übersichtszeichnung und zugehörige Detailzeichnung).
4. Aus dem Katalog heraus kann der Kunde eine Anfrage auslösen (mehrere Positionen mit Menge, ein
   `PlantRequest`).
5. Die komplette Anlagendokumentation ist zentral im Portal abrufbar und herunterladbar,
   inklusive Sammel-Download.
6. Mandantentrennung bleibt zwingend gewahrt — kein Kunde sieht Daten/Kataloge anderer Kunden.
7. Interne Nutzer (Service/Vertrieb) pflegen Kataloge und Zeichnungen; Kunden lesen und fragen an.

## 4. Lösungskonzept

### 4.1 Auftragsnummern & Portalzugang

Unverändert — bestehende Mechanik (`ServiceJob.orderNumber`, `EXTERNAL_ROLES`,
`getExternalPlantScope`) wird weiterverwendet.

### 4.2 Anlagendokumentation im Portal

Die Grundlage (`PlantDocument`) existiert bereits und wird im Portal angezeigt. Ergänzungen:

- **Sammel-Download**: `GET /api/portal/plants/[id]/documents/zip`, lädt alle für den Nutzer
  sichtbaren Dokumente einer Anlage gebündelt herunter (nutzt vorhandene Scope-Prüfung).
- **Filter/Kategorien** in `PlantDocuments` nach `DocumentType`, da die Liste pro Anlage mit
  Doku + Katalogzeichnungen wächst.
- Kein neues Datenmodell nötig — nur UI-/API-Erweiterung.

### 4.3 Ersatzteilkatalog je Anlage

**Katalogtiefe.** Die volle Inventor-Stückliste (im Praxisbeispiel 40+ Positionen inkl.
Schrauben, Muttern, Unterlegscheiben) ist für den Kunden zu granular und teilweise nicht separat
bestellbar. HETA erstellt bereits heute pro Auftrag/Anlage eine **kuratierte „Empfohlene
Ersatzteile"-Liste** (typischerweise 10–20 Zeilen) als Excel-Tabelle — gemischt aus
Top-Level-Positionen (z. B. „18") und Unterbaugruppen-Positionen in Punktnotation (z. B. „3.2",
„6.12", entsprechend der in Inventor bereits genutzten hierarchischen Positionsnummerierung von
Baugruppen). Diese bereits vorhandene, von Ingenieuren vorselektierte Liste ist die Datenquelle
für den Portal-Katalog — nicht die volle Stückliste. Eine eigene, generische
Baugruppen-Navigation ist damit nicht nötig: Die Hierarchie steckt bereits als Text in der
Positionsnummer.

**Darstellungsform.** Tabelle + 2D-Zeichnung mit klickbaren Positionsmarkierungen
(Hotspot-Overlay, reines HTML/CSS-Bild-Overlay). Ein interaktives 3D-Modell wurde für Phase 1
bewusst verworfen: Es würde CAD-Exporte (glTF/GLB) je Anlage voraussetzen, die aktuell nicht
vorliegen, dazu eine 3D-Viewer-Komponente (z. B. `@react-three/fiber`/`three.js`) mit
entsprechendem Interaktionsdesign (Mesh-Picking, Mobilgeräte-Performance) — deutlich höherer
Aufwand ohne aktuell validierten Mehrwert. 3D bleibt eine mögliche spätere, optionale
Ausbaustufe (vgl. Autodesk-Platform-Services-Option in Abschnitt 4.6).

**Datenmodell-Erweiterung** (siehe Abschnitt 5 für die Prisma-Skizze):

- `PlantMaterial` (konkrete Anlage) wird um `positionLabel` (Positionsnummer wie auf der
  Zeichnung, z. B. „3.2") und `specification` (Abmessungen/Material als Freitext) ergänzt — die
  Spalten der „Empfohlene Ersatzteile"-Tabelle bilden sich damit 1:1 ab (`label`=Bezeichnung,
  `partNumber`=Artikelnummer falls vorhanden, `quantity`=Empf. Menge). `PartTypeItem` bleibt
  unverändert als optionale Vorlage, ist aber wegen der auftragsindividuellen Konstruktion nicht
  die primäre Datenquelle.
- Kein neues Zeichnungsmodell — stattdessen Wiederverwendung von `PlantDocument`
  (`type: DRAWING`) plus optionalen Bild-Maßen (`width`/`height`).
- Neues Verknüpfungsmodell `PlantMaterialPosition` (n:m zwischen Ersatzteil und Zeichnung): Eine
  Position kann auf mehreren Zeichnungen markiert sein (z. B. Übersicht und zusätzlich eine
  Detailzeichnung), daher reicht ein einzelnes Positionsfeld direkt an `PlantMaterial` nicht aus.
  Jede Zeile in `PlantMaterialPosition` verknüpft ein `PlantMaterial` mit einem `PlantDocument`
  und einer X/Y-Koordinate darauf.
- Kunden-Sichtbarkeit wird über eine neue Ressource `parts-catalog` in `lib/permissions.ts` /
  `permissions-config.ts` gesteuert (view für externe Rollen, create/edit nur intern,
  Abschnitt 4.5).

### 4.4 Anfrageworkflow

Kein neues System — Wiederverwendung von `PlantRequest`. Keine Preise sichtbar, kein
automatischer Auftrag/keine Rechnung — der Kunde stellt ausschließlich eine unverbindliche
Anfrage mit Menge, das Angebot kommt wie bisher separat zurück.

- `RequestType`-Enum um `ERSATZTEIL` ergänzen.
- **Einstieg:** Auf der Anlagen-Detailseite im Portal (`app/portal/plants/[id]/page.tsx`, gut
  sichtbar im Kopfbereich, z. B. neben dem „Einsätze"-Zähler) erscheint ein Button
  **„Ersatzteile anfragen"**. Er führt auf eine neue Unterseite
  `app/portal/plants/[id]/ersatzteile/page.tsx`.
- **Auswahlseite:** Zeigt — falls vorhanden — die Zeichnung mit Hotspots plus darunter die
  Tabelle aller Ersatzteile dieser Anlage (Bezeichnung, Teilenummer, Mengen-Eingabefeld, kein
  Preis). Ist keine Zeichnung hinterlegt, wird nur die Tabelle gezeigt (Fallback, kein Blocker).
- Kunde wählt Positionen mit Menge, klickt „Anfrage absenden" → es wird eine `PlantRequest` vom
  Typ `ERSATZTEIL` mit den gewählten Teilen erzeugt (strukturierte Zeilen, neues Modell
  `PlantRequestPart`, analog zu `PlantRequestPlant`).
- Der bestehende Status-Fluss (`OPEN` → `IN_REVIEW` → `OFFER_SENT` → `OFFER_ACCEPTED` → ggf.
  `JOB_PLANNED`/`CLOSED`) und die Nachrichtenfunktion (`PlantRequestMessage`) werden unverändert
  genutzt — intern prüft Vertrieb/Service die Anfrage und erstellt ein Angebot mit den für den
  jeweiligen Kunden gültigen Preisen (`PlantRequestOffer`, PDF-Upload wie bisher). Erst wenn der
  Kunde annimmt, kann daraus bei Bedarf ein Folgeauftrag entstehen.
- Die Anfrage landet in der bestehenden Anfragen-Übersicht (`/portal/requests`), nicht in einem
  separaten Bereich — ein Team, ein Kunden-UI-Muster für alle Anfragearten.

### 4.5 Berechtigungen & Mandantentrennung

- Neue Ressource `parts-catalog` in `Resources`-Typ (`lib/permissions-config.ts`). **Pflege**
  (create/edit/delete — Ersatzteile, Zeichnungen, Hotspot-Positionen) ist ausschließlich `ADMIN`
  und `SERVICE_MANAGER` vorbehalten. `SERVICE_TECHNICIAN` erhält — anders als beim bestehenden
  `materials`-Endpunkt für die interne Auftragsplanung — **keine** Schreibrechte auf
  `parts-catalog`, da diese Ressource kundenseitig sichtbaren Inhalt pflegt und enger
  kontrolliert werden soll. Externe Rollen (`MAINTENANCE_MANAGER`, `MAINTENANCE_TECHNICIAN`,
  `BUYER`) erhalten nur `view`, gescoped über `getExternalPlantScope` (dieselbe
  Anlagen-Sichtbarkeit wie für Dokumente/Checklisten).
- API-Routen folgen dem Standardmuster aus `.claude/CLAUDE.md` Abschnitt 6 (`getServerSession` →
  `checkPermission` → `getScopeFilter`).
- Katalogdaten (`PlantMaterial`, `PlantMaterialPosition`, referenzierte `PlantDocument`) sind
  über `plantId` an die Anlage und damit transitiv an `customerId` gebunden — bestehende
  Scope-Filter greifen ohne Sonderfall.

### 4.6 CAD-Datenpflege — Übernahme aus Autodesk Inventor

Zeichnungen entstehen im CAD-System Autodesk Inventor, die „Empfohlene Ersatzteile"-Liste liegt
bereits als Excel-Tabelle pro Auftrag/Anlage vor. Damit die Pflege im Portal möglichst wenig
Aufwand macht, wird bewusst keine direkte API-/Cloud-Integration mit Inventor gebaut, sondern der
einfachste funktionierende Weg genutzt:

- **Zeichnung(en):** Die relevanten Zeichnungsblätter (Übersicht + ausgewählte
  Detailzeichnungen — nicht jedes Blatt wird angehängt, nur die für den Katalog relevanten)
  werden als PNG/JPG/PDF exportiert und wie jedes andere Anlagendokument über den bestehenden
  Upload (`PlantDocument`, `type: DRAWING`) hochgeladen. Pro Anlage können mehrere Zeichnungen
  hinterlegt werden.
- **Ersatzteilliste:** Die vorhandene „Empfohlene Ersatzteile"-Excel-Tabelle wird direkt
  importiert, kein Umweg über CSV-Konvertierung nötig. Die Spalten „Pos. Stückliste",
  „Bezeichnung", „Abmessungen/Material", „Empf. Menge" werden 1:1 auf `positionLabel`, `label`,
  `specification`, `quantity` gemappt (Artikelnummer, falls vorhanden, auf `partNumber`).
- **Import:** Eine kleine, neu zu bauende Excel-Import-Funktion auf der internen
  Materialpflegeseite liest die Tabelle ein und legt/aktualisiert `PlantMaterial`-Zeilen daraus —
  ersetzt manuelles Abtippen.
- **Hotspots setzen (manueller Restschritt):** Die Excel-Liste enthält keine Bildkoordinaten.
  Nach dem Import platziert die Pflegekraft einmalig pro Zeichnung die Positionsmarkierungen
  (Klick-auf-Bild-Editor, Abschnitt 6) — erleichtert dadurch, dass Inventor die Bauteile auf der
  Zeichnung bereits mit denselben Positionsnummern („Positionsballons") beschriftet, die auch in
  der importierten Tabelle stehen. Eine Position kann dabei auf mehr als einer Zeichnung markiert
  werden (`PlantMaterialPosition` ist n:m).
- **Bewusst nicht umgesetzt** (höherer Aufwand, aktuell nicht nötig): ein Inventor-Makro
  (iLogic/VBA) für automatischen Export bei Freigabe, oder eine Anbindung an Autodesk Platform
  Services (Model Derivative/Design Automation API) für vollautomatische Cloud-Konvertierung.
  Letzteres wäre auch der Weg, falls später doch ein 3D-Viewer gewünscht wird — Model Derivative
  kann native Inventor-Dateien ohne eigene Konvertierungs-Pipeline darstellbar machen.

## 5. Datenmodell-Vorschlag (Skizze)

```prisma
// Ergänzungen an PlantDocument (nicht neu, nur zusätzliche Felder — kein eigenes Zeichnungsmodell):
// PlantDocument + width Int? + height Int?   // Bildmaße, nötig für das Hotspot-Overlay

// Ergänzungen an PlantMaterial (bestehendes Modell):
// PlantMaterial + positionLabel String?   // Positionsnummer wie auf Zeichnung/Stückliste, z.B. "3.2"
//               + specification String?   // Abmessungen/Material als Freitext
//               + orderable    Boolean @default(true)  // ob Kunde dieses Teil anfragen darf
// Bewusst KEIN price-Feld — Preise sind kundenindividuell und werden nicht im Portal angezeigt,
// sondern erst im Angebot (PlantRequestOffer) genannt.

// n:m zwischen Ersatzteil und Zeichnung — eine Position kann auf mehreren Zeichnungen markiert
// sein (z. B. Übersicht + Detailzeichnung), daher kein einzelnes drawingId-Feld an PlantMaterial.
model PlantMaterialPosition {
  id         String        @id @default(cuid())
  materialId String
  material   PlantMaterial @relation(fields: [materialId], references: [id], onDelete: Cascade)
  documentId String
  document   PlantDocument @relation(fields: [documentId], references: [id], onDelete: Cascade)
  positionX  Float         // relative Koordinate 0–1
  positionY  Float         // relative Koordinate 0–1

  @@unique([materialId, documentId])
  @@index([documentId])
}

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

`positionX`/`positionY` sind relative Koordinaten (0–1) auf dem jeweils referenzierten
`PlantDocument`, geräte-/auflösungsunabhängig für das Hotspot-Overlay im Frontend.

## 6. Technische Umsetzung Hotspot-Overlay

- Pro Zeichnung (`PlantDocument` mit `type: DRAWING`): Client-Komponente rendert das Bild als
  `<img>` und overlayt für jede zugehörige `PlantMaterialPosition` einen absolut positionierten
  Marker-Button (`style={{ left: `${x*100}%`, top: `${y*100}%` }}`), beschriftet mit der
  `positionLabel` des zugehörigen `PlantMaterial` (z. B. „3.2").
- Klick auf Marker scrollt zur/hebt die zugehörige Tabellenzeile hervor (und umgekehrt) — kein
  WebGL, keine neue Abhängigkeit nötig.
- Ist eine Anlage mit mehreren Zeichnungen hinterlegt (Übersicht + Details), werden diese als
  Tabs/Reiter über dem Bild angeboten; ein Ersatzteil mit mehreren
  `PlantMaterialPosition`-Einträgen erscheint entsprechend auf mehreren Reitern.
- Pflege der Positionen: einfacher Klick-auf-Bild-Editor im internen Admin-/Anlagen-Bereich (legt
  beim Klick eine `PlantMaterialPosition` an), analog zu bestehenden Editor-Mustern im Projekt.

## 7. Rollout-Phasen

**Pilot:** Kantenspaltfilter, Typ KS-401.13.065, Kunde Follmann (Auftrag K-04532-24) — an dieser
einen Anlage wird der Ersatzteilkatalog zuerst umgesetzt und geprüft, bevor er auf weitere Kunden
und Anlagentypen ausgerollt wird.

| Phase | Inhalt | Voraussetzung |
|---|---|---|
| 0 | Vorbereitung Pilot: „Kantenspaltfilter" als Anlagentyp in `PLANT_TYPES` ergänzen; `Customer`/`Plant`-Datensatz für Follmann/KS-401.13.065 anlegen bzw. prüfen | Keine |
| 1a | Ersatzteilkatalog (Tabelle, ohne Zeichnung) für die Pilot-Anlage im Portal sichtbar machen + Button „Ersatzteile anfragen" → `PlantRequest`/`ERSATZTEIL` + XLSX-Import für `PlantMaterial` | Excel „Empfohlene Ersatzteile" für K-04532-24 (liegt bereits vor) |
| 1b | Zeichnung(en) + Hotspot-Positionen ergänzen (`PlantDocument`, `PlantMaterialPosition`) | Bild-Export der relevanten Zeichnungsblätter aus Inventor |
| 2 | Rollout auf weitere Anlagen/Kunden; Dokumentenportal-Ausbau: Sammel-Download, Kategorie-Filter | Erfahrungen aus dem Piloten |
| 3 (Zukunft, optional) | Interaktives 3D-Modell für ausgewählte, komplexe Anlagentypen; ggf. über Autodesk Platform Services statt eigener 3D-Pipeline | Validierter Bedarf aus Phase 1–2, CAD-Exportweg geklärt |

Reihenfolge passt zur bestehenden Vorgehensweise in `.claude/CLAUDE.md` Abschnitt 9
(Solution Architect → DB/Prisma → Backend → Security → Frontend → QA) und zu den in Abschnitt 11
gelisteten „Zukunft"-Punkten (Ersatzteilmanagement, Smart Monitoring).

## 8. Offene Punkte

1. Gibt es für ein interaktives 3D-Modell (Phase 3) einen validierten Kundenbedarf, oder reicht
   die 2D-Lösung dauerhaft aus? Empfehlung: erst nach Phase 1–2 mit echtem Nutzerfeedback
   entscheiden — blockiert die Umsetzung nicht.
2. Existieren `Customer` (Follmann) und `Plant` (KS-401.13.065 / K-04532-24) bereits als
   Datensätze, oder müssen sie für den Piloten neu angelegt werden (Phase 0)?

## 9. Zuordnung zu bestehenden Agenten (laut `.claude/CLAUDE.md` Abschnitt 10)

- **Solution Architect**: Freigabe dieses Konzepts, Entscheidung Phase-1-Scope
- **Database/Prisma**: Migrationen für `PlantMaterialPosition`, Feldergänzungen `PlantDocument`
  (`width`/`height`) und `PlantMaterial` (`positionLabel`/`specification`/`orderable`),
  `PlantRequestPart`, Enum-Erweiterung `ERSATZTEIL`
- **Customer & Plant**: Zeichnungs-/Positionspflege-UI im internen Bereich, Anlagentyp
  „Kantenspaltfilter" anlegen
- **Security & Permission**: neue Ressource `parts-catalog`, Rollen-Defaults, Scope-Tests
- **UI/UX**: Portal-Katalogseite, Hotspot-Overlay, Ersatzteilauswahl mit Mengenangabe,
  Dokumenten-Sammel-Download
- **Service Job**: Verknüpfung Anfrage ↔ Folgeauftrag (falls Ersatzteil-Einbau zu Job wird)
- **QA Review**: Mandantentrennung der Katalogdaten, Scope-Tests für alle externen Rollen
