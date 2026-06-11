import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { sendPasswordResetEmail } from '@/lib/mail'

export async function POST(request: NextRequest) {
  const { email } = await request.json()

  if (!email) {
    return NextResponse.json({ error: 'E-Mail-Adresse fehlt.' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { email } })

  // Always return success to prevent user enumeration
  if (!user || !user.active) {
    return NextResponse.json({ ok: true })
  }

  const token = crypto.randomBytes(32).toString('hex')
  const expiry = new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 hours

  await prisma.user.update({
    where: { id: user.id },
    data: { resetToken: token, resetTokenExpiry: expiry },
  })

  try {
    await sendPasswordResetEmail(user.email, user.name, token)
  } catch (err) {
    console.error('E-Mail konnte nicht gesendet werden:', err)
    return NextResponse.json({ error: 'E-Mail konnte nicht gesendet werden. Bitte versuchen Sie es später erneut.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
