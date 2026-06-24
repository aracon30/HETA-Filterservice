'use client'

import { useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { usePathname } from 'next/navigation'

const HEARTBEAT_KEY = 'heta_session_heartbeat'
const HEARTBEAT_MS = 15_000  // alle 15 Sekunden schreiben
const STALE_MS = 60_000      // 60 Sekunden Pause = Browser/alle Tabs geschlossen

function isStale(): boolean {
  try {
    const ts = localStorage.getItem(HEARTBEAT_KEY)
    if (!ts) return false // Erstbesuch oder nach manuellem Abmelden: kein Zwang
    return Date.now() - parseInt(ts, 10) > STALE_MS
  } catch {
    return false
  }
}

function writeHeartbeat() {
  try {
    localStorage.setItem(HEARTBEAT_KEY, Date.now().toString())
  } catch { /* privater Modus ohne localStorage */ }
}

function clearHeartbeat() {
  try {
    localStorage.removeItem(HEARTBEAT_KEY)
  } catch { /* ignorieren */ }
}

export default function SessionGuard() {
  const { data: session } = useSession()
  const pathname = usePathname()

  const isPublic =
    pathname === '/login' ||
    pathname === '/forgot-password' ||
    pathname.startsWith('/reset-password')

  useEffect(() => {
    if (!session?.user || isPublic) return

    // Beim Laden prüfen: war kein Tab aktiv? → Abmeldung
    if (isStale()) {
      clearHeartbeat()
      signOut({ callbackUrl: '/login' })
      return
    }

    // Heartbeat starten
    writeHeartbeat()
    const interval = setInterval(writeHeartbeat, HEARTBEAT_MS)

    // Beim Sichtbarwerden prüfen (Browser-Session-Restore, Tab-Wechsel)
    const onVisible = () => {
      if (document.visibilityState === 'visible' && isStale()) {
        clearHeartbeat()
        signOut({ callbackUrl: '/login' })
      }
    }
    document.addEventListener('visibilitychange', onVisible)

    // Beim Abmelden Heartbeat löschen damit nächster Besuch sauber startet
    const onStorage = (e: StorageEvent) => {
      if (e.key === HEARTBEAT_KEY && e.newValue === null) {
        signOut({ callbackUrl: '/login' })
      }
    }
    window.addEventListener('storage', onStorage)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('storage', onStorage)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, isPublic])

  return null
}
