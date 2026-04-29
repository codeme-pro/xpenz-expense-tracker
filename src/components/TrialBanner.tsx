import { useNavigate } from '@tanstack/react-router'
import { Clock } from 'lucide-react'
import { useWorkspace } from '#/context/WorkspaceContext'

interface TrialBannerProps {
  variant: 'sidebar' | 'inline'
}

export function TrialBanner({ variant }: TrialBannerProps) {
  const { current } = useWorkspace()
  const navigate = useNavigate()

  if (current.status !== 'trial' || current.role !== 'owner') return null

  const urgent = current.trialDaysLeft <= 7

  if (variant === 'sidebar') {
    return (
      <div
        className={`mx-3 my-2 px-3 py-2 rounded-lg flex items-center justify-between gap-2 ${
          urgent ? 'bg-danger/10' : 'bg-amber-500/10'
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <Clock size={12} className={urgent ? 'text-danger shrink-0' : 'text-amber-600 shrink-0 dark:text-amber-400'} />
          <span className={`text-[11px] font-medium truncate ${urgent ? 'text-danger' : 'text-amber-700 dark:text-amber-400'}`}>
            Trial: {current.trialDaysLeft}d left
          </span>
        </div>
        <button
          onClick={() => navigate({ to: '/workspace/settings' })}
          className={`text-[11px] font-semibold shrink-0 cursor-pointer hover:underline ${urgent ? 'text-danger' : 'text-amber-700 dark:text-amber-400'}`}
        >
          Add card
        </button>
      </div>
    )
  }

  return (
    <div
      className={`flex items-center justify-between gap-2 px-4 py-2 text-xs ${
        urgent ? 'bg-danger/10 text-danger' : 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
      }`}
    >
      <div className="flex items-center gap-1.5">
        <Clock size={12} className="shrink-0" />
        <span className="font-medium">Trial ends in {current.trialDaysLeft} days</span>
      </div>
      <button
        onClick={() => navigate({ to: '/workspace/settings' })}
        className="font-semibold underline cursor-pointer touch-manipulation"
      >
        Add payment →
      </button>
    </div>
  )
}
