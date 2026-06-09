# HETA ServiceHub

Interne Serviceplattform für Filtrationssysteme — gebaut mit Next.js 14, TypeScript, PostgreSQL und Prisma.

---

## Installation (Linux/Ubuntu)

**Voraussetzungen:** `sudo`-Rechte und Internetzugang.

```bash
git clone https://github.com/aracon30/HETA-Filterservice.git
cd HETA-Filterservice
chmod +x setup-linux.sh
./setup-linux.sh
```

Das Skript installiert Node.js, PostgreSQL und PM2, richtet die Datenbank ein und startet die App automatisch. Nach Abschluss ist die App unter [http://localhost:3000](http://localhost:3000) erreichbar.

---

## App verwalten

```bash
pm2 status                       # Status anzeigen
pm2 logs                         # Logs anzeigen
pm2 restart heta-servicehub      # App neu starten
pm2 stop heta-servicehub         # App stoppen
```

---

## Server-Update (Admin)

Neue Updates über die Weboberfläche einspielen — kein SSH nötig.

Als Admin unter `/admin/update` auf **„Update starten"** klicken.

---

## Demo-Zugangsdaten

> Nur für lokale Testumgebungen.

| Email | Passwort | Rolle |
|-------|----------|-------|
| `admin@heta.de` | `Admin1234!` | Admin |
| `manager@heta.de` | `Manager1234!` | Service Manager |
| `techniker@heta.de` | `Tech1234!` | Service Techniker |
| `instandhaltung@chemiewerk.de` | `Kunde1234!` | Instandhaltungsleiter |
| `techniker@chemiewerk.de` | `Kunde1234!` | Instandhaltungstechniker |
| `einkauf@chemiewerk.de` | `Kunde1234!` | Einkäufer |

---

## Benutzerrollen

**Interne Rollen** (Zugriff auf alle Kunden):

| Rolle | Rechte |
|-------|--------|
| Admin | Vollzugriff, Benutzerverwaltung, Backup/Restore, Server-Updates |
| Service Manager | Vollzugriff operativ, Berechtigungen konfigurieren |
| Service Techniker | Eigene Einsätze, Checklisten, Materialien |
| Maintenance Manager | Anlagen und Einsätze der eigenen Firma verwalten |
| Maintenance Technician | Einsätze und Checklisten der eigenen Firma |

**Externe Rollen** (nur Zugriff auf eigene Firma/Anlage):

| Rolle | Rechte |
|-------|--------|
| Instandhaltungsleiter | Einsätze und Anlagen ansehen, Serviceanfragen stellen |
| Instandhaltungstechniker | Einsätze ansehen, Checklisten bearbeiten |
| Einkäufer | Einsätze und Vertriebschancen ansehen |

---

## Neuinstallation

```bash
# App stoppen
pm2 stop heta-servicehub 2>/dev/null
pm2 delete heta-servicehub 2>/dev/null

# Projektordner und Datenbank löschen
cd ~ && rm -rf HETA-Filterservice
sudo -u postgres psql -c "DROP DATABASE IF EXISTS heta_servicehub;"
sudo -u postgres psql -c "DROP USER IF EXISTS heta_user;"

# Neu installieren
git clone https://github.com/aracon30/HETA-Filterservice.git
cd HETA-Filterservice && chmod +x setup-linux.sh && ./setup-linux.sh
```
