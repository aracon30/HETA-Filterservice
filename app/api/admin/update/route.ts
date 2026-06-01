import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'

const execAsync = promisify(exec)

// Projektverzeichnis zuverlässig ermitteln: von dieser Datei aus nach oben bis package.json
function findProjectRoot(dir: string): string {
  const fs = require('fs')
  if (fs.existsSync(path.join(dir, 'package.json'))) return dir
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

  // 1. Alle Dateien auf Remote-Stand zurücksetzen (stellt fehlende Dateien wieder her)
  await run('Git Fetch', 'git fetch origin main')
  const pulled = await run('Git Reset', 'git reset --hard origin/main')
  if (!pulled) return NextResponse.json({ success: false, steps }, { status: 500 })

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
