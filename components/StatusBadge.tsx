import { JOB_STATUS_LABELS } from '@/lib/constants'

type JobStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'

const statusStyles: Record<JobStatus, string> = {
  PLANNED: 'bg-gray-100 text-gray-700 border border-gray-200',
  IN_PROGRESS: 'bg-blue-100 text-blue-700 border border-blue-200',
  COMPLETED: 'bg-green-100 text-green-700 border border-green-200',
  CANCELLED: 'bg-red-100 text-red-700 border border-red-200',
}

export default function StatusBadge({ status }: { status: string }) {
  const style = statusStyles[status as JobStatus] ?? 'bg-gray-100 text-gray-600'
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${style}`}>
      {JOB_STATUS_LABELS[status] ?? status}
    </span>
  )
}
