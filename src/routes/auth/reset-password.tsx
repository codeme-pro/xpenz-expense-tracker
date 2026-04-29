import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { supabaseAuth } from '#/lib/supabase'

export const Route = createFileRoute('/auth/reset-password')({
  validateSearch: (s: Record<string, unknown>) => ({
    code: typeof s.code === 'string' ? s.code : '',
  }),
  component: ResetPassword,
})

function ResetPassword() {
  const { code } = Route.useSearch()
  const navigate = useNavigate()

  const [exchanged, setExchanged] = useState(false)
  const [exchangeError, setExchangeError] = useState(false)
  const [fields, setFields] = useState({ password: '', confirm: '' })
  const [errors, setErrors] = useState<Partial<typeof fields>>({})
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!code) {
      setExchangeError(true)
      return
    }
    supabaseAuth.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) setExchangeError(true)
      else setExchanged(true)
    })
  }, [code])

  const set = (key: keyof typeof fields) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFields((f) => ({ ...f, [key]: e.target.value }))
    if (errors[key]) setErrors((err) => ({ ...err, [key]: undefined }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs: Partial<typeof fields> = {}
    if (fields.password.length < 8) errs.password = 'At least 8 characters'
    if (fields.password !== fields.confirm) errs.confirm = 'Passwords do not match'
    if (Object.keys(errs).length) { setErrors(errs); return }

    setLoading(true)
    const { error } = await supabaseAuth.auth.updateUser({ password: fields.password })
    setLoading(false)
    if (error) {
      setErrors({ password: 'Failed to update password. Try again.' })
      return
    }
    setDone(true)
    setTimeout(() => navigate({ to: '/auth/sign-in' }), 2000)
  }

  if (exchangeError) {
    return (
      <div>
        <h2 className="text-base font-semibold text-text-1 mb-1">Link expired</h2>
        <p className="text-sm text-text-2 mb-6">This reset link is invalid or has expired.</p>
        <a
          href="/auth/forgot-password"
          className="block w-full h-11 bg-primary text-white text-sm font-semibold rounded-xl flex items-center justify-center cursor-pointer"
        >
          Request a new link
        </a>
      </div>
    )
  }

  if (!exchanged) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-sm text-text-2">Verifying link…</p>
      </div>
    )
  }

  if (done) {
    return (
      <div>
        <h2 className="text-base font-semibold text-text-1 mb-1">Password updated</h2>
        <p className="text-sm text-text-2">Redirecting to sign in…</p>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-base font-semibold text-text-1 mb-1">Set new password</h2>
      <p className="text-sm text-text-2 mb-6">Choose a strong password for your account.</p>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <label htmlFor="password" className="block text-xs font-medium text-text-1 mb-1">
            New password <span className="text-danger">*</span>
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={fields.password}
              onChange={set('password')}
              placeholder="Min. 8 characters"
              className="w-full h-11 pl-3 pr-10 text-sm border border-border rounded-xl bg-surface text-text-1 focus:outline-none focus:ring-2 focus:ring-primary"
              aria-describedby={errors.password ? 'password-error' : undefined}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-2 cursor-pointer"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.password && (
            <p id="password-error" role="alert" className="mt-1 text-xs text-danger">{errors.password}</p>
          )}
        </div>

        <div>
          <label htmlFor="confirm" className="block text-xs font-medium text-text-1 mb-1">
            Confirm password <span className="text-danger">*</span>
          </label>
          <input
            id="confirm"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            value={fields.confirm}
            onChange={set('confirm')}
            placeholder="Repeat password"
            className="w-full h-11 px-3 text-sm border border-border rounded-xl bg-surface text-text-1 focus:outline-none focus:ring-2 focus:ring-primary"
            aria-describedby={errors.confirm ? 'confirm-error' : undefined}
          />
          {errors.confirm && (
            <p id="confirm-error" role="alert" className="mt-1 text-xs text-danger">{errors.confirm}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          aria-busy={loading}
          className="w-full h-11 bg-primary text-white text-sm font-semibold rounded-xl disabled:opacity-50 touch-manipulation cursor-pointer transition-opacity duration-150"
        >
          {loading ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </div>
  )
}
