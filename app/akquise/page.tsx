'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import { MOOD_OPTIONS, NEXT_STEP_OPTIONS } from '@/lib/acquisition-types'

interface AcquisitionCheck {
  id: string
  customerId: string
  customer: { id: string; name: string }
  plants: unknown[]
  mood: string | null
  nextStep: string | null
  note: string | null
  createdByName: string
  createdAt: string
}

const MOOD_COLORS: Record<string, string> = {
  very_open: 'bg-green-100 text-green-800',
  positive: 'bg-blue-100 text-blue-800',
  neutral: 'bg-slate-100 text-slate-700',
  skeptical: 'bg-yellow-100 text-yellow-800',
  rejecting: 'bg-red-100 text-red-800',
}

export default function AcquisitionListPage() {
  const [checks, setChecks] = useState<AcquisitionCheck[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/acquisition')
      .then((r) => r.json())
      .then((data) => { setChecks(data); setLoading(false) })
  }, [])

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Akquise-Checks</h1>
          <p className="text-sm text-slate-500 mt-1">Geführte Anlagenerfassung für Neukunden</p>
        </div>
        <Link
          href="/akquise/neu"
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Neuer Check
        </Link>
      </div>

      {loading && (
        <div className="text-center py-12 text-slate-400">Lädt...</div>
      )}

      {!loading && checks.length === 0 && (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
          <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-slate-500 font-medium">Noch keine Checks vorhanden</p>
          <p className="text-sm text-slate-400 mt-1">Starte den ersten Akquise-Check bei einem Kunden.</p>
          <Link
            href="/akquise/neu"
            className="mt-4 inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
          >
            Jetzt starten
          </Link>
        </div>
      )}

      <div className="space-y-3">
        {checks.map((check) => {
          const moodLabel = MOOD_OPTIONS.find((m) => m.value === check.mood)?.label
          const nextStepLabel = NEXT_STEP_OPTIONS.find((n) => n.value === check.nextStep)?.label
          const moodColor = check.mood ? MOOD_COLORS[check.mood] ?? 'bg-slate-100 text-slate-700' : ''

          return (
            <Link
              key={check.id}
              href={`/akquise/${check.id}`}
              className="block bg-white rounded-2xl border border-slate-200 p-5 hover:border-blue-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 truncate">{check.customer.name}</p>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {(check.plants as unknown[]).length} Anlage{(check.plants as unknown[]).length !== 1 ? 'n' : ''} ·{' '}
                    {format(new Date(check.createdAt), 'dd. MMM yyyy', { locale: de })} ·{' '}
                    {check.createdByName}
                  </p>
                  {nextStepLabel && (
                    <p className="text-sm text-slate-600 mt-1">Nächster Schritt: {nextStepLabel}</p>
                  )}
                </div>
                {moodLabel && (
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0 ${moodColor}`}>
                    {moodLabel.split('—')[0].trim()}
                  </span>
                )}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
