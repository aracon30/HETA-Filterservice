import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

// Strict whitelist — no executables, scripts, or archives
const ALLOWED_EXTENSIONS = new Set([
  // Images
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'tiff',
  // Documents
  'pdf', 'docx', 'xlsx', 'txt', 'csv',
  // CAD / Drawing formats
  'dwg', 'dxf', 'svg',
])

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Keine Datei' }, { status: 400 })

  const ext = (file.name.split('.').pop() ?? '').toLowerCase()
  if (!ALLOWED_EXTENSIONS.has(ext))
    return NextResponse.json({ error: 'Dateityp nicht erlaubt' }, { status: 400 })

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  const fileName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${ext}`
  // Use the directory of this file as anchor so the path is correct regardless of cwd
  const uploadDir = path.join(process.cwd(), 'public', 'uploads')
  await mkdir(uploadDir, { recursive: true })
  const filePath = path.join(uploadDir, fileName)
  await writeFile(filePath, buffer)
  console.log('[upload] saved to', filePath)

  return NextResponse.json({ url: `/uploads/${fileName}` })
}
