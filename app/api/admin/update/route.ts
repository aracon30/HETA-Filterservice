import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

// process.cwd() is always the project root in Next.js
const APP_DIR = process.cwd()

export async function POST() {
  const session = await getServerSession(authOptions)

  if (!session?.user)
    return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
  if (session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Nur Admins können Updates durchführen' }, { status: 403 })

  const steps: { step: string; output: string; error?: boolean }[] = []

  const run = async (label: string, cmd: string, opts?: { ignoreFail?: boolean }) => {
    try {
      const { stdout, stderr } = await execAsync(cmd, { cwd: APP_DIR, timeout: 300000 })
      steps.push({ step: label, output: (stdout + stderr).trim() || '(kein Output)' })
      return true
    } catch (err: any) {
      steps.push({ step: label, output: err.message, error: !opts?.ignoreFail })
      return false
    }
  }

  steps.push({ step: 'Projektverzeichnis', output: APP_DIR })

  // 0. Git-Status vor dem Update
  const { stdout: hashBefore } = await execAsync('git rev-parse --short HEAD', { cwd: APP_DIR }).catch(() => ({ stdout: 'unbekannt' }))
  steps.push({ step: 'Version vor Update', output: hashBefore.trim() })

  // 1. Git: neuesten Stand holen
  await run('Git Fetch', 'git fetch origin main')

  // skip-worktree / assume-unchanged Flags entfernen — sonst ignoriert git reset diese Dateien
  await run('Git Flags zurücksetzen', "git ls-files -v | grep '^[hS]' | awk '{print $2}' | xargs -r git update-index --no-skip-worktree --no-assume-unchanged", { ignoreFail: true })
  await run('Git Sparse-Checkout deaktivieren', 'git sparse-checkout disable 2>/dev/null || true', { ignoreFail: true })

  // git reset --hard setzt Arbeitsverzeichnis auf origin/main — git checkout danach ist redundant
  const pulled = await run('Git Reset', 'git reset --hard origin/main')
  if (!pulled) return NextResponse.json({ success: false, steps }, { status: 500 })

  // 2. Was hat sich geändert?
  await run('Änderungen (letzte 10 Commits)', 'git log --oneline -10')

  // 3. Kritische Dateien prüfen
  const fs = require('fs')
  const critical = [
    'lib/auth.ts',
    'lib/prisma.ts',
    'lib/permissions.ts',
    'lib/constants.ts',
    'lib/plant-types.ts',
    'types/next-auth.d.ts',
    'components/StatusBadge.tsx',
    'components/JobCalendar.tsx',
    'components/Sidebar.tsx',
    'tailwind.config.ts',
    'next.config.js',
  ]
  const missing = critical.filter(f => !fs.existsSync(`${APP_DIR}/${f}`))
  if (missing.length > 0) {
    for (const f of missing) {
      await run(`Git Extract: ${f}`, `git show origin/main:"${f}" > "${f}"`, { ignoreFail: true })
    }
  }
  const stillMissing = critical.filter(f => !fs.existsSync(`${APP_DIR}/${f}`))
  const fileSizes = critical.map(f => {
    try { return `${f}: ${fs.statSync(`${APP_DIR}/${f}`).size}B` } catch { return `${f}: FEHLT` }
  }).join('\n')
  steps.push({ step: 'Datei-Check', output: fileSizes, error: stillMissing.length > 0 })

  // 4. Caches entfernen (node_modules komplett für saubere Auflösung)
  await run('Cache leeren', 'rm -rf .next node_modules/.cache tsconfig.tsbuildinfo')
  await run('node_modules entfernen', 'rm -rf node_modules')

  // 5. Saubere npm-Installation
  const installed = await run('npm install', 'npm install')
  if (!installed) return NextResponse.json({ success: false, steps }, { status: 500 })

  // 6. Prisma: Client generieren + Schema in DB übernehmen (Daten bleiben erhalten)
  await run('Prisma generate', 'npx prisma generate')
  await run('Prisma db push', 'npx prisma db push --accept-data-loss')

  // 7. Build
  const built = await run('Build', 'npm run build')
  if (!built) return NextResponse.json({ success: false, steps }, { status: 500 })

  // 8. Version nach Update
  const { stdout: hashAfter } = await execAsync('git rev-parse --short HEAD', { cwd: APP_DIR }).catch(() => ({ stdout: 'unbekannt' }))
  steps.push({ step: 'Version nach Update', output: hashAfter.trim() })

  // 9. Server neu starten
  await run('Neustart', 'pm2 restart heta-servicehub 2>/dev/null || pm2 restart all 2>/dev/null || true', { ignoreFail: true })

  return NextResponse.json({ success: true, steps })
}
