import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // 8 hours
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
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.customerId = user.customerId
        token.customerName = user.customerName ?? null
        token.mustChangePassword = user.mustChangePassword
      } else if (trigger === 'update' && token.id) {
        // Re-sync mutable fields from the DB when the client calls
        // useSession().update() — e.g. after the forced first-login password
        // change clears mustChangePassword. We read the authoritative DB value
        // instead of trusting client-supplied data so the forced change can't
        // be skipped without actually changing the password.
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id },
          select: { role: true, customerId: true, mustChangePassword: true },
        })
        if (dbUser) {
          token.role = dbUser.role
          token.customerId = dbUser.customerId
          token.mustChangePassword = dbUser.mustChangePassword
        }
      }
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
