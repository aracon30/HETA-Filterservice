'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

type Step = { step: string; output: string; error?: boolean }

const STEP_ICONS: Record<string, string> = {
  'Projektverzeichnis': '📁',
  'Version vor Update': '🏷️',
  'Pakete geändert?': '📦',
  'Git Fetch': '📡',
  'Git Flags zurücksetzen': '🔓',
  'Git Sparse-Checkout deaktivieren': '🔓',
  'Git Reset': '🔄',
  'Änderungen (letzte 10 Commits)': '📋',
  'Datei-Check': '🔍',
  'Cache leeren': '🗑️',
  'Cache leeren (.next)': '🗑️',
  'node_modules entfernen': '🗑️',
  'npm ci': '📦',
  'Prisma generate': '🔧',
  'Prisma db push': '🗄️',
  'Build': '🏗️',
  'Version nach Update': '✅',
  'Neustart': '🚀',
}

export default function UpdatePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [running, setRunning] = useState(false)
  const [steps, setSteps] = useState<Step[]>([])
  const [done, setDone] = useState<boolean | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const logEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [steps])

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>
    if (running) {
      const start = Date.now()
      timer = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000)
    } else {
      setElapsed(0)
    }
    return () => clearInterval(timer)
  }, [running])

  // Redirect after success once stream closed
  useEffect(() => {
    if (done === true) {
      const t = setTimeout(() => window.location.replace('/'), 4000)
      return () => clearTimeout(t)
    }
  }, [done])

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
    if (!res.ok || !res.body) {
      setDone(false)
      setRunning(false)
      return
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done: streamDone, value } = await reader.read()
      if (streamDone) break

      buffer += decoder.decode(value, { stream: true })
      const parts = buffer.split('\n\n')
      buffer = parts.pop() ?? ''

      for (const part of parts) {
        if (!part.startsWith('data: ')) continue
        try {
          const parsed = JSON.parse(part.slice(6))
          if (parsed.done !== undefined) {
            setDone(parsed.done)
          } else {
            setSteps(prev => [...prev, parsed as Step])
          }
        } catch {
          // malformed chunk — ignore
        }
      }
    }

    setRunning(false)
    if (done !== false) {
      // done state already set via stream; redirect on success
    }
  }

  const successCount = steps.filter(s => !s.error).length
  const errorCount = steps.filter(s => s.error).length

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Server-Update</h1>
        <p className="text-sm text-gray-500 mt-1">
          Zieht den neuesten Stand von Git, installiert Abhängigkeiten (nur bei Änderungen), führt Datenbank-Migration durch, baut die App neu und startet den Server neu.
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex gap-3">
        <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
        <div className="text-sm text-amber-800 space-y-1">
          <p className="font-semibold">Hinweise vor dem Update</p>
          <ul className="list-disc list-inside text-amber-700 space-y-0.5">
            <li>Der Dienst ist während des Builds (~1–5 Min.) kurzzeitig nicht erreichbar</li>
            <li>Daten in der Datenbank bleiben vollständig erhalten</li>
            <li>Update zieht immer den neuesten Stand aus dem <strong>main</strong>-Branch</li>
            <li>node_modules wird nur neu installiert wenn sich Pakete geändert haben oder fehlen</li>
          </ul>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={runUpdate}
          disabled={running}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
        >
          {running ? (
            <>
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Update läuft… ({elapsed}s)
            </>
          ) : (
            <>
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Update jetzt starten
            </>
          )}
        </button>
        {running && (
          <p className="text-sm text-gray-500 animate-pulse">
            Schritte erscheinen live — bitte warten…
          </p>
        )}
      </div>

      {done !== null && !running && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl mb-4 font-medium text-sm ${done ? 'bg-green-100 text-green-800 border border-green-300' : 'bg-red-100 text-red-800 border border-red-300'}`}>
          {done ? (
            <>
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Update erfolgreich abgeschlossen ({successCount} Schritte) — Weiterleitung in 4 Sekunden…
            </>
          ) : (
            <>
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Update fehlgeschlagen — {errorCount} Fehler aufgetreten. Details unten.
            </>
          )}
        </div>
      )}

      {steps.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Protokoll</p>
          {steps.map((s, i) => (
            <div key={i} className="rounded-xl border overflow-hidden">
              <div className={`flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium ${s.error ? 'bg-red-50 text-red-700 border-red-200' : 'bg-gray-50 text-gray-700 border-gray-200'}`}>
                <span className="text-base">{STEP_ICONS[s.step] ?? '⚙️'}</span>
                <span>{s.step}</span>
                {s.error && (
                  <span className="ml-auto text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-semibold">Fehler</span>
                )}
              </div>
              {s.output && s.output !== '(kein Output)' && (
                <pre className="px-4 py-3 text-xs text-gray-600 bg-white border-t border-gray-100 overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed max-h-48 overflow-y-auto">
                  {s.output}
                </pre>
              )}
            </div>
          ))}
          <div ref={logEndRef} />
        </div>
      )}
    </div>
  )
}
