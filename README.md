# HETA ServiceHub

Interne Serviceplattform für einen Maschinenbau-Servicebetrieb (Filtrationssysteme), gebaut mit Next.js 14, TypeScript, PostgreSQL und Prisma ORM.

## Voraussetzungen

- **Node.js** 18 oder höher
- **PostgreSQL** 14 oder höher (lokal oder remote)
- npm 9+

## Setup

### 1. Repository klonen & Abhängigkeiten installieren

```bash
git clone <repo-url>
cd HETA-Filterservice
npm install
```

### 2. Umgebungsvariablen konfigurieren

```bash
cp .env.example .env
```

Passe die `DATABASE_URL` in `.env` an deine PostgreSQL-Instanz an:

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/heta_servicehub?schema=public"
```

### 3. Datenbank migrieren

```bash
npx prisma migrate dev --name init
```

### 4. Seed-Daten laden

```bash
npm run db:seed
```

Dies erstellt:
- 3 Beispielkunden mit je 2 Anlagen
- 8 Serviceeinsätze in verschiedenen Status (geplant, in Bearbeitung, abgeschlossen)
- 3 Vertriebschancen

### 5. Entwicklungsserver starten

```bash
npm run dev
```

Die Anwendung ist unter [http://localhost:3000](http://localhost:3000) erreichbar.

## Seiten & Funktionen

| Seite | URL | Beschreibung |
|-------|-----|--------------|
| **Dashboard** | `/` | KPI-Kacheln (offene Einsätze, Einsätze heute, Vertriebspotenzial), nächste 5 Einsätze |
| **Einsatzliste** | `/jobs` | Alle Serviceeinsätze, filterbar nach Status, suchbar nach Kunde/Jobnummer |
| **Neuer Einsatz** | `/jobs/new` | Einsatz erstellen mit Kundenwahl, Anlagenwahl (gefiltert), Datum, Techniker |
| **Einsatzdetail** | `/jobs/[id]` | Befunde & Empfehlungen, 10-Punkte-Checkliste, Statusänderung |
| **Kunden** | `/customers` | Kundenliste mit Anlagenanzahl & offenen Einsätzen, Neukunde anlegen |
| **Vertrieb** | `/opportunities` | Kanban-Board + Tabellenansicht, Vertriebschancen anlegen |

## API-Routen

| Methode | Endpunkt | Beschreibung |
|---------|----------|--------------|
| `GET` | `/api/jobs` | Alle Einsätze (Filter: `status`, `search`) |
| `POST` | `/api/jobs` | Neuen Einsatz erstellen (mit Standard-Checkliste) |
| `GET` | `/api/jobs/[id]` | Einsatz mit Checkliste laden |
| `PUT` | `/api/jobs/[id]` | Status, Befunde, Empfehlungen, Checkliste speichern |
| `GET` | `/api/customers` | Alle Kunden |
| `POST` | `/api/customers` | Neuen Kunden anlegen |
| `GET` | `/api/plants` | Anlagen (Filter: `customerId`) |
| `GET` | `/api/opportunities` | Alle Vertriebschancen |
| `POST` | `/api/opportunities` | Neue Vertriebschance anlegen |

## Standard-Checkliste

Jeder neue Einsatz erhält automatisch diese 10 Prüfpunkte:

1. Sichtprüfung Gehäuse und Dichtungen
2. Differenzdruckmessung durchgeführt
3. Filterelemente auf Zustand geprüft
4. Reinigung Filtergehäuse
5. Dichtheit nach Zusammenbau geprüft
6. Betriebsparameter dokumentiert (Druck, Durchfluss, Temperatur)
7. Ventile und Armaturen geprüft
8. Elektrische Anschlüsse geprüft (falls vorhanden)
9. Kundenpersonal eingewiesen
10. Servicebericht unterzeichnet

## Datenbankschema

```
Customer ─── Plant ──┐
    │                └── ServiceJob ─── ChecklistItem
    └────────────────────────┘
    └─── Opportunity
```

## Hilfreiche Befehle

```bash
# Prisma Studio (Datenbankansicht im Browser)
npm run db:studio

# Neue Migration erstellen
npx prisma migrate dev --name <beschreibung>

# Prisma Client neu generieren
npx prisma generate

# Datenbank zurücksetzen und neu seeden
npx prisma migrate reset
```

## Technologie-Stack

- **Framework**: Next.js 14 (App Router)
- **Sprache**: TypeScript
- **Styling**: Tailwind CSS
- **Datenbank**: PostgreSQL
- **ORM**: Prisma
- **Rendering**: Server Components (Dashboard) + Client Components (interaktive Seiten)
