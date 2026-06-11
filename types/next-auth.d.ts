import { UserRole } from '@prisma/client'
import NextAuth, { DefaultSession, DefaultJWT } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: UserRole
      customerId: string | null
      customerName: string | null
      mustChangePassword: boolean
    } & DefaultSession['user']
  }

  interface User {
    id: string
    role: UserRole
    customerId: string | null
    customerName: string | null
    mustChangePassword: boolean
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: UserRole
    customerId: string | null
    customerName: string | null
    mustChangePassword: boolean
  }
}
