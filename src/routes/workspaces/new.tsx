import { createFileRoute, useNavigate, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { ArrowLeft, Building2 } from 'lucide-react'
import { getSession } from '#/lib/auth'

export const Route = createFileRoute('/workspaces/new')({
  beforeLoad: () => {
    if (!getSession()) throw redirect({ to: '/auth/sign-in' })
  },
  component: NewWorkspace,
})

function NewWorkspace() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Workspace name is required')
      return
    }
    if (trimmed.length < 2) {
      setError('Name must be at least 2 characters')
      return
    }
    setError('')
    setLoading(true)
    await new Promise((r) => setTimeout(r, 800))
    setLoading(false)
    navigate({ to: '/home' })
  }

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 h-14 px-4 border-b border-border shrink-0">
        <button
          onClick={() => navigate({ to: '/workspaces/' })}
          aria-label="Go back"
          className="flex items-center justify-center w-8 h-8 -ml-1 text-text-2 touch-manipulation cursor-pointer"
        >
          <ArrowLeft size={20} />
        </button>
        <span className="text-sm font-semibold text-text-1">New Workspace</span>
      </div>

      <div className="flex-1 flex flex-col items-center px-6 py-10">
        <div className="w-full max-w-sm">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Building2 size={28} className="text-primary" />
            </div>
          </div>

          <h1 className="text-xl font-bold text-text-1 text-center mb-1">Create a workspace</h1>
          <p className="text-sm text-text-2 text-center mb-8">
            30-day free trial. No card required.
          </p>

          <form onSubmit={handleSubmit} noValidate>
            <label htmlFor="workspace-name" className="block text-xs font-medium text-text-1 mb-1.5">
              Workspace name <span className="text-danger">*</span>
            </label>
            <input
              id="workspace-name"
              type="text"
              autoComplete="organization"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Corp"
              maxLength={60}
              className="w-full h-11 px-3 text-sm border border-border rounded-xl bg-surface text-text-1 focus:outline-none focus:ring-2 focus:ring-primary"
              aria-describedby={error ? 'name-error' : 'name-hint'}
            />
            {error ? (
              <p id="name-error" role="alert" className="mt-1.5 text-xs text-danger">
                {error}
              </p>
            ) : (
              <p id="name-hint" className="mt-1.5 text-xs text-text-2">
                Can be your company name or team name.
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              aria-busy={loading}
              className="mt-6 w-full h-11 bg-primary text-white text-sm font-semibold rounded-xl disabled:opacity-50 touch-manipulation cursor-pointer transition-opacity duration-150"
            >
              {loading ? 'Creating…' : 'Create workspace'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
