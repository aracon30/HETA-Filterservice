export interface ChecklistTemplate {
  section: string
  label: string
}

export interface PlantTypeDefinition {
  value: string
  label: string
  checklist: ChecklistTemplate[]
}

export const PLANT_TYPES: PlantTypeDefinition[] = [
  {
    value: 'Verladearm',
    label: 'Verladearm',
    checklist: [
      // 1. Unterlagen
      { section: 'Unterlagen', label: 'Unbedenklichkeitsbescheinigung vorhanden' },
      { section: 'Unterlagen', label: 'Freigabeschein vorhanden' },
      { section: 'Unterlagen', label: 'Sicherheitsunterweisung durchgeführt' },
      // 2. Visuelle Begutachtung
      { section: 'Visuelle Begutachtung', label: 'Oberfläche geprüft' },
      { section: 'Visuelle Begutachtung', label: 'Schnittstellen geprüft' },
      { section: 'Visuelle Begutachtung', label: 'Winkel geprüft' },
      { section: 'Visuelle Begutachtung', label: 'Kupplung geprüft' },
      { section: 'Visuelle Begutachtung', label: 'Gesamteindruck geprüft' },
      // 3. Federzylinder
      { section: 'Federzylinder', label: 'Sichtprüfung Federzylinder' },
      { section: 'Federzylinder', label: 'Vollständigkeitsüberprüfung Federzylinder' },
      { section: 'Federzylinder', label: 'Balancierung geprüft' },
      { section: 'Federzylinder', label: 'Sicherheit Federzylinder geprüft' },
      // 4. Drehgelenke – Leckagen
      { section: 'Drehgelenke – Leckagen', label: 'Drehgelenk 1 auf Leckage geprüft' },
      { section: 'Drehgelenke – Leckagen', label: 'Drehgelenk 2 auf Leckage geprüft' },
      { section: 'Drehgelenke – Leckagen', label: 'Drehgelenk 3 auf Leckage geprüft' },
      { section: 'Drehgelenke – Leckagen', label: 'Drehgelenk 4 auf Leckage geprüft' },
      { section: 'Drehgelenke – Leckagen', label: 'Drehgelenk 5 auf Leckage geprüft' },
      { section: 'Drehgelenke – Leckagen', label: 'Drehgelenk 6 auf Leckage geprüft' },
      // 4. Drehgelenke – Leichtgängigkeit und Verschleiß
      { section: 'Drehgelenke – Leichtgängigkeit & Verschleiß', label: 'Drehgelenk 1 Leichtgängigkeit und Verschleiß' },
      { section: 'Drehgelenke – Leichtgängigkeit & Verschleiß', label: 'Drehgelenk 2 Leichtgängigkeit und Verschleiß' },
      { section: 'Drehgelenke – Leichtgängigkeit & Verschleiß', label: 'Drehgelenk 3 Leichtgängigkeit und Verschleiß' },
      { section: 'Drehgelenke – Leichtgängigkeit & Verschleiß', label: 'Drehgelenk 4 Leichtgängigkeit und Verschleiß' },
      { section: 'Drehgelenke – Leichtgängigkeit & Verschleiß', label: 'Drehgelenk 5 Leichtgängigkeit und Verschleiß' },
      { section: 'Drehgelenke – Leichtgängigkeit & Verschleiß', label: 'Drehgelenk 6 Leichtgängigkeit und Verschleiß' },
      // 4. Drehgelenke – Vollständigkeit
      { section: 'Drehgelenke – Vollständigkeit', label: 'Drehgelenk 1 Vollständigkeit geprüft' },
      { section: 'Drehgelenke – Vollständigkeit', label: 'Drehgelenk 2 Vollständigkeit geprüft' },
      { section: 'Drehgelenke – Vollständigkeit', label: 'Drehgelenk 3 Vollständigkeit geprüft' },
      { section: 'Drehgelenke – Vollständigkeit', label: 'Drehgelenk 4 Vollständigkeit geprüft' },
      { section: 'Drehgelenke – Vollständigkeit', label: 'Drehgelenk 5 Vollständigkeit geprüft' },
      { section: 'Drehgelenke – Vollständigkeit', label: 'Drehgelenk 6 Vollständigkeit geprüft' },
    ],
  },
  {
    value: 'Druckfilter',
    label: 'Druckfilter',
    checklist: [],
  },
  {
    value: 'Saugfilter',
    label: 'Saugfilter',
    checklist: [],
  },
  {
    value: 'Rücklauffilter',
    label: 'Rücklauffilter',
    checklist: [],
  },
  {
    value: 'Belüftungsfilter',
    label: 'Belüftungsfilter',
    checklist: [],
  },
  {
    value: 'Filteraggregat',
    label: 'Filteraggregat',
    checklist: [],
  },
  {
    value: 'Sonstige',
    label: 'Sonstige',
    checklist: [],
  },
]

export function getChecklistForPlantType(plantType: string): ChecklistTemplate[] {
  const def = PLANT_TYPES.find(p => p.value === plantType)
  if (def && def.checklist.length > 0) return def.checklist
  // fallback to generic checklist imported from constants
  return []
}
