import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl
    const token = req.nextauth.token

    // Force password change on first login
    if (
      token?.mustChangePassword &&
      pathname !== '/settings/password' &&
      !pathname.startsWith('/api/auth/change-password') &&
      !pathname.startsWith('/api/auth/signout')
    ) {
      return NextResponse.redirect(new URL('/settings/password', req.url))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized({ token, req }) {
        const { pathname } = req.nextUrl
        // Public routes
        if (
          pathname.startsWith('/api/auth') ||
          pathname === '/login' ||
          pathname === '/forgot-password' ||
          pathname.startsWith('/reset-password')
        ) {
          return true
        }
        // Everything else requires a token
        return !!token
      },
    },
    pages: {
      signIn: '/login',
    },
  }
)

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|uploads/).*)'],
}
