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
    const userId = session.user.id
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
    // Sites that contain at least one of the technician's assigned plants
    if (resource === 'sites') return { plants: { some: { id: { in: plantIds } } } }
    // Contacts at the technician's plant, at the site of that plant, or company-wide
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
