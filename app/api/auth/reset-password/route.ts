import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  const { token, password } = await request.json()

  if (!token || !password) {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 })
  }

  if (password.length < 8) {
    return NextResponse.json({ error: 'Das Passwort muss mindestens 8 Zeichen lang sein.' }, { status: 400 })
  }

  const user = await prisma.user.findFirst({
    where: {
      resetToken: token,
      resetTokenExpiry: { gt: new Date() },
    },
  })

  if (!user) {
    return NextResponse.json({ error: 'Der Link ist ungültig oder abgelaufen. Bitte fordern Sie einen neuen an.' }, { status: 400 })
  }

  const hashedPassword = await bcrypt.hash(password, 12)

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      resetToken: null,
      resetTokenExpiry: null,
      mustChangePassword: false,
    },
  })

  return NextResponse.json({ ok: true })
}
