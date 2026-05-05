import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Building2, X } from 'lucide-react'
import { supabaseAuth, db } from '#/lib/supabase'
import { useAuth } from '#/context/AuthContext'
import { fetchCurrencies } from '#/lib/queries'

export const Route = createFileRoute('/auth/onboarding')({
  component: Onboarding,
})

function Onboarding() {
  const navigate = useNavigate()
  const { refreshUser } = useAuth()
  const { data: currencies = [] } = useQuery({ queryKey: ['currencies'], queryFn: fetchCurrencies, staleTime: Infinity })
  const [currency, setCurrency] = useState('MYR')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [firstName, setFirstName] = useState('')

  // Domain conflict state
  const [showDomainModal, setShowDomainModal] = useState(false)
  const [domainName, setDomainName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteError, setInviteError] = useState('')

  useEffect(() => {
    supabaseAuth.auth.getSession().then(({ data: { session } }) => {
      if (!session) return
      const name = (session.user.user_metadata.name as string) ?? ''
      setFirstName(name.split(' ')[0] ?? '')
      if (session.user.app_metadata.domain_conflict) {
        const email = session.user.email ?? ''
        setDomainName(email.split('@')[1] ?? '')
        setShowDomainModal(true)
      }
    })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { data: { session } } = await supabaseAuth.auth.getSession()
    if (!session) { setLoading(false); return }

    const { error: dbError } = await db
      .from('users')
      .update({ reporting_currency: currency, onboarded: true })
      .eq('id', session.user.id)

    if (dbError) {
      setLoading(false)
      setError('Failed to save settings. Please try again.')
      return
    }
    await refreshUser()
    await navigate({ to: '/home' })
  }

  const handleJoinWithCode = async () => {
    if (!inviteCode.trim()) return
    setInviteLoading(true)
    setInviteError('')
    const { error: rpcError } = await db.rpc('join_workspace_with_invite', {
      p_code: inviteCode.trim(),
    })
    setInviteLoading(false)
    if (rpcError) {
      setInviteError('Invalid or expired invite code')
      return
    }
    setShowDomainModal(false)
  }

  return (
    <>
      <div>
        <h2 className="text-base font-semibold text-text-1 mb-1">
          Welcome{firstName ? `, ${firstName}` : ''}!
        </h2>
        <p className="text-sm text-text-2 mb-6">
          Almost there. Choose your reporting currency.
        </p>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label htmlFor="currency" className="block text-xs font-medium text-text-1 mb-1">
              Reporting currency <span className="text-danger">*</span>
            </label>
            <select
              id="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full h-11 px-3 text-sm border border-border rounded-xl bg-surface text-text-1 focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
            >
              {currencies.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-text-2">
              Expenses in other currencies will be converted to this for reporting.
            </p>
          </div>

          {error && (
            <p role="alert" className="text-xs text-danger">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            aria-busy={loading}
            className="w-full h-11 bg-primary text-white text-sm font-semibold rounded-xl disabled:opacity-50 touch-manipulation cursor-pointer transition-opacity duration-150"
          >
            {loading ? 'Saving…' : 'Get started'}
          </button>
        </form>
      </div>

      {/* Domain conflict modal */}
      {showDomainModal && (
        <>
          <div className="fixed inset-0 z-[60] bg-black/40" aria-hidden="true" />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="domain-modal-title"
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[70] w-full max-w-sm mx-auto bg-surface rounded-2xl border border-border shadow-2xl p-5"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <Building2 size={18} className="text-primary shrink-0" />
                <h3 id="domain-modal-title" className="text-sm font-semibold text-text-1">
                  Workspace already exists
                </h3>
              </div>
              <button
                onClick={() => setShowDomainModal(false)}
                aria-label="Close"
                className="w-7 h-7 flex items-center justify-center rounded-lg text-text-2 hover:bg-nav-hover-bg transition-colors duration-150 cursor-pointer shrink-0"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-sm text-text-2 mb-4">
              A workspace for <strong className="text-text-1">{domainName}</strong> already exists.
              You've been placed in a Personal workspace. Ask your admin for an invite code to join
              the team workspace.
            </p>

            <div className="space-y-3">
              <div>
                <label htmlFor="invite-code-modal" className="block text-xs font-medium text-text-1 mb-1">
                  Enter invite code
                </label>
                <input
                  id="invite-code-modal"
                  type="text"
                  autoComplete="off"
                  value={inviteCode}
                  onChange={(e) => {
                    setInviteCode(e.target.value)
                    setInviteError('')
                  }}
                  placeholder="e.g. abc123"
                  className="w-full h-11 px-3 text-sm border border-border rounded-xl bg-surface text-text-1 focus:outline-none focus:ring-2 focus:ring-primary"
                />
                {inviteError && (
                  <p role="alert" className="mt-1 text-xs text-danger">{inviteError}</p>
                )}
              </div>

              <button
                onClick={handleJoinWithCode}
                disabled={inviteLoading || !inviteCode.trim()}
                aria-busy={inviteLoading}
                className="w-full h-11 bg-primary text-white text-sm font-semibold rounded-xl disabled:opacity-50 touch-manipulation cursor-pointer transition-opacity duration-150"
              >
                {inviteLoading ? 'Joining…' : 'Join workspace'}
              </button>

              <button
                onClick={() => setShowDomainModal(false)}
                className="w-full h-10 border border-border text-text-2 text-sm font-medium rounded-xl hover:bg-nav-hover-bg transition-colors duration-150 cursor-pointer"
              >
                Continue with Personal workspace
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
