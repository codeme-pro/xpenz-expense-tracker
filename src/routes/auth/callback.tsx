import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { supabaseAuth } from '#/lib/supabase'

export const Route = createFileRoute('/auth/callback')({
  validateSearch: (s: Record<string, unknown>) => ({
    code: typeof s.code === 'string' ? s.code : '',
    error: typeof s.error === 'string' ? s.error : '',
  }),
  component: AuthCallback,
})

function AuthCallback() {
  const { code, error } = Route.useSearch()
  const navigate = useNavigate()

  useEffect(() => {
    if (error) {
      navigate({ to: '/auth/sign-in' })
      return
    }
    if (code) {
      supabaseAuth.auth.exchangeCodeForSession(code).then(({ error: exchangeError }) => {
        if (exchangeError) {
          navigate({ to: '/auth/sign-in' })
        } else {
          // onAuthStateChange in AuthContext fires; _app beforeLoad handles onboarding redirect
          navigate({ to: '/home' })
        }
      })
    }
  }, [code, error, navigate])

  return (
    <div className="min-h-dvh bg-background flex items-center justify-center">
      <p className="text-sm text-text-2">Signing you in…</p>
    </div>
  )
}
