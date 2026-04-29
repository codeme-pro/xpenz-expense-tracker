import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { CheckCircle } from 'lucide-react'
import { supabaseAuth } from '#/lib/supabase'

export const Route = createFileRoute('/auth/verify')({
  validateSearch: (s: Record<string, unknown>) => ({
    email: typeof s.email === 'string' ? s.email : '',
  }),
  component: Verify,
})

function Verify() {
  const { email } = Route.useSearch()
  const [loading, setLoading] = useState(false)
  const [resent, setResent] = useState(false)

  const handleResend = async () => {
    setLoading(true)
    await supabaseAuth.auth.resend({ type: 'signup', email })
    setLoading(false)
    setResent(true)
    setTimeout(() => setResent(false), 5000)
  }

  return (
    <div className="text-center">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary-light mb-4">
        <CheckCircle className="text-primary" size={28} />
      </div>
      <h2 className="text-base font-semibold text-text-1 mb-2">Check your inbox</h2>
      <p className="text-sm text-text-2 mb-6">
        We sent a confirmation link to{' '}
        <span className="font-medium text-text-1">{email}</span>
      </p>
      <p className="text-xs text-text-2 mb-6">
        Click the link in the email to activate your account. Check your spam folder if you don't
        see it.
      </p>

      <button
        onClick={handleResend}
        disabled={loading || resent}
        className="w-full h-11 border border-border text-sm font-medium text-text-1 rounded-xl disabled:opacity-50 touch-manipulation cursor-pointer hover:bg-surface transition-colors duration-150 mb-3"
      >
        {resent ? 'Email sent!' : loading ? 'Sending…' : 'Resend email'}
      </button>

      <p className="text-xs text-text-2">
        Wrong email?{' '}
        <Link to="/auth/sign-up" className="text-primary font-medium hover:underline">
          Go back
        </Link>
      </p>
    </div>
  )
}
