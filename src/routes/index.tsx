import { createFileRoute, redirect } from '@tanstack/react-router'
import { supabaseAuth } from '#/lib/supabase'

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    const { data: { session } } = await supabaseAuth.auth.getSession()
    throw redirect({ to: session ? '/home' : '/auth/sign-in' })
  },
  component: () => null,
})
