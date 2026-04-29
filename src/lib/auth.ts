// Phase 2 shim: provides a synchronous getSession() for routes not yet
// migrated to async supabase.auth.getSession(). Remove in Phase 4/7.
// Role is NOT available here — use useAuth() in components instead.

const KEY = (() => {
  try {
    const ref = new URL(import.meta.env.VITE_SUPABASE_URL as string).hostname.split('.')[0]
    return `sb-${ref}-auth-token`
  } catch {
    return 'sb-sphxhjtghofuwndctlih-auth-token'
  }
})()

export function getSession(): { userId: string } | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as { user?: { id?: string } }
    return data.user?.id ? { userId: data.user.id } : null
  } catch {
    return null
  }
}
