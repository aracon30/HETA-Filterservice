import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { readFile } from 'fs/promises'
import path from 'path'

const MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const { path: segments } = await params
  // Prevent path traversal — no segment may be ".."
  if (segments.some((s) => s === '..' || s.includes('\0'))) {
    return NextResponse.json({ error: 'Ungültiger Pfad' }, { status: 400 })
  }

  const filePath = path.join(process.cwd(), 'public', 'uploads', ...segments)

  try {
    const file = await readFile(filePath)
    const ext = (segments[segments.length - 1].split('.').pop() ?? '').toLowerCase()
    const contentType = MIME[ext] ?? 'application/octet-stream'
    return new NextResponse(file, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
  }
}
