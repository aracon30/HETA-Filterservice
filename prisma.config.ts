import path from 'node:path'
import { defineConfig } from 'prisma/config'

// Prisma 7: connection URL for the CLI/Migrate lives here (no longer in schema.prisma).
// The runtime PrismaClient connects via the pg driver adapter in lib/prisma.ts.
// Read straight from process.env so offline `prisma generate` (e.g. postinstall
// without a DB) does not fail; migrate/seed pick up DATABASE_URL from the env.
export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    seed: 'ts-node --compiler-options {"module":"CommonJS"} prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
})
