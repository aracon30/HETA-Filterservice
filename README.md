# HETA ServiceHub

Interne Serviceplattform für einen Maschinenbau-Servicebetrieb (Filtrationssysteme), gebaut mit Next.js 14, TypeScript, PostgreSQL und Prisma ORM.

## Voraussetzungen

- **Node.js** 18 oder höher
- **PostgreSQL** 14 oder höher
- **npm** 9+
- **sudo**-Rechte (für PostgreSQL-Setup)

## Schnellinstallation (Linux/Ubuntu)

```bash
git clone https://github.com/aracon30/HETA-Filterservice.git
cd HETA-Filterservice
chmod +x setup-linux.sh
./setup-linux.sh
```

Das Skript erledigt automatisch:
1. PostgreSQL starten
2. Datenbankbenutzer und Datenbank anlegen
3. `.env` Datei erstellen
4. npm-Abhängigkeiten installieren
5. Datenbankschema einrichten
6. Testdaten einspielen
7. Produktions-Build erstellen

Danach die App starten:

```bash
npm run start
```

Die Anwendung ist unter [http://localhost:3000](http://localhost:3000) erreichbar.

---

## Manuelle Installation

### 1. Repository klonen & Abhängigkeiten installieren

```bash
git clone https://github.com/aracon30/HETA-Filterservice.git
cd HETA-Filterservice
npm install
```

### 2. Umgebungsvariablen konfigurieren

```bash
cp .env.example .env
```

`.env` anpassen:

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/heta_servicehub?schema=public"
NEXTAUTH_SECRET="<zufälliger-langer-string>"
NEXTAUTH_URL="http://localhost:3000"
```

> `NEXTAUTH_SECRET` kann mit `openssl rand -base64 32` generiert werden.

### 3. Datenbank einrichten

```bash
npx prisma db push
```

### 4. Testdaten laden

```bash
npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts
```

### 5. App starten

```bash
npm run build && npm run start   # Produktion
# oder
npm run dev                      # Entwicklung
```

---

## Demo-Zugangsdaten

> Diese Zugangsdaten sind nur für lokale Testumgebungen gedacht — nicht in Produktion verwenden.

| Email | Passwort | Rolle |
|-------|----------|-------|
| `admin@heta.de` | `Admin1234!` | Admin |
| `manager@heta.de` | `Manager1234!` | Service Manager |
| `techniker@heta.de` | `Tech1234!` | Service Techniker |
| `instandhaltung@chemiewerk.de` | `Kunde1234!` | Instandhaltungsleiter |
| `techniker@chemiewerk.de` | `Kunde1234!` | Instandhaltungstechniker |
| `einkauf@chemiewerk.de` | `Kunde1234!` | Einkäufer |

---

## Benutzerrollen & Berechtigungen

### Interne Rollen (Zugriff auf alle Kunden und Projekte)

| Rolle | Rechte |
|-------|--------|
| **Admin** | Vollzugriff, Benutzerverwaltung, Berechtigungen konfigurieren |
| **Service Manager** | Vollzugriff operativ, Berechtigungen anderer Rollen anpassen |
| **Service Techniker** | Einsätze ansehen/erstellen/bearbeiten, Checklisten pflegen |

### Externe Rollen (nur Zugriff auf die eigene Firma/Anlage)

| Rolle | Rechte |
|-------|--------|
| **Instandhaltungsleiter** | Einsätze und Anlagen der eigenen Firma ansehen, Serviceanfragen stellen |
| **Instandhaltungstechniker** | Einsätze der eigenen Anlage ansehen, Checklisten bearbeiten |
| **Einkäufer** | Einsätze und Vertriebschancen der eigenen Firma ansehen |

Berechtigungen sind dynamisch und können im Admin-Bereich unter `/admin/permissions` angepasst werden.

---

## Seiten & Funktionen

| Seite | URL | Beschreibung |
|-------|-----|--------------|
| **Login** | `/login` | Anmeldung mit Email und Passwort |
| **Dashboard** | `/` | KPI-Kacheln, nächste 5 Einsätze |
| **Einsatzliste** | `/jobs` | Alle Serviceeinsätze, filterbar nach Status |
| **Neuer Einsatz** | `/jobs/new` | Einsatz mit Kunde, Anlage, Datum, Techniker anlegen |
| **Einsatzdetail** | `/jobs/[id]` | Befunde, Empfehlungen, 10-Punkte-Checkliste |
| **Kunden** | `/customers` | Kundenliste, Neukunde anlegen |
| **Vertrieb** | `/opportunities` | Kanban-Board + Tabellenansicht |
| **Benutzerverwaltung** | `/admin/users` | Benutzer anlegen/bearbeiten (Admin) |
| **Berechtigungen** | `/admin/permissions` | Berechtigungsmatrix konfigurieren (Admin/Manager) |

---

## API-Routen

Alle Endpunkte erfordern eine aktive Session. Berechtigungen werden serverseitig geprüft.

| Methode | Endpunkt | Beschreibung |
|---------|----------|--------------|
| `GET` | `/api/jobs` | Einsätze (gefiltert nach Rolle/Scope) |
| `POST` | `/api/jobs` | Neuen Einsatz erstellen |
| `GET` | `/api/jobs/[id]` | Einsatz mit Checkliste |
| `PUT` | `/api/jobs/[id]` | Einsatz aktualisieren |
| `GET` | `/api/customers` | Kunden (gefiltert nach Rolle/Scope) |
| `POST` | `/api/customers` | Neuen Kunden anlegen |
| `GET` | `/api/plants` | Anlagen (Filter: `customerId`) |
| `GET` | `/api/opportunities` | Vertriebschancen (gefiltert nach Rolle/Scope) |
| `POST` | `/api/opportunities` | Neue Vertriebschance anlegen |
| `GET/POST` | `/api/users` | Benutzerliste / Benutzer anlegen |
| `PUT/DELETE` | `/api/users/[id]` | Benutzer bearbeiten / löschen |
| `GET/PUT` | `/api/permissions` | Berechtigungen lesen / aktualisieren |

---

## Datenbankschema

```
Customer ─── Plant ──── ServiceJob ─── ChecklistItem
    │                       │
    └─── Opportunity    User (intern: kein customerId)
                            │
                        User (extern: customerId → Customer)

RolePermission (pro Rolle × Ressource)
```

---

## Hilfreiche Befehle

```bash
# Entwicklungsserver
npm run dev

# Prisma Studio (Datenbankansicht im Browser)
npm run db:studio

# Schema-Änderungen übernehmen
npx prisma db push

# Prisma Client neu generieren
npx prisma generate

# Datenbank zurücksetzen und neu seeden
npx prisma db push --force-reset
npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts
```

---

## Technologie-Stack

| Bereich | Technologie |
|---------|-------------|
| Framework | Next.js 14 (App Router) |
| Sprache | TypeScript |
| Styling | Tailwind CSS |
| Authentifizierung | NextAuth.js |
| Datenbank | PostgreSQL |
| ORM | Prisma |
| Passwort-Hashing | bcryptjs |
