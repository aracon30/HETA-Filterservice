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
  YES_NO_UNKNOWN,
  INSTALLATION_TYPE_OPTIONS,
  ENVIRONMENTAL_CONDITIONS,
  getProblemsForTypes,
  type AcquisitionPlant,
} from '@/lib/acquisition-types'
import { useConfirm } from '@/components/ConfirmDialog'

interface AcquisitionCheck {
  id: string
  customer: { id: string; name: string; address: string | null }
  siteId: string | null
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
  const [converting, setConverting] = useState(false)
  const [converted, setConverted] = useState(false)
  const confirm = useConfirm()

  useEffect(() => {
    fetch(`/api/acquisition/${id}`)
      .then((r) => r.json())
      .then((data) => { setCheck(data); setLoading(false) })
  }, [id])

  const handleConvert = async () => {
    if (!check) return
    const ok = await confirm({
      title: 'Anlagen in Kundenstamm übernehmen',
      message: `Es werden ${check.plants.length} Anlage(n) als echte Kundenanlagen bei „${check.customer.name}" angelegt. Fortfahren?`,
      confirmLabel: 'Übernehmen',
      danger: false,
    })
    if (!ok) return
    setConverting(true)
    try {
      const res = await fetch(`/api/acquisition/${id}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId: check.siteId }),
      })
      if (!res.ok) throw new Error()
      setConverted(true)
    } finally {
      setConverting(false)
    }
  }

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
        <div className="flex gap-2 flex-wrap">
          <Link
            href={`/customers/${check.customer.id}`}
            className="text-sm text-slate-600 border border-slate-300 hover:border-slate-400 px-3 py-2 rounded-lg transition-colors"
          >
            Zum Kunden
          </Link>
          {converted ? (
            <span className="text-sm text-green-700 border border-green-300 bg-green-50 px-3 py-2 rounded-lg">
              ✓ Anlagen übernommen
            </span>
          ) : (
            <button
              onClick={handleConvert}
              disabled={converting}
              className="text-sm text-blue-700 border border-blue-300 hover:border-blue-500 hover:bg-blue-50 px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              {converting ? 'Wird übernommen...' : 'Anlagen übernehmen'}
            </button>
          )}
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

            {/* Identifikation */}
            {[
              { label: 'Hersteller', val: plant.manufacturer },
              { label: 'Modell / Typ', val: plant.modelDesignation },
              { label: 'Baujahr', val: plant.buildYear },
              { label: 'Seriennummer', val: plant.serialNumber },
            ].some((f) => f.val) && (
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-2">Identifikation</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  {[
                    { label: 'Hersteller', val: plant.manufacturer },
                    { label: 'Modell / Typ', val: plant.modelDesignation },
                    { label: 'Baujahr', val: plant.buildYear },
                    { label: 'Seriennummer', val: plant.serialNumber },
                  ].filter((f) => f.val).map(({ label, val }) => (
                    <div key={label}>
                      <p className="text-xs text-slate-500">{label}</p>
                      <p className="text-slate-800">{val}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Technische Daten */}
            {[plant.nominalPower, plant.operatingPressure, plant.flowRate, plant.medium, plant.operatingHours].some(Boolean) && (
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-2">Technische Daten</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  {[
                    { label: 'Nennleistung', val: plant.nominalPower },
                    { label: 'Betriebsdruck', val: plant.operatingPressure },
                    { label: 'Durchflussrate', val: plant.flowRate },
                    { label: 'Medium', val: plant.medium },
                    { label: 'Betriebsstunden', val: plant.operatingHours },
                  ].filter((f) => f.val).map(({ label, val }) => (
                    <div key={label}>
                      <p className="text-xs text-slate-500">{label}</p>
                      <p className="text-slate-800">{val}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Zustand & Historie */}
            {[plant.wasModified, plant.hasDocumentation, plant.sparePartsAvailable].some(Boolean) && (
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-2">Zustand & Historie</p>
                <div className="grid grid-cols-1 gap-y-2 text-sm">
                  {[
                    { label: 'Umgebaut / modifiziert', val: plant.wasModified },
                    { label: 'Dokumentation vorhanden', val: plant.hasDocumentation },
                    { label: 'Ersatzteile beschaffbar', val: plant.sparePartsAvailable },
                  ].filter((f) => f.val).map(({ label, val }) => (
                    <div key={label} className="flex items-center justify-between">
                      <span className="text-slate-500">{label}</span>
                      <span className="text-slate-800">{YES_NO_UNKNOWN.find((o) => o.value === val)?.label ?? val}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Aufstellort */}
            {(plant.installationType || plant.environmentalConditions?.length > 0) && (
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-2">Aufstellort</p>
                <div className="text-sm space-y-1">
                  {plant.installationType && (
                    <p className="text-slate-800">{INSTALLATION_TYPE_OPTIONS.find((o) => o.value === plant.installationType)?.label}</p>
                  )}
                  {plant.environmentalConditions?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {plant.environmentalConditions.map((c) => (
                        <span key={c} className="text-xs bg-yellow-50 text-yellow-800 border border-yellow-200 px-2.5 py-1 rounded-full">
                          {ENVIRONMENTAL_CONDITIONS.find((o) => o.value === c)?.label ?? c}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Service */}
            {(lastServiceLabel || maintainedByLabel || urgencyLabel) && (
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-2">Servicehistorie & Dringlichkeit</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  {lastServiceLabel && (
                    <div>
                      <p className="text-xs text-slate-500">Letzter Service</p>
                      <p className="text-slate-800">{lastServiceLabel}</p>
                    </div>
                  )}
                  {maintainedByLabel && (
                    <div>
                      <p className="text-xs text-slate-500">Gewartet durch</p>
                      <p className="text-slate-800">{maintainedByLabel}</p>
                    </div>
                  )}
                  {urgencyLabel && (
                    <div className="col-span-2">
                      <p className="text-xs text-slate-500">Dringlichkeit</p>
                      <p className="text-slate-800">{urgencyLabel}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

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

            {plant.additionalInfo && (
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-1">Weitere Informationen</p>
                <p className="text-sm text-slate-700 bg-slate-50 rounded-lg px-3 py-2">{plant.additionalInfo}</p>
              </div>
            )}

            {plant.photos?.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-2">Fotos</p>
                <div className="grid grid-cols-3 gap-2">
                  {plant.photos.map((url) => (
                    <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="rounded-lg overflow-hidden aspect-square bg-slate-100 block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="w-full h-full object-cover hover:opacity-90 transition-opacity" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })}

    </div>
  )
}
