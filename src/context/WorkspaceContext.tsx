import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import type { UserRole } from '#/lib/types'
import { db } from '#/lib/supabase'
import { useAuth } from './AuthContext'

export interface Workspace {
  id: string
  name: string
  role: UserRole
  status: 'trial' | 'active' | 'locked'
  trialDaysLeft: number
  scansThisMonth: number
  ownerName: string
  mileageRate: number
  isPremium: boolean
}

const PLACEHOLDER: Workspace = {
  id: '',
  name: '',
  role: 'member',
  status: 'trial',
  trialDaysLeft: 99,
  scansThisMonth: 0,
  ownerName: '',
  mileageRate: 0.80,
  isPremium: false,
}

interface WorkspaceContextValue {
  current: Workspace
  workspaces: Workspace[]
  loading: boolean
  switchWorkspace: (id: string) => void
  refreshWorkspace: () => Promise<void>
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [current, setCurrent] = useState<Workspace>(PLACEHOLDER)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.workspaceId) {
      setLoading(false)
      return
    }
    loadWorkspace(user.workspaceId, user.role)
  }, [user?.workspaceId, user?.role])

  async function loadWorkspace(workspaceId: string, role: UserRole) {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

    const [wsResult, scansResult] = await Promise.all([
      db
        .from('workspaces')
        .select('id, name, plan, plan_expires_at, mileage_rate_per_km')
        .eq('id', workspaceId)
        .maybeSingle(),
      db
        .from('scans')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .gte('created_at', monthStart),
    ])

    const ws = wsResult.data
    if (!ws) {
      setLoading(false)
      return
    }

    const now = Date.now()
    const expiresAt = ws.plan_expires_at ? new Date(ws.plan_expires_at).getTime() : null
    const trialDaysLeft = expiresAt ? Math.max(0, Math.ceil((expiresAt - now) / 86400000)) : 0
    const status: Workspace['status'] =
      ws.plan === 'trial' ? (trialDaysLeft > 0 ? 'trial' : 'locked') : 'active'

    const workspace: Workspace = {
      id: ws.id,
      name: ws.name,
      role,
      status,
      trialDaysLeft,
      scansThisMonth: scansResult.count ?? 0,
      ownerName: '',
      mileageRate: Number(ws.mileage_rate_per_km ?? 0.80),
      isPremium: ws.plan === 'premium',
    }

    setCurrent(workspace)
    setWorkspaces([workspace])
    setLoading(false)
  }

  function switchWorkspace(id: string) {
    const ws = workspaces.find((w) => w.id === id)
    if (ws) setCurrent(ws)
  }

  async function refreshWorkspace() {
    if (user?.workspaceId && user.role) {
      await loadWorkspace(user.workspaceId, user.role)
    }
  }

  return (
    <WorkspaceContext.Provider value={{ current, workspaces, loading, switchWorkspace, refreshWorkspace }}>
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider')
  return ctx
}
