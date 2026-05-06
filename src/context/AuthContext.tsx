import type { ReactNode } from 'react'
import { createContext, useContext, useState, useEffect } from 'react'
import type { User, UserRole } from '#/lib/types'
import { supabaseAuth, db } from '#/lib/supabase'

interface AuthContextValue {
  user: User | null
  role: UserRole | null
  loading: boolean
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function fetchUserProfile(userId: string, email: string): Promise<User | null> {
  const { data: profile } = await db
    .from('users')
    .select('id, name, department, reporting_currency, workspace_id, onboarded')
    .eq('id', userId)
    .maybeSingle()

  if (!profile) return null

  let role: UserRole = 'member'
  if (profile.workspace_id) {
    const { data: membership } = await db
      .from('workspace_members')
      .select('role')
      .eq('user_id', userId)
      .eq('workspace_id', profile.workspace_id)
      .maybeSingle()
    if (membership?.role) role = membership.role as UserRole
  }

  return {
    id: profile.id,
    name: profile.name ?? '',
    email,
    role,
    department: profile.department ?? '',
    reportingCurrency: profile.reporting_currency ?? '',
    workspaceId: profile.workspace_id ?? null,
    onboarded: profile.onboarded ?? false,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const { data: { subscription } } = supabaseAuth.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'TOKEN_REFRESHED') {
          setLoading(false)
          return
        }
        if (session) {
          const profile = await fetchUserProfile(session.user.id, session.user.email ?? '')
          setUser(profile)
        } else {
          setUser(null)
        }
        setLoading(false)
      },
    )
    return () => subscription.unsubscribe()
  }, [])

  const handleSignOut = async () => {
    await supabaseAuth.auth.signOut()
    setUser(null)
  }

  const refreshUser = async () => {
    const { data: { session } } = await supabaseAuth.auth.getSession()
    if (session) {
      const profile = await fetchUserProfile(session.user.id, session.user.email ?? '')
      setUser(profile)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role ?? null,
        loading,
        signOut: handleSignOut,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
