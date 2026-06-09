export const REQUEST_TYPE_LABELS: Record<string, string> = {
  STOERUNG: 'Störungsmeldung',
  WARTUNG: 'Wartungsanfrage',
  ANGEBOT: 'Angebotsanfrage',
  INFORMATION: 'Informationsanfrage',
  SONSTIGES: 'Sonstiges',
}

export const REQUEST_PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Niedrig',
  NORMAL: 'Normal',
  URGENT: 'Dringend',
  CRITICAL: 'Kritisch',
}

export const REQUEST_STATUS_LABELS: Record<string, string> = {
  OPEN: 'Offen',
  IN_REVIEW: 'In Prüfung',
  OFFER_SENT: 'Angebot versendet',
  OFFER_ACCEPTED: 'Angebot angenommen',
  OFFER_REJECTED: 'Angebot abgelehnt',
  JOB_PLANNED: 'Einsatz geplant',
  REJECTED: 'Abgelehnt',
  CLOSED: 'Geschlossen',
}

export const REQUEST_STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-blue-100 text-blue-800',
  IN_REVIEW: 'bg-yellow-100 text-yellow-800',
  OFFER_SENT: 'bg-purple-100 text-purple-800',
  OFFER_ACCEPTED: 'bg-green-100 text-green-800',
  OFFER_REJECTED: 'bg-red-100 text-red-800',
  JOB_PLANNED: 'bg-teal-100 text-teal-800',
  REJECTED: 'bg-gray-100 text-gray-700',
  CLOSED: 'bg-gray-100 text-gray-500',
}

export const REQUEST_PRIORITY_COLORS: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-600',
  NORMAL: 'bg-blue-100 text-blue-700',
  URGENT: 'bg-orange-100 text-orange-700',
  CRITICAL: 'bg-red-100 text-red-700',
}

export const REQUEST_STATUS_FLOW: Record<string, string[]> = {
  OPEN: ['IN_REVIEW', 'REJECTED'],
  IN_REVIEW: ['OFFER_SENT', 'REJECTED', 'OPEN'],
  OFFER_SENT: ['OFFER_ACCEPTED', 'OFFER_REJECTED', 'IN_REVIEW'],
  OFFER_ACCEPTED: ['JOB_PLANNED', 'CLOSED'],
  OFFER_REJECTED: ['IN_REVIEW', 'CLOSED'],
  JOB_PLANNED: ['CLOSED'],
  REJECTED: ['CLOSED'],
  CLOSED: [],
}
