import nodemailer from 'nodemailer'

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

export async function sendPasswordResetEmail(to: string, name: string, token: string) {
  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
  const resetUrl = `${baseUrl}/reset-password?token=${token}`
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER

  const transporter = createTransporter()

  await transporter.sendMail({
    from: `"HETA ServiceHub" <${from}>`,
    to,
    subject: 'Passwort zurücksetzen – HETA ServiceHub',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px; color: #1e293b;">
        <div style="margin-bottom: 24px;">
          <h1 style="font-size: 20px; font-weight: 700; margin: 0 0 4px;">HETA ServiceHub</h1>
          <p style="font-size: 13px; color: #64748b; margin: 0;">HETA Verfahrenstechnik GmbH</p>
        </div>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 0 0 24px;" />
        <p style="margin: 0 0 8px;">Hallo ${name},</p>
        <p style="margin: 0 0 24px; color: #475569;">
          Sie haben eine Anfrage zum Zurücksetzen Ihres Passworts gestellt. Klicken Sie auf den Button unten, um ein neues Passwort festzulegen.
        </p>
        <a href="${resetUrl}" style="display: inline-block; background: #2563eb; color: white; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 14px; margin-bottom: 24px;">
          Passwort zurücksetzen
        </a>
        <p style="margin: 0 0 8px; font-size: 13px; color: #64748b;">
          Der Link ist <strong>2 Stunden</strong> gültig. Wenn Sie diese Anfrage nicht gestellt haben, können Sie diese E-Mail ignorieren.
        </p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0 16px;" />
        <p style="margin: 0; font-size: 12px; color: #94a3b8;">
          HETA Verfahrenstechnik GmbH · Gottlieb-Daimler-Str. 7, D-35423 Lich
        </p>
      </div>
    `,
  })
}
