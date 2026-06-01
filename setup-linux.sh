#!/bin/bash
# Setup script for HETA-Filterservice on Linux (Ubuntu/Debian/Raspbian)
set -e

echo "========================================"
echo "  HETA ServiceHub - Linux Setup"
echo "========================================"

# Prüfe ob sudo verfügbar ist
if ! command -v sudo &>/dev/null; then
  echo "FEHLER: 'sudo' wird benötigt. Bitte als root ausführen oder sudo installieren."
  exit 1
fi

# Config — kann per Umgebungsvariable überschrieben werden
DB_USER="${DB_USER:-heta_user}"
DB_PASS="${DB_PASS:-$(openssl rand -base64 16)}"
DB_NAME="${DB_NAME:-heta_servicehub}"
NODE_VERSION="20"

# -----------------------------------------------
# SCHRITT 1: Systempakete & Node.js installieren
# -----------------------------------------------
echo ""
echo "[1/6] Installiere Systempakete..."

sudo apt-get update -qq

# Basis-Tools
sudo apt-get install -y -qq curl gnupg ca-certificates lsb-release openssl

# Node.js installieren (falls nicht vorhanden oder zu alt)
NODE_OK=0
if command -v node &>/dev/null; then
  CURRENT_NODE=$(node -e "process.exit(parseInt(process.versions.node))" 2>/dev/null; echo $?)
  MAJOR=$(node --version | sed 's/v//' | cut -d. -f1)
  if [ "$MAJOR" -ge 18 ]; then
    NODE_OK=1
    echo "    Node.js $(node --version) bereits installiert."
  fi
fi

if [ "$NODE_OK" -eq 0 ]; then
  echo "    Installiere Node.js ${NODE_VERSION}..."
  curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash -
  sudo apt-get install -y -qq nodejs
  echo "    Node.js $(node --version) installiert."
fi

# PostgreSQL installieren (falls nicht vorhanden)
if ! command -v psql &>/dev/null; then
  echo "    Installiere PostgreSQL..."
  sudo apt-get install -y -qq postgresql postgresql-contrib
  echo "    PostgreSQL installiert."
else
  echo "    PostgreSQL bereits installiert."
fi

# -----------------------------------------------
# SCHRITT 2: PostgreSQL starten
# -----------------------------------------------
echo ""
echo "[2/6] Starte PostgreSQL..."

pg_running() {
  if command -v pg_isready &>/dev/null && pg_isready -q 2>/dev/null; then return 0; fi
  if sudo -u postgres psql -c "SELECT 1" &>/dev/null 2>&1; then return 0; fi
  return 1
}

if ! pg_running; then
  sudo service postgresql start 2>/dev/null || \
  sudo systemctl start postgresql 2>/dev/null || true
  sleep 3
fi

if ! pg_running; then
  echo "FEHLER: PostgreSQL konnte nicht gestartet werden."
  echo "Bitte prüfe die PostgreSQL-Logs: sudo journalctl -u postgresql"
  exit 1
fi
echo "    PostgreSQL läuft."

# -----------------------------------------------
# SCHRITT 3: Datenbank & Benutzer anlegen
# -----------------------------------------------
echo ""
echo "[3/6] Richte Datenbank ein..."

sudo -u postgres psql -tc "SELECT 1 FROM pg_user WHERE usename='${DB_USER}'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}' CREATEDB;"

sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"

sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};" -q

echo "    Datenbank '${DB_NAME}' bereit."

# -----------------------------------------------
# SCHRITT 4: .env Datei erstellen
# -----------------------------------------------
echo ""
echo "[4/6] Erstelle Konfigurationsdatei..."

DB_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}?schema=public"
NEXTAUTH_SECRET=$(openssl rand -base64 32)

cat > .env <<EOF
DATABASE_URL="${DB_URL}"
NEXTAUTH_SECRET="${NEXTAUTH_SECRET}"
NEXTAUTH_URL="http://localhost:3000"
EOF

echo "    .env erstellt."

# -----------------------------------------------
# SCHRITT 5: npm-Abhängigkeiten, Schema & Seed
# -----------------------------------------------
echo ""
echo "[5/6] Installiere App-Abhängigkeiten und richte Schema ein..."

npm install --silent
npx prisma db push --skip-generate 2>&1 | grep -E "Your database|Error" || true
npx prisma generate -q
npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts

echo "    Abhängigkeiten und Datenbank eingerichtet."

# -----------------------------------------------
# SCHRITT 6: Produktions-Build
# -----------------------------------------------
echo ""
echo "[6/6] Erstelle Produktions-Build..."

npm run build

# -----------------------------------------------
# Zusammenfassung
# -----------------------------------------------
echo ""
echo "========================================"
echo "  Setup abgeschlossen!"
echo "========================================"
echo ""
echo "  App starten:     npm run start"
echo "  Browser öffnen:  http://localhost:3000"
echo ""
echo "  Demo-Zugangsdaten:"
echo "    admin@heta.de        / Admin1234!"
echo "    manager@heta.de      / Manager1234!"
echo "    techniker@heta.de    / Tech1234!"
echo "    instandhaltung@chemiewerk.de / Kunde1234!"
echo ""
echo "  Datenbank: ${DB_NAME}"
echo "  DB-User:   ${DB_USER}"
echo "========================================"
