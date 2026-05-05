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
  baseCurrency: string
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
  baseCurrency: 'MYR',
}

interface WorkspaceContextValue {
  current: Workspace
  workspaces: Workspace[]
  loading: boolean
  switchWorkspace: (id: string) => Promise<void>
  refreshWorkspace: () => Promise<void>
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

const STORAGE_KEY = 'xpenz_workspace_id'

function deriveStatus(plan: string, planExpiresAt: string | null): Pick<Workspace, 'status' | 'trialDaysLeft'> {
  if (plan !== 'trial') return { status: 'active', trialDaysLeft: 0 }
  const expiresAt = planExpiresAt ? new Date(planExpiresAt).getTime() : null
  const trialDaysLeft = expiresAt ? Math.max(0, Math.ceil((expiresAt - Date.now()) / 86400000)) : 0
  return { status: trialDaysLeft > 0 ? 'trial' : 'locked', trialDaysLeft }
}

async function fetchScansThisMonth(workspaceId: string): Promise<number> {
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
  const { count } = await db
    .from('scans')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .gte('created_at', monthStart)
  return count ?? 0
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [current, setCurrent] = useState<Workspace>(PLACEHOLDER)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.id) {
      setLoading(false)
      return
    }
    loadWorkspaces(user.id)
  }, [user?.id])

  async function loadWorkspaces(userId: string) {
    setLoading(true)

    const { data: memberships, error } = await db
      .from('workspace_members')
      .select('role, workspace:workspaces(id, name, plan, plan_expires_at, mileage_rate_per_km, base_currency)')
      .eq('user_id', userId)

    if (error || !memberships?.length) {
      setLoading(false)
      return
    }

    const mapped: Workspace[] = memberships.map((m) => {
      const ws = m.workspace as {
        id: string
        name: string
        plan: string
        plan_expires_at: string | null
        mileage_rate_per_km: number | null
        base_currency: string | null
      }
      return {
        id: ws.id,
        name: ws.name,
        role: m.role as UserRole,
        ...deriveStatus(ws.plan, ws.plan_expires_at),
        scansThisMonth: 0,
        ownerName: '',
        mileageRate: Number(ws.mileage_rate_per_km ?? 0.80),
        isPremium: ws.plan === 'premium',
        baseCurrency: ws.base_currency ?? 'MYR',
      }
    })

    // Determine active workspace
    const savedId = localStorage.getItem(STORAGE_KEY)
    const active = (savedId ? mapped.find((w) => w.id === savedId) : null) ?? mapped[0]

    // Persist active to localStorage
    localStorage.setItem(STORAGE_KEY, active.id)

    // Fetch scans count for active workspace
    const scansThisMonth = await fetchScansThisMonth(active.id)
    const activeWithScans = { ...active, scansThisMonth }

    const finalList = mapped.map((w) => (w.id === active.id ? activeWithScans : w))
    setWorkspaces(finalList)
    setCurrent(activeWithScans)
    setLoading(false)
  }

  async function switchWorkspace(id: string) {
    const ws = workspaces.find((w) => w.id === id)
    if (!ws) return
    localStorage.setItem(STORAGE_KEY, id)
    // Fetch fresh scans count for newly selected workspace
    const scansThisMonth = await fetchScansThisMonth(id)
    const updated = { ...ws, scansThisMonth }
    setCurrent(updated)
    setWorkspaces((prev) => prev.map((w) => (w.id === id ? updated : w)))
  }

  async function refreshWorkspace() {
    if (user?.id) await loadWorkspaces(user.id)
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
