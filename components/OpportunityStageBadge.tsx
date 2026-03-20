import { OPPORTUNITY_STAGE_LABELS } from '@/lib/constants'

type Stage = 'IDENTIFIED' | 'QUALIFIED' | 'PROPOSAL' | 'WON' | 'LOST'

const stageStyles: Record<Stage, string> = {
  IDENTIFIED: 'bg-slate-100 text-slate-700 border border-slate-200',
  QUALIFIED: 'bg-yellow-100 text-yellow-700 border border-yellow-200',
  PROPOSAL: 'bg-blue-100 text-blue-700 border border-blue-200',
  WON: 'bg-green-100 text-green-700 border border-green-200',
  LOST: 'bg-red-100 text-red-700 border border-red-200',
}

export default function OpportunityStageBadge({ stage }: { stage: string }) {
  const style = stageStyles[stage as Stage] ?? 'bg-gray-100 text-gray-600'
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${style}`}>
      {OPPORTUNITY_STAGE_LABELS[stage] ?? stage}
    </span>
  )
}
