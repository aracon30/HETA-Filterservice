-- Optionales, idempotentes Daten-Migrationsskript (reines SQL).
--
-- Legt für jeden Kunden mit Anlagen oder Hotels OHNE Standort einen
-- "Hauptstandort" aus der Kundenadresse an und ordnet die noch nicht
-- zugeordneten Anlagen und Hotels diesem Standort zu.
--
-- Gefahrlos mehrfach ausführbar (NOT EXISTS-Guard + "siteId IS NULL"-Filter).
--
-- Ausführen (Prisma 7 liest die DB-URL aus prisma.config.ts):
--   npx prisma db execute --file prisma/scripts/assign-default-sites.sql

-- 1. Hauptstandort je Kunde anlegen, der einen braucht und noch keinen hat
INSERT INTO "Site" (id, "customerId", name, address, "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, c.id, 'Hauptstandort', c.address, now(), now()
FROM "Customer" c
WHERE (
  EXISTS (SELECT 1 FROM "Plant" p WHERE p."customerId" = c.id AND p."siteId" IS NULL)
  OR EXISTS (SELECT 1 FROM "Hotel" h WHERE h."customerId" = c.id AND h."siteId" IS NULL)
)
AND NOT EXISTS (
  SELECT 1 FROM "Site" s WHERE s."customerId" = c.id AND s.name = 'Hauptstandort'
);

-- 2. Anlagen ohne Standort dem Hauptstandort zuordnen
UPDATE "Plant" p
SET "siteId" = s.id
FROM "Site" s
WHERE s."customerId" = p."customerId"
  AND s.name = 'Hauptstandort'
  AND p."siteId" IS NULL;

-- 3. Hotels ohne Standort dem Hauptstandort zuordnen
UPDATE "Hotel" h
SET "siteId" = s.id
FROM "Site" s
WHERE s."customerId" = h."customerId"
  AND s.name = 'Hauptstandort'
  AND h."siteId" IS NULL;
