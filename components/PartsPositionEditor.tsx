'use client'

import { useEffect, useMemo, useState } from 'react'
import { toFileUrl, isImageFile } from '@/lib/file-url'

interface Drawing {
  id: string
  title: string
  fileUrl: string
  mimeType: string | null
}

interface MaterialRef {
  id?: string
  label: string
  positionLabel: string
}

interface Position {
  id: string
  materialId: string
  documentId: string
  positionX: number
  positionY: number
}

export default function PartsPositionEditor({
  plantId,
  materials,
}: {
  plantId: string
  materials: MaterialRef[]
}) {
  const [drawings, setDrawings] = useState<Drawing[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [activeDrawingId, setActiveDrawingId] = useState<string | null>(null)
  const [armedMaterialId, setArmedMaterialId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch(`/api/plants/${plantId}/documents`).then(r => r.json()),
      fetch(`/api/plants/${plantId}/parts-positions`).then(r => r.json()),
    ]).then(([docs, pos]) => {
      const drawingDocs: Drawing[] = (Array.isArray(docs) ? docs : [])
        .filter((d: { type: string; fileUrl: string; mimeType: string | null }) =>
          d.type === 'DRAWING' && isImageFile(d.fileUrl, d.mimeType))
      setDrawings(drawingDocs)
      setActiveDrawingId(prev => prev ?? drawingDocs[0]?.id ?? null)
      setPositions(Array.isArray(pos) ? pos : [])
      setLoading(false)
    })
  }, [plantId])

  const savableMaterials = useMemo(
    () => materials.filter((m): m is MaterialRef & { id: string } => !!m.id),
    [materials]
  )

  const activePositions = positions.filter(p => p.documentId === activeDrawingId)
  const activeDrawing = drawings.find(d => d.id === activeDrawingId)

  const materialLabel = (materialId: string) => {
    const m = savableMaterials.find(m => m.id === materialId)
    return m ? (m.positionLabel || m.label) : '?'
  }

  const handleImageClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (!armedMaterialId || !activeDrawingId) return
    const rect = e.currentTarget.getBoundingClientRect()
    const positionX = (e.clientX - rect.left) / rect.width
    const positionY = (e.clientY - rect.top) / rect.height

    const res = await fetch(`/api/plants/${plantId}/parts-positions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ materialId: armedMaterialId, documentId: activeDrawingId, positionX, positionY }),
    })
    if (res.ok) {
      const saved = await res.json()
      setPositions(prev => [...prev.filter(p => p.id !== saved.id), saved])
    }
    setArmedMaterialId(null)
  }

  const removePosition = async (positionId: string) => {
    const res = await fetch(`/api/plants/${plantId}/parts-positions?id=${positionId}`, { method: 'DELETE' })
    if (res.ok) setPositions(prev => prev.filter(p => p.id !== positionId))
  }

  if (loading) return <p className="text-xs text-gray-400 py-3">Lädt Zeichnungen...</p>

  if (drawings.length === 0) {
    return (
      <p className="text-xs text-gray-400 py-3">
        Keine Zeichnung hinterlegt. Unter „Dokumente“ mit Typ „Zeichnung / Plan“ (Bildformat: PNG/JPG/SVG) hochladen,
        um Ersatzteil-Positionen markieren zu können.
      </p>
    )
  }

  if (savableMaterials.length === 0) {
    return <p className="text-xs text-gray-400 py-3">Erst Ersatzteile anlegen und speichern, dann Positionen setzen.</p>
  }

  return (
    <div className="mt-2">
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

      <div className="flex gap-3">
        {/* Image with hotspots */}
        <div
          onClick={handleImageClick}
          className={`relative flex-1 border rounded-lg overflow-hidden ${armedMaterialId ? 'cursor-crosshair ring-2 ring-blue-400' : 'border-gray-200'}`}
        >
          {activeDrawing && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={toFileUrl(activeDrawing.fileUrl)} alt={activeDrawing.title} className="w-full h-auto block select-none" draggable={false} />
          )}
          {activePositions.map(p => (
            <button
              key={p.id}
              onClick={e => { e.stopPropagation(); if (confirm(`Position „${materialLabel(p.materialId)}" entfernen?`)) removePosition(p.id) }}
              style={{ left: `${p.positionX * 100}%`, top: `${p.positionY * 100}%` }}
              className="absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white shadow hover:bg-red-500 transition-colors"
              title={`${materialLabel(p.materialId)} — Klicken zum Entfernen`}
            >
              {materialLabel(p.materialId).slice(0, 3)}
            </button>
          ))}
        </div>

        {/* Material picker */}
        <div className="w-52 flex-shrink-0 border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-2.5 py-1.5 bg-gray-50 border-b border-gray-100 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
            {armedMaterialId ? 'Auf Zeichnung klicken...' : 'Teil wählen, dann Zeichnung klicken'}
          </div>
          <div className="max-h-64 overflow-y-auto divide-y divide-gray-50">
            {savableMaterials.map(m => {
              const hasPosition = activePositions.some(p => p.materialId === m.id)
              return (
                <button
                  key={m.id}
                  onClick={() => setArmedMaterialId(prev => prev === m.id ? null : m.id)}
                  className={`w-full text-left px-2.5 py-1.5 text-xs flex items-center gap-1.5 transition-colors ${
                    armedMaterialId === m.id ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${hasPosition ? 'bg-green-500' : 'bg-gray-200'}`} />
                  <span className="truncate">{m.positionLabel ? `[${m.positionLabel}] ` : ''}{m.label || '(ohne Bezeichnung)'}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
