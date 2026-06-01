#!/bin/bash
# Setup script for HETA-Filterservice on Linux (Ubuntu/Debian)
set -e

echo "=== HETA ServiceHub - Linux Setup ==="

# Config — passe diese Werte an deine Umgebung an
DB_USER="${DB_USER:-heta_user}"
DB_PASS="${DB_PASS:-$(openssl rand -base64 16)}"
DB_NAME="${DB_NAME:-heta_servicehub}"
DB_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}?schema=public"

# 1. Start PostgreSQL if not running
echo "[1/5] Starte PostgreSQL..."
pg_running() {
  # Prüfe ob PostgreSQL erreichbar ist (mehrere Methoden)
  if command -v pg_isready &>/dev/null && pg_isready -q 2>/dev/null; then return 0; fi
  if sudo -u postgres psql -c "SELECT 1" &>/dev/null 2>&1; then return 0; fi
  return 1
}

if ! pg_running; then
  echo "    PostgreSQL nicht aktiv, starte..."
  # service-Befehl (funktioniert auf den meisten Linux-Systemen)
  if command -v service &>/dev/null; then
    sudo service postgresql start 2>/dev/null || true
  fi
  # systemctl als Fallback
  if command -v systemctl &>/dev/null && systemctl is-system-running &>/dev/null 2>&1; then
    for SVC in postgresql postgresql-16 postgresql-15 postgresql-14; do
      sudo systemctl start "$SVC" 2>/dev/null && break || true
    done
  fi
  sleep 2
  if ! pg_running; then
    echo "FEHLER: PostgreSQL läuft nicht und konnte nicht automatisch gestartet werden."
    echo "Bitte starte PostgreSQL manuell (z.B.: sudo service postgresql start)"
    exit 1
  fi
fi
echo "    PostgreSQL läuft."

# 2. Create DB user and database
echo "[2/5] Erstelle Datenbankbenutzer und Datenbank..."
sudo -u postgres psql -tc "SELECT 1 FROM pg_user WHERE usename='${DB_USER}'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}' CREATEDB;"

sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"

sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"

# 3. Create .env file
echo "[3/5] Erstelle .env Datei..."
echo "DATABASE_URL=\"${DB_URL}\"" > .env

# 4. Install dependencies and setup DB
echo "[4/5] Installiere Abhängigkeiten und richte Datenbank ein..."
npm install
npx prisma db push
npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts

# 5. Build the app
echo "[5/5] Baue die Anwendung..."
npm run build

echo ""
echo "=== Setup abgeschlossen! ==="
echo "Starte die App mit: npm run start"
echo "Öffne im Browser: http://localhost:3000"
