'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toFileUrl } from '@/lib/file-url'

interface Part {
  id: string
  label: string
  partNumber: string | null
  positionLabel: string | null
  specification: string | null
}

interface Drawing {
  id: string
  title: string
  fileUrl: string
}

interface Hotspot {
  materialId: string
  documentId: string
  positionX: number
  positionY: number
}

export default function ErsatzteilAuswahl({
  plantId,
  plantName,
  parts,
  drawings = [],
  hotspots = [],
}: {
  plantId: string
  plantName: string
  parts: Part[]
  drawings?: Drawing[]
  hotspots?: Hotspot[]
}) {
  const router = useRouter()
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [activeDrawingId, setActiveDrawingId] = useState(drawings[0]?.id ?? null)
  const [highlighted, setHighlighted] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({})
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const setQuantity = (id: string, value: number) => {
    setQuantities(prev => {
      const next = { ...prev }
      if (value <= 0) delete next[id]
      else next[id] = value
      return next
    })
  }

  const selectedCount = Object.keys(quantities).length

  const jumpToMaterial = (materialId: string) => {
    rowRefs.current[materialId]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    inputRefs.current[materialId]?.focus()
    setHighlighted(materialId)
    setTimeout(() => setHighlighted(prev => (prev === materialId ? null : prev)), 1500)
  }

  const activeHotspots = hotspots.filter(h => h.documentId === activeDrawingId)
  const activeDrawing = drawings.find(d => d.id === activeDrawingId)
  const hotspotLabel = (materialId: string) => {
    const p = parts.find(p => p.id === materialId)
    return p ? (p.positionLabel || p.label.slice(0, 3)) : '?'
  }

  const handleSubmit = async () => {
    setError('')
    if (selectedCount === 0) {
      setError('Bitte mindestens ein Ersatzteil mit Menge auswählen.')
      return
    }

    setSubmitting(true)

    const selectedParts = Object.entries(quantities).map(([materialId, quantity]) => ({
      materialId,
      quantity,
    }))

    const partLines = parts
      .filter(p => quantities[p.id])
      .map(p => `- ${p.positionLabel ? `[${p.positionLabel}] ` : ''}${p.label} (Menge: ${quantities[p.id]})`)
      .join('\n')

    const res = await fetch('/api/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `Ersatzteilanfrage – ${plantName}`,
        description: `Angefragte Ersatzteile:\n${partLines}${note.trim() ? `\n\nAnmerkung: ${note.trim()}` : ''}`,
        type: 'ERSATZTEIL',
        priority: 'NORMAL',
        plantIds: [plantId],
        parts: selectedParts,
      }),
    })

    setSubmitting(false)

    if (res.ok) {
      setDone(true)
      setTimeout(() => router.push('/portal/requests'), 1200)
    } else {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Fehler beim Senden der Anfrage.')
    }
  }

  if (done) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-10 text-center">
        <svg className="w-10 h-10 mx-auto mb-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm font-medium text-gray-800">Anfrage gesendet.</p>
        <p className="text-xs text-gray-400 mt-1">Sie werden zu Ihren Anfragen weitergeleitet...</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      {error && (
        <div className="bg-red-50 border-b border-red-200 text-red-700 text-sm px-4 py-3">{error}</div>
      )}

      {drawings.length > 0 && (
        <div className="p-4 border-b border-gray-100">
          {drawings.length > 1 && (
            <div className="flex gap-1.5 mb-2">
              {drawings.map(d => (
                <button
                  key={d.id}
                  onClick={() => setActiveDrawingId(d.id)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    activeDrawingId === d.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {d.title}
                </button>
              ))}
            </div>
          )}
          {activeDrawing && (
            <>
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-[11px] text-gray-400">Zoom:</span>
                {[1, 2, 3].map(z => (
                  <button
                    key={z}
                    onClick={() => setZoom(z)}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                      zoom === z ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {z}×
                  </button>
                ))}
              </div>
              <div className="border border-gray-200 rounded-lg overflow-auto" style={{ maxHeight: 480 }}>
                <div className="relative inline-block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={toFileUrl(activeDrawing.fileUrl)}
                    alt={activeDrawing.title}
                    style={{ width: `${zoom * 100}%`, maxWidth: 'none' }}
                    className="block"
                  />
                  {activeHotspots.map(h => (
                    <button
                      key={h.materialId}
                      onClick={() => jumpToMaterial(h.materialId)}
                      style={{ left: `${h.positionX * 100}%`, top: `${h.positionY * 100}%` }}
                      className={`absolute -translate-x-1/2 -translate-y-1/2 min-w-[18px] h-[18px] px-1 rounded-full text-white text-[10px] font-bold flex items-center justify-center border-2 border-white shadow transition-colors ${
                        quantities[h.materialId] ? 'bg-green-600' : 'bg-blue-600 hover:bg-blue-700'
                      }`}
                      title={hotspotLabel(h.materialId)}
                    >
                      {hotspotLabel(h.materialId).length <= 4 ? hotspotLabel(h.materialId) : ''}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
          <p className="text-xs text-gray-400 mt-2">Auf eine Markierung klicken, um zum Ersatzteil in der Liste zu springen.</p>
        </div>
      )}

      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-100">
          <tr>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Pos.</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Bezeichnung</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Abmessungen / Material</th>
            <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Menge</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {parts.map(p => (
            <tr
              key={p.id}
              ref={el => { rowRefs.current[p.id] = el }}
              className={`transition-colors ${highlighted === p.id ? 'bg-yellow-100' : quantities[p.id] ? 'bg-blue-50/40' : undefined}`}
            >
              <td className="px-4 py-3 text-gray-400 font-mono text-xs">{p.positionLabel ?? '—'}</td>
              <td className="px-4 py-3 text-gray-800">{p.label}</td>
              <td className="px-4 py-3 text-gray-500">{p.specification ?? '—'}</td>
              <td className="px-4 py-3 text-right">
                <input
                  ref={el => { inputRefs.current[p.id] = el }}
                  type="number"
                  min={0}
                  value={quantities[p.id] ?? 0}
                  onChange={e => setQuantity(p.id, Math.max(0, Number(e.target.value)))}
                  className="w-16 border border-gray-200 rounded px-2 py-1 text-xs text-center focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="px-4 py-4 border-t border-gray-100 space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Anmerkung (optional)</label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={2}
            placeholder="Zusätzliche Hinweise zu Ihrer Anfrage..."
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400">
            {selectedCount === 0 ? 'Keine Position ausgewählt' : `${selectedCount} Position(en) ausgewählt`}
          </p>
          <button
            onClick={handleSubmit}
            disabled={submitting || selectedCount === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Wird gesendet...' : 'Ersatzteile anfragen'}
          </button>
        </div>
        <p className="text-xs text-gray-400">
          Dies ist eine unverbindliche Anfrage. Preise erhalten Sie mit dem individuellen Angebot.
        </p>
      </div>
    </div>
  )
}
