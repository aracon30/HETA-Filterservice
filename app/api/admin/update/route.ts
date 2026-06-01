import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'

const execAsync = promisify(exec)
const APP_DIR = path.resolve(process.cwd())

export async function POST() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
  }
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Nur Admins können Updates durchführen' }, { status: 403 })
  }

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

  // 1. Git pull
  const pulled = await run('Git Pull', 'git pull origin main')
  if (!pulled) return NextResponse.json({ success: false, steps }, { status: 500 })

  // 2. npm install (nur wenn package.json geändert)
  await run('npm install', 'npm install --prefer-offline')

  // 3. Prisma generate + db push
  await run('Prisma', 'npx prisma generate && npx prisma db push')

  // 4. Build (Cache löschen um veraltete Module-Referenzen zu vermeiden)
  await run('Cache leeren', 'rm -rf .next')
  const built = await run('Build', 'npm run build')
  if (!built) return NextResponse.json({ success: false, steps }, { status: 500 })

  // 5. Neustart — PM2 bevorzugt, sonst touch .next/server/app/page.js als Signal
  const restarted = await run('Neustart', 'pm2 restart heta-servicehub 2>/dev/null || true')

  return NextResponse.json({ success: true, steps })
}
