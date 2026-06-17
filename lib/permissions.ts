import { UserRole } from '@prisma/client'
import { Session } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { ROLE_PERMISSIONS, type Resource, type Action } from '@/lib/permissions-config'

// Re-export pure config so existing server imports from '@/lib/permissions' keep working.
export { ROLE_PERMISSIONS }
export type { Resource, Action }

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

// External (customer-side) roles whose visibility is contact-driven
const EXTERNAL_ROLES = ['MAINTENANCE_MANAGER', 'MAINTENANCE_TECHNICIAN', 'BUYER']

export type ExternalScope = { all: boolean; plantIds: string[] }

// Determines which plants an external user may see, based on how they are linked:
//   - company-wide contact (siteId null, plantId null) → all plants/sites
//   - site contact                                     → that site's plants
//   - plant contact / plant assignment                 → those plants
// A user with no link at all falls back to the role default (manager/buyer see
// the whole company, technician sees nothing) so existing setups keep working
// until contacts are assigned.
export async function getExternalPlantScope(
  userId: string,
  customerId: string,
  role: string
): Promise<ExternalScope> {
  const [companyContacts, siteContacts, plantContacts, assignments] = await Promise.all([
    prisma.contact.count({ where: { userId, customerId, siteId: null, plantId: null } }),
    prisma.contact.findMany({ where: { userId, customerId, siteId: { not: null } }, select: { siteId: true } }),
    prisma.contact.findMany({ where: { userId, customerId, plantId: { not: null } }, select: { plantId: true } }),
    prisma.plantExternalUser.findMany({ where: { userId }, select: { plantId: true } }),
  ])

  // Company-wide contact → see everything
  if (companyContacts > 0) return { all: true, plantIds: [] }

  const hasAnyLink = siteContacts.length > 0 || plantContacts.length > 0 || assignments.length > 0
  if (!hasAnyLink) {
    if (role === 'MAINTENANCE_MANAGER' || role === 'BUYER') return { all: true, plantIds: [] }
    return { all: false, plantIds: [] }
  }

  const siteIds = siteContacts.map(c => c.siteId).filter((x): x is string => !!x)
  let sitePlantIds: string[] = []
  if (siteIds.length > 0) {
    const sitePlants = await prisma.plant.findMany({
      where: { customerId, siteId: { in: siteIds } },
      select: { id: true },
    })
    sitePlantIds = sitePlants.map(p => p.id)
  }

  const plantIds = Array.from(new Set([
    ...sitePlantIds,
    ...plantContacts.map(c => c.plantId).filter((x): x is string => !!x),
    ...assignments.map(a => a.plantId),
  ]))

  return { all: false, plantIds }
}

// Returns a Prisma where-clause to scope queries for external users
export async function getScopeFilter(
  session: Session | null,
  resource: Resource
): Promise<Record<string, unknown>> {
  if (!session?.user) return {}

  const role = session.user.role as UserRole
  const customerId = session.user.customerId

  if (role === 'ADMIN' || role === 'SERVICE_MANAGER') return {}
  if (role === 'SERVICE_TECHNICIAN' && !customerId) return {}

  if (!customerId) return { id: 'NONE' }

  const userId = session.user.id

  // External (customer) users: visibility is driven by how the user is linked
  // (company-wide / site / plant contact, or plant assignment) — not the role.
  if (EXTERNAL_ROLES.includes(role as string) && userId) {
    if (resource === 'customers') return { id: customerId }
    if (resource === 'requests') return { customerId }
    if (resource === 'opportunities') return { customerId }

    const ext = await getExternalPlantScope(userId, customerId, role as string)

    if (ext.all) {
      if (resource === 'plants' || resource === 'jobs' || resource === 'sites' || resource === 'contacts')
        return { customerId }
      return {}
    }

    const ids = ext.plantIds.length > 0 ? ext.plantIds : ['__none__']
    if (resource === 'plants') return { id: { in: ids } }
    if (resource === 'jobs') return { plants: { some: { plantId: { in: ids } } } }
    // Sites that contain at least one visible plant
    if (resource === 'sites') return { customerId, plants: { some: { id: { in: ids } } } }
    // Contacts of the visible plants, of their sites, or company-wide
    if (resource === 'contacts') return {
      customerId,
      OR: [
        { plantId: { in: ids } },
        { site: { plants: { some: { id: { in: ids } } } } },
        { siteId: null, plantId: null },
      ],
    }
    return {}
  }

  // Legacy role-based fallback (non-external roles that still carry a customerId)
  const scope = ROLE_PERMISSIONS[role]?.[resource]?.scope ?? 'all'

  if (scope === 'own_company') {
    if (resource === 'customers') return { id: customerId }
    if (resource === 'plants') return { customerId }
    if (resource === 'sites') return { customerId }
    if (resource === 'contacts') return { customerId }
    if (resource === 'jobs') return { customerId }
    if (resource === 'opportunities') return { customerId }
    if (resource === 'requests') return { customerId }
    return {}
  }

  if (scope === 'own_plant') {
    if (!userId) return { id: 'NONE' }

    const assignments = await prisma.plantExternalUser.findMany({
      where: { userId },
      select: { plantId: true },
    })
    const plantIds = assignments.map(a => a.plantId)

    if (plantIds.length === 0) return { id: 'NONE' }

    if (resource === 'plants') return { id: { in: plantIds } }
    if (resource === 'jobs') return { plants: { some: { plantId: { in: plantIds } } } }
    if (resource === 'customers') return { id: customerId }
    if (resource === 'sites') return { plants: { some: { id: { in: plantIds } } } }
    if (resource === 'contacts') return {
      OR: [
        { plantId: { in: plantIds } },
        { site: { plants: { some: { id: { in: plantIds } } } } },
        { customerId, siteId: null, plantId: null },
      ],
    }
    return {}
  }

  return {}
}
