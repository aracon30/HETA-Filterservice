import { UserRole } from '@prisma/client'
import { Session } from 'next-auth'
import { prisma } from '@/lib/prisma'

export type Resource = 'customers' | 'plants' | 'jobs' | 'checklist' | 'opportunities' | 'users'
export type Action = 'view' | 'create' | 'edit' | 'delete'

type PermEntry = {
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
  },
  SERVICE_MANAGER: {
    customers:     { canView: true,  canCreate: true,  canEdit: true,  canDelete: true,  scope: 'all' },
    plants:        { canView: true,  canCreate: true,  canEdit: true,  canDelete: true,  scope: 'all' },
    jobs:          { canView: true,  canCreate: true,  canEdit: true,  canDelete: true,  scope: 'all' },
    checklist:     { canView: true,  canCreate: true,  canEdit: true,  canDelete: true,  scope: 'all' },
    opportunities: { canView: true,  canCreate: true,  canEdit: true,  canDelete: true,  scope: 'all' },
    users:         { canView: true,  canCreate: false, canEdit: false, canDelete: false, scope: 'all' },
  },
  SERVICE_TECHNICIAN: {
    customers:     { canView: true,  canCreate: false, canEdit: false, canDelete: false, scope: 'all' },
    plants:        { canView: true,  canCreate: false, canEdit: false, canDelete: false, scope: 'all' },
    jobs:          { canView: true,  canCreate: false, canEdit: true,  canDelete: false, scope: 'all' },
    checklist:     { canView: true,  canCreate: false, canEdit: false, canDelete: false, scope: 'all' },
    opportunities: { canView: false, canCreate: false, canEdit: false, canDelete: false, scope: 'all' },
    users:         { canView: false, canCreate: false, canEdit: false, canDelete: false, scope: 'all' },
  },
  MAINTENANCE_MANAGER: {
    customers:     { canView: true,  canCreate: false, canEdit: false, canDelete: false, scope: 'own_company' },
    plants:        { canView: true,  canCreate: false, canEdit: false, canDelete: false, scope: 'own_company' },
    jobs:          { canView: true,  canCreate: false, canEdit: false, canDelete: false, scope: 'own_company' },
    checklist:     { canView: true,  canCreate: false, canEdit: false, canDelete: false, scope: 'own_company' },
    opportunities: { canView: false, canCreate: false, canEdit: false, canDelete: false, scope: 'all' },
    users:         { canView: false, canCreate: false, canEdit: false, canDelete: false, scope: 'all' },
  },
  MAINTENANCE_TECHNICIAN: {
    customers:     { canView: true,  canCreate: false, canEdit: false, canDelete: false, scope: 'own_company' },
    plants:        { canView: true,  canCreate: false, canEdit: false, canDelete: false, scope: 'own_plant' },
    jobs:          { canView: true,  canCreate: false, canEdit: false, canDelete: false, scope: 'own_plant' },
    checklist:     { canView: true,  canCreate: false, canEdit: false, canDelete: false, scope: 'own_plant' },
    opportunities: { canView: false, canCreate: false, canEdit: false, canDelete: false, scope: 'all' },
    users:         { canView: false, canCreate: false, canEdit: false, canDelete: false, scope: 'all' },
  },
  BUYER: {
    customers:     { canView: true,  canCreate: false, canEdit: false, canDelete: false, scope: 'own_company' },
    plants:        { canView: true,  canCreate: false, canEdit: false, canDelete: false, scope: 'own_company' },
    jobs:          { canView: true,  canCreate: false, canEdit: false, canDelete: false, scope: 'own_company' },
    checklist:     { canView: false, canCreate: false, canEdit: false, canDelete: false, scope: 'all' },
    opportunities: { canView: false, canCreate: false, canEdit: false, canDelete: false, scope: 'all' },
    users:         { canView: false, canCreate: false, canEdit: false, canDelete: false, scope: 'all' },
  },
}

// Fetch user-specific permissions (overrides role defaults)
async function getUserPermission(userId: string, resource: Resource) {
  return prisma.userPermission.findUnique({
    where: { userId_resource: { userId, resource } },
  })
}

// Check if the session user can perform an action on a resource
export async function checkPermission(
  session: Session | null,
  resource: Resource,
  action: Action
): Promise<boolean> {
  if (!session?.user) return false

  const role = session.user.role as UserRole

  if (role === 'ADMIN') return true

  // User-specific overrides take precedence
  const userId = session.user.id
  if (userId) {
    const userPerm = await getUserPermission(userId, resource)
    if (userPerm) {
      switch (action) {
        case 'view':   return userPerm.canView
        case 'create': return userPerm.canCreate
        case 'edit':   return userPerm.canEdit
        case 'delete': return userPerm.canDelete
        default:       return false
      }
    }
  }

  // Fall back to hardcoded role permissions
  const perm = ROLE_PERMISSIONS[role]?.[resource]
  if (!perm) return false

  switch (action) {
    case 'view':   return perm.canView
    case 'create': return perm.canCreate
    case 'edit':   return perm.canEdit
    case 'delete': return perm.canDelete
    default:       return false
  }
}

// Returns a Prisma where-clause to scope queries for external users
export function getScopeFilter(
  session: Session | null,
  resource: Resource
): Record<string, unknown> {
  if (!session?.user) return {}

  const role = session.user.role as UserRole
  const customerId = session.user.customerId

  if (role === 'ADMIN' || role === 'SERVICE_MANAGER') return {}
  if (role === 'SERVICE_TECHNICIAN' && !customerId) return {}

  if (!customerId) return { id: 'NONE' }

  const scope = ROLE_PERMISSIONS[role]?.[resource]?.scope ?? 'all'

  if (scope === 'own_company' || scope === 'own_plant') {
    if (resource === 'customers') return { id: customerId }
    if (resource === 'plants') return { customerId }
    if (resource === 'jobs') return { customerId }
    if (resource === 'opportunities') return { customerId }
    return {}
  }

  return {}
}
