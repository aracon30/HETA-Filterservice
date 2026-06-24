'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { downloadFile } from '@/lib/file-url'

interface Props {
  src: string
  fileName?: string
  alt?: string
  onClose: () => void
}

const MIN_SCALE = 1
const MAX_SCALE = 6

export default function ImageLightbox({ src, fileName, alt, onClose }: Props) {
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const dragOrigin = useRef({ mx: 0, my: 0, ox: 0, oy: 0 })
  const pinchOrigin = useRef<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const clamp = (v: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, v))

  const resetZoom = useCallback(() => {
    setScale(1)
    setOffset({ x: 0, y: 0 })
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  // Mouse wheel zoom
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const next = clamp(scale * (1 - e.deltaY * 0.001))
    setScale(next)
    if (next === MIN_SCALE) setOffset({ x: 0, y: 0 })
  }, [scale])

  // Mouse drag
  const onMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return
    e.preventDefault()
    setIsDragging(true)
    dragOrigin.current = { mx: e.clientX, my: e.clientY, ox: offset.x, oy: offset.y }
  }
  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    setOffset({
      x: dragOrigin.current.ox + e.clientX - dragOrigin.current.mx,
      y: dragOrigin.current.oy + e.clientY - dragOrigin.current.my,
    })
  }
  const onMouseUp = () => setIsDragging(false)

  // Touch pinch zoom + pan
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      pinchOrigin.current = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      )
    } else if (e.touches.length === 1 && scale > 1) {
      setIsDragging(true)
      dragOrigin.current = {
        mx: e.touches[0].clientX, my: e.touches[0].clientY,
        ox: offset.x, oy: offset.y,
      }
    }
  }
  const onTouchMove = (e: React.TouchEvent) => {
    e.preventDefault()
    if (e.touches.length === 2 && pinchOrigin.current !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      )
      const next = clamp(scale * (dist / pinchOrigin.current))
      setScale(next)
      pinchOrigin.current = dist
      if (next === MIN_SCALE) setOffset({ x: 0, y: 0 })
    } else if (e.touches.length === 1 && isDragging) {
      setOffset({
        x: dragOrigin.current.ox + e.touches[0].clientX - dragOrigin.current.mx,
        y: dragOrigin.current.oy + e.touches[0].clientY - dragOrigin.current.my,
      })
    }
  }
  const onTouchEnd = () => {
    pinchOrigin.current = null
    setIsDragging(false)
  }

  const handleDownload = async () => {
    setDownloading(true)
    await downloadFile(src, fileName)
    setDownloading(false)
  }

  const zoomIn = () => {
    const next = clamp(scale * 1.4)
    setScale(next)
  }
  const zoomOut = () => {
    const next = clamp(scale / 1.4)
    setScale(next)
    if (next <= 1) setOffset({ x: 0, y: 0 })
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90" onClick={onClose}>
      {/* Toolbar */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-4 py-3 bg-black/60 backdrop-blur-sm"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <button
            onClick={zoomOut}
            disabled={scale <= MIN_SCALE}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white disabled:opacity-30 transition-colors text-lg font-light"
            title="Verkleinern"
          >
            −
          </button>
          <button
            onClick={resetZoom}
            className="px-3 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors min-w-[52px]"
            title="Zurücksetzen"
          >
            {Math.round(scale * 100)}%
          </button>
          <button
            onClick={zoomIn}
            disabled={scale >= MAX_SCALE}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white disabled:opacity-30 transition-colors text-lg font-light"
            title="Vergrößern"
          >
            +
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center gap-1.5 px-3 h-8 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white rounded-lg text-xs font-medium transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {downloading ? 'Lädt...' : 'Download'}
          </button>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
            title="Schließen"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Image area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden flex items-center justify-center select-none"
        onClick={e => e.stopPropagation()}
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{ cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default', touchAction: 'none' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt ?? ''}
          style={{
            transform: `scale(${scale}) translate(${offset.x / scale}px, ${offset.y / scale}px)`,
            transition: isDragging ? 'none' : 'transform 0.15s ease',
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            userSelect: 'none',
            pointerEvents: 'none',
          }}
          draggable={false}
        />
      </div>

      {/* Hint */}
      {scale === 1 && (
        <div className="flex-shrink-0 text-center pb-3 text-white/30 text-xs pointer-events-none">
          Scrollen oder Pinch zum Zoomen · Klick außen zum Schließen
        </div>
      )}
    </div>
  )
}
