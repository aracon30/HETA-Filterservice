import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { execFile } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs'

const execFileAsync = promisify(execFile)
const APP_DIR = path.resolve(process.cwd())
const BACKUP_DIR = path.join(APP_DIR, 'backups')

// Parse DATABASE_URL → pg connection params
function parseDbUrl(url: string) {
  const match = url.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/)
  if (!match) throw new Error('Ungültige DATABASE_URL')
  return { user: match[1], password: match[2], host: match[3], port: match[4], db: match[5] }
}

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true })
}

// GET — Backup-Liste
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  ensureBackupDir()
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.endsWith('.sql'))
    .map(f => {
      const stat = fs.statSync(path.join(BACKUP_DIR, f))
      return { name: f, size: stat.size, createdAt: stat.birthtime.toISOString() }
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  return NextResponse.json({ backups: files })
}

// POST — Backup erstellen
export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  ensureBackupDir()

  const dbUrl = process.env.DATABASE_URL!
  const { user, password, host, port, db } = parseDbUrl(dbUrl)

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const filename = `backup-${timestamp}.sql`
  const filepath = path.join(BACKUP_DIR, filename)

  try {
    await execFileAsync(
      'pg_dump',
      ['-h', host, '-p', port, '-U', user, '-d', db, '-F', 'p', '-f', filepath],
      { env: { ...process.env, PGPASSWORD: password }, timeout: 60000 }
    )
    const stat = fs.statSync(filepath)
    return NextResponse.json({ success: true, name: filename, size: stat.size })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE — Backup löschen
export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { name } = await req.json()
  if (!name || !name.endsWith('.sql') || name.includes('/') || name.includes('..'))
    return NextResponse.json({ error: 'Ungültiger Dateiname' }, { status: 400 })

  const filepath = path.join(BACKUP_DIR, name)
  if (!fs.existsSync(filepath))
    return NextResponse.json({ error: 'Datei nicht gefunden' }, { status: 404 })

  fs.unlinkSync(filepath)
  return NextResponse.json({ success: true })
}
