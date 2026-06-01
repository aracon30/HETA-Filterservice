import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'

const execAsync = promisify(exec)

// Projektverzeichnis ermitteln: sucht nach package.json mit einem "scripts"-Feld
// (überspringt die package.json die Next.js in .next ablegt)
function findProjectRoot(dir: string): string {
  const fs = require('fs')
  const pkgPath = path.join(dir, 'package.json')
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
      if (pkg.scripts) return dir
    } catch {}
  }
  const parent = path.dirname(dir)
  if (parent === dir) return process.cwd()
  return findProjectRoot(parent)
}

const APP_DIR = findProjectRoot(__dirname)

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

  steps.push({ step: 'Verzeichnis', output: APP_DIR })

  // 1. Git: neuesten Stand holen
  await run('Git Fetch', 'git fetch origin main')
  await run('Git Sparse-Checkout', 'git sparse-checkout disable 2>/dev/null || true', { ignoreFail: true })
  // skip-worktree / assume-unchanged Flags entfernen — sonst ignoriert git reset diese Dateien!
  await run('Git Flags reset', "git ls-files -v | grep '^[hS]' | awk '{print $2}' | xargs -r git update-index --no-skip-worktree --no-assume-unchanged", { ignoreFail: true })
  const pulled = await run('Git Reset', 'git reset --hard origin/main')
  if (!pulled) return NextResponse.json({ success: false, steps }, { status: 500 })
  await run('Git Checkout', 'git checkout origin/main -- .')
  // Prüfen ob kritische Dateien vorhanden sind
  const fs = require('fs')
  const critical = ['components/StatusBadge.tsx', 'lib/constants.ts', 'components/JobCalendar.tsx', 'lib/plant-types.ts']
  const missing = critical.filter(f => !fs.existsSync(`${APP_DIR}/${f}`))
  if (missing.length > 0) {
    // Letzter Versuch: Dateien direkt aus git-Objekten extrahieren
    for (const f of missing) {
      await run(`Git Extract ${f}`, `git show origin/main:${f} > ${f}`, { ignoreFail: true })
    }
  }
  const stillMissing = critical.filter(f => !fs.existsSync(`${APP_DIR}/${f}`))
  steps.push({ step: 'Datei-Check', output: stillMissing.length === 0 ? 'Alle Dateien vorhanden' : `Fehlend: ${stillMissing.join(', ')}`, error: stillMissing.length > 0 })

  // 2. Alle Build-Caches und node_modules entfernen für saubere Installation
  // node_modules wird komplett gelöscht um veraltete Modul-Auflösungen zu vermeiden
  await run('Cache leeren', 'rm -rf .next node_modules/.cache tsconfig.tsbuildinfo')
  await run('node_modules entfernen', 'rm -rf node_modules')

  // 3. Saubere npm-Installation
  await run('npm install', 'npm install')

  // 4. Prisma: Client generieren + Schema in DB übernehmen (Daten bleiben erhalten)
  await run('Prisma', 'npx prisma generate && npx prisma db push --accept-data-loss')

  // 5. Build
  const built = await run('Build', 'npm run build')
  if (!built) return NextResponse.json({ success: false, steps }, { status: 500 })

  // 6. Server neu starten
  await run('Neustart', 'pm2 restart heta-servicehub 2>/dev/null || true', { ignoreFail: true })

  return NextResponse.json({ success: true, steps })
}
