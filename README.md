# HETA ServiceHub

Interne Serviceplattform für einen Maschinenbau-Servicebetrieb (Filtrationssysteme), gebaut mit Next.js 14, TypeScript, PostgreSQL und Prisma ORM.

---

## Installation (Linux/Ubuntu)

Das Setup-Skript installiert alle benötigten Programme automatisch (Node.js, PostgreSQL, PM2) und startet die App direkt.

**Einzige Voraussetzung:** `sudo`-Rechte und Internetzugang.

```bash
git clone https://github.com/aracon30/HETA-Filterservice.git
cd HETA-Filterservice
chmod +x setup-linux.sh
./setup-linux.sh
```

Nach Abschluss öffnet sich der Browser automatisch auf [http://localhost:3000](http://localhost:3000).

Das Skript erledigt vollautomatisch:
1. Node.js 20 installieren (falls nicht vorhanden)
2. PostgreSQL installieren und starten
3. Datenbankbenutzer und Datenbank anlegen
4. `.env` Datei mit zufälligem Secret erstellen
5. npm-Abhängigkeiten installieren
6. Datenbankschema einrichten und Testdaten einspielen
7. Produktions-Build erstellen
8. App mit PM2 starten (läuft auch nach Systemneustart weiter)

---

## Neuinstallation / Alles zurücksetzen

Falls die Installation fehlgeschlagen ist oder ein sauberer Neustart gewünscht wird:

**1. App stoppen:**
```bash
pm2 stop heta-servicehub 2>/dev/null
pm2 delete heta-servicehub 2>/dev/null
fuser -k 3000/tcp 2>/dev/null
```

**2. Projektordner löschen:**
```bash
cd ~
rm -rf HETA-Filterservice
```

**3. Datenbank löschen:**
```bash
sudo -u postgres psql -c "DROP DATABASE IF EXISTS heta_servicehub;"
sudo -u postgres psql -c "DROP USER IF EXISTS heta_user;"
```

**4. Neu installieren:**
```bash
git clone https://github.com/aracon30/HETA-Filterservice.git
cd HETA-Filterservice
chmod +x setup-linux.sh
./setup-linux.sh
```

---

## App verwalten

```bash
pm2 status                         # Status anzeigen
pm2 logs                           # Logs anzeigen
pm2 restart heta-servicehub        # App neu starten
pm2 stop heta-servicehub           # App stoppen
```

---

## Server-Update (Admin)

Neue Updates können direkt über die Weboberfläche eingespielt werden — kein SSH nötig.

Als Admin unter `/admin/update` auf **„Update starten"** klicken. Das System führt automatisch aus:
- `git pull` — neuesten Code holen
- `npm install` — neue Pakete installieren
- `prisma db push` — Schemaänderungen übernehmen
- `npm run build` — App neu bauen
- `pm2 restart` — Server neu starten

---

## Demo-Zugangsdaten

> Nur für lokale Testumgebungen — nicht in Produktion verwenden.

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
| **Admin** | Vollzugriff, Benutzerverwaltung, Berechtigungen konfigurieren, Server-Updates |
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
| **Server-Update** | `/admin/update` | Updates von Git einspielen (Admin) |

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
| `POST` | `/api/admin/update` | Server-Update ausführen (Admin) |

---

## Datenbankschema

```
Customer ─── Plant ──── ServiceJob ─── ChecklistItem
    │
    └─── Opportunity

User (intern: ohne customerId)
User (extern: customerId → Customer)

RolePermission (pro Rolle × Ressource)
```

---

## Technologie-Stack

| Bereich | Technologie |
|---------|-------------|
| Framework | Next.js 14 (App Router) |
| Sprache | TypeScript |
| Styling | Tailwind CSS |
| Authentifizierung | NextAuth.js |
| Prozessmanager | PM2 |
| Datenbank | PostgreSQL |
| ORM | Prisma |
| Passwort-Hashing | bcryptjs |
