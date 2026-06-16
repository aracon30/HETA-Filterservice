import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl
    const token = req.nextauth.token

    // Force password change on first login (but still allow loading of uploaded
    // files so images/documents keep rendering during the forced-change flow)
    if (
      token?.mustChangePassword &&
      pathname !== '/settings/password' &&
      !pathname.startsWith('/uploads/') &&
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
  // Note: `uploads/` is intentionally NOT excluded so that statically served
  // files under public/uploads/ require a valid session (prevents anonymous
  // access to invoices, plant documents and other uploads via their URL).
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
