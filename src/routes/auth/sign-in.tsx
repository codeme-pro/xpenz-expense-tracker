import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { supabaseAuth } from '#/lib/supabase'

export const Route = createFileRoute('/auth/sign-in')({
  component: SignIn,
})

function SignIn() {
  const [fields, setFields] = useState({ email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<Partial<typeof fields>>({})
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const set = (key: keyof typeof fields) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFields((f) => ({ ...f, [key]: e.target.value }))
    if (errors[key]) setErrors((err) => ({ ...err, [key]: undefined }))
  }

  const validate = () => {
    const e: Partial<typeof fields> = {}
    if (!fields.email.includes('@')) e.email = 'Enter a valid email address'
    if (fields.password.length < 8) e.password = 'At least 8 characters'
    return e
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) {
      setErrors(errs)
      return
    }
    setLoading(true)
    const { error } = await supabaseAuth.auth.signInWithPassword({
      email: fields.email,
      password: fields.password,
    })
    setLoading(false)
    if (error) {
      const isNetwork = error.message.toLowerCase().includes('fetch') || error.message.toLowerCase().includes('network')
      setErrors({ email: isNetwork ? 'Network error — check your connection' : 'Incorrect email or password' })
      return
    }
    await navigate({ to: '/home' })
  }

  return (
    <div>
      <h2 className="text-base font-semibold text-text-1 mb-1">Sign in</h2>
      <p className="text-sm text-text-2 mb-6">Welcome back. Enter your email and password.</p>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-xs font-medium text-text-1 mb-1">
            Email <span className="text-danger">*</span>
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={fields.email}
            onChange={set('email')}
            placeholder="you@example.com"
            className="w-full h-11 px-3 text-sm border border-border rounded-xl bg-surface text-text-1 focus:outline-none focus:ring-2 focus:ring-primary"
            aria-describedby={errors.email ? 'email-error' : undefined}
          />
          {errors.email && (
            <p id="email-error" role="alert" className="mt-1 text-xs text-danger">
              {errors.email}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="password" className="block text-xs font-medium text-text-1 mb-1">
            Password <span className="text-danger">*</span>
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
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
            <p id="password-error" role="alert" className="mt-1 text-xs text-danger">
              {errors.password}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          aria-busy={loading}
          className="w-full h-11 bg-primary text-white text-sm font-semibold rounded-xl disabled:opacity-50 touch-manipulation cursor-pointer transition-opacity duration-150"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="mt-5 text-center text-xs text-text-2">
        Don't have an account?{' '}
        <Link to="/auth/sign-up" className="text-primary font-medium hover:underline">
          Sign up free
        </Link>
      </p>
    </div>
  )
}
