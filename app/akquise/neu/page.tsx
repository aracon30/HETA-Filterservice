'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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

interface Customer {
  id: string
  name: string
  address: string | null
}

interface Site {
  id: string
  name: string
  address: string | null
  city: string | null
}

const emptyPlant = (): AcquisitionPlant => ({
  types: [],
  manufacturer: '',
  buildYear: '',
  serialNumber: '',
  modelDesignation: '',
  nominalPower: '',
  operatingPressure: '',
  flowRate: '',
  medium: '',
  operatingHours: '',
  wasModified: '',
  hasDocumentation: '',
  sparePartsAvailable: '',
  installationType: '',
  environmentalConditions: [],
  lastServiceAge: '',
  maintainedBy: '',
  condition: 0,
  problems: [],
  problemNote: '',
  priorities: [],
  urgency: '',
  customerNote: '',
  additionalInfo: '',
  photos: [],
})

type WizardStep =
  | { kind: 'customer' }
  | { kind: 'site_select' }
  | { kind: 'plant_count' }
  | { kind: 'plant_types' }
  | { kind: 'plant_base'; plantIndex: number }
  | { kind: 'plant_condition'; plantIndex: number }
  | { kind: 'plant_voice'; plantIndex: number }
  | { kind: 'overall' }
  | { kind: 'summary' }

function buildSteps(plantCount: number): WizardStep[] {
  const steps: WizardStep[] = [
    { kind: 'customer' },
    { kind: 'site_select' },
    { kind: 'plant_count' },
    { kind: 'plant_types' },
  ]
  for (let i = 0; i < plantCount; i++) {
    steps.push({ kind: 'plant_base', plantIndex: i })
    steps.push({ kind: 'plant_condition', plantIndex: i })
    steps.push({ kind: 'plant_voice', plantIndex: i })
  }
  steps.push({ kind: 'overall' })
  steps.push({ kind: 'summary' })
  return steps
}

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1 mb-6">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full flex-1 transition-all ${
            i < current ? 'bg-blue-600' : i === current ? 'bg-blue-400' : 'bg-slate-200'
          }`}
        />
      ))}
    </div>
  )
}

function ConditionStars({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const labels = ['', 'Kritisch', 'Schlecht', 'Mittel', 'Gut', 'Sehr gut']
  return (
    <div className="space-y-2">
      {[5, 4, 3, 2, 1].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border-2 text-left transition-all ${
            value === star
              ? 'border-blue-500 bg-blue-50'
              : 'border-slate-200 hover:border-slate-300 bg-white'
          }`}
        >
          <span className="text-yellow-400 text-lg">{'★'.repeat(star)}{'☆'.repeat(5 - star)}</span>
          <span className="text-sm font-medium text-slate-700">{labels[star]}</span>
        </button>
      ))}
    </div>
  )
}

function RadioGroup({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="space-y-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border-2 text-left transition-all ${
            value === opt.value
              ? 'border-blue-500 bg-blue-50'
              : 'border-slate-200 hover:border-slate-300 bg-white'
          }`}
        >
          <span
            className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
              value === opt.value ? 'border-blue-500 bg-blue-500' : 'border-slate-300'
            }`}
          />
          <span className="text-sm text-slate-700">{opt.label}</span>
        </button>
      ))}
    </div>
  )
}

function CheckboxGroup({
  options,
  values,
  onChange,
}: {
  options: { value: string; label: string }[]
  values: string[]
  onChange: (v: string[]) => void
}) {
  const toggle = (val: string) => {
    if (values.includes(val)) onChange(values.filter((v) => v !== val))
    else onChange([...values, val])
  }
  return (
    <div className="space-y-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => toggle(opt.value)}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border-2 text-left transition-all ${
            values.includes(opt.value)
              ? 'border-blue-500 bg-blue-50'
              : 'border-slate-200 hover:border-slate-300 bg-white'
          }`}
        >
          <span
            className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center ${
              values.includes(opt.value) ? 'border-blue-500 bg-blue-500' : 'border-slate-300'
            }`}
          >
            {values.includes(opt.value) && (
              <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </span>
          <span className="text-sm text-slate-700">{opt.label}</span>
        </button>
      ))}
    </div>
  )
}

function PhotoUpload({ photos, onChange }: { photos: string[]; onChange: (p: string[]) => void }) {
  const [uploading, setUploading] = useState(false)

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploading(true)
    const newUrls: string[] = []
    for (const file of Array.from(files)) {
      const form = new FormData()
      form.append('file', file)
      try {
        const res = await fetch('/api/upload', { method: 'POST', body: form })
        if (res.ok) {
          const data = await res.json()
          newUrls.push(data.url)
        }
      } catch { /* skip failed uploads */ }
    }
    onChange([...photos, ...newUrls])
    setUploading(false)
  }

  const removePhoto = (url: string) => onChange(photos.filter((p) => p !== url))

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-700">Fotos <span className="font-normal text-slate-400">(optional)</span></label>
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((url) => (
            <div key={url} className="relative rounded-lg overflow-hidden aspect-square bg-slate-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => removePhoto(url)}
                className="absolute top-1 right-1 w-5 h-5 bg-red-600 text-white rounded-full flex items-center justify-center text-xs"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <label className={`flex items-center justify-center gap-2 border-2 border-dashed rounded-xl px-4 py-4 cursor-pointer transition-colors ${uploading ? 'border-slate-200 bg-slate-50' : 'border-slate-300 hover:border-blue-400 hover:bg-blue-50'}`}>
        <input
          type="file"
          accept="image/*"
          multiple
          capture="environment"
          className="sr-only"
          onChange={(e) => handleFiles(e.target.files)}
          disabled={uploading}
        />
        {uploading ? (
          <span className="text-sm text-slate-400">Wird hochgeladen...</span>
        ) : (
          <>
            <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-sm text-slate-500">Foto aufnehmen oder auswählen</span>
          </>
        )}
      </label>
    </div>
  )
}

const PLANT_COUNT_OPTIONS = [
  { value: 1, label: '1 Anlage' },
  { value: 2, label: '2 Anlagen' },
  { value: 3, label: '3 Anlagen' },
  { value: 4, label: '4 Anlagen' },
  { value: 5, label: '5 Anlagen' },
  { value: 6, label: '6–10 Anlagen' },
  { value: 11, label: 'Mehr als 10 Anlagen' },
]

function AcquisitionWizard() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedCustomerId = searchParams.get('customerId')

  const [customers, setCustomers] = useState<Customer[]>([])
  const [customerSearch, setCustomerSearch] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [sites, setSites] = useState<Site[]>([])
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null)

  const [plantCount, setPlantCount] = useState(0)
  const [plants, setPlants] = useState<AcquisitionPlant[]>([])
  const [mood, setMood] = useState('')
  const [nextStep, setNextStep] = useState('')
  const [note, setNote] = useState('')

  const [stepIndex, setStepIndex] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const steps = buildSteps(plantCount)
  const currentStep = steps[stepIndex]

  useEffect(() => {
    fetch('/api/customers')
      .then((r) => r.json())
      .then((data) => {
        setCustomers(data)
        if (preselectedCustomerId) {
          const found = data.find((c: Customer) => c.id === preselectedCustomerId)
          if (found) {
            setSelectedCustomer(found)
            setStepIndex(1)
          }
        }
      })
  }, [preselectedCustomerId])

  useEffect(() => {
    if (!selectedCustomer) { setSites([]); setSelectedSiteId(null); return }
    fetch(`/api/sites?customerId=${selectedCustomer.id}`)
      .then((r) => r.json())
      .then((data) => setSites(Array.isArray(data) ? data : []))
  }, [selectedCustomer])

  const updatePlant = useCallback((index: number, patch: Partial<AcquisitionPlant>) => {
    setPlants((prev) => {
      const copy = [...prev]
      copy[index] = { ...copy[index], ...patch }
      return copy
    })
  }, [])

  const handlePlantCountSelect = (count: number) => {
    setPlantCount(count)
    setPlants(Array.from({ length: count }, () => emptyPlant()))
  }

  const canProceed = (): boolean => {
    if (!currentStep) return false
    if (currentStep.kind === 'customer') return !!selectedCustomer
    if (currentStep.kind === 'plant_count') return plantCount > 0
    if (currentStep.kind === 'plant_types') {
      return plants.every((p) => p.types.length > 0)
    }
    if (currentStep.kind === 'plant_base') return true
    if (currentStep.kind === 'plant_condition') {
      return plants[currentStep.plantIndex]?.condition > 0
    }
    if (currentStep.kind === 'plant_voice') return true
    if (currentStep.kind === 'overall') return !!mood && !!nextStep
    return true
  }

  const next = () => {
    if (stepIndex < steps.length - 1) setStepIndex(stepIndex + 1)
  }

  const back = () => {
    if (stepIndex > 0) setStepIndex(stepIndex - 1)
  }

  const handleSubmit = async () => {
    if (!selectedCustomer) return
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/acquisition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomer.id,
          siteId: selectedSiteId,
          plants,
          mood,
          nextStep,
          note,
        }),
      })
      if (!res.ok) throw new Error('Fehler beim Speichern')
      const data = await res.json()
      router.push(`/akquise/${data.id}`)
    } catch {
      setError('Fehler beim Speichern. Bitte erneut versuchen.')
      setSubmitting(false)
    }
  }

  const filteredCustomers = customers.filter((c) =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase())
  )

  const plantTypeLabel = (types: string[]) =>
    types.map((t) => ACQUISITION_PLANT_TYPES.find((p) => p.value === t)?.label ?? t).join(' + ')

  const conditionLabel = (v: number) =>
    ['', 'Kritisch ★', 'Schlecht ★★', 'Mittel ★★★', 'Gut ★★★★', 'Sehr gut ★★★★★'][v] ?? ''

  // --- Render steps ---

  const renderStep = () => {
    if (!currentStep) return null

    if (currentStep.kind === 'customer') {
      return (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Kunde auswählen</h2>
            <p className="text-sm text-slate-500 mt-1">Wähle den Kunden aus dem Kundenstamm.</p>
          </div>
          <input
            type="text"
            placeholder="Kundenname suchen..."
            value={customerSearch}
            onChange={(e) => setCustomerSearch(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {filteredCustomers.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedCustomer(c)}
                className={`w-full flex flex-col px-4 py-3 rounded-lg border-2 text-left transition-all ${
                  selectedCustomer?.id === c.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <span className="font-medium text-slate-800 text-sm">{c.name}</span>
                {c.address && <span className="text-xs text-slate-500 mt-0.5">{c.address}</span>}
              </button>
            ))}
            {filteredCustomers.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">Keine Kunden gefunden.</p>
            )}
          </div>
        </div>
      )
    }

    if (currentStep.kind === 'site_select') {
      return (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Standort</h2>
            <p className="text-sm text-slate-500 mt-1">
              Wähle den Standort bei <strong>{selectedCustomer?.name}</strong> — oder überspringe diesen Schritt.
            </p>
          </div>

          {sites.length === 0 ? (
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-5 text-center">
              <p className="text-sm text-slate-500">Für diesen Kunden sind keine Standorte angelegt.</p>
              <p className="text-xs text-slate-400 mt-1">Kann nach dem Check im Kundenprofil ergänzt werden.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setSelectedSiteId(null)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border-2 text-left transition-all ${
                  selectedSiteId === null
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${selectedSiteId === null ? 'border-blue-500 bg-blue-500' : 'border-slate-300'}`} />
                <span className="text-sm text-slate-500 italic">Kein Standort gewählt</span>
              </button>
              {sites.map((site) => (
                <button
                  key={site.id}
                  type="button"
                  onClick={() => setSelectedSiteId(site.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border-2 text-left transition-all ${
                    selectedSiteId === site.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${selectedSiteId === site.id ? 'border-blue-500 bg-blue-500' : 'border-slate-300'}`} />
                  <span className="flex flex-col">
                    <span className="text-sm font-medium text-slate-800">{site.name}</span>
                    {(site.address || site.city) && (
                      <span className="text-xs text-slate-500">{[site.address, site.city].filter(Boolean).join(', ')}</span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )
    }

    if (currentStep.kind === 'plant_count') {
      return (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Wie viele Anlagen?</h2>
            <p className="text-sm text-slate-500 mt-1">
              Wie viele Anlagen gibt es bei <strong>{selectedCustomer?.name}</strong>?
            </p>
          </div>
          <div className="space-y-2">
            {PLANT_COUNT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handlePlantCountSelect(opt.value > 10 ? 10 : opt.value)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border-2 text-left transition-all ${
                  (opt.value > 10 ? plantCount >= 10 : plantCount === opt.value)
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                    (opt.value > 10 ? plantCount >= 10 : plantCount === opt.value)
                      ? 'border-blue-500 bg-blue-500'
                      : 'border-slate-300'
                  }`}
                />
                <span className="text-sm text-slate-700">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>
      )
    }

    if (currentStep.kind === 'plant_types') {
      return (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Anlagentypen</h2>
            <p className="text-sm text-slate-500 mt-1">
              Wähle für jede Anlage den Typ. Mehrere Typen je Anlage möglich.
            </p>
          </div>
          <div className="space-y-6">
            {plants.map((plant, i) => (
              <div key={i}>
                <p className="text-sm font-semibold text-slate-700 mb-2">Anlage {i + 1}</p>
                <div className="grid grid-cols-1 gap-1.5">
                  {ACQUISITION_PLANT_TYPES.map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => {
                        const current = plant.types
                        const updated = current.includes(type.value)
                          ? current.filter((t) => t !== type.value)
                          : [...current, type.value]
                        updatePlant(i, { types: updated })
                      }}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border-2 text-left transition-all ${
                        plant.types.includes(type.value)
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <span
                        className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center ${
                          plant.types.includes(type.value)
                            ? 'border-blue-500 bg-blue-500'
                            : 'border-slate-300'
                        }`}
                      >
                        {plant.types.includes(type.value) && (
                          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </span>
                      <span className="text-sm text-slate-700">{type.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )
    }

    if (currentStep.kind === 'plant_base') {
      const i = currentStep.plantIndex
      const plant = plants[i]
      const showMaintainedBy =
        plant.lastServiceAge && plant.lastServiceAge !== 'never' && plant.lastServiceAge !== 'unknown'

      return (
        <div className="space-y-5">
          <div>
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">
              Anlage {i + 1} — {plantTypeLabel(plant.types) || 'Unbekannt'}
            </p>
            <h2 className="text-xl font-bold text-slate-800 mt-0.5">Basisdaten</h2>
          </div>

          {/* Identifikation */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Identifikation</p>
            {[
              { label: 'Hersteller', key: 'manufacturer', placeholder: 'z.B. Mann+Hummel' },
              { label: 'Modellbezeichnung / Typ', key: 'modelDesignation', placeholder: 'z.B. HF-3000' },
              { label: 'Baujahr', key: 'buildYear', placeholder: 'z.B. 2015' },
              { label: 'Seriennummer', key: 'serialNumber', placeholder: 'z.B. SN-12345' },
            ].map(({ label, key, placeholder }) => (
              <div key={key}>
                <label className="block text-sm font-medium text-slate-700 mb-1">{label} <span className="font-normal text-slate-400">(optional)</span></label>
                <input
                  type="text"
                  value={(plant as unknown as Record<string, string>)[key] ?? ''}
                  onChange={(e) => updatePlant(i, { [key]: e.target.value } as Partial<AcquisitionPlant>)}
                  className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={placeholder}
                />
              </div>
            ))}
          </div>

          {/* Technische Daten */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Technische Daten</p>
            {[
              { label: 'Nennleistung / Motorleistung', key: 'nominalPower', placeholder: 'z.B. 7,5 kW' },
              { label: 'Betriebsdruck', key: 'operatingPressure', placeholder: 'z.B. 6 bar' },
              { label: 'Durchflussrate', key: 'flowRate', placeholder: 'z.B. 50 m³/h' },
              { label: 'Medium', key: 'medium', placeholder: 'z.B. Wasser, Öl, Druckluft...' },
              { label: 'Betriebsstunden', key: 'operatingHours', placeholder: 'z.B. 12.000 h' },
            ].map(({ label, key, placeholder }) => (
              <div key={key}>
                <label className="block text-sm font-medium text-slate-700 mb-1">{label} <span className="font-normal text-slate-400">(optional)</span></label>
                <input
                  type="text"
                  value={(plant as unknown as Record<string, string>)[key] ?? ''}
                  onChange={(e) => updatePlant(i, { [key]: e.target.value } as Partial<AcquisitionPlant>)}
                  className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={placeholder}
                />
              </div>
            ))}
          </div>

          {/* Zustand & Historie */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Zustand & Historie</p>
            {[
              { label: 'Anlage jemals umgebaut / modifiziert?', key: 'wasModified' },
              { label: 'Originaldokumentation / Handbuch vorhanden?', key: 'hasDocumentation' },
              { label: 'Ersatzteile noch beschaffbar?', key: 'sparePartsAvailable' },
            ].map(({ label, key }) => (
              <div key={key}>
                <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
                <RadioGroup
                  options={YES_NO_UNKNOWN}
                  value={(plant as unknown as Record<string, string>)[key] ?? ''}
                  onChange={(v) => updatePlant(i, { [key]: v } as Partial<AcquisitionPlant>)}
                />
              </div>
            ))}
          </div>

          {/* Aufstellort */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Aufstellort</p>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Aufstellungsart</label>
              <RadioGroup
                options={INSTALLATION_TYPE_OPTIONS}
                value={plant.installationType}
                onChange={(v) => updatePlant(i, { installationType: v })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Besondere Umgebungsbedingungen <span className="font-normal text-slate-400">(Mehrfachauswahl)</span>
              </label>
              <CheckboxGroup
                options={ENVIRONMENTAL_CONDITIONS}
                values={plant.environmentalConditions}
                onChange={(v) => updatePlant(i, { environmentalConditions: v })}
              />
            </div>
          </div>

          {/* Service */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Servicehistorie</p>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Letzter bekannter Service</label>
              <RadioGroup
                options={LAST_SERVICE_OPTIONS}
                value={plant.lastServiceAge}
                onChange={(v) => updatePlant(i, { lastServiceAge: v, maintainedBy: '' })}
              />
            </div>
            {showMaintainedBy && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Wartung durchgeführt durch</label>
                <RadioGroup
                  options={MAINTAINED_BY_OPTIONS}
                  value={plant.maintainedBy}
                  onChange={(v) => updatePlant(i, { maintainedBy: v })}
                />
              </div>
            )}
          </div>

          {/* Zusatzinfos & Fotos */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Zusatzinformationen & Fotos</p>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Weitere Informationen <span className="font-normal text-slate-400">(optional)</span></label>
              <textarea
                value={plant.additionalInfo}
                onChange={(e) => updatePlant(i, { additionalInfo: e.target.value })}
                rows={3}
                className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="Besonderheiten, Auffälligkeiten, sonstige Beobachtungen..."
              />
            </div>
            <PhotoUpload
              photos={plant.photos}
              onChange={(photos) => updatePlant(i, { photos })}
            />
          </div>
        </div>
      )
    }

    if (currentStep.kind === 'plant_condition') {
      const i = currentStep.plantIndex
      const plant = plants[i]
      const problemOptions = getProblemsForTypes(plant.types)

      return (
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">
              Anlage {i + 1} — {plantTypeLabel(plant.types) || 'Unbekannt'}
            </p>
            <h2 className="text-xl font-bold text-slate-800 mt-0.5">Zustand & Probleme</h2>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Sichtbarer Zustand</label>
            <ConditionStars value={plant.condition} onChange={(v) => updatePlant(i, { condition: v })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Bekannte Probleme <span className="font-normal text-slate-400">(Mehrfachauswahl)</span>
            </label>
            <CheckboxGroup
              options={[...problemOptions, { value: 'none', label: 'Keine bekannten Probleme' }]}
              values={plant.problems}
              onChange={(v) => updatePlant(i, { problems: v })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Kundenaussage (wörtlich)</label>
            <textarea
              value={plant.problemNote}
              onChange={(e) => updatePlant(i, { problemNote: e.target.value })}
              rows={3}
              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Was sagt der Kunde über das Problem? Möglichst wörtlich festhalten..."
            />
          </div>
        </div>
      )
    }

    if (currentStep.kind === 'plant_voice') {
      const i = currentStep.plantIndex
      const plant = plants[i]

      return (
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">
              Anlage {i + 1} — {plantTypeLabel(plant.types) || 'Unbekannt'}
            </p>
            <h2 className="text-xl font-bold text-slate-800 mt-0.5">Kundenstimme</h2>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Was ist dem Kunden bei dieser Anlage am wichtigsten?{' '}
              <span className="font-normal text-slate-400">(Mehrfachauswahl)</span>
            </label>
            <CheckboxGroup
              options={PRIORITY_OPTIONS}
              values={plant.priorities}
              onChange={(v) => updatePlant(i, { priorities: v })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Wie dringend sieht der Kunde Handlungsbedarf?</label>
            <RadioGroup
              options={URGENCY_OPTIONS}
              value={plant.urgency}
              onChange={(v) => updatePlant(i, { urgency: v })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Gesprächsnotiz</label>
            <textarea
              value={plant.customerNote}
              onChange={(e) => updatePlant(i, { customerNote: e.target.value })}
              rows={3}
              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Beobachtungen, Stimmung, Zitate des Kunden..."
            />
          </div>
        </div>
      )
    }

    if (currentStep.kind === 'overall') {
      return (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Gesamteindruck</h2>
            <p className="text-sm text-slate-500 mt-1">Wie war das Gespräch insgesamt?</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Gesprächsatmosphäre</label>
            <RadioGroup options={MOOD_OPTIONS} value={mood} onChange={setMood} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Nächster Schritt aus Kundensicht</label>
            <RadioGroup options={NEXT_STEP_OPTIONS} value={nextStep} onChange={setNextStep} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Abschlussnotiz</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Allgemeine Beobachtungen, offene Punkte, interne Notizen..."
            />
          </div>
        </div>
      )
    }

    if (currentStep.kind === 'summary') {
      const moodLabel = MOOD_OPTIONS.find((m) => m.value === mood)?.label ?? mood
      const nextStepLabel = NEXT_STEP_OPTIONS.find((n) => n.value === nextStep)?.label ?? nextStep

      return (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Zusammenfassung</h2>
            <p className="text-sm text-slate-500 mt-1">Alles prüfen und dann speichern.</p>
          </div>

          <div className="bg-slate-50 rounded-xl p-4 space-y-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Kunde</p>
            <p className="font-semibold text-slate-800">{selectedCustomer?.name}</p>
            {selectedCustomer?.address && (
              <p className="text-sm text-slate-500">{selectedCustomer.address}</p>
            )}
          </div>

          {plants.map((plant, i) => (
            <div key={i} className="bg-slate-50 rounded-xl p-4 space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Anlage {i + 1} — {plantTypeLabel(plant.types)}
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                {plant.manufacturer && (
                  <>
                    <span className="text-slate-500">Hersteller</span>
                    <span className="text-slate-800">{plant.manufacturer}</span>
                  </>
                )}
                {plant.buildYear && (
                  <>
                    <span className="text-slate-500">Baujahr</span>
                    <span className="text-slate-800">{plant.buildYear}</span>
                  </>
                )}
                {plant.condition > 0 && (
                  <>
                    <span className="text-slate-500">Zustand</span>
                    <span className="text-slate-800">{conditionLabel(plant.condition)}</span>
                  </>
                )}
                {plant.urgency && (
                  <>
                    <span className="text-slate-500">Dringlichkeit</span>
                    <span className="text-slate-800">
                      {URGENCY_OPTIONS.find((u) => u.value === plant.urgency)?.label}
                    </span>
                  </>
                )}
              </div>
              {plant.problems.length > 0 && (
                <p className="text-sm text-slate-600">
                  <span className="font-medium">Probleme:</span>{' '}
                  {plant.problems
                    .map(
                      (p) =>
                        getProblemsForTypes(plant.types).find((pr) => pr.value === p)?.label ??
                        (p === 'none' ? 'Keine' : p)
                    )
                    .join(', ')}
                </p>
              )}
              {plant.customerNote && (
                <p className="text-sm text-slate-600 italic">„{plant.customerNote}"</p>
              )}
            </div>
          ))}

          <div className="bg-slate-50 rounded-xl p-4 space-y-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Gesamteindruck</p>
            <p className="text-sm text-slate-800">{moodLabel}</p>
            <p className="text-sm text-slate-600">Nächster Schritt: {nextStepLabel}</p>
            {note && <p className="text-sm text-slate-600 italic mt-1">{note}</p>}
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              {error}
            </p>
          )}
        </div>
      )
    }

    return null
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-4 flex items-center gap-3">
        <button
          onClick={() => (stepIndex === 0 ? router.push('/akquise') : back())}
          className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1">
          <p className="text-xs text-slate-500">Akquise-Check</p>
          <p className="text-sm font-semibold text-slate-800 truncate">
            {selectedCustomer?.name ?? 'Neuer Check'}
          </p>
        </div>
        <span className="text-xs text-slate-400">
          {stepIndex + 1} / {steps.length}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 max-w-lg mx-auto w-full px-4 py-6">
        <StepIndicator current={stepIndex} total={steps.length} />
        {renderStep()}
      </div>

      {/* Footer */}
      <div className="bg-white border-t border-slate-200 px-4 py-4 max-w-lg mx-auto w-full">
        {currentStep?.kind === 'summary' ? (
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            {submitting ? 'Wird gespeichert...' : 'Akquise-Check speichern'}
          </button>
        ) : (
          <button
            onClick={next}
            disabled={!canProceed()}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors"
          >
            Weiter
          </button>
        )}
      </div>
    </div>
  )
}

export default function AcquisitionWizardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-100 flex items-center justify-center text-slate-400">Lädt...</div>}>
      <AcquisitionWizard />
    </Suspense>
  )
}
