import { createFileRoute, useNavigate, redirect } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Building2, ChevronRight, Lock, Clock, Plus, Loader2 } from 'lucide-react'
import { getSession } from '#/lib/auth'
import { db } from '#/lib/supabase'

const STORAGE_KEY = 'xpenz_workspace_id'

export const Route = createFileRoute('/workspaces/')({
  beforeLoad: () => {
    if (!getSession()) throw redirect({ to: '/auth/sign-in' })
  },
  component: WorkspaceList,
})

function deriveStatus(plan: string, planExpiresAt: string | null) {
  if (plan !== 'trial') return { status: 'active' as const, trialDaysLeft: 0 }
  const expiresAt = planExpiresAt ? new Date(planExpiresAt).getTime() : null
  const trialDaysLeft = expiresAt ? Math.max(0, Math.ceil((expiresAt - Date.now()) / 86400000)) : 0
  return { status: (trialDaysLeft > 0 ? 'trial' : 'locked') as 'trial' | 'locked', trialDaysLeft }
}

async function fetchMyWorkspaces() {
  const session = getSession()
  if (!session) return []
  const { data, error } = await db
    .from('workspace_members')
    .select('role, workspace:workspaces(id, name, plan, plan_expires_at)')
    .eq('user_id', session.userId)
  if (error || !data) return []
  return data.map((m) => {
    const ws = m.workspace as { id: string; name: string; plan: string; plan_expires_at: string | null }
    return {
      id: ws.id,
      name: ws.name,
      role: m.role as string,
      ...deriveStatus(ws.plan, ws.plan_expires_at),
    }
  })
}

type WorkspaceItem = Awaited<ReturnType<typeof fetchMyWorkspaces>>[number]

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
  const { data: workspaces = [], isLoading } = useQuery({
    queryKey: ['myWorkspaces'],
    queryFn: fetchMyWorkspaces,
  })

  const handleSelect = (ws: WorkspaceItem) => {
    localStorage.setItem(STORAGE_KEY, ws.id)
    navigate({ to: '/home' })
  }

  return (
    <div className="min-h-dvh bg-background flex flex-col">
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
              {isLoading ? '…' : `${workspaces.length} workspace${workspaces.length !== 1 ? 's' : ''}`}
            </p>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 size={24} className="animate-spin text-text-2" />
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {workspaces.map((ws) => (
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
                    <p className="text-xs text-text-2 mt-0.5 capitalize">{ws.role}</p>
                    {ws.status === 'locked' && (
                      <p className="text-xs text-danger mt-1">Add payment to restore access</p>
                    )}
                  </div>

                  <ChevronRight size={16} className="text-text-2 shrink-0" />
                </button>
              ))}

              <button
                onClick={() => navigate({ to: '/workspaces/new' })}
                className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl border-2 border-dashed border-border hover:border-primary/40 hover:bg-primary/[0.02] transition-colors duration-150 cursor-pointer touch-manipulation"
              >
                <Plus size={16} className="text-text-2" />
                <span className="text-sm font-medium text-text-2">Create new workspace</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
