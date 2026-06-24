'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import {
  ACQUISITION_PLANT_TYPES,
  LAST_SERVICE_OPTIONS,
  MAINTAINED_BY_OPTIONS,
  PRIORITY_OPTIONS,
  URGENCY_OPTIONS,
  MOOD_OPTIONS,
  NEXT_STEP_OPTIONS,
  getProblemsForTypes,
  type AcquisitionPlant,
} from '@/lib/acquisition-types'
import { useConfirm } from '@/components/ConfirmDialog'

interface AcquisitionCheck {
  id: string
  customer: { id: string; name: string; address: string | null }
  plants: AcquisitionPlant[]
  mood: string | null
  nextStep: string | null
  note: string | null
  createdByName: string
  createdAt: string
}

const CONDITION_LABELS = ['', 'Kritisch ★', 'Schlecht ★★', 'Mittel ★★★', 'Gut ★★★★', 'Sehr gut ★★★★★']
const CONDITION_COLORS = ['', 'text-red-600', 'text-orange-600', 'text-yellow-600', 'text-blue-600', 'text-green-600']

export default function AcquisitionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [check, setCheck] = useState<AcquisitionCheck | null>(null)
  const [loading, setLoading] = useState(true)
  const confirm = useConfirm()

  useEffect(() => {
    fetch(`/api/acquisition/${id}`)
      .then((r) => r.json())
      .then((data) => { setCheck(data); setLoading(false) })
  }, [id])

  const handleDelete = async () => {
    const ok = await confirm({
      title: 'Check löschen',
      message: 'Dieser Akquise-Check wird unwiderruflich gelöscht.',
      confirmLabel: 'Löschen',
    })
    if (!ok) return
    await fetch(`/api/acquisition/${id}`, { method: 'DELETE' })
    router.push('/akquise')
  }

  const plantTypeLabel = (types: string[]) =>
    types.map((t) => ACQUISITION_PLANT_TYPES.find((p) => p.value === t)?.label ?? t).join(' + ')

  if (loading) return <div className="p-6 text-slate-400">Lädt...</div>
  if (!check) return <div className="p-6 text-slate-400">Nicht gefunden.</div>

  const moodLabel = MOOD_OPTIONS.find((m) => m.value === check.mood)?.label
  const nextStepLabel = NEXT_STEP_OPTIONS.find((n) => n.value === check.nextStep)?.label

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/akquise" className="text-sm text-blue-600 hover:underline">← Alle Checks</Link>
          <h1 className="text-2xl font-bold text-slate-800 mt-1">{check.customer.name}</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Akquise-Check vom {format(new Date(check.createdAt), 'dd. MMMM yyyy', { locale: de })} · {check.createdByName}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/customers/${check.customer.id}`}
            className="text-sm text-slate-600 border border-slate-300 hover:border-slate-400 px-3 py-2 rounded-lg transition-colors"
          >
            Zum Kunden
          </Link>
          <button
            onClick={handleDelete}
            className="text-sm text-red-600 border border-red-200 hover:border-red-400 px-3 py-2 rounded-lg transition-colors"
          >
            Löschen
          </button>
        </div>
      </div>

      {/* Gesamteindruck */}
      {(moodLabel || nextStepLabel || check.note) && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
          <h2 className="font-semibold text-slate-800">Gesamteindruck</h2>
          {moodLabel && (
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold mb-0.5">Atmosphäre</p>
              <p className="text-sm text-slate-700">{moodLabel}</p>
            </div>
          )}
          {nextStepLabel && (
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold mb-0.5">Nächster Schritt</p>
              <p className="text-sm text-slate-700">{nextStepLabel}</p>
            </div>
          )}
          {check.note && (
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold mb-0.5">Notiz</p>
              <p className="text-sm text-slate-700 italic">„{check.note}"</p>
            </div>
          )}
        </div>
      )}

      {/* Anlagen */}
      {check.plants.map((plant, i) => {
        const problemOptions = getProblemsForTypes(plant.types)
        const problemLabels = plant.problems.map(
          (p) => problemOptions.find((pr) => pr.value === p)?.label ?? (p === 'none' ? 'Keine bekannten Probleme' : p)
        )
        const priorityLabels = plant.priorities.map(
          (p) => PRIORITY_OPTIONS.find((pr) => pr.value === p)?.label ?? p
        )
        const urgencyLabel = URGENCY_OPTIONS.find((u) => u.value === plant.urgency)?.label
        const lastServiceLabel = LAST_SERVICE_OPTIONS.find((l) => l.value === plant.lastServiceAge)?.label
        const maintainedByLabel = MAINTAINED_BY_OPTIONS.find((m) => m.value === plant.maintainedBy)?.label

        return (
          <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-800">
                Anlage {i + 1} — {plantTypeLabel(plant.types) || 'Unbekannt'}
              </h2>
              {plant.condition > 0 && (
                <span className={`text-sm font-semibold ${CONDITION_COLORS[plant.condition]}`}>
                  {CONDITION_LABELS[plant.condition]}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {plant.manufacturer && (
                <div>
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Hersteller</p>
                  <p className="text-slate-800 mt-0.5">{plant.manufacturer}</p>
                </div>
              )}
              {plant.buildYear && (
                <div>
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Baujahr</p>
                  <p className="text-slate-800 mt-0.5">{plant.buildYear}</p>
                </div>
              )}
              {plant.serialNumber && (
                <div>
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Seriennummer</p>
                  <p className="text-slate-800 mt-0.5">{plant.serialNumber}</p>
                </div>
              )}
              {lastServiceLabel && (
                <div>
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Letzter Service</p>
                  <p className="text-slate-800 mt-0.5">{lastServiceLabel}</p>
                </div>
              )}
              {maintainedByLabel && (
                <div>
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Gewartet durch</p>
                  <p className="text-slate-800 mt-0.5">{maintainedByLabel}</p>
                </div>
              )}
              {urgencyLabel && (
                <div>
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Dringlichkeit</p>
                  <p className="text-slate-800 mt-0.5">{urgencyLabel}</p>
                </div>
              )}
            </div>

            {problemLabels.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-1">Bekannte Probleme</p>
                <div className="flex flex-wrap gap-1.5">
                  {problemLabels.map((label, j) => (
                    <span key={j} className="text-xs bg-red-50 text-red-700 border border-red-200 px-2.5 py-1 rounded-full">
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {priorityLabels.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-1">Kundenprioritäten</p>
                <div className="flex flex-wrap gap-1.5">
                  {priorityLabels.map((label, j) => (
                    <span key={j} className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full">
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {plant.problemNote && (
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-1">Kundenaussage</p>
                <p className="text-sm text-slate-700 italic bg-slate-50 rounded-lg px-3 py-2">„{plant.problemNote}"</p>
              </div>
            )}

            {plant.customerNote && (
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-1">Gesprächsnotiz</p>
                <p className="text-sm text-slate-700 italic bg-slate-50 rounded-lg px-3 py-2">„{plant.customerNote}"</p>
              </div>
            )}
          </div>
        )
      })}

    </div>
  )
}
