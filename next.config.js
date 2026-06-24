/** @type {import('next').NextConfig} */
const securityHeaders = [
  // Verhindert Clickjacking (Einbettung in fremde iframes)
  { key: 'X-Frame-Options', value: 'DENY' },
  // Verhindert MIME-Type-Sniffing
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Kein Referrer bei externen Links
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Kein Zugriff auf Kamera/Mikrofon/Geolocation
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  // HTTPS erzwingen (1 Jahr, inkl. Subdomains)
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  // XSS-Schutz (Legacy-Browser)
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  // Content Security Policy — erlaubt nur eigene Ressourcen + inline styles (Tailwind)
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // unsafe-eval only in development (Next.js HMR requires it); removed in production
      process.env.NODE_ENV === 'development'
        ? "script-src 'self' 'unsafe-eval' 'unsafe-inline'"
        : "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      "connect-src 'self'",
      "frame-ancestors 'none'",
    ].join('; '),
  },
]

const nextConfig = {
  // Keep @react-pdf external so the bundler doesn't try to bundle the ESM-only
  // package (stable `serverExternalPackages` key since Next.js 15).
  // The `@/*` import alias is resolved automatically from tsconfig paths
  // (works under Turbopack, the default bundler in Next.js 16).
  serverExternalPackages: ['@react-pdf/renderer'],
  async rewrites() {
    return [
      // Rewrite /uploads/* to the auth-protected file-serving route
      { source: '/uploads/:path*', destination: '/api/files/:path*' },
    ]
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },
}
module.exports = nextConfig
