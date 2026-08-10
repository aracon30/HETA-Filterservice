# Konzept: Ersatzteilportal

Status: Eckpunkte für Phase 1 abgestimmt · Autor: Claude (im Auftrag) · Datum: 2026-08-10

## 1. Ausgangslage

Idee (Kurzfassung des Auftrags): Für jede Anlage eines Kunden soll im Kundenportal ein
Ersatzteilkatalog hinterlegt werden. Zusätzlich soll die komplette Anlagendokumentation im
Portal verfügbar sein, um den Dokumentenversand zu vereinfachen. Auftragsnummern und
Kundenzugänge sollen wie bisher funktionieren.

Dieses Dokument ordnet die Idee in die bestehende Architektur ein, zeigt auf, was bereits
vorhanden ist, und schlägt ein konkretes Datenmodell sowie einen Umsetzungsweg vor.

**In der Abstimmung festgelegte Eckpunkte für Phase 1** (Ergebnis der Konzept-Besprechung):

1. Darstellung als **2D-Zeichnung mit klickbaren Positionsmarkierungen (Hotspots)** —
   kein interaktives 3D-Modell. 3D bleibt eine mögliche, aber unverbindliche spätere Ausbaustufe.
2. Digitale Explosionszeichnungen/Ersatzteillisten liegen **aktuell noch nicht vor** — sie müssen
   pro Anlagentyp aus dem CAD-System (**Autodesk Inventor**) exportiert und hochgeladen werden.
   Es soll kein Sonderaufwand in Digitalisierung/Aufbereitung gesteckt werden — einfache,
   bereits vorhandene Inventor-Exporte reichen (siehe Abschnitt 4.6).
3. Ersatzteilanfragen laufen über **denselben Prozess** wie heutige Wartungsanfragen
   (`PlantRequest`), nur mit neuer Kategorie „Ersatzteil" — kein getrennter Bereich.
4. **Keine Preise im Portal sichtbar**, da Kunden unterschiedliche Konditionen haben. Der Kunde
   kann nur eine Anfrage mit Menge/Teilenummer stellen; die Preisnennung erfolgt wie bisher erst
   im individuellen Angebot.
5. Auf der Anlagen-Detailseite im Portal (`app/portal/plants/[id]/page.tsx`) erhält der Kunde
   einen Button **„Ersatzteile anfragen"**, der direkt zur Teileauswahl und in den
   Anfrageprozess führt (siehe Abschnitt 4.4).

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

**Darstellungsform — entschieden: Tabelle + 2D-Zeichnung mit Hotspots.**

Ein interaktives 3D-Modell wurde bewusst verworfen für Phase 1: Es würde CAD-Exporte (glTF/GLB)
je Anlagentyp voraussetzen, die aktuell für keinen Anlagentyp vorliegen, dazu eine 3D-Viewer-
Komponente (z. B. `@react-three/fiber`/`three.js`) mit entsprechendem Interaktionsdesign
(Mesh-Picking, Mobilgeräte-Performance) — deutlich höherer Aufwand ohne aktuell validierten
Mehrwert gegenüber der einfacheren 2D-Lösung. 3D bleibt eine mögliche **spätere, optionale
Ausbaustufe** (vgl. `Zukunft`-Einträge in `.claude/CLAUDE.md` Abschnitt 11), siehe Abschnitt 4.6
zur Autodesk-Platform-Services-Option, falls dieser Bedarf einmal entsteht.

Stattdessen: **Tabelle + Zeichnung inkl. klickbarer Positionsmarkierungen auf einem 2D-Bild**
(Hotspot-Overlay, reines HTML/CSS, keine 3D-Engine). Das deckt den Kernnutzen (Kunde
identifiziert Teil, sieht Teilenummer, stellt Anfrage) mit überschaubarem Aufwand ab und passt zu
den vorhandenen Inventor-Exportmöglichkeiten (Abschnitt 4.6).

### 4.4 Bestellworkflow

Kein neues Bestellsystem — Wiederverwendung von `PlantRequest`. **Keine Preise sichtbar**; der
Kunde stellt ausschließlich eine Anfrage mit Menge/Teilenummer, das Angebot inkl. Preis kommt wie
bisher separat zurück.

- `RequestType`-Enum um `ERSATZTEIL` ergänzen.
- **Einstieg:** Auf der Anlagen-Detailseite im Portal (`app/portal/plants/[id]/page.tsx`, gut
  sichtbar im Kopfbereich, z. B. neben dem „Einsätze"-Zähler) erscheint ein Button
  **„Ersatzteile anfragen"**. Er führt auf eine neue Unterseite
  `app/portal/plants/[id]/ersatzteile/page.tsx`.
- **Auswahlseite:** Zeigt — falls vorhanden — die Zeichnung mit Hotspots (Abschnitt 4.6) plus
  darunter die Tabelle aller Ersatzteile dieser Anlage (Bezeichnung, Teilenummer,
  Mengen-Eingabefeld, kein Preis). Ist keine Zeichnung hinterlegt, wird nur die Tabelle gezeigt
  (Fallback, kein Blocker).
- Kunde wählt Positionen mit Menge, klickt „Anfrage absenden" → es wird eine `PlantRequest` vom
  Typ `ERSATZTEIL` mit den gewählten Teilen erzeugt (strukturierte Zeilen, analog zu
  `PlantRequestPlant`, neu: `PlantRequestPart`).
- Der bestehende Status-Fluss (`OPEN` → `IN_REVIEW` → `OFFER_SENT` → `OFFER_ACCEPTED` → ggf.
  `JOB_PLANNED`/`CLOSED`) und die Nachrichtenfunktion (`PlantRequestMessage`) werden unverändert
  genutzt — intern prüft Vertrieb/Service die Anfrage und erstellt ein Angebot mit den für den
  jeweiligen Kunden gültigen Preisen (`PlantRequestOffer`, PDF-Upload wie bisher).
- Die Anfrage landet danach ganz normal in der bestehenden Anfragen-Übersicht
  (`/portal/requests`), nicht in einem separaten Bereich.

Vorteil: kein Parallelprozess, ein Team, ein Kunden-UI-Muster (`app/portal/requests/**`) für alle
Anfragearten — Ersatzteilanfragen sind lediglich eine weitere Kategorie darin.

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

### 4.6 CAD-Datenpflege — Übernahme aus Autodesk Inventor

Zeichnungen und Ersatzteillisten entstehen im CAD-System **Autodesk Inventor**. Damit die
Pflege im Portal möglichst wenig Aufwand macht, wird bewusst **keine** direkte
API-/Cloud-Integration mit Inventor gebaut, sondern der einfachste funktionierende Weg genutzt
("Stufe 0"):

- **Zeichnung:** Inventor exportiert eine 2D-Ansicht direkt als PNG/JPG/PDF (Bordmittel,
  „Speichern unter"/„Veröffentlichen") — dieser Export wird wie jedes andere Anlagendokument über
  den bestehenden Upload (`PlantDocument`/`PlantDrawing`) hochgeladen.
- **Stückliste (BOM):** Inventor kann die Stückliste direkt als **CSV/Excel** exportieren
  (Positionsnummer, Teilenummer, Bezeichnung, Menge) — ebenfalls Bordmittel, kein Skript/Add-in
  nötig.
- **Import auf unserer Seite:** Eine kleine, neu zu bauende CSV-Import-Funktion auf der
  internen Materialpflegeseite liest die exportierte Stückliste ein und legt/aktualisiert
  `PlantMaterial`-Zeilen daraus (Spalten → Felder: Bezeichnung, Teilenummer, Menge). Das ersetzt
  manuelles Abtippen der Teileliste.
- **Praktische Erleichterung für Hotspots:** Inventor nummeriert Bauteile auf der Zeichnung
  bereits automatisch mit denselben Positionsnummern wie in der Stückliste ("Positionsballons").
  Die Positionsmarkierungen im Portal können sich an dieser bereits vorhandenen Nummerierung
  orientieren — die Pflegekraft muss beim Setzen der Hotspots nur die schon sichtbaren Nummern
  auf der Zeichnung mit den (bereits importierten) Tabellenzeilen verknüpfen, nicht neu erfinden.
- **Bewusst nicht umgesetzt (höherer Aufwand, aktuell nicht nötig):** ein Inventor-Makro
  (iLogic/VBA) für automatischen Export bei Freigabe, oder eine Anbindung an Autodesk Platform
  Services (Model Derivative/Design Automation API) für vollautomatische Cloud-Konvertierung.
  Letzteres wäre auch der Weg, falls später doch ein 3D-Viewer gewünscht wird (Model Derivative
  kann native Inventor-Dateien ohne eigene Konvertierungs-Pipeline darstellbar machen) — für
  Phase 1 aber nicht erforderlich.

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
// PartTypeItem  + unit String? + drawingId String? + positionX Float? + positionY Float?
// PlantMaterial + unit String? + drawingId String? + positionX Float? + positionY Float?
//               + orderable Boolean @default(true)  // ob Kunde dieses Teil anfragen darf
// Bewusst KEIN price-Feld — Preise sind kundenindividuell und werden nicht im Portal angezeigt,
// sondern erst im Angebot (PlantRequestOffer) genannt.

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
| 1a | Ersatzteilkatalog (Tabelle, ohne Zeichnung) je Anlage im Portal sichtbar machen + Button „Ersatzteile anfragen" → `PlantRequest`/`ERSATZTEIL` + CSV-Import für `PlantMaterial` | Keine — CSV-Export aus Inventor je Anlage/-typ |
| 1b | Zeichnung + Hotspot-Positionen ergänzen (`PlantDrawing`, Positionsfelder) | Bild-Export je Anlagentyp aus Inventor (Stufe 0, Abschnitt 4.6) |
| 2 | Dokumentenportal-Ausbau: Sammel-Download, Kategorie-Filter | Keine |
| 3 (Zukunft, optional) | Interaktives 3D-Modell für ausgewählte, komplexe Anlagentypen; ggf. über Autodesk Platform Services statt eigener 3D-Pipeline | Validierter Bedarf aus Phase 1–2, CAD-Exportweg geklärt |

Reihenfolge passt zur bestehenden Vorgehensweise in `.claude/CLAUDE.md` Abschnitt 9
(Solution Architect → DB/Prisma → Backend → Security → Frontend → QA) und zu den in Abschnitt 11
gelisteten "Zukunft"-Punkten (Ersatzteilmanagement, Smart Monitoring).

## 8. Geklärte und offene Fragen

**Geklärt in der Konzept-Besprechung:**

1. ~~Liegen digitale Explosionszeichnungen vor?~~ Nein — werden erst nach Bedarf aus Inventor
   exportiert (Abschnitt 4.6), kein vorhandener Bestand vorausgesetzt.
2. ~~Preise im Portal?~~ Nein, keine Preise sichtbar — nur Mengenanfrage, Preis erst im Angebot.
3. ~~Eigener Bestellprozess oder bestehender Anfrage-Workflow?~~ Bestehender `PlantRequest`-
   Workflow, neue Kategorie „Ersatzteil", kein separater Bereich.

**Weiterhin offen:**

1. Für welchen Anlagentyp soll die erste Zeichnung/Stückliste aus Inventor exportiert und ins
   Portal aufgenommen werden — vermutlich **Verladearm** (laut `CLAUDE.md` Abschnitt 11 "in
   Vorbereitung" als erster vollständiger Anlagentyp)? Muss mit Konstruktion abgestimmt werden.
2. Soll die Bestellung/Anfrage direkt einen Auftrag/eine Rechnung auslösen können, oder — wie
   vorgeschlagen — ausschließlich über den bestehenden Anfrage-/Angebotsprozess laufen?
3. Gibt es für 3D-Modelle (Phase 3) überhaupt einen validierten Kundenbedarf, oder reicht die
   2D-Lösung dauerhaft aus? Empfehlung: erst nach Phase 1–2 mit echtem Nutzerfeedback
   entscheiden.
4. Wer pflegt künftig Zeichnungen/Positionen/CSV-Importe — bestehendes Servicepersonal oder eine
   neue Rolle/Zuständigkeit?

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
