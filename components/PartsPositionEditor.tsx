'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { toFileUrl, isImageFile } from '@/lib/file-url'

interface Drawing {
  id: string
  title: string
  fileUrl: string
  mimeType: string | null
  markerSize: number | null
}

const DEFAULT_MARKER_SIZE = 28

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
  const [zoom, setZoom] = useState(1)
  const [containerWidth, setContainerWidth] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch(`/api/plants/${plantId}/documents`).then(r => r.json()),
      fetch(`/api/plants/${plantId}/parts-positions`).then(r => r.json()),
    ]).then(([docs, pos]) => {
      const drawingDocs: Drawing[] = (Array.isArray(docs) ? docs : [])
        .filter((d: { type: string; fileUrl: string; mimeType: string | null }) =>
          d.type === 'DRAWING' && isImageFile(d.fileUrl, d.mimeType))
        .map((d: { id: string; title: string; fileUrl: string; mimeType: string | null; markerSize: number | null }) => ({
          id: d.id, title: d.title, fileUrl: d.fileUrl, mimeType: d.mimeType, markerSize: d.markerSize,
        }))
      setDrawings(drawingDocs)
      setActiveDrawingId(prev => prev ?? drawingDocs[0]?.id ?? null)
      setPositions(Array.isArray(pos) ? pos : [])
      setLoading(false)
    })
  }, [plantId])

  // "1×" soll die ganze Zeichnung einpassen — dafür wird die tatsächlich sichtbare
  // Containerbreite gemessen; "2×"/"3×" sind Vielfache davon (nicht der Rohpixelgröße
  // des Bildes, die je nach Scan/Export viel größer als der verfügbare Platz sein kann).
  useEffect(() => {
    const measure = () => {
      if (containerRef.current) setContainerWidth(containerRef.current.clientWidth)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [activeDrawingId])

  const savableMaterials = useMemo(
    () => materials.filter((m): m is MaterialRef & { id: string } => !!m.id),
    [materials]
  )

  const activePositions = positions.filter(p => p.documentId === activeDrawingId)
  const activeDrawing = drawings.find(d => d.id === activeDrawingId)
  const markerSize = activeDrawing?.markerSize ?? DEFAULT_MARKER_SIZE

  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleMarkerSizeChange = (size: number) => {
    if (!activeDrawingId) return
    // Sofortige, optimistische Aktualisierung für flüssiges Ziehen am Regler,
    // aber nur verzögert (debounced) ans Backend senden statt bei jedem Zwischenwert.
    setDrawings(prev => prev.map(d => d.id === activeDrawingId ? { ...d, markerSize: size } : d))
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(() => {
      fetch(`/api/plants/${plantId}/documents/${activeDrawingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markerSize: size }),
      })
    }, 400)
  }

  const materialLabel = (materialId: string) => {
    const m = savableMaterials.find(m => m.id === materialId)
    return m ? (m.positionLabel || m.label) : '?'
  }

  const handleImageClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (!armedMaterialId || !activeDrawingId) return
    // Koordinaten relativ zum bildgroßen Wrapper (nicht zum scrollbaren Außencontainer) —
    // funktioniert dadurch unabhängig von Zoom-Stufe und Scroll-Position exakt.
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
        <div className="flex-1 min-w-0">
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
            <span className="text-[11px] text-gray-300 ml-1">Zum präzisen Setzen hineinzoomen, Bild ist scrollbar</span>
          </div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-[11px] text-gray-400">Markergröße:</span>
            <input
              type="range"
              min={12}
              max={80}
              step={2}
              value={markerSize}
              onChange={e => handleMarkerSizeChange(Number(e.target.value))}
              className="w-32 accent-blue-600"
            />
            <span className="text-[11px] text-gray-400 w-8">{markerSize}px</span>
            <span className="text-[11px] text-gray-300 ml-1">passend zur Beschriftungsgröße dieser Zeichnung</span>
          </div>
          <div ref={containerRef} className="border border-gray-200 rounded-lg overflow-auto" style={{ maxHeight: 520 }}>
            <div
              onClick={handleImageClick}
              className={`relative inline-block ${armedMaterialId ? 'cursor-crosshair' : ''}`}
            >
              {activeDrawing && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={toFileUrl(activeDrawing.fileUrl)}
                  alt={activeDrawing.title}
                  style={containerWidth ? { width: containerWidth * zoom, maxWidth: 'none' } : { width: '100%' }}
                  className="block select-none"
                  draggable={false}
                />
              )}
              {activePositions.map(p => (
                <button
                  key={p.id}
                  onClick={e => { e.stopPropagation(); if (confirm(`Position „${materialLabel(p.materialId)}“ entfernen?`)) removePosition(p.id) }}
                  style={{
                    left: `${p.positionX * 100}%`,
                    top: `${p.positionY * 100}%`,
                    width: markerSize * zoom,
                    height: markerSize * zoom,
                  }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-blue-600 bg-transparent hover:border-red-500 transition-colors"
                  title={`${materialLabel(p.materialId)} — Klicken zum Entfernen`}
                />
              ))}
            </div>
          </div>
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
