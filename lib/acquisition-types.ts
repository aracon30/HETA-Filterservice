export const ACQUISITION_PLANT_TYPES = [
  { value: 'filter', label: 'Filteranlage' },
  { value: 'pump', label: 'Pumpenanlage' },
  { value: 'filter_pump', label: 'Filter + Pumpe (kombiniert)' },
  { value: 'compressor', label: 'Kompressor' },
  { value: 'loading_arm', label: 'Verladearm' },
  { value: 'tank', label: 'Tankanlage' },
  { value: 'other', label: 'Sonstiges / unbekannt' },
]

const FILTER_PROBLEMS = [
  { value: 'pressure_loss', label: 'Druckverlust' },
  { value: 'filter_overdue', label: 'Filterwechsel überfällig' },
  { value: 'clogging', label: 'Verstopfung' },
  { value: 'leakage', label: 'Leckage' },
  { value: 'corrosion', label: 'Korrosion / Rost' },
  { value: 'seal_defect', label: 'Undichtigkeit' },
]

const PUMP_PROBLEMS = [
  { value: 'cavitation', label: 'Kavitation' },
  { value: 'bearing_damage', label: 'Lagerschaden' },
  { value: 'shaft_seal_defect', label: 'Wellendichtung defekt' },
  { value: 'power_loss', label: 'Leistungsverlust' },
  { value: 'overheating', label: 'Überhitzung' },
  { value: 'leakage', label: 'Leckage' },
]

const COMPRESSOR_PROBLEMS = [
  { value: 'pressure_loss', label: 'Druckverlust' },
  { value: 'oil_leakage', label: 'Ölaustritt' },
  { value: 'overheating', label: 'Überhitzung' },
  { value: 'valve_defect', label: 'Ventilschaden' },
  { value: 'noise', label: 'Ungewöhnliche Geräusche' },
  { value: 'filter_overdue', label: 'Filterwechsel überfällig' },
]

const LOADING_ARM_PROBLEMS = [
  { value: 'swivel_joint_defect', label: 'Drehgelenk defekt' },
  { value: 'seal_defect', label: 'Dichtung defekt' },
  { value: 'corrosion', label: 'Korrosion / Rost' },
  { value: 'leakage', label: 'Leckage' },
  { value: 'movement_blocked', label: 'Beweglichkeit eingeschränkt' },
  { value: 'safety_coupler_defect', label: 'Sicherheitskupplung defekt' },
]

const TANK_PROBLEMS = [
  { value: 'corrosion', label: 'Korrosion / Rost' },
  { value: 'leakage', label: 'Leckage' },
  { value: 'seal_defect', label: 'Undichtigkeit' },
  { value: 'level_indicator_defect', label: 'Füllstandsanzeige defekt' },
  { value: 'overpressure', label: 'Überdruck' },
  { value: 'contamination', label: 'Kontamination' },
]

const GENERIC_PROBLEMS = [
  { value: 'leakage', label: 'Leckage' },
  { value: 'corrosion', label: 'Korrosion / Rost' },
  { value: 'noise', label: 'Ungewöhnliche Geräusche' },
  { value: 'overheating', label: 'Überhitzung' },
  { value: 'seal_defect', label: 'Undichtigkeit' },
]

export function getProblemsForTypes(types: string[]): { value: string; label: string }[] {
  const seen = new Set<string>()
  const result: { value: string; label: string }[] = []

  for (const type of types) {
    let list: { value: string; label: string }[] = []
    if (type === 'filter') list = FILTER_PROBLEMS
    else if (type === 'pump') list = PUMP_PROBLEMS
    else if (type === 'filter_pump') list = [...FILTER_PROBLEMS, ...PUMP_PROBLEMS]
    else if (type === 'compressor') list = COMPRESSOR_PROBLEMS
    else if (type === 'loading_arm') list = LOADING_ARM_PROBLEMS
    else if (type === 'tank') list = TANK_PROBLEMS
    else list = GENERIC_PROBLEMS

    for (const item of list) {
      if (!seen.has(item.value)) {
        seen.add(item.value)
        result.push(item)
      }
    }
  }

  if (result.length === 0) return GENERIC_PROBLEMS
  return result
}

export const YES_NO_UNKNOWN = [
  { value: 'yes', label: 'Ja' },
  { value: 'no', label: 'Nein' },
  { value: 'unknown', label: 'Unbekannt' },
]

export const INSTALLATION_TYPE_OPTIONS = [
  { value: 'indoor', label: 'Innenaufstellung' },
  { value: 'outdoor', label: 'Außenaufstellung' },
  { value: 'unknown', label: 'Unbekannt' },
]

export const ENVIRONMENTAL_CONDITIONS = [
  { value: 'heat', label: 'Hohe Temperaturen' },
  { value: 'humidity', label: 'Feuchtigkeit' },
  { value: 'dust', label: 'Staub / Schmutz' },
  { value: 'ex_zone', label: 'Ex-Bereich (Explosionsschutz)' },
  { value: 'chemicals', label: 'Chemische Einwirkung' },
  { value: 'vibration', label: 'Starke Vibrationen' },
  { value: 'frost', label: 'Frost / Kälte' },
]

export const LAST_SERVICE_OPTIONS = [
  { value: 'never', label: 'Noch nie gewartet' },
  { value: 'lt1year', label: 'Vor weniger als 1 Jahr' },
  { value: '1to3years', label: 'Vor 1–3 Jahren' },
  { value: 'gt3years', label: 'Vor mehr als 3 Jahren' },
  { value: 'unknown', label: 'Unbekannt' },
]

export const MAINTAINED_BY_OPTIONS = [
  { value: 'internal', label: 'Intern (eigenes Personal)' },
  { value: 'external_other', label: 'Extern — anderer Dienstleister' },
  { value: 'unknown', label: 'Unbekannt' },
]

export const PRIORITY_OPTIONS = [
  { value: 'reliability', label: 'Zuverlässigkeit / keine Ausfälle' },
  { value: 'cost', label: 'Geringere Wartungskosten' },
  { value: 'response_time', label: 'Schnellere Reaktionszeit bei Störungen' },
  { value: 'documentation', label: 'Bessere Dokumentation' },
  { value: 'compliance', label: 'Gesetzliche Anforderungen / Compliance' },
  { value: 'energy', label: 'Energieeffizienz' },
]

export const URGENCY_OPTIONS = [
  { value: 'none', label: 'Kein Druck — läuft soweit' },
  { value: 'medium', label: 'Mittelfristig — in den nächsten Monaten' },
  { value: 'urgent', label: 'Dringend — so bald wie möglich' },
  { value: 'critical', label: 'Akut — Anlage steht / droht auszufallen' },
]

export const MOOD_OPTIONS = [
  { value: 'very_open', label: 'Sehr offen — Kunde ist interessiert und gesprächsbereit' },
  { value: 'positive', label: 'Positiv — grundsätzliches Interesse vorhanden' },
  { value: 'neutral', label: 'Neutral — abwartend, noch kein klares Signal' },
  { value: 'skeptical', label: 'Skeptisch — Überzeugungsarbeit nötig' },
  { value: 'rejecting', label: 'Ablehnend — kein Interesse' },
]

export const NEXT_STEP_OPTIONS = [
  { value: 'offer', label: 'Angebot gewünscht' },
  { value: 'callback', label: 'Weiteres Gespräch / Rückruf' },
  { value: 'inspection', label: 'Technische Prüfung vor Ort' },
  { value: 'none', label: 'Kein konkreter nächster Schritt' },
]

export interface AcquisitionPlant {
  types: string[]
  // Basisdaten
  manufacturer: string
  buildYear: string
  serialNumber: string
  modelDesignation: string
  // Technische Daten
  nominalPower: string
  operatingPressure: string
  flowRate: string
  medium: string
  operatingHours: string
  // Zustand & Historie
  wasModified: string
  hasDocumentation: string
  sparePartsAvailable: string
  // Aufstellort
  installationType: string
  environmentalConditions: string[]
  // Service
  lastServiceAge: string
  maintainedBy: string
  // Zustand & Probleme
  condition: number
  problems: string[]
  problemNote: string
  // Kundenstimme
  priorities: string[]
  urgency: string
  customerNote: string
  // Zusatzinfos & Fotos
  additionalInfo: string
  photos: string[]
}

export interface AcquisitionCheckData {
  customerId: string
  plants: AcquisitionPlant[]
  mood: string
  nextStep: string
  note: string
}
