'use client'

import { useEffect, useRef, useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { usePathname } from 'next/navigation'

const INACTIVITY_MS = 30 * 60 * 1000  // 30 Minuten
const WARNING_MS = 2 * 60 * 1000      // Warnung 2 Minuten vor Ablauf
const PING_MS = 5 * 60 * 1000         // Server-Ping alle 5 Minuten bei Aktivität

const TRACKED_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'] as const

export default function SessionTimeoutWarning() {
  const { data: session, update } = useSession()
  const pathname = usePathname()
  const [showWarning, setShowWarning] = useState(false)
  const [countdown, setCountdown] = useState(WARNING_MS / 1000)

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastActivityRef = useRef(Date.now())
  const warningActiveRef = useRef(false)
  const updateRef = useRef(update)
  useEffect(() => { updateRef.current = update }, [update])

  const isPublic =
    pathname === '/login' ||
    pathname === '/forgot-password' ||
    pathname.startsWith('/reset-password')

  function clearAllTimers() {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null }
  }

  function doLogout() {
    clearAllTimers()
    try { localStorage.removeItem('heta_session_heartbeat') } catch { /* ignorieren */ }
    signOut({ callbackUrl: '/login' })
  }

  function startWarning() {
    warningActiveRef.current = true
    setShowWarning(true)
    setCountdown(WARNING_MS / 1000)

    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          doLogout()
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  function scheduleWarning() {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(startWarning, INACTIVITY_MS - WARNING_MS)
  }

  function onUserActivity() {
    if (warningActiveRef.current) return
    lastActivityRef.current = Date.now()
    scheduleWarning()
  }

  async function handleContinue() {
    clearAllTimers()
    warningActiveRef.current = false
    setShowWarning(false)
    lastActivityRef.current = Date.now()
    scheduleWarning()
    await updateRef.current({ activityPing: true })
  }

  useEffect(() => {
    if (!session?.user || isPublic) return

    scheduleWarning()

    // Server-seitiges lastActivity alle 5 Minuten aktualisieren, wenn Nutzer aktiv war
    pingRef.current = setInterval(async () => {
      const idle = Date.now() - lastActivityRef.current
      if (idle < PING_MS) {
        await updateRef.current({ activityPing: true })
      }
    }, PING_MS)

    TRACKED_EVENTS.forEach(ev => window.addEventListener(ev, onUserActivity, { passive: true }))

    return () => {
      clearAllTimers()
      if (pingRef.current) { clearInterval(pingRef.current); pingRef.current = null }
      TRACKED_EVENTS.forEach(ev => window.removeEventListener(ev, onUserActivity))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, isPublic])

  if (!session?.user || isPublic || !showWarning) return null

  const mins = Math.floor(countdown / 60)
  const secs = countdown % 60

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.072 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Sitzung läuft ab</h2>
        </div>

        <p className="text-sm text-gray-600 mb-5">
          Aufgrund von Inaktivität wird Ihre Sitzung in{' '}
          <span className="font-bold text-amber-600 tabular-nums">
            {mins > 0
              ? `${mins}:${secs.toString().padStart(2, '0')} Min.`
              : `${secs} Sek.`}
          </span>{' '}
          automatisch beendet.
        </p>

        <div className="flex gap-3">
          <button
            onClick={handleContinue}
            className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Angemeldet bleiben
          </button>
          <button
            onClick={doLogout}
            className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
          >
            Abmelden
          </button>
        </div>
      </div>
    </div>
  )
}
