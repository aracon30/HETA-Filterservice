'use client'

import { SessionProvider } from 'next-auth/react'
import { ConfirmProvider } from '@/components/ConfirmDialog'

export default function SessionWrapper({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ConfirmProvider>{children}</ConfirmProvider>
    </SessionProvider>
  )
}
