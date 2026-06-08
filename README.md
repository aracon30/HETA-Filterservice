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
| **Admin** | Vollzugriff, Benutzerverwaltung, Berechtigungen konfigurieren, Server-Updates, Backup/Restore |
| **Service Manager** | Vollzugriff operativ, Berechtigungen anderer Rollen anpassen |
| **Service Techniker** | Einsätze ansehen/erstellen/bearbeiten, Checklisten pflegen, Materialien erfassen |
| **Maintenance Manager** | Anlagen und Einsätze der eigenen Firma vollständig verwalten |
| **Maintenance Technician** | Einsätze und Checklisten der eigenen Firma bearbeiten |

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
| **Dashboard** | `/` | KPI-Kacheln, nächste Einsätze |
| **Kalender** | `/calendar` | Kalenderansicht aller geplanten Einsätze |
| **Einsatzliste** | `/jobs` | Alle Serviceeinsätze, filterbar nach Status |
| **Neuer Einsatz** | `/jobs/new` | Einsatz mit Kunde, Anlage(n), Datum, Techniker anlegen |
| **Einsatzdetail** | `/jobs/[id]` | Befunde, Empfehlungen, Checkliste, Materialien, Signaturen, PDF-Bericht |
| **Kunden** | `/customers` | Kundenliste, Neukunde anlegen |
| **Kundendetail** | `/customers/[id]` | Anlagen, Einsätze, Dokumente, Opportunities pro Kunde |
| **Vertrieb** | `/opportunities` | Kanban-Board + Tabellenansicht |
| **Materialien** | `/materialien` | Übersicht aller offenen Materialbestellungen |
| **Anlagentypen** | `/admin/plant-types` | Anlagentypen und Checklisten-Vorlagen verwalten (Admin) |
| **Benutzerverwaltung** | `/admin/users` | Benutzer anlegen/bearbeiten (Admin) |
| **Berechtigungen** | `/admin/permissions` | Berechtigungsmatrix konfigurieren (Admin/Manager) |
| **Backup** | `/admin/backup` | Datenbank sichern und wiederherstellen (Admin) |
| **Server-Update** | `/admin/update` | Updates von Git einspielen (Admin) |
| **Kundenportal** | `/portal` | Eingeschränkte Ansicht für externe Kunden |
| **Anlage (Portal)** | `/portal/plants/[id]` | Anlagendetails im Kundenportal |

---

## API-Routen

Alle Endpunkte erfordern eine aktive Session. Berechtigungen werden serverseitig geprüft.

| Methode | Endpunkt | Beschreibung |
|---------|----------|--------------|
| `GET/POST` | `/api/jobs` | Einsätze (gefiltert nach Rolle/Scope) / Neuen Einsatz erstellen |
| `GET/PUT/DELETE` | `/api/jobs/[id]` | Einsatz lesen, aktualisieren, löschen |
| `GET` | `/api/jobs/[id]/report` | PDF-Servicebericht generieren |
| `GET/POST` | `/api/jobs/[id]/materials` | Materialien eines Einsatzes |
| `POST` | `/api/jobs/[id]/reload-checklist` | Checkliste neu laden |
| `GET/POST` | `/api/customers` | Kunden / Neukunde anlegen |
| `GET/PUT/DELETE` | `/api/customers/[id]` | Kunde lesen, aktualisieren, löschen |
| `GET/POST` | `/api/plants` | Anlagen (Filter: `customerId`) / Neue Anlage |
| `GET/PUT/DELETE` | `/api/plants/[id]` | Anlage lesen, aktualisieren, löschen |
| `GET/PUT` | `/api/plants/[id]/checklist` | Anlagen-Checklisten-Overrides |
| `GET/POST` | `/api/plants/[id]/materials` | Materialien einer Anlage |
| `GET/POST` | `/api/plants/[id]/documents` | Dokumente einer Anlage |
| `DELETE` | `/api/plants/[id]/documents/[docId]` | Dokument löschen |
| `GET/POST` | `/api/plant-types` | Anlagentypen / Neuen Typ anlegen |
| `GET/PUT/DELETE` | `/api/plant-types/[id]` | Anlagentyp verwalten |
| `GET/PUT` | `/api/plant-types/[id]/checklist` | Checklisten-Vorlage eines Typs |
| `GET/PUT` | `/api/plant-types/[id]/parts` | Ersatzteil-Vorlagen eines Typs |
| `GET/POST` | `/api/opportunities` | Vertriebschancen / Neue Chance anlegen |
| `GET/PUT/DELETE` | `/api/opportunities/[id]` | Chance lesen, aktualisieren, löschen |
| `GET` | `/api/opportunities/suggestions` | Automatische Opportunity-Vorschläge |
| `GET/POST` | `/api/invoices` | Rechnungen / Neue Rechnung hochladen |
| `GET/DELETE` | `/api/invoices/[id]` | Rechnung lesen, löschen |
| `GET/POST` | `/api/users` | Benutzerliste / Benutzer anlegen |
| `PUT/DELETE` | `/api/users/[id]` | Benutzer bearbeiten / löschen |
| `GET/PUT` | `/api/users/[id]/permissions` | Benutzer-Berechtigungen |
| `GET/PUT` | `/api/permissions` | Rollen-Berechtigungen lesen / aktualisieren |
| `GET` | `/api/technicians` | Techniker-Liste |
| `GET` | `/api/calendar` | Kalender-Ereignisse |
| `GET` | `/api/availability` | Techniker-Verfügbarkeit |
| `POST` | `/api/upload` | Datei-Upload |
| `POST` | `/api/admin/backup` | Datenbank-Backup erstellen |
| `GET` | `/api/admin/backup/download` | Backup herunterladen |
| `POST` | `/api/admin/restore` | Datenbank wiederherstellen |
| `POST` | `/api/admin/update` | Server-Update ausführen (Admin) |

---

## Datenbankschema

```
Customer ─── Plant ──────── ServiceJob ─── ChecklistItem
    │           │                │
    │           ├── PlantMaterial│── JobMaterial
    │           ├── PlantDocument│── Invoice
    │           └── PlantChecklist│─ PlantDocument
    │                 Override
    ├── Opportunity ◄─── ServiceJob (sourceJob)
    ├── Invoice
    └── User[]

PlantType ─── PlantTypeChecklistItem
          └── PartTypeItem

ServiceJob ─── ServiceJobTechnician (User)
           └── ServiceJobPlant (Plant)

User (intern: ohne customerId)
User (extern: customerId → Customer)

RolePermission (pro Rolle × Ressource)
UserPermission (pro User × Ressource, überschreibt Rolle)
```

---

## Technologie-Stack

| Bereich | Technologie | Version |
|---------|-------------|---------|
| Framework | Next.js (App Router) | 14.1.0 |
| Sprache | TypeScript | ^5 |
| Styling | Tailwind CSS | ^3.3.0 |
| Icons | lucide-react | ^1.17.0 |
| Authentifizierung | NextAuth.js (JWT) | ^4.24.14 |
| Datenbank | PostgreSQL | — |
| ORM | Prisma | ^5.9.1 |
| Passwort-Hashing | bcryptjs | ^3.0.3 |
| Datumsverarbeitung | date-fns (DE-Locale) | ^4.4.0 |
| Kalender | react-big-calendar | ^1.20.0 |
| PDF-Generierung | @react-pdf/renderer | ^4.5.1 |
| Prozessmanager | PM2 | Produktion |
