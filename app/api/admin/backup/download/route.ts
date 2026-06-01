import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import path from 'path'
import fs from 'fs'

const APP_DIR = path.resolve(process.cwd())
const BACKUP_DIR = path.join(APP_DIR, 'backups')

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const name = searchParams.get('name') ?? ''

  if (!name.endsWith('.sql') || name.includes('/') || name.includes('..'))
    return NextResponse.json({ error: 'Ungültiger Dateiname' }, { status: 400 })

  const filepath = path.join(BACKUP_DIR, name)
  if (!fs.existsSync(filepath))
    return NextResponse.json({ error: 'Datei nicht gefunden' }, { status: 404 })

  const content = fs.readFileSync(filepath)
  return new NextResponse(content, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${name}"`,
    },
  })
}
