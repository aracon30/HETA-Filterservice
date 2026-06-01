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

  const run = async (label: string, cmd: string) => {
    try {
      const { stdout, stderr } = await execAsync(cmd, { cwd: APP_DIR, timeout: 300000 })
      steps.push({ step: label, output: (stdout + stderr).trim() })
      return true
    } catch (err: any) {
      steps.push({ step: label, output: err.message, error: true })
      return false
    }
  }

  // Debug: Projektverzeichnis im ersten Schritt anzeigen
  steps.push({ step: 'Verzeichnis', output: APP_DIR })

  // 1. Alle Dateien auf Remote-Stand zurücksetzen
  await run('Git Fetch', 'git fetch origin main')
  // Sparse-Checkout deaktivieren falls aktiv, dann hart zurücksetzen
  await run('Git Sparse-Checkout', 'git sparse-checkout disable 2>/dev/null || true')
  const pulled = await run('Git Reset', 'git reset --hard origin/main')
  if (!pulled) return NextResponse.json({ success: false, steps }, { status: 500 })
  // Sicherheitshalber alle Dateien explizit auschecken
  await run('Git Checkout', 'git checkout origin/main -- .')
  // Dateien nach Reset prüfen
  const { execSync } = require('child_process')
  const missing: string[] = []
  for (const f of ['components/StatusBadge.tsx', 'lib/constants.ts', 'components/JobCalendar.tsx']) {
    try { execSync(`test -f ${f}`, { cwd: APP_DIR }) } catch { missing.push(f) }
  }
  steps.push({ step: 'Datei-Check', output: missing.length === 0 ? 'Alle Dateien vorhanden' : `Fehlend: ${missing.join(', ')}`, error: missing.length > 0 })

  // 2. npm install
  await run('npm install', 'npm install')

  // 3. Prisma generate + db push
  await run('Prisma', 'npx prisma generate && npx prisma db push')

  // 4. Build — Cache leeren
  await run('Cache leeren', 'rm -rf .next node_modules/.cache')
  const built = await run('Build', 'npm run build')
  if (!built) return NextResponse.json({ success: false, steps }, { status: 500 })

  // 5. Neustart
  await run('Neustart', 'pm2 restart heta-servicehub 2>/dev/null || true')

  return NextResponse.json({ success: true, steps })
}
