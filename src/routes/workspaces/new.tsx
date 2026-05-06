import { createFileRoute, useNavigate, redirect } from '@tanstack/react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { ArrowLeft, Building2, ChevronDown } from 'lucide-react'
import { getSession } from '#/lib/auth'
import { createWorkspace, fetchCurrencies } from '#/lib/queries'

const STORAGE_KEY = 'xpenz_workspace_id'

export const Route = createFileRoute('/workspaces/new')({
  beforeLoad: () => {
    if (!getSession()) throw redirect({ to: '/auth/sign-in' })
  },
  component: NewWorkspace,
})

function NewWorkspace() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState('')
  const [errors, setErrors] = useState<{ name?: string; currency?: string }>({})

  const { data: currencies = [] } = useQuery({
    queryKey: ['currencies'],
    queryFn: fetchCurrencies,
    staleTime: Infinity,
  })

  const createMutation = useMutation({
    mutationFn: () => createWorkspace(name.trim(), currency),
    onSuccess: (workspaceId) => {
      localStorage.setItem(STORAGE_KEY, workspaceId)
      navigate({ to: '/home' })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const newErrors: { name?: string; currency?: string } = {}
    if (!name.trim()) newErrors.name = 'Workspace name is required'
    else if (name.trim().length < 2) newErrors.name = 'Name must be at least 2 characters'
    if (!currency) newErrors.currency = 'Base currency is required'
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return }
    setErrors({})
    createMutation.mutate()
  }

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 h-14 px-4 border-b border-border shrink-0">
        <button
          onClick={() => navigate({ to: '/workspaces' })}
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

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            {/* Workspace name */}
            <div>
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
              />
              {errors.name ? (
                <p role="alert" className="mt-1.5 text-xs text-danger">{errors.name}</p>
              ) : (
                <p className="mt-1.5 text-xs text-text-2">Can be your company name or team name.</p>
              )}
            </div>

            {/* Base currency */}
            <div>
              <label htmlFor="workspace-currency" className="block text-xs font-medium text-text-1 mb-1.5">
                Base currency <span className="text-danger">*</span>
              </label>
              <div className="relative">
                <select
                  id="workspace-currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full h-11 pl-3 pr-9 text-sm border border-border rounded-xl bg-surface text-text-1 focus:outline-none focus:ring-2 focus:ring-primary appearance-none"
                >
                  <option value="" disabled>Select currency…</option>
                  {currencies.map((c) => (
                    <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-2" />
              </div>
              {errors.currency ? (
                <p role="alert" className="mt-1.5 text-xs text-danger">{errors.currency}</p>
              ) : (
                <p className="mt-1.5 text-xs text-text-2">Used for mileage and reports. Cannot be changed later.</p>
              )}
            </div>

            {createMutation.isError && (
              <p role="alert" className="text-xs text-danger">{(createMutation.error as Error).message}</p>
            )}

            <button
              type="submit"
              disabled={createMutation.isPending}
              aria-busy={createMutation.isPending}
              className="w-full h-11 bg-primary text-white text-sm font-semibold rounded-xl disabled:opacity-50 touch-manipulation cursor-pointer transition-opacity duration-150"
            >
              {createMutation.isPending ? 'Creating…' : 'Create workspace'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
