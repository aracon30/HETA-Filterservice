import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import ManagerDashboard from './_components/ManagerDashboard'
import BuyerDashboard from './_components/BuyerDashboard'
import TechnicianDashboard from './_components/TechnicianDashboard'

export const dynamic = 'force-dynamic'

const EXTERNAL_ROLES = ['MAINTENANCE_MANAGER', 'MAINTENANCE_TECHNICIAN', 'BUYER']

export default async function PortalPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const role = session.user.role as string
  const customerId = session.user.customerId as string | undefined

  if (!EXTERNAL_ROLES.includes(role) || !customerId) redirect('/')

  const userId = session.user.id

  if (role === 'BUYER') {
    return <BuyerDashboard userId={userId} customerId={customerId} />
  }

  if (role === 'MAINTENANCE_TECHNICIAN') {
    return <TechnicianDashboard userId={userId} customerId={customerId} />
  }

  // MAINTENANCE_MANAGER
  return <ManagerDashboard userId={userId} customerId={customerId} />
}
