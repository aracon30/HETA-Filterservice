'use client'

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
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

interface Customer { id: string; name: string; address: string | null }
interface Site { id: string; name: string; address: string | null; city: string | null }

const emptyPlant = (): AcquisitionPlant => ({
  types: [], manufacturer: '', buildYear: '', serialNumber: '', modelDesignation: '',
  nominalPower: '', operatingPressure: '', flowRate: '', medium: '', operatingHours: '',
  wasModified: '', hasDocumentation: '', sparePartsAvailable: '',
  installationType: '', environmentalConditions: [],
  lastServiceAge: '', maintainedBy: '',
  condition: 0, problems: [], problemNote: '',
  priorities: [], urgency: '', customerNote: '',
  additionalInfo: '', photos: [],
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

function stepTitle(step: WizardStep, plantCount: number): string {
  if (step.kind === 'customer') return 'Kunde auswählen'
  if (step.kind === 'site_select') return 'Standort'
  if (step.kind === 'plant_count') return 'Anzahl Anlagen'
  if (step.kind === 'plant_types') return 'Anlagentypen'
  if (step.kind === 'plant_base') return `Anlage ${step.plantIndex + 1} von ${plantCount} — Basisdaten`
  if (step.kind === 'plant_condition') return `Anlage ${step.plantIndex + 1} von ${plantCount} — Zustand & Probleme`
  if (step.kind === 'plant_voice') return `Anlage ${step.plantIndex + 1} von ${plantCount} — Kundenstimme`
  if (step.kind === 'overall') return 'Gesamteindruck'
  return 'Zusammenfassung'
}

// --- UI-Komponenten ---

function RadioGroup({ options, value, onChange }: {
  options: { value: string; label: string }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="space-y-2">
      {options.map((opt) => (
        <button key={opt.value} type="button" onClick={() => onChange(opt.value)}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${
            value === opt.value ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300 bg-white'
          }`}>
          <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${value === opt.value ? 'border-blue-500 bg-blue-500' : 'border-slate-300'}`} />
          <span className="text-sm text-slate-700">{opt.label}</span>
        </button>
      ))}
    </div>
  )
}

function CheckboxGroup({ options, values, onChange }: {
  options: { value: string; label: string }[]
  values: string[]
  onChange: (v: string[]) => void
}) {
  const toggle = (val: string) =>
    values.includes(val) ? onChange(values.filter((v) => v !== val)) : onChange([...values, val])
  return (
    <div className="space-y-2">
      {options.map((opt) => (
        <button key={opt.value} type="button" onClick={() => toggle(opt.value)}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${
            values.includes(opt.value) ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300 bg-white'
          }`}>
          <span className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center ${values.includes(opt.value) ? 'border-blue-500 bg-blue-500' : 'border-slate-300'}`}>
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

function ConditionStars({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const labels = ['', 'Kritisch', 'Schlecht', 'Mittel', 'Gut', 'Sehr gut']
  const colors = ['', 'text-red-600', 'text-orange-500', 'text-yellow-500', 'text-blue-600', 'text-green-600']
  return (
    <div className="space-y-2">
      {[5, 4, 3, 2, 1].map((star) => (
        <button key={star} type="button" onClick={() => onChange(star)}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${
            value === star ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300 bg-white'
          }`}>
          <span className={`text-base font-bold ${colors[star]}`}>{'★'.repeat(star)}{'☆'.repeat(5 - star)}</span>
          <span className="text-sm font-medium text-slate-700">{labels[star]}</span>
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
        if (res.ok) newUrls.push((await res.json()).url)
      } catch { /* skip */ }
    }
    onChange([...photos, ...newUrls])
    setUploading(false)
  }
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-700">Fotos <span className="font-normal text-slate-400">(optional)</span></label>
      {photos.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {photos.map((url) => (
            <div key={url} className="relative rounded-xl overflow-hidden aspect-square bg-slate-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="w-full h-full object-cover" />
              <button type="button" onClick={() => onChange(photos.filter((p) => p !== url))}
                className="absolute top-1 right-1 w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center text-sm font-bold shadow">×</button>
            </div>
          ))}
        </div>
      )}
      <label className={`flex items-center justify-center gap-2 border-2 border-dashed rounded-xl px-4 py-5 cursor-pointer transition-colors ${uploading ? 'border-slate-200 bg-slate-50' : 'border-slate-300 hover:border-blue-400 hover:bg-blue-50'}`}>
        <input type="file" accept="image/*" multiple capture="environment" className="sr-only"
          onChange={(e) => handleFiles(e.target.files)} disabled={uploading} />
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
  { value: 1, label: '1 Anlage' }, { value: 2, label: '2 Anlagen' },
  { value: 3, label: '3 Anlagen' }, { value: 4, label: '4 Anlagen' },
  { value: 5, label: '5 Anlagen' }, { value: 6, label: '6–10 Anlagen' },
  { value: 11, label: 'Mehr als 10 Anlagen' },
]

// --- Hauptkomponente ---

function AcquisitionWizard() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedCustomerId = searchParams.get('customerId')
  const contentRef = useRef<HTMLDivElement>(null)

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
  const [checkId, setCheckId] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [submitting, setSubmitting] = useState(false)

  const steps = buildSteps(plantCount)
  const currentStep = steps[stepIndex]

  useEffect(() => {
    fetch('/api/customers').then((r) => r.json()).then((data) => {
      setCustomers(data)
      if (preselectedCustomerId) {
        const found = data.find((c: Customer) => c.id === preselectedCustomerId)
        if (found) { setSelectedCustomer(found); setStepIndex(1) }
      }
    })
  }, [preselectedCustomerId])

  useEffect(() => {
    if (!selectedCustomer) { setSites([]); setSelectedSiteId(null); return }
    fetch(`/api/sites?customerId=${selectedCustomer.id}`)
      .then((r) => r.json()).then((data) => setSites(Array.isArray(data) ? data : []))
  }, [selectedCustomer])

  const updatePlant = useCallback((index: number, patch: Partial<AcquisitionPlant>) => {
    setPlants((prev) => { const copy = [...prev]; copy[index] = { ...copy[index], ...patch }; return copy })
  }, [])

  const handlePlantCountSelect = (count: number) => {
    setPlantCount(count)
    setPlants(Array.from({ length: count }, () => emptyPlant()))
  }

  const getPayload = useCallback(() => ({
    customerId: selectedCustomer?.id ?? '',
    siteId: selectedSiteId,
    plants,
    mood,
    nextStep,
    note,
  }), [selectedCustomer, selectedSiteId, plants, mood, nextStep, note])

  const saveProgress = useCallback(async (currentCheckId: string | null): Promise<string | null> => {
    if (!selectedCustomer) return currentCheckId
    setSaveStatus('saving')
    try {
      if (!currentCheckId) {
        const res = await fetch('/api/acquisition', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(getPayload()),
        })
        if (!res.ok) throw new Error()
        const data = await res.json()
        setSaveStatus('saved')
        return data.id
      } else {
        await fetch(`/api/acquisition/${currentCheckId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(getPayload()),
        })
        setSaveStatus('saved')
        return currentCheckId
      }
    } catch {
      setSaveStatus('error')
      return currentCheckId
    }
  }, [selectedCustomer, getPayload])

  const canProceed = (): boolean => {
    if (!currentStep) return false
    if (currentStep.kind === 'customer') return !!selectedCustomer
    if (currentStep.kind === 'plant_count') return plantCount > 0
    if (currentStep.kind === 'plant_types') return plants.every((p) => p.types.length > 0)
    if (currentStep.kind === 'plant_condition') return plants[currentStep.plantIndex]?.condition > 0
    return true
  }

  const handleNext = async () => {
    if (stepIndex >= steps.length - 1) return
    const newId = await saveProgress(checkId)
    if (newId !== checkId) setCheckId(newId)
    setStepIndex(stepIndex + 1)
    contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleBack = async () => {
    if (stepIndex === 0) { router.push('/akquise'); return }
    if (checkId) await saveProgress(checkId)
    setStepIndex(stepIndex - 1)
    contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSubmit = async () => {
    if (!selectedCustomer || !checkId) return
    setSubmitting(true)
    try {
      await fetch(`/api/acquisition/${checkId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(getPayload()),
      })
      router.push(`/akquise/${checkId}`)
    } catch {
      setSubmitting(false)
    }
  }

  const plantTypeLabel = (types: string[]) =>
    types.map((t) => ACQUISITION_PLANT_TYPES.find((p) => p.value === t)?.label ?? t).join(' + ')

  const conditionLabel = (v: number) =>
    ['', 'Kritisch ★', 'Schlecht ★★', 'Mittel ★★★', 'Gut ★★★★', 'Sehr gut ★★★★★'][v] ?? ''

  const filteredCustomers = customers.filter((c) =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase())
  )

  // --- Schritte rendern ---

  const renderStep = () => {
    if (!currentStep) return null

    if (currentStep.kind === 'customer') return (
      <div className="space-y-4">
        <p className="text-sm text-slate-500">Wähle den Kunden aus dem Kundenstamm.</p>
        <input type="text" placeholder="Kundenname suchen..."
          value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)}
          className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <div className="space-y-2">
          {filteredCustomers.map((c) => (
            <button key={c.id} type="button" onClick={() => setSelectedCustomer(c)}
              className={`w-full flex flex-col px-4 py-3 rounded-xl border-2 text-left transition-all ${
                selectedCustomer?.id === c.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}>
              <span className="font-medium text-slate-800 text-sm">{c.name}</span>
              {c.address && <span className="text-xs text-slate-500 mt-0.5">{c.address}</span>}
            </button>
          ))}
          {filteredCustomers.length === 0 && <p className="text-sm text-slate-400 text-center py-6">Keine Kunden gefunden.</p>}
        </div>
      </div>
    )

    if (currentStep.kind === 'site_select') return (
      <div className="space-y-4">
        <p className="text-sm text-slate-500">
          Wähle den Standort bei <strong>{selectedCustomer?.name}</strong> — oder überspringe diesen Schritt.
        </p>
        {sites.length === 0 ? (
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-6 text-center">
            <p className="text-sm text-slate-500">Keine Standorte für diesen Kunden angelegt.</p>
            <p className="text-xs text-slate-400 mt-1">Kann später im Kundenprofil ergänzt werden.</p>
          </div>
        ) : (
          <div className="space-y-2">
            <button type="button" onClick={() => setSelectedSiteId(null)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${
                selectedSiteId === null ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}>
              <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${selectedSiteId === null ? 'border-blue-500 bg-blue-500' : 'border-slate-300'}`} />
              <span className="text-sm text-slate-500 italic">Kein Standort</span>
            </button>
            {sites.map((site) => (
              <button key={site.id} type="button" onClick={() => setSelectedSiteId(site.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${
                  selectedSiteId === site.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}>
                <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${selectedSiteId === site.id ? 'border-blue-500 bg-blue-500' : 'border-slate-300'}`} />
                <span className="flex flex-col">
                  <span className="text-sm font-medium text-slate-800">{site.name}</span>
                  {(site.address || site.city) && <span className="text-xs text-slate-500">{[site.address, site.city].filter(Boolean).join(', ')}</span>}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    )

    if (currentStep.kind === 'plant_count') return (
      <div className="space-y-3">
        <p className="text-sm text-slate-500">Wie viele Anlagen gibt es bei <strong>{selectedCustomer?.name}</strong>?</p>
        {PLANT_COUNT_OPTIONS.map((opt) => (
          <button key={opt.value} type="button"
            onClick={() => handlePlantCountSelect(opt.value > 10 ? 10 : opt.value)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${
              (opt.value > 10 ? plantCount >= 10 : plantCount === opt.value) ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}>
            <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${(opt.value > 10 ? plantCount >= 10 : plantCount === opt.value) ? 'border-blue-500 bg-blue-500' : 'border-slate-300'}`} />
            <span className="text-sm text-slate-700">{opt.label}</span>
          </button>
        ))}
      </div>
    )

    if (currentStep.kind === 'plant_types') return (
      <div className="space-y-6">
        <p className="text-sm text-slate-500">Wähle für jede Anlage den Typ. Mehrere Typen je Anlage möglich.</p>
        {plants.map((plant, i) => (
          <div key={i}>
            <p className="text-sm font-semibold text-slate-700 mb-2">Anlage {i + 1}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {ACQUISITION_PLANT_TYPES.map((type) => (
                <button key={type.value} type="button"
                  onClick={() => {
                    const updated = plant.types.includes(type.value)
                      ? plant.types.filter((t) => t !== type.value)
                      : [...plant.types, type.value]
                    updatePlant(i, { types: updated })
                  }}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 text-left transition-all ${
                    plant.types.includes(type.value) ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}>
                  <span className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center ${plant.types.includes(type.value) ? 'border-blue-500 bg-blue-500' : 'border-slate-300'}`}>
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
    )

    if (currentStep.kind === 'plant_base') {
      const i = currentStep.plantIndex
      const plant = plants[i]
      const showMaintainedBy = plant.lastServiceAge && plant.lastServiceAge !== 'never' && plant.lastServiceAge !== 'unknown'
      return (
        <div className="space-y-6">
          {/* Identifikation */}
          <section className="space-y-3">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Identifikation</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { label: 'Hersteller', key: 'manufacturer', placeholder: 'z.B. Mann+Hummel' },
                { label: 'Modellbezeichnung / Typ', key: 'modelDesignation', placeholder: 'z.B. HF-3000' },
                { label: 'Baujahr', key: 'buildYear', placeholder: 'z.B. 2015' },
                { label: 'Seriennummer', key: 'serialNumber', placeholder: 'z.B. SN-12345' },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
                  <input type="text"
                    value={(plant as unknown as Record<string, string>)[key] ?? ''}
                    onChange={(e) => updatePlant(i, { [key]: e.target.value } as Partial<AcquisitionPlant>)}
                    className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={placeholder} />
                </div>
              ))}
            </div>
          </section>
          {/* Technische Daten */}
          <section className="space-y-3">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Technische Daten</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { label: 'Nennleistung', key: 'nominalPower', placeholder: 'z.B. 7,5 kW' },
                { label: 'Betriebsdruck', key: 'operatingPressure', placeholder: 'z.B. 6 bar' },
                { label: 'Durchflussrate', key: 'flowRate', placeholder: 'z.B. 50 m³/h' },
                { label: 'Medium', key: 'medium', placeholder: 'z.B. Wasser, Öl...' },
                { label: 'Betriebsstunden', key: 'operatingHours', placeholder: 'z.B. 12.000 h' },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
                  <input type="text"
                    value={(plant as unknown as Record<string, string>)[key] ?? ''}
                    onChange={(e) => updatePlant(i, { [key]: e.target.value } as Partial<AcquisitionPlant>)}
                    className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={placeholder} />
                </div>
              ))}
            </div>
          </section>
          {/* Zustand & Historie */}
          <section className="space-y-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Zustand & Historie</p>
            {[
              { label: 'Anlage jemals umgebaut / modifiziert?', key: 'wasModified' },
              { label: 'Originaldokumentation vorhanden?', key: 'hasDocumentation' },
              { label: 'Ersatzteile noch beschaffbar?', key: 'sparePartsAvailable' },
            ].map(({ label, key }) => (
              <div key={key}>
                <label className="block text-sm font-medium text-slate-700 mb-2">{label}</label>
                <RadioGroup options={YES_NO_UNKNOWN}
                  value={(plant as unknown as Record<string, string>)[key] ?? ''}
                  onChange={(v) => updatePlant(i, { [key]: v } as Partial<AcquisitionPlant>)} />
              </div>
            ))}
          </section>
          {/* Aufstellort */}
          <section className="space-y-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Aufstellort</p>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Aufstellungsart</label>
              <RadioGroup options={INSTALLATION_TYPE_OPTIONS} value={plant.installationType}
                onChange={(v) => updatePlant(i, { installationType: v })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Besondere Umgebungsbedingungen</label>
              <CheckboxGroup options={ENVIRONMENTAL_CONDITIONS} values={plant.environmentalConditions}
                onChange={(v) => updatePlant(i, { environmentalConditions: v })} />
            </div>
          </section>
          {/* Servicehistorie */}
          <section className="space-y-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Servicehistorie</p>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Letzter bekannter Service</label>
              <RadioGroup options={LAST_SERVICE_OPTIONS} value={plant.lastServiceAge}
                onChange={(v) => updatePlant(i, { lastServiceAge: v, maintainedBy: '' })} />
            </div>
            {showMaintainedBy && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Wartung durchgeführt durch</label>
                <RadioGroup options={MAINTAINED_BY_OPTIONS} value={plant.maintainedBy}
                  onChange={(v) => updatePlant(i, { maintainedBy: v })} />
              </div>
            )}
          </section>
          {/* Zusatzinfos & Fotos */}
          <section className="space-y-3">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Zusatzinfos & Fotos</p>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Weitere Informationen</label>
              <textarea value={plant.additionalInfo}
                onChange={(e) => updatePlant(i, { additionalInfo: e.target.value })}
                rows={3} placeholder="Besonderheiten, Auffälligkeiten..."
                className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>
            <PhotoUpload photos={plant.photos} onChange={(photos) => updatePlant(i, { photos })} />
          </section>
        </div>
      )
    }

    if (currentStep.kind === 'plant_condition') {
      const i = currentStep.plantIndex
      const plant = plants[i]
      const problemOptions = getProblemsForTypes(plant.types)
      return (
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Sichtbarer Zustand</label>
            <ConditionStars value={plant.condition} onChange={(v) => updatePlant(i, { condition: v })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Bekannte Probleme <span className="font-normal text-slate-400">(Mehrfachauswahl)</span></label>
            <CheckboxGroup options={[...problemOptions, { value: 'none', label: 'Keine bekannten Probleme' }]}
              values={plant.problems} onChange={(v) => updatePlant(i, { problems: v })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Kundenaussage (wörtlich)</label>
            <textarea value={plant.problemNote} onChange={(e) => updatePlant(i, { problemNote: e.target.value })}
              rows={3} placeholder="Was sagt der Kunde? Möglichst wörtlich..."
              className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
        </div>
      )
    }

    if (currentStep.kind === 'plant_voice') {
      const i = currentStep.plantIndex
      const plant = plants[i]
      return (
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Was ist dem Kunden am wichtigsten? <span className="font-normal text-slate-400">(Mehrfachauswahl)</span></label>
            <CheckboxGroup options={PRIORITY_OPTIONS} values={plant.priorities}
              onChange={(v) => updatePlant(i, { priorities: v })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Wie dringend sieht der Kunde Handlungsbedarf?</label>
            <RadioGroup options={URGENCY_OPTIONS} value={plant.urgency}
              onChange={(v) => updatePlant(i, { urgency: v })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Gesprächsnotiz</label>
            <textarea value={plant.customerNote} onChange={(e) => updatePlant(i, { customerNote: e.target.value })}
              rows={3} placeholder="Beobachtungen, Stimmung, Zitate..."
              className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
        </div>
      )
    }

    if (currentStep.kind === 'overall') return (
      <div className="space-y-5">
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
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3}
            placeholder="Allgemeine Beobachtungen, offene Punkte..."
            className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </div>
      </div>
    )

    if (currentStep.kind === 'summary') {
      const moodLabel = MOOD_OPTIONS.find((m) => m.value === mood)?.label
      const nextStepLabel = NEXT_STEP_OPTIONS.find((n) => n.value === nextStep)?.label
      return (
        <div className="space-y-4">
          <p className="text-sm text-slate-500">Alles prüfen und dann abschließen.</p>
          <div className="bg-slate-50 rounded-2xl p-4 space-y-1">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Kunde</p>
            <p className="font-semibold text-slate-800">{selectedCustomer?.name}</p>
            {selectedCustomer?.address && <p className="text-sm text-slate-500">{selectedCustomer.address}</p>}
          </div>
          {plants.map((plant, i) => (
            <div key={i} className="bg-slate-50 rounded-2xl p-4 space-y-1">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Anlage {i + 1} — {plantTypeLabel(plant.types)}</p>
              {plant.manufacturer && <p className="text-sm text-slate-700">{plant.manufacturer}{plant.buildYear ? ` · ${plant.buildYear}` : ''}</p>}
              {plant.condition > 0 && <p className="text-sm text-slate-700">Zustand: {conditionLabel(plant.condition)}</p>}
              {plant.urgency && <p className="text-sm text-slate-700">{URGENCY_OPTIONS.find((u) => u.value === plant.urgency)?.label}</p>}
              {plant.customerNote && <p className="text-sm text-slate-600 italic mt-1">„{plant.customerNote}"</p>}
            </div>
          ))}
          {(moodLabel || nextStepLabel) && (
            <div className="bg-slate-50 rounded-2xl p-4 space-y-1">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Gesamteindruck</p>
              {moodLabel && <p className="text-sm text-slate-700">{moodLabel}</p>}
              {nextStepLabel && <p className="text-sm text-slate-600">Nächster Schritt: {nextStepLabel}</p>}
              {note && <p className="text-sm text-slate-600 italic mt-1">{note}</p>}
            </div>
          )}
        </div>
      )
    }
    return null
  }

  const isSummary = currentStep?.kind === 'summary'

  return (
    <div className="flex flex-col h-screen bg-slate-100">
      {/* Sticky Header */}
      <header className="flex-shrink-0 bg-white border-b border-slate-200 px-4 py-3 shadow-sm">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 min-w-0">
              <p className="text-xs text-slate-400 hidden sm:block">Akquise-Check</p>
              <p className="text-xs text-slate-400 sm:hidden">Check</p>
              {selectedCustomer && (
                <>
                  <span className="text-xs text-slate-300">›</span>
                  <p className="text-sm font-semibold text-slate-800 truncate">{selectedCustomer.name}</p>
                </>
              )}
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              {saveStatus === 'saving' && <span className="text-xs text-slate-400">Speichert…</span>}
              {saveStatus === 'saved' && <span className="text-xs text-green-600">✓ Gespeichert</span>}
              {saveStatus === 'error' && <span className="text-xs text-red-500">Fehler</span>}
              <span className="text-xs text-slate-400">{stepIndex + 1} / {steps.length}</span>
            </div>
          </div>
          {/* Fortschrittsbalken */}
          <div className="flex gap-0.5">
            {steps.map((_, i) => (
              <div key={i} className={`h-1 rounded-full flex-1 transition-all duration-300 ${
                i < stepIndex ? 'bg-blue-600' : i === stepIndex ? 'bg-blue-400' : 'bg-slate-200'
              }`} />
            ))}
          </div>
          <p className="text-xs font-semibold text-slate-600 mt-2">
            {currentStep ? stepTitle(currentStep, plantCount) : ''}
          </p>
        </div>
      </header>

      {/* Scrollbarer Inhaltsbereich */}
      <main ref={contentRef} className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6">
          {renderStep()}
        </div>
      </main>

      {/* Sticky Footer */}
      <footer className="flex-shrink-0 bg-white border-t border-slate-200 px-4 py-4 shadow-[0_-1px_6px_rgba(0,0,0,0.06)]">
        <div className="max-w-2xl mx-auto flex gap-3">
          <button onClick={handleBack}
            className="flex items-center gap-2 px-5 py-3 rounded-xl border-2 border-slate-200 text-slate-700 font-semibold text-sm hover:border-slate-300 hover:bg-slate-50 transition-all flex-shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Zurück
          </button>
          {isSummary ? (
            <button onClick={handleSubmit} disabled={submitting}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors text-sm">
              {submitting ? 'Wird abgeschlossen…' : 'Akquise-Check abschließen'}
            </button>
          ) : (
            <button onClick={handleNext} disabled={!canProceed()}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors text-sm">
              Weiter
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>
      </footer>
    </div>
  )
}

export default function AcquisitionWizardPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen bg-slate-100">
        <p className="text-slate-400 text-sm">Lädt…</p>
      </div>
    }>
      <AcquisitionWizard />
    </Suspense>
  )
}
