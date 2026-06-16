import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import SessionWrapper from '@/components/SessionWrapper'
import LayoutShell from '@/components/LayoutShell'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'HETA ServiceHub',
  description: 'Serviceplattform – HETA Verfahrenstechnik GmbH, Gottlieb-Daimler-Str. 7, D-35423 Lich',
  icons: {
    icon: '/icon.svg',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="de">
      <body className={inter.className}>
        <SessionWrapper>
          <LayoutShell>{children}</LayoutShell>
        </SessionWrapper>
      </body>
    </html>
  )
}
