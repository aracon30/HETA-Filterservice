export const DEFAULT_CHECKLIST_ITEMS = [
  'Sichtprüfung Gehäuse und Dichtungen',
  'Differenzdruckmessung durchgeführt',
  'Filterelemente auf Zustand geprüft',
  'Reinigung Filtergehäuse',
  'Dichtheit nach Zusammenbau geprüft',
  'Betriebsparameter dokumentiert (Druck, Durchfluss, Temperatur)',
  'Ventile und Armaturen geprüft',
  'Elektrische Anschlüsse geprüft (falls vorhanden)',
  'Kundenpersonal eingewiesen',
  'Servicebericht unterzeichnet',
]

export const JOB_STATUS_LABELS: Record<string, string> = {
  PLANNED: 'Geplant',
  IN_PROGRESS: 'In Bearbeitung',
  COMPLETED: 'Abgeschlossen',
  CANCELLED: 'Storniert',
}

export const OPPORTUNITY_STAGE_LABELS: Record<string, string> = {
  IDENTIFIED: 'Identifiziert',
  QUALIFIED: 'Qualifiziert',
  PROPOSAL: 'Angebot',
  WON: 'Gewonnen',
  LOST: 'Verloren',
}
