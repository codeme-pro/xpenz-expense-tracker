import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { Building2, Users, ShieldCheck } from 'lucide-react'
import { db } from '#/lib/supabase'
import { getSession } from '#/lib/auth'

export const Route = createFileRoute('/join/$code')({
  loader: async ({ params }) => {
    const { data } = await db.rpc('lookup_invite_by_code', { p_code: params.code })
    return { invite: data as { workspace_name: string; role: 'member' | 'admin' } | null }
  },
  component: JoinWorkspace,
})

function JoinWorkspace() {
  const { code } = Route.useParams()
  const { invite } = Route.useLoaderData()
  const navigate = useNavigate()
  const isLoggedIn = !!getSession()
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState('')

  const handleJoin = async () => {
    setJoining(true)
    setError('')
    const { error: rpcError } = await db.rpc('join_workspace_with_invite', {
      p_code: code,
    })
    setJoining(false)
    if (rpcError) {
      setError('Failed to join. The invite may have expired.')
      return
    }
    navigate({ to: '/home' })
  }

  if (!invite) {
    return (
      <div className="min-h-dvh bg-background flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm text-center">
          <div className="w-14 h-14 rounded-2xl bg-danger/10 flex items-center justify-center mx-auto mb-4">
            <Building2 size={26} className="text-danger" />
          </div>
          <h1 className="text-lg font-bold text-text-1 mb-2">Invalid invite link</h1>
          <p className="text-sm text-text-2 mb-6">
            This invite link is invalid or has expired. Ask the workspace owner for a new link.
          </p>
          <Link
            to="/auth/sign-in"
            className="inline-flex items-center justify-center h-11 px-6 bg-primary text-white text-sm font-semibold rounded-xl"
          >
            Go to sign in
          </Link>
        </div>
      </div>
    )
  }

  const RoleIcon = invite.role === 'admin' ? ShieldCheck : Users
  const roleLabel = invite.role === 'admin' ? 'Admin' : 'Member'

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      <div className="flex items-center gap-2.5 h-14 px-6 border-b border-border shrink-0">
        <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shrink-0">
          <span className="text-white font-bold text-xs select-none">X</span>
        </div>
        <span className="text-sm font-bold text-text-1">Xpenz</span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Building2 size={28} className="text-primary" />
            </div>
            <h1 className="text-xl font-bold text-text-1 mb-1">You're invited</h1>
          </div>

          <div className="bg-surface border border-border rounded-2xl p-5 mb-6">
            <p className="text-base font-semibold text-text-1 mb-1">{invite.workspace_name}</p>
            <div className="flex items-center gap-1.5 text-xs text-text-2">
              <RoleIcon size={13} />
              <span>
                You'll join as <strong className="text-text-1">{roleLabel}</strong>
              </span>
            </div>
          </div>

          {error && (
            <p role="alert" className="mb-3 text-xs text-danger text-center">{error}</p>
          )}

          {isLoggedIn ? (
            <button
              onClick={handleJoin}
              disabled={joining}
              aria-busy={joining}
              className="w-full h-11 bg-primary text-white text-sm font-semibold rounded-xl disabled:opacity-50 touch-manipulation cursor-pointer"
            >
              {joining ? 'Joining…' : `Join ${invite.workspace_name}`}
            </button>
          ) : (
            <div className="space-y-3">
              <Link
                to="/auth/sign-up"
                search={{ code }}
                className="flex items-center justify-center w-full h-11 bg-primary text-white text-sm font-semibold rounded-xl touch-manipulation"
              >
                Create account &amp; join
              </Link>
              <Link
                to="/auth/sign-in"
                className="flex items-center justify-center w-full h-11 border border-border text-sm font-semibold text-text-1 rounded-xl touch-manipulation hover:bg-surface"
              >
                Sign in to join
              </Link>
            </div>
          )}

          {!isLoggedIn && (
            <p className="mt-4 text-center text-xs text-text-2">
              You'll be added to <strong>{invite.workspace_name}</strong> after signing in.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
