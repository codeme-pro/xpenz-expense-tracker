import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

// Full auth client — all .auth.* operations go through this
export const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    flowType: 'pkce',
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
})

// Sync session flag + cached token updated by the auth listener below.
// _cachedToken is fed to the db client's accessToken escape hatch,
// bypassing getSession() (and its mutex) for every data query.
let _sessionActive: boolean | null = null
let _cachedToken: string | null = null

supabaseAuth.auth.onAuthStateChange((_event, session) => {
  _sessionActive = !!session
  _cachedToken = session?.access_token ?? null
})

export const sessionActive = () => _sessionActive

// Data-only client — never calls getSession() for DB requests.
// accessToken option activates the escape hatch at node_modules/@supabase/supabase-js/dist/index.mjs:527,
// skipping the auth mutex entirely. Falls back to anon key if no session (RLS rejects anyway).
export const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
  accessToken: async () => _cachedToken ?? SUPABASE_ANON_KEY,
})
