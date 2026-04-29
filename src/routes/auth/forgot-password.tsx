import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { supabaseAuth } from '#/lib/supabase'

export const Route = createFileRoute('/auth/forgot-password')({
  component: ForgotPassword,
})

function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.includes('@')) {
      setError('Enter a valid email address')
      return
    }
    setLoading(true)
    const { error: err } = await supabaseAuth.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })
    setLoading(false)
    if (err) {
      setError('Something went wrong. Try again.')
      return
    }
    setSent(true)
  }

  if (sent) {
    return (
      <div>
        <h2 className="text-base font-semibold text-text-1 mb-1">Check your email</h2>
        <p className="text-sm text-text-2 mb-6">
          We sent a password reset link to <span className="text-text-1 font-medium">{email}</span>.
        </p>
        <p className="text-xs text-text-2">
          Didn't receive it?{' '}
          <button
            onClick={() => setSent(false)}
            className="text-primary font-medium hover:underline cursor-pointer"
          >
            Try again
          </button>
        </p>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-base font-semibold text-text-1 mb-1">Forgot password</h2>
      <p className="text-sm text-text-2 mb-6">Enter your email and we'll send a reset link.</p>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-xs font-medium text-text-1 mb-1">
            Email <span className="text-danger">*</span>
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError('') }}
            placeholder="you@example.com"
            className="w-full h-11 px-3 text-sm border border-border rounded-xl bg-surface text-text-1 focus:outline-none focus:ring-2 focus:ring-primary"
            aria-describedby={error ? 'email-error' : undefined}
          />
          {error && (
            <p id="email-error" role="alert" className="mt-1 text-xs text-danger">{error}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          aria-busy={loading}
          className="w-full h-11 bg-primary text-white text-sm font-semibold rounded-xl disabled:opacity-50 touch-manipulation cursor-pointer transition-opacity duration-150"
        >
          {loading ? 'Sending…' : 'Send reset link'}
        </button>
      </form>

      <p className="mt-5 text-center text-xs text-text-2">
        Remember it?{' '}
        <Link to="/auth/sign-in" className="text-primary font-medium hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  )
}
