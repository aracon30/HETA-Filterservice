import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

const INACTIVITY_TIMEOUT = 30 * 60 // 30 Minuten in Sekunden

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60,  // 8 Stunden absolutes Maximum
    updateAge: 5 * 60,     // Token alle 5 Minuten neu signieren
  },
  cookies: {
    sessionToken: {
      name: 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        // Kein maxAge → Session-Cookie, wird beim Schließen des Browsers gelöscht
      },
    },
  },
  pages: {
    signIn: '/login',
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Passwort', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: { customer: { select: { name: true } } },
        })

        if (!user || !user.active) {
          return null
        }

        const passwordMatch = await bcrypt.compare(credentials.password, user.password)
        if (!passwordMatch) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          customerId: user.customerId,
          customerName: user.customer?.name ?? null,
          mustChangePassword: user.mustChangePassword,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      const now = Math.floor(Date.now() / 1000)

      if (user) {
        // Frischer Login: alle Felder setzen + Aktivitätszeitstempel
        token.id = user.id
        token.role = user.role
        token.customerId = user.customerId
        token.customerName = user.customerName ?? null
        token.mustChangePassword = user.mustChangePassword
        token.lastActivity = now
      } else if (trigger === 'update' && token.id) {
        if ((session as { activityPing?: boolean } | null)?.activityPing) {
          // Aktivitäts-Ping vom Client: nur lastActivity aktualisieren, kein DB-Sync
          token.lastActivity = now
        } else {
          // Vollständiger DB-Sync (z.B. nach Passwortänderung)
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id },
            select: { role: true, customerId: true, mustChangePassword: true },
          })
          if (dbUser) {
            token.role = dbUser.role
            token.customerId = dbUser.customerId
            token.mustChangePassword = dbUser.mustChangePassword
          }
          token.lastActivity = now
        }
      }
      // Bei regulären Token-Lesevorgängen (API-Polling etc.) wird lastActivity
      // bewusst NICHT aktualisiert – nur explizite Nutzerinteraktionen zählen.
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id
        session.user.role = token.role
        session.user.customerId = token.customerId
        session.user.customerName = token.customerName as string | null
        session.user.mustChangePassword = token.mustChangePassword
      }
      return session
    },
  },
}
