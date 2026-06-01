import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs'

const execAsync = promisify(exec)
const APP_DIR = path.resolve(process.cwd())
const BACKUP_DIR = path.join(APP_DIR, 'backups')

function parseDbUrl(url: string) {
  const match = url.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/)
  if (!match) throw new Error('Ungültige DATABASE_URL')
  return { user: match[1], password: match[2], host: match[3], port: match[4], db: match[5] }
}

// POST — Backup einspielen (aus Liste oder Upload)
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const contentType = req.headers.get('content-type') ?? ''
  let filepath: string
  let tempFile = false

  if (contentType.includes('multipart/form-data')) {
    // Upload-Modus
    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'Keine Datei übermittelt' }, { status: 400 })
    if (!file.name.endsWith('.sql'))
      return NextResponse.json({ error: 'Nur .sql Dateien erlaubt' }, { status: 400 })

    const buf = Buffer.from(await file.arrayBuffer())
    filepath = path.join(BACKUP_DIR, `upload-${Date.now()}.sql`)
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true })
    fs.writeFileSync(filepath, buf)
    tempFile = true
  } else {
    // Aus Liste
    const { name } = await req.json()
    if (!name || !name.endsWith('.sql') || name.includes('/') || name.includes('..'))
      return NextResponse.json({ error: 'Ungültiger Dateiname' }, { status: 400 })
    filepath = path.join(BACKUP_DIR, name)
    if (!fs.existsSync(filepath))
      return NextResponse.json({ error: 'Backup nicht gefunden' }, { status: 404 })
  }

  const dbUrl = process.env.DATABASE_URL!
  const { user, password, host, port, db } = parseDbUrl(dbUrl)
  const env = { ...process.env, PGPASSWORD: password }

  try {
    // Verbindungen trennen, Schema leeren, Backup einspielen
    await execAsync(
      `psql -h ${host} -p ${port} -U ${user} -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${db}' AND pid <> pg_backend_pid();"`,
      { env, timeout: 10000 }
    )
    await execAsync(
      `psql -h ${host} -p ${port} -U ${user} -d ${db} -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"`,
      { env, timeout: 10000 }
    )
    await execAsync(
      `psql -h ${host} -p ${port} -U ${user} -d ${db} -f "${filepath}"`,
      { env, timeout: 120000 }
    )
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  } finally {
    if (tempFile && fs.existsSync(filepath)) fs.unlinkSync(filepath)
  }
}
