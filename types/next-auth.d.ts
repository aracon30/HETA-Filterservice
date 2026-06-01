import { UserRole } from '@prisma/client'
import NextAuth, { DefaultSession, DefaultJWT } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: UserRole
      customerId: string | null
    } & DefaultSession['user']
  }

  interface User {
    id: string
    role: UserRole
    customerId: string | null
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: UserRole
    customerId: string | null
  }
}
