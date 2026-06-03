'use client'

import { useEffect, useState, useCallback, useMemo, Suspense } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Calendar, dateFnsLocalizer, View, SlotInfo } from 'react-big-calendar'
import withDragAndDrop, { EventInteractionArgs } from 'react-big-calendar/lib/addons/dragAndDrop'
import { format, parse, startOfWeek, getDay, addMinutes } from 'date-fns'
import { de } from 'date-fns/locale'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css'

// ─── Localizer ───────────────────────────────────────────────────────────────

const locales = { de }

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date: Date) => startOfWeek(date, { weekStartsOn: 1 }),
  getDay,
  locales,
})

// ─── Types ────────────────────────────────────────────────────────────────────

interface CalendarEvent {
  id: string
  orderNumber: string
  title: string
  start: Date
  end: Date
  status: string
  technicianName: string | null
  vehicle: string | null
  duration: number
  description: string | null
  customer: { name: string; address: string | null }
  plants: { name: string; location: string | null }[]
}

// ─── Drag & Drop Calendar ────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DnDCalendar = withDragAndDrop(Calendar as any)

// ─── Color Helpers ────────────────────────────────────────────────────────────

const TECH_COLORS = [
  { bg: '#3b82f6', text: '#ffffff' }, // blue
  { bg: '#22c55e', text: '#ffffff' }, // green
  { bg: '#a855f7', text: '#ffffff' }, // purple
  { bg: '#f97316', text: '#ffffff' }, // orange
  { bg: '#ec4899', text: '#ffffff' }, // pink
  { bg: '#14b8a6', text: '#ffffff' }, // teal
  { bg: '#ef4444', text: '#ffffff' }, // red
  { bg: '#6366f1', text: '#ffffff' }, // indigo
]

function hashTechColor(name: string | null) {
  if (!name) return TECH_COLORS[0]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) & 0xffffffff
  }
  return TECH_COLORS[Math.abs(hash) % TECH_COLORS.length]
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  PLANNED: 'Geplant',
  IN_PROGRESS: 'In Bearbeitung',
  COMPLETED: 'Abgeschlossen',
  CANCELLED: 'Storniert',
}

const STATUS_BADGE: Record<string, string> = {
  PLANNED: 'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-gray-100 text-gray-600',
}

// ─── Format helpers ───────────────────────────────────────────────────────────

function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} Min.`
  if (m === 0) return `${h} Std.`
  return `${h} Std. ${m} Min.`
}

// ─── Internal roles ───────────────────────────────────────────────────────────

const DRAG_ROLES = ['ADMIN', 'SERVICE_MANAGER', 'SERVICE_TECHNICIAN']

// ─── Calendar Messages (German) ───────────────────────────────────────────────

const messages = {
  allDay: 'Ganztägig',
  previous: '‹',
  next: '›',
  today: 'Heute',
  month: 'Monat',
  week: 'Woche',
  day: 'Tag',
  agenda: 'Agenda',
  date: 'Datum',
  time: 'Uhrzeit',
  event: 'Einsatz',
  noEventsInRange: 'Keine Einsätze in diesem Zeitraum.',
  showMore: (total: number) => `+${total} weitere`,
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function JobCalendar() {
  const { data: session } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>('week')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [filterTechnician, setFilterTechnician] = useState('ALL')
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)

  const role = session?.user?.role as string | undefined
  const canDrag = role ? DRAG_ROLES.includes(role) : false

  // Compute visible date range
  const { rangeStart, rangeEnd } = useMemo(() => {
    const d = currentDate
    if (view === 'month') {
      const start = new Date(d.getFullYear(), d.getMonth(), 1)
      start.setDate(start.getDate() - 7)
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0)
      end.setDate(end.getDate() + 7)
      return { rangeStart: start, rangeEnd: end }
    }
    if (view === 'week') {
      const start = startOfWeek(d, { weekStartsOn: 1 })
      const end = new Date(start)
      end.setDate(end.getDate() + 6)
      end.setHours(23, 59, 59)
      return { rangeStart: start, rangeEnd: end }
    }
    // day
    const start = new Date(d)
    start.setHours(0, 0, 0)
    const end = new Date(d)
    end.setHours(23, 59, 59)
    return { rangeStart: start, rangeEnd: end }
  }, [view, currentDate])

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set('from', rangeStart.toISOString())
    params.set('to', rangeEnd.toISOString())
    if (filterTechnician !== 'ALL') params.set('technician', filterTechnician)
    if (filterStatus !== 'ALL') params.set('status', filterStatus)

    try {
      const res = await fetch(`/api/calendar?${params}`)
      if (!res.ok) throw new Error('Fetch failed')
      const data = await res.json()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setEvents(data.map((e: Record<string, any>) => ({
        ...e,
        start: new Date(e.start),
        end: new Date(e.end),
      })))
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [rangeStart, rangeEnd, filterTechnician, filterStatus])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  // Pre-fill date from query param if coming from calendar
  useEffect(() => {
    const dateParam = searchParams.get('date')
    if (dateParam) {
      setCurrentDate(new Date(dateParam))
      setView('day')
    }
  }, [searchParams])

  // Collect unique technician names for filter dropdown
  const technicianOptions = useMemo(() => {
    const names = events
      .map((e) => e.technicianName)
      .filter((n): n is string => !!n)
    return Array.from(new Set(names)).sort()
  }, [events])

  // Event style per technician / status
  const eventPropGetter = useCallback((event: CalendarEvent) => {
    if (event.status === 'CANCELLED') {
      return {
        style: {
          backgroundColor: '#e5e7eb',
          color: '#6b7280',
          textDecoration: 'line-through',
          borderColor: '#d1d5db',
        },
      }
    }
    if (event.status === 'COMPLETED') {
      return {
        style: {
          backgroundColor: '#d1d5db',
          color: '#6b7280',
          borderColor: '#9ca3af',
          opacity: 0.75,
        },
      }
    }
    const color = hashTechColor(event.technicianName)
    return {
      style: {
        backgroundColor: color.bg,
        color: color.text,
        borderColor: color.bg,
      },
    }
  }, [])

  // Custom event component
  const EventComponent = useCallback(({ event }: { event: CalendarEvent }) => (
    <div className="text-xs leading-tight px-0.5 overflow-hidden h-full">
      <div className="font-semibold truncate">{event.customer.name}</div>
      {event.technicianName && (
        <div className="opacity-90 truncate">{event.technicianName}</div>
      )}
      {event.vehicle && (
        <div className="opacity-80 truncate">{event.vehicle}</div>
      )}
    </div>
  ), [])

  // Drag & Drop handlers
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleEventDrop = useCallback(async (args: Record<string, any>) => {
    const { event, start, end } = args as EventInteractionArgs<CalendarEvent>
    const newStart = start instanceof Date ? start : new Date(start)
    const newEnd = end instanceof Date ? end : new Date(end)
    const durationMs = newEnd.getTime() - newStart.getTime()
    const newDuration = Math.round(durationMs / 60000)

    // Optimistic update
    setEvents((prev) =>
      prev.map((e) =>
        e.id === event.id
          ? { ...e, start: newStart, end: addMinutes(newStart, newDuration) }
          : e
      )
    )

    try {
      const res = await fetch('/api/calendar', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: event.id,
          scheduledAt: newStart.toISOString(),
          duration: newDuration,
        }),
      })
      if (!res.ok) throw new Error('Update failed')
    } catch {
      // Revert
      setEvents((prev) =>
        prev.map((e) =>
          e.id === event.id ? { ...e, start: event.start, end: event.end } : e
        )
      )
    }
  }, [])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleEventResize = useCallback(async (args: Record<string, any>) => {
    await handleEventDrop(args)
  }, [handleEventDrop])

  // Click on empty slot → new job
  const handleSelectSlot = useCallback((slotInfo: SlotInfo) => {
    const date = slotInfo.start instanceof Date ? slotInfo.start : new Date(slotInfo.start)
    router.push(`/jobs/new?date=${date.toISOString()}`)
  }, [router])

  // Navigation
  const handleNavigate = (date: Date) => setCurrentDate(date)
  const handleViewChange = (newView: View) => setView(newView)

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>

          <p className="text-sm text-gray-500 mt-0.5">Kalenderübersicht aller Serviceeinsätze</p>
        </div>
        <Link
          href="/jobs/new"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Neuer Einsatz
        </Link>
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3 flex flex-wrap gap-3 items-center">
        {/* View switcher */}
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
          {(['day', 'week', 'month'] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-4 py-1.5 font-medium transition-colors ${
                view === v
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {v === 'day' ? 'Tag' : v === 'week' ? 'Woche' : 'Monat'}
            </button>
          ))}
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              const d = new Date(currentDate)
              if (view === 'day') d.setDate(d.getDate() - 1)
              else if (view === 'week') d.setDate(d.getDate() - 7)
              else d.setMonth(d.getMonth() - 1)
              setCurrentDate(d)
            }}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Heute
          </button>
          <button
            onClick={() => {
              const d = new Date(currentDate)
              if (view === 'day') d.setDate(d.getDate() + 1)
              else if (view === 'week') d.setDate(d.getDate() + 7)
              else d.setMonth(d.getMonth() + 1)
              setCurrentDate(d)
            }}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Current date label */}
        <span className="text-sm font-medium text-gray-700">
          {view === 'month'
            ? currentDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
            : view === 'week'
            ? (() => {
                const ws = startOfWeek(currentDate, { weekStartsOn: 1 })
                const we = new Date(ws); we.setDate(we.getDate() + 6)
                return `${ws.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })} – ${we.toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })}`
              })()
            : currentDate.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
        </span>

        <div className="flex-1" />

        {/* Technician filter */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Techniker:</label>
          <select
            value={filterTechnician}
            onChange={(e) => setFilterTechnician(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">Alle</option>
            {technicianOptions.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Status:</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">Alle</option>
            <option value="PLANNED">Geplant</option>
            <option value="IN_PROGRESS">In Bearbeitung</option>
            <option value="COMPLETED">Abgeschlossen</option>
            <option value="CANCELLED">Storniert</option>
          </select>
        </div>

        {loading && (
          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      {/* Calendar */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex-1 overflow-hidden" style={{ minHeight: 600 }}>
        <style>{`
          .rbc-calendar { font-family: inherit; }
          .rbc-header { padding: 8px 4px; font-weight: 600; font-size: 0.8rem; color: #374151; }
          .rbc-time-header-cell { font-size: 0.8rem; }
          .rbc-today { background-color: #eff6ff !important; }
          .rbc-current-time-indicator { background-color: #3b82f6; height: 2px; }
          .rbc-event { border-radius: 4px !important; border: none !important; }
          .rbc-event:focus { outline: none; }
          .rbc-slot-selection { background: #dbeafe; opacity: 0.5; }
          .rbc-time-slot { min-height: 30px; }
        `}</style>
        <DnDCalendar
          localizer={localizer}
          events={events}
          view={view}
          date={currentDate}
          onNavigate={handleNavigate}
          onView={handleViewChange}
          onSelectEvent={(event) => setSelectedEvent(event as CalendarEvent)}
          onSelectSlot={handleSelectSlot}
          onEventDrop={canDrag ? handleEventDrop : undefined}
          onEventResize={canDrag ? handleEventResize : undefined}
          selectable
          resizable={canDrag}
          draggableAccessor={() => canDrag}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          eventPropGetter={eventPropGetter as any}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          components={{ event: EventComponent as any }}
          messages={messages}
          culture="de"
          min={new Date(2000, 0, 1, 6, 0)}
          max={new Date(2000, 0, 1, 20, 0)}
          step={15}
          timeslots={4}
          className="h-full"
          style={{ height: '100%', minHeight: 600, padding: '0 4px 4px' }}
          popup
          showMultiDayTimes
        />
      </div>

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedEvent(null) }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 pt-6 pb-4 border-b border-gray-100">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-lg font-bold text-gray-900">{selectedEvent.orderNumber}</span>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_BADGE[selectedEvent.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {STATUS_LABELS[selectedEvent.status] ?? selectedEvent.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">{selectedEvent.customer.name}</p>
                </div>
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                {/* Customer */}
                <div>
                  <p className="text-gray-500 text-xs font-medium uppercase tracking-wide mb-1">Kunde</p>
                  <p className="text-gray-900 font-medium">{selectedEvent.customer.name}</p>
                  {selectedEvent.customer.address && (
                    <p className="text-gray-500 text-xs mt-0.5">{selectedEvent.customer.address}</p>
                  )}
                </div>

                {/* Plants */}
                {selectedEvent.plants.length > 0 ? (
                  <div>
                    <p className="text-gray-500 text-xs font-medium uppercase tracking-wide mb-1">Anlagen</p>
                    {selectedEvent.plants.map((p, i) => (
                      <div key={i}>
                        <p className="text-gray-900 font-medium">{p.name}</p>
                        {p.location && <p className="text-gray-500 text-xs mt-0.5">{p.location}</p>}
                      </div>
                    ))}
                  </div>
                ) : <div />}

                {/* Technician */}
                {selectedEvent.technicianName && (
                  <div>
                    <p className="text-gray-500 text-xs font-medium uppercase tracking-wide mb-1">Techniker</p>
                    <p className="text-gray-900 font-medium">{selectedEvent.technicianName}</p>
                  </div>
                )}

                {/* Vehicle */}
                {selectedEvent.vehicle && (
                  <div>
                    <p className="text-gray-500 text-xs font-medium uppercase tracking-wide mb-1">Fahrzeug</p>
                    <p className="text-gray-900 font-medium">{selectedEvent.vehicle}</p>
                  </div>
                )}

                {/* Date & Time */}
                <div>
                  <p className="text-gray-500 text-xs font-medium uppercase tracking-wide mb-1">Datum</p>
                  <p className="text-gray-900 font-medium">
                    {selectedEvent.start.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: 'long', year: 'numeric' })}
                  </p>
                </div>

                <div>
                  <p className="text-gray-500 text-xs font-medium uppercase tracking-wide mb-1">Uhrzeit & Dauer</p>
                  <p className="text-gray-900 font-medium">
                    {selectedEvent.start.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
                  </p>
                  <p className="text-gray-500 text-xs mt-0.5">{formatDuration(selectedEvent.duration)}</p>
                </div>
              </div>

              {/* Description */}
              {selectedEvent.description && (
                <div>
                  <p className="text-gray-500 text-xs font-medium uppercase tracking-wide mb-1">Beschreibung</p>
                  <p className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2">{selectedEvent.description}</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 pb-6 flex gap-3 justify-end">
              <button
                onClick={() => setSelectedEvent(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Schließen
              </button>
              <Link
                href={`/jobs/${selectedEvent.id}`}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                onClick={() => setSelectedEvent(null)}
              >
                Zum Einsatz →
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
