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
2. Zeichnungen liegen als Inventor-Export vor, sind aber noch nicht ins Portal hochgeladen.
   Ersatzteillisten existieren bereits **pro Auftrag/Anlage** als kuratierte
   „Empfohlene Ersatzteile"-Excel-Tabelle (nicht die volle Fertigungsstückliste) — genau diese
   Tabelle wird die Datenquelle für den Katalog (siehe Abschnitt 4.3 „Katalogtiefe" und
   Abschnitt 4.6).
3. Ersatzteilanfragen laufen über **denselben Prozess** wie heutige Wartungsanfragen
   (`PlantRequest`), nur mit neuer Kategorie „Ersatzteil" — kein getrennter Bereich.
4. **Keine Preise im Portal sichtbar**, da Kunden unterschiedliche Konditionen haben. Der Kunde
   kann nur eine Anfrage mit Menge/Teilenummer stellen; die Preisnennung erfolgt wie bisher erst
   im individuellen Angebot.
5. Auf der Anlagen-Detailseite im Portal (`app/portal/plants/[id]/page.tsx`) erhält der Kunde
   einen Button **„Ersatzteile anfragen"**, der direkt zur Teileauswahl und in den
   Anfrageprozess führt (siehe Abschnitt 4.4).
6. Die **Pflege** von Ersatzteilen und Zeichnungen (Anlegen, Bearbeiten, Hochladen) ist vorerst
   **ausschließlich `ADMIN` und `SERVICE_MANAGER`** vorbehalten — nicht `SERVICE_TECHNICIAN`
   (siehe Abschnitt 4.5).

## 2. Ist-Stand — was schon existiert

Ein großer Teil der Idee ist im Datenmodell bereits angelegt, aber nicht für den
Ersatzteil-Anwendungsfall im Portal nutzbar gemacht:

| Baustein | Vorhanden? | Wo | Bewertung |
|---|---|---|---|
| Auftragsnummern je Kunde | ✅ | `ServiceJob.orderNumber` (`prisma/schema.prisma:304`) | Nichts zu tun |
| Kundenportal mit Rollen/Scope | ✅ | `app/portal/**`, `lib/permissions.ts` | Basis für Ersatzteilportal nutzbar |
| Anlagendokumentation im Portal | ✅ (Basis) | `PlantDocument`-Modell, `components/PlantDocuments.tsx`, eingebunden in `app/portal/plants/[id]/page.tsx:205` | Typen `MANUAL`, `DRAWING`, `IMAGE`, `OTHER` bereits vorhanden — deckt "Dokumentenversand erleichtern" schon weitgehend ab |
| Ersatzteil-Stammdaten je Anlagentyp | ✅ (intern) | `PartTypeItem` (Vorlage je `PlantType`) | Nur Label/Teilenummer/Menge, keine Zeichnung/Position. Begrenzt nützlich, da Anlagen auftragsbezogen individuell konstruiert werden (eigene Auslegung je Kunde/Auftrag) — Katalog gehört primär an die einzelne Anlage, nicht an den generischen Typ |
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
2. Pro Anlage existiert eine Liste von Ersatzteilen mit mindestens: Positionsnummer (wie auf der
   Zeichnung/Stückliste, z. B. „3.2"), Bezeichnung, Abmessungen/Material, empfohlene Menge,
   optional Artikelnummer. Keine Preise (siehe Eckpunkt 4).
3. Ersatzteile können optional visuell verortet werden — auf einer oder, falls sinnvoll, auch auf
   **mehreren** Zeichnungen gleichzeitig (z. B. Übersichtszeichnung und zugehörige
   Detailzeichnung), perspektivisch auch auf einem 3D-Modell.
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

**Katalogtiefe — Empfohlene-Ersatzteile-Liste statt volle Fertigungsstückliste.**

Anhand realer Beispiele (Auftrag K-04532-24) zeigt sich: Die volle Inventor-Stückliste (40+
Positionen inkl. Schrauben, Muttern, Unterlegscheiben) ist für den Kunden zu granular und
teilweise gar nicht separat bestellbar. HETA erstellt bereits heute pro Auftrag/Anlage eine
**kuratierte „Empfohlene Ersatzteile"-Liste** (im Beispiel 13 Zeilen) als Excel-Tabelle —
gemischt aus Top-Level-Positionen (z. B. „18") und Unterbaugruppen-Positionen in Punktnotation
(z. B. „3.2", „6.12", entsprechend der in Inventor bereits genutzten hierarchischen
Positionsnummerierung von Baugruppen). **Diese bereits vorhandene, von Ingenieuren
vorselektierte Liste ist die Datenquelle für den Portal-Katalog — nicht die volle Stückliste.**
Damit erübrigt sich eine eigene, generische Baugruppen-Navigation in der App: Die Hierarchie
steckt bereits als Text in der Positionsnummer, die App muss sie nicht selbst abbilden oder
verwalten.

**Datenmodell-Erweiterung** (Vorschlag, siehe Abschnitt 5 für Details):

- `PlantMaterial` (konkrete Anlage) wird um Felder `positionLabel` (Positionsnummer wie auf der
  Zeichnung, z. B. „3.2") und `specification` (Abmessungen/Material als Freitext) ergänzt — die
  Spalten der „Empfohlene Ersatzteile"-Tabelle bilden sich damit 1:1 ab
  (`label`=Bezeichnung, `partNumber`=Artikelnummer falls vorhanden, `quantity`=Empf. Menge).
  `PartTypeItem` bleibt unverändert als optionale Vorlage, ist aber wegen der auftragsindividuellen
  Konstruktion (Abschnitt 2) nicht die primäre Datenquelle.
- **Kein** neues `PlantDrawing`-Modell — stattdessen Wiederverwendung von `PlantDocument`
  (`type: DRAWING`) plus optionalen Bild-Maßen (`width`/`height`).
- **Neues Verknüpfungsmodell `PlantMaterialPosition`** (n:m zwischen Ersatzteil und Zeichnung):
  Da eine Position — wie besprochen — theoretisch auf **mehreren** Zeichnungen markiert sein kann
  (z. B. auf der Übersichtszeichnung und zusätzlich auf einer Detailzeichnung), reicht ein
  einzelnes `drawingId`/`positionX`/`positionY`-Feld direkt an `PlantMaterial` nicht aus. Jede
  Zeile in `PlantMaterialPosition` verknüpft ein `PlantMaterial` mit einem `PlantDocument` und
  einer X/Y-Koordinate darauf.
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

- Neue Ressource `parts-catalog` in `Resources`-Typ (`lib/permissions-config.ts`). **Pflege
  (create/edit/delete — Ersatzteile, Zeichnungen, Hotspot-Positionen) ist vorerst ausschließlich
  `ADMIN` und `SERVICE_MANAGER` vorbehalten.** `SERVICE_TECHNICIAN` erhält (anders als beim
  bestehenden `materials`-Endpunkt für die interne Auftragsplanung) **keine** Schreibrechte auf
  `parts-catalog` — das ist eine bewusste Abweichung vom bisherigen `WRITE_ROLES`-Muster in
  `app/api/plants/[id]/materials/route.ts`, da die neue Ressource kundenseitig sichtbaren Inhalt
  pflegt und enger kontrolliert werden soll. Externe Rollen (`MAINTENANCE_MANAGER`,
  `MAINTENANCE_TECHNICIAN`, `BUYER`) erhalten nur `view`, gescoped über `getExternalPlantScope`
  (dieselbe Anlagen-Sichtbarkeit wie für Dokumente/Checklisten, kein separates
  Berechtigungsmodell nötig).
- API-Routen folgen dem Standardmuster aus `.claude/CLAUDE.md` Abschnitt 6 (`getServerSession` →
  `checkPermission` → `getScopeFilter`).
- Katalogdaten (`PlantMaterial`, `PlantMaterialPosition`, referenzierte `PlantDocument`) sind
  über `plantId` an die Anlage und damit transitiv an `customerId` gebunden — bestehende
  Scope-Filter greifen ohne Sonderfall.

### 4.6 CAD-Datenpflege — Übernahme aus Autodesk Inventor

Zeichnungen entstehen im CAD-System **Autodesk Inventor**, die „Empfohlene Ersatzteile"-Liste
liegt bereits **als Excel-Tabelle pro Auftrag/Anlage** vor. Damit die Pflege im Portal möglichst
wenig Aufwand macht, wird bewusst **keine** direkte API-/Cloud-Integration mit Inventor gebaut,
sondern der einfachste funktionierende Weg genutzt ("Stufe 0"):

- **Zeichnung(en):** Die relevanten Zeichnungsblätter (Übersicht + ausgewählte Detailzeichnungen —
  wie bisher wird nicht jedes Blatt angehängt, nur die für den Katalog relevanten) werden als
  PNG/JPG/PDF exportiert und wie jedes andere Anlagendokument über den bestehenden Upload
  (`PlantDocument`, `type: DRAWING`) hochgeladen. Pro Anlage können mehrere Zeichnungen hinterlegt
  werden.
- **Ersatzteilliste:** Die vorhandene „Empfohlene Ersatzteile"-Excel-Tabelle wird direkt
  importiert — **kein Umweg über CSV-Konvertierung nötig**, ein XLSX-Import genügt. Die Spalten
  „Pos. Stückliste", „Bezeichnung", „Abmessungen/Material", „Empf. Menge" werden 1:1 auf
  `positionLabel`, `label`, `specification`, `quantity` gemappt (Artikelnummer, falls in einer
  Spalte vorhanden, auf `partNumber`).
- **Import auf unserer Seite:** Eine kleine, neu zu bauende Excel-Import-Funktion auf der internen
  Materialpflegeseite liest die Tabelle ein und legt/aktualisiert `PlantMaterial`-Zeilen daraus.
  Das ersetzt manuelles Abtippen — bei typischerweise 10–20 Zeilen pro Anlage ohnehin ein kleiner
  Datensatz.
- **Hotspots setzen (manueller Restschritt):** Die Excel-Liste enthält keine Bildkoordinaten. Nach
  dem Import platziert die Pflegekraft einmalig pro Zeichnung die Positionsmarkierungen
  (Klick-auf-Bild-Editor, Abschnitt 6) — erleichtert dadurch, dass Inventor die Bauteile auf der
  Zeichnung bereits mit denselben Positionsnummern („Positionsballons") beschriftet, die auch in
  der importierten Tabelle stehen. Eine Position kann dabei auf mehr als einer Zeichnung markiert
  werden (`PlantMaterialPosition` ist n:m, Abschnitt 4.3).
- **Bewusst nicht umgesetzt (höherer Aufwand, aktuell nicht nötig):** ein Inventor-Makro
  (iLogic/VBA) für automatischen Export bei Freigabe, oder eine Anbindung an Autodesk Platform
  Services (Model Derivative/Design Automation API) für vollautomatische Cloud-Konvertierung.
  Letzteres wäre auch der Weg, falls später doch ein 3D-Viewer gewünscht wird (Model Derivative
  kann native Inventor-Dateien ohne eigene Konvertierungs-Pipeline darstellbar machen) — für
  Phase 1 aber nicht erforderlich.

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

// Neu: n:m zwischen Ersatzteil und Zeichnung — eine Position kann auf mehreren Zeichnungen
// markiert sein (z.B. Übersicht + Detailzeichnung), daher kein einzelnes drawingId-Feld an PlantMaterial.
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

`positionX`/`positionY` als relative Koordinaten (0–1) auf dem jeweils referenzierten
`PlantDocument`, geräte-/auflösungsunabhängig für das Hotspot-Overlay im Frontend.

## 6. Technische Umsetzung Hotspot-Overlay (Phase 1)

- Pro Zeichnung (`PlantDocument` mit `type: DRAWING`): Client-Komponente rendert das Bild als
  `<img>` und overlayt für jede zugehörige `PlantMaterialPosition` einen absolut positionierten
  Marker-Button (`style={{ left: `${x*100}%`, top: `${y*100}%` }}`), beschriftet mit der
  `positionLabel` des zugehörigen `PlantMaterial` (z. B. „3.2").
- Klick auf Marker scrollt zur/hebt die zugehörige Tabellenzeile hervor (und umgekehrt) —
  kein WebGL, keine neue Abhängigkeit nötig.
- Ist eine Anlage mit mehreren Zeichnungen hinterlegt (Übersicht + Details), werden diese als
  Tabs/Reiter über dem Bild angeboten; ein Ersatzteil mit mehreren `PlantMaterialPosition`-Einträgen
  erscheint entsprechend auf mehreren Reitern.
- Pflege der Positionen: einfacher Klick-auf-Bild-Editor im internen Admin-/Anlagen-Bereich
  (legt beim Klick eine `PlantMaterialPosition` an), analog zu bestehenden Editor-Mustern im
  Projekt.

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
4. ~~Wie tief soll der Katalog gehen, wie werden Baugruppen/Einzelteile dargestellt?~~ Keine
   generische Baugruppen-Hierarchie in der App — Datenquelle ist die bereits vorhandene,
   ingenieurseitig kuratierte „Empfohlene Ersatzteile"-Excel-Liste pro Auftrag/Anlage
   (Abschnitt 4.3), nicht die volle Fertigungsstückliste.
5. ~~Liegt die Ersatzteilliste digital vor?~~ Ja, als Excel-Tabelle pro Auftrag — direkter
   XLSX-Import möglich (Abschnitt 4.6).
6. ~~Muss eine Position auf mehreren Zeichnungen markierbar sein?~~ Ja, theoretisch — dafür das
   n:m-Modell `PlantMaterialPosition` (Abschnitt 4.3/5).
7. ~~Wer darf Ersatzteile/Zeichnungen pflegen?~~ Vorerst nur `ADMIN` und `SERVICE_MANAGER`
   (Abschnitt 4.5) — beantwortet auch einen Teil der bisherigen offenen Frage 4 zur
   Pflege-Zuständigkeit.

**Weiterhin offen:**

1. Für welchen Anlagentyp soll die erste Zeichnung/Stückliste aus Inventor exportiert und ins
   Portal aufgenommen werden — vermutlich **Verladearm** (laut `CLAUDE.md` Abschnitt 11 "in
   Vorbereitung" als erster vollständiger Anlagentyp)? Muss mit Konstruktion abgestimmt werden.
2. Soll die Bestellung/Anfrage direkt einen Auftrag/eine Rechnung auslösen können, oder — wie
   vorgeschlagen — ausschließlich über den bestehenden Anfrage-/Angebotsprozess laufen?
3. Gibt es für 3D-Modelle (Phase 3) überhaupt einen validierten Kundenbedarf, oder reicht die
   2D-Lösung dauerhaft aus? Empfehlung: erst nach Phase 1–2 mit echtem Nutzerfeedback
   entscheiden.

## 9. Zuordnung zu bestehenden Agenten (laut `.claude/CLAUDE.md` Abschnitt 10)

- **Solution Architect**: Freigabe dieses Konzepts, Entscheidung Phase-1-Scope
- **Database/Prisma**: Migrationen für `PlantMaterialPosition`, Feldergänzungen `PlantDocument`
  (`width`/`height`) und `PlantMaterial` (`positionLabel`/`specification`/`orderable`),
  `PlantRequestPart`, Enum-Erweiterung `ERSATZTEIL`
- **Customer & Plant**: Zeichnungs-/Positionspflege-UI im internen Bereich
- **Security & Permission**: neue Ressource `parts-catalog`, Rollen-Defaults, Scope-Tests
- **UI/UX**: Portal-Katalogseite, Hotspot-Overlay, Warenkorb-artige Bestellauswahl,
  Dokumenten-Sammel-Download
- **Service Job**: Verknüpfung Bestellungen ↔ Folgeauftrag (falls Ersatzteil-Einbau zu Job wird)
- **QA Review**: Mandantentrennung der Katalogdaten, Scope-Tests für alle externen Rollen
