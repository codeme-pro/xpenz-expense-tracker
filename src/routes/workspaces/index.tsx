import { createFileRoute, useNavigate, redirect } from '@tanstack/react-router'
import { Building2, ChevronRight, Lock, Clock, Plus } from 'lucide-react'
import { getSession } from '#/lib/auth'

export const Route = createFileRoute('/workspaces/')({
  beforeLoad: () => {
    if (!getSession()) throw redirect({ to: '/auth/sign-in' })
  },
  component: WorkspaceList,
})

const MOCK_WORKSPACES = [
  {
    id: 'ws-1',
    name: 'Acme Corp',
    role: 'owner' as const,
    memberCount: 12,
    status: 'trial' as const,
    trialDaysLeft: 18,
  },
  {
    id: 'ws-2',
    name: 'Freelance Studio',
    role: 'member' as const,
    memberCount: 4,
    status: 'active' as const,
    trialDaysLeft: 0,
  },
  {
    id: 'ws-3',
    name: 'Side Project LLC',
    role: 'owner' as const,
    memberCount: 1,
    status: 'locked' as const,
    trialDaysLeft: 0,
  },
]

function StatusBadge({ status, daysLeft }: { status: string; daysLeft: number }) {
  if (status === 'trial') {
    const urgent = daysLeft <= 7
    return (
      <span
        className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
          urgent ? 'bg-danger/10 text-danger' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
        }`}
      >
        <Clock size={10} />
        {daysLeft}d left
      </span>
    )
  }
  if (status === 'locked') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-danger/10 text-danger">
        <Lock size={10} />
        Locked
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-success/10 text-success">
      Active
    </span>
  )
}

function WorkspaceList() {
  const navigate = useNavigate()

  const handleSelect = (ws: (typeof MOCK_WORKSPACES)[number]) => {
    if (ws.status === 'locked') {
      navigate({ to: '/home' })
      return
    }
    navigate({ to: '/home' })
  }

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2.5 h-14 px-6 border-b border-border shrink-0">
        <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shrink-0">
          <span className="text-white font-bold text-xs select-none">X</span>
        </div>
        <span className="text-sm font-bold text-text-1">Xpenz</span>
      </div>

      <div className="flex-1 flex flex-col items-center px-6 py-10">
        <div className="w-full max-w-md">
          <div className="mb-6">
            <h1 className="text-xl font-bold text-text-1">Your Workspaces</h1>
            <p className="text-sm text-text-2 mt-0.5">
              {MOCK_WORKSPACES.length} workspace{MOCK_WORKSPACES.length !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {MOCK_WORKSPACES.map((ws) => (
              <button
                key={ws.id}
                onClick={() => handleSelect(ws)}
                className={`w-full flex items-center gap-4 p-4 rounded-2xl border text-left transition-all duration-150 cursor-pointer touch-manipulation ${
                  ws.status === 'locked'
                    ? 'border-danger/30 bg-danger/[0.03] hover:bg-danger/[0.06]'
                    : 'border-border bg-surface hover:border-primary/40 hover:shadow-sm'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    ws.status === 'locked' ? 'bg-danger/10' : 'bg-primary/10'
                  }`}
                >
                  {ws.status === 'locked' ? (
                    <Lock size={18} className="text-danger" />
                  ) : (
                    <Building2 size={18} className="text-primary" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-text-1">{ws.name}</span>
                    <StatusBadge status={ws.status} daysLeft={ws.trialDaysLeft} />
                  </div>
                  <p className="text-xs text-text-2 mt-0.5 capitalize">
                    {ws.role} · {ws.memberCount} member{ws.memberCount !== 1 ? 's' : ''}
                  </p>
                  {ws.status === 'locked' && (
                    <p className="text-xs text-danger mt-1">Add payment to restore access</p>
                  )}
                </div>

                <ChevronRight size={16} className="text-text-2 shrink-0" />
              </button>
            ))}

            {/* Create new */}
            <button
              onClick={() => navigate({ to: '/workspaces/new' })}
              className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl border-2 border-dashed border-border hover:border-primary/40 hover:bg-primary/[0.02] transition-colors duration-150 cursor-pointer touch-manipulation"
            >
              <Plus size={16} className="text-text-2" />
              <span className="text-sm font-medium text-text-2">Create new workspace</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
