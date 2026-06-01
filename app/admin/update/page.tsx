'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

type Step = { step: string; output: string; error?: boolean }

export default function UpdatePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [running, setRunning] = useState(false)
  const [steps, setSteps] = useState<Step[]>([])
  const [done, setDone] = useState<boolean | null>(null)

  if (status === 'loading') return null
  if (!session || session.user.role !== 'ADMIN') {
    router.replace('/')
    return null
  }

  const runUpdate = async () => {
    setRunning(true)
    setSteps([])
    setDone(null)

    const res = await fetch('/api/admin/update', { method: 'POST' })
    const data = await res.json()
    setSteps(data.steps ?? [])
    setDone(data.success)
    setRunning(false)

    if (data.success) {
      // Seite nach 3 Sekunden neu laden damit der neue Build aktiv ist
      setTimeout(() => window.location.replace('/'), 3000)
    }
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Server-Update</h1>
      <p className="text-gray-500 mb-6 text-sm">
        Zieht den neuesten Stand von Git, installiert Abhängigkeiten, baut die App neu und startet den Server neu.
      </p>

      <button
        onClick={runUpdate}
        disabled={running}
        className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {running ? (
          <>
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            Update läuft...
          </>
        ) : (
          <>
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Update starten
          </>
        )}
      </button>

      {steps.length > 0 && (
        <div className="mt-6 space-y-3">
          {steps.map((s, i) => (
            <div key={i} className="rounded-lg border overflow-hidden">
              <div className={`flex items-center gap-2 px-4 py-2 text-sm font-medium ${s.error ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                {s.error ? (
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {s.step}
              </div>
              {s.output && (
                <pre className="px-4 py-2 text-xs text-gray-600 bg-gray-50 overflow-x-auto whitespace-pre-wrap">{s.output}</pre>
              )}
            </div>
          ))}

          {done === true && (
            <div className="rounded-lg bg-green-100 border border-green-300 px-4 py-3 text-green-800 text-sm font-medium">
              ✓ Update erfolgreich — Weiterleitung zur Startseite...
            </div>
          )}
          {done === false && (
            <div className="rounded-lg bg-red-100 border border-red-300 px-4 py-3 text-red-800 text-sm font-medium">
              ✗ Update fehlgeschlagen — siehe Fehler oben.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
