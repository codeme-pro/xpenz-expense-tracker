import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { Eye, EyeOff, Building2 } from 'lucide-react'
import { supabaseAuth, db } from '#/lib/supabase'

export const Route = createFileRoute('/auth/sign-up')({
  validateSearch: (s: Record<string, unknown>) => ({
    code: typeof s.code === 'string' ? s.code : '',
  }),
  component: SignUp,
})

const FREE_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
  'icloud.com', 'live.com', 'msn.com', 'me.com',
  'aol.com', 'protonmail.com', 'mail.com', 'zoho.com',
  'yandex.com', 'tutanota.com', 'fastmail.com',
  'mailinator.com', 'guerrillamail.com', '10minutemail.com',
  'tempmail.com', 'throwam.com', 'yopmail.com',
])

interface InviteInfo {
  workspace_name: string
  role: 'member' | 'admin'
}

function SignUp() {
  const navigate = useNavigate()
  const { code: urlCode } = Route.useSearch()

  const [fields, setFields] = useState({
    firstName: '',
    lastName: '',
    email: urlCode ? '' : '',
    password: '',
    inviteCode: urlCode,
  })
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<keyof typeof fields, string>>>({})
  const [loading, setLoading] = useState(false)
  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null)
  const [inviteLookupDone, setInviteLookupDone] = useState(false)

  // Lookup invite on mount if URL code present
  useEffect(() => {
    if (!urlCode) return
    db
      .rpc('lookup_invite_by_code', { p_code: urlCode })
      .then(({ data }) => {
        setInviteInfo(data as InviteInfo | null)
        setInviteLookupDone(true)
      })
  }, [urlCode])

  const set = (key: keyof typeof fields) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFields((f) => ({ ...f, [key]: e.target.value }))
    if (errors[key]) setErrors((err) => ({ ...err, [key]: undefined }))
  }

  const validate = () => {
    const e: Partial<Record<keyof typeof fields, string>> = {}
    if (!fields.firstName.trim()) e.firstName = 'Required'
    if (!fields.lastName.trim()) e.lastName = 'Required'
    if (!fields.email.includes('@')) {
      e.email = 'Enter a valid email address'
    } else {
      const domain = fields.email.split('@')[1]?.toLowerCase() ?? ''
      if (FREE_DOMAINS.has(domain) && domain.endsWith('mail.com') === false) {
        // allow free email domains — workspace path determined in DB trigger
      }
    }
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
    const { data, error } = await supabaseAuth.auth.signUp({
      email: fields.email,
      password: fields.password,
      options: {
        data: {
          name: `${fields.firstName.trim()} ${fields.lastName.trim()}`,
          invite_code: fields.inviteCode.trim() || undefined,
        },
      },
    })
    setLoading(false)

    if (error) {
      if (error.message.toLowerCase().includes('already registered')) {
        setErrors({ email: 'An account with this email already exists' })
      } else {
        setErrors({ email: error.message })
      }
      return
    }

    // When email confirmation is ON and email already exists, Supabase returns
    // no error but user.identities is [] (silent non-disclosure to prevent enumeration).
    if (!data.user || data.user.identities?.length === 0) {
      setErrors({ email: 'An account with this email already exists' })
      return
    }

    if (data.session) {
      // Email confirmation disabled — logged in immediately
      await navigate({ to: '/auth/onboarding' })
    } else {
      await navigate({ to: '/auth/verify', search: { email: fields.email } })
    }
  }

  return (
    <div>
      <h2 className="text-base font-semibold text-text-1 mb-1">Create your account</h2>
      <p className="text-sm text-text-2 mb-6">Start your 30-day free trial. No card required.</p>

      {/* Invite banner */}
      {inviteInfo && (
        <div className="flex items-center gap-2.5 p-3 mb-4 bg-primary/5 border border-primary/20 rounded-xl">
          <Building2 size={16} className="text-primary shrink-0" />
          <p className="text-xs text-text-1">
            Joining <strong>{inviteInfo.workspace_name}</strong> as{' '}
            <span className="capitalize">{inviteInfo.role}</span>
          </p>
        </div>
      )}
      {urlCode && inviteLookupDone && !inviteInfo && (
        <div className="p-3 mb-4 bg-danger/5 border border-danger/20 rounded-xl">
          <p className="text-xs text-danger">Invite code is invalid or expired.</p>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {/* Name row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="first-name" className="block text-xs font-medium text-text-1 mb-1">
              First name <span className="text-danger">*</span>
            </label>
            <input
              id="first-name"
              type="text"
              autoComplete="given-name"
              value={fields.firstName}
              onChange={set('firstName')}
              placeholder="Ali"
              className="w-full h-11 px-3 text-sm border border-border rounded-xl bg-surface text-text-1 focus:outline-none focus:ring-2 focus:ring-primary"
              aria-describedby={errors.firstName ? 'first-name-error' : undefined}
            />
            {errors.firstName && (
              <p id="first-name-error" role="alert" className="mt-1 text-xs text-danger">
                {errors.firstName}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="last-name" className="block text-xs font-medium text-text-1 mb-1">
              Last name <span className="text-danger">*</span>
            </label>
            <input
              id="last-name"
              type="text"
              autoComplete="family-name"
              value={fields.lastName}
              onChange={set('lastName')}
              placeholder="Hassan"
              className="w-full h-11 px-3 text-sm border border-border rounded-xl bg-surface text-text-1 focus:outline-none focus:ring-2 focus:ring-primary"
              aria-describedby={errors.lastName ? 'last-name-error' : undefined}
            />
            {errors.lastName && (
              <p id="last-name-error" role="alert" className="mt-1 text-xs text-danger">
                {errors.lastName}
              </p>
            )}
          </div>
        </div>

        {/* Email */}
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

        {/* Password */}
        <div>
          <label htmlFor="password" className="block text-xs font-medium text-text-1 mb-1">
            Password <span className="text-danger">*</span>
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
              aria-describedby={errors.password ? 'password-error' : 'password-hint'}
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
          {errors.password ? (
            <p id="password-error" role="alert" className="mt-1 text-xs text-danger">
              {errors.password}
            </p>
          ) : (
            <p id="password-hint" className="mt-1 text-xs text-text-2">At least 8 characters</p>
          )}
        </div>

        {/* Invite code — hidden if pre-filled from URL */}
        {!urlCode && (
          <div>
            <label htmlFor="invite-code" className="block text-xs font-medium text-text-1 mb-1">
              Invite code <span className="text-text-2 font-normal">(optional)</span>
            </label>
            <input
              id="invite-code"
              type="text"
              autoComplete="off"
              value={fields.inviteCode}
              onChange={set('inviteCode')}
              placeholder="e.g. abc123"
              className="w-full h-11 px-3 text-sm border border-border rounded-xl bg-surface text-text-1 focus:outline-none focus:ring-2 focus:ring-primary"
              aria-describedby="invite-code-hint"
            />
            <p id="invite-code-hint" className="mt-1 text-xs text-text-2">
              Have a code? You'll join the workspace directly.
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          aria-busy={loading}
          className="w-full h-11 bg-primary text-white text-sm font-semibold rounded-xl disabled:opacity-50 touch-manipulation cursor-pointer transition-opacity duration-150"
        >
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p className="mt-5 text-center text-xs text-text-2">
        Already have an account?{' '}
        <Link to="/auth/sign-in" className="text-primary font-medium hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  )
}
