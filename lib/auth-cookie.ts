// Bestimmt den Session-Cookie-Namen basierend auf NEXTAUTH_URL.
// Wird von lib/auth.ts (Cookie-Erstellung) und middleware.ts (Cookie-Lesen)
// gemeinsam genutzt, damit beide immer denselben Namen verwenden.
export const useSecureCookies = process.env.NEXTAUTH_URL?.startsWith('https://') ?? false

export const sessionCookieName = useSecureCookies
  ? '__Secure-next-auth.session-token'
  : 'next-auth.session-token'
