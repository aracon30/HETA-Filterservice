// Pure permission data and types — no server-only dependencies (no Prisma).
// Safe to import from both server and client components.

export type Resource = 'customers' | 'plants' | 'jobs' | 'checklist' | 'opportunities' | 'users' | 'requests'
export type Action = 'view' | 'create' | 'edit' | 'delete'

export type PermEntry = {
  canView: boolean
  canCreate: boolean
  canEdit: boolean
  canDelete: boolean
  scope: string
}

// Hardcoded role permissions — edit here to change defaults
export const ROLE_PERMISSIONS: Record<string, Record<string, PermEntry>> = {
  ADMIN: {
    customers:     { canView: true,  canCreate: true,  canEdit: true,  canDelete: true,  scope: 'all' },
    plants:        { canView: true,  canCreate: true,  canEdit: true,  canDelete: true,  scope: 'all' },
    jobs:          { canView: true,  canCreate: true,  canEdit: true,  canDelete: true,  scope: 'all' },
    checklist:     { canView: true,  canCreate: true,  canEdit: true,  canDelete: true,  scope: 'all' },
    opportunities: { canView: true,  canCreate: true,  canEdit: true,  canDelete: true,  scope: 'all' },
    users:         { canView: true,  canCreate: true,  canEdit: true,  canDelete: true,  scope: 'all' },
    requests:      { canView: true,  canCreate: false, canEdit: true,  canDelete: true,  scope: 'all' },
  },
  SERVICE_MANAGER: {
    customers:     { canView: true,  canCreate: true,  canEdit: true,  canDelete: true,  scope: 'all' },
    plants:        { canView: true,  canCreate: true,  canEdit: true,  canDelete: true,  scope: 'all' },
    jobs:          { canView: true,  canCreate: true,  canEdit: true,  canDelete: true,  scope: 'all' },
    checklist:     { canView: true,  canCreate: true,  canEdit: true,  canDelete: true,  scope: 'all' },
    opportunities: { canView: true,  canCreate: true,  canEdit: true,  canDelete: true,  scope: 'all' },
    users:         { canView: true,  canCreate: false, canEdit: false, canDelete: false, scope: 'all' },
    requests:      { canView: true,  canCreate: false, canEdit: true,  canDelete: false, scope: 'all' },
  },
  SERVICE_TECHNICIAN: {
    customers:     { canView: true,  canCreate: false, canEdit: false, canDelete: false, scope: 'all' },
    plants:        { canView: true,  canCreate: false, canEdit: false, canDelete: false, scope: 'all' },
    jobs:          { canView: true,  canCreate: false, canEdit: true,  canDelete: false, scope: 'all' },
    checklist:     { canView: true,  canCreate: false, canEdit: false, canDelete: false, scope: 'all' },
    opportunities: { canView: false, canCreate: false, canEdit: false, canDelete: false, scope: 'all' },
    users:         { canView: false, canCreate: false, canEdit: false, canDelete: false, scope: 'all' },
    requests:      { canView: true,  canCreate: false, canEdit: false, canDelete: false, scope: 'all' },
  },
  MAINTENANCE_MANAGER: {
    customers:     { canView: true,  canCreate: false, canEdit: false, canDelete: false, scope: 'own_company' },
    plants:        { canView: true,  canCreate: false, canEdit: false, canDelete: false, scope: 'own_company' },
    jobs:          { canView: true,  canCreate: false, canEdit: false, canDelete: false, scope: 'own_company' },
    checklist:     { canView: true,  canCreate: false, canEdit: false, canDelete: false, scope: 'own_company' },
    opportunities: { canView: false, canCreate: false, canEdit: false, canDelete: false, scope: 'all' },
    users:         { canView: false, canCreate: false, canEdit: false, canDelete: false, scope: 'all' },
    requests:      { canView: true,  canCreate: true,  canEdit: true,  canDelete: false, scope: 'own_company' },
  },
  MAINTENANCE_TECHNICIAN: {
    customers:     { canView: true,  canCreate: false, canEdit: false, canDelete: false, scope: 'own_company' },
    plants:        { canView: true,  canCreate: false, canEdit: false, canDelete: false, scope: 'own_plant' },
    jobs:          { canView: true,  canCreate: false, canEdit: false, canDelete: false, scope: 'own_plant' },
    checklist:     { canView: true,  canCreate: false, canEdit: false, canDelete: false, scope: 'own_plant' },
    opportunities: { canView: false, canCreate: false, canEdit: false, canDelete: false, scope: 'all' },
    users:         { canView: false, canCreate: false, canEdit: false, canDelete: false, scope: 'all' },
    requests:      { canView: false, canCreate: false, canEdit: false, canDelete: false, scope: 'all' },
  },
  BUYER: {
    customers:     { canView: true,  canCreate: false, canEdit: false, canDelete: false, scope: 'own_company' },
    plants:        { canView: true,  canCreate: false, canEdit: false, canDelete: false, scope: 'own_company' },
    jobs:          { canView: true,  canCreate: false, canEdit: false, canDelete: false, scope: 'own_company' },
    checklist:     { canView: false, canCreate: false, canEdit: false, canDelete: false, scope: 'all' },
    opportunities: { canView: false, canCreate: false, canEdit: false, canDelete: false, scope: 'all' },
    users:         { canView: false, canCreate: false, canEdit: false, canDelete: false, scope: 'all' },
    requests:      { canView: true,  canCreate: true,  canEdit: true,  canDelete: false, scope: 'own_company' },
  },
}
