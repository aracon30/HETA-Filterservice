import { UserRole } from '@prisma/client'
import { Session } from 'next-auth'
import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'

export type Resource = 'customers' | 'plants' | 'jobs' | 'checklist' | 'opportunities' | 'users'
export type Action = 'view' | 'create' | 'edit' | 'delete'

// Fetch permissions from DB with caching
export const getPermissions = unstable_cache(
  async (role: UserRole, resource: Resource) => {
    const perm = await prisma.rolePermission.findUnique({
      where: { role_resource: { role, resource } },
    })
    return perm
  },
  ['role-permissions'],
  { revalidate: 60 }
)

// Check if the session user can perform an action on a resource
export async function checkPermission(
  session: Session | null,
  resource: Resource,
  action: Action
): Promise<boolean> {
  if (!session?.user) return false

  const role = session.user.role as UserRole

  // Admin always has full access
  if (role === 'ADMIN') return true

  const perm = await getPermissions(role, resource)
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
  resource: Resource,
  scope: string | null
): Record<string, unknown> {
  if (!session?.user) return {}

  const role = session.user.role as UserRole
  const customerId = session.user.customerId

  // Internal roles — no filter needed
  if (role === 'ADMIN' || role === 'SERVICE_MANAGER' || role === 'SERVICE_TECHNICIAN') {
    return {}
  }

  if (!customerId) return { id: 'NONE' } // external user without customer → block all

  if (scope === 'own_company') {
    // Filter by customerId
    if (resource === 'customers') return { id: customerId }
    if (resource === 'plants') return { customerId }
    if (resource === 'jobs') return { customerId }
    if (resource === 'opportunities') return { customerId }
    return {}
  }

  if (scope === 'own_plant') {
    // MAINTENANCE_TECHNICIAN — scoped to customer (plant-level would need plantId in session)
    if (resource === 'plants') return { customerId }
    if (resource === 'jobs') return { customerId }
    if (resource === 'checklist') {
      // checklist items are fetched via job, filter happens at job level
      return {}
    }
    return {}
  }

  return {}
}
