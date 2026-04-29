import { createFileRoute } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { Building2, Users, Shield, CreditCard, Zap, Receipt, Navigation, Pencil, Check, X, Loader2 } from 'lucide-react'
import { useWorkspace } from '#/context/WorkspaceContext'
import { useAuth } from '#/context/AuthContext'
import { updateMileageRate, updateWorkspacePlan } from '#/lib/queries'

export const Route = createFileRoute('/_app/workspace/settings')({
  component: WorkspaceSettingsScreen,
})

function WorkspaceSettingsScreen() {
  const { current, refreshWorkspace } = useWorkspace()
  const { role } = useAuth()
  const canEditPolicies = role === 'owner' || role === 'admin'
  const [editingRate, setEditingRate] = useState(false)
  const [rateInput, setRateInput] = useState('')

  const rateMutation = useMutation({
    mutationFn: (rate: number) => updateMileageRate(current.id, rate),
    onSuccess: async () => {
      await refreshWorkspace()
      setEditingRate(false)
    },
  })

  const planMutation = useMutation({
    mutationFn: (plan: 'free' | 'premium') => updateWorkspacePlan(current.id, plan),
    onSuccess: async () => { await refreshWorkspace() },
  })

  const startEditRate = () => {
    setRateInput(current.mileageRate.toFixed(2))
    setEditingRate(true)
    rateMutation.reset()
  }

  const saveRate = () => {
    const parsed = parseFloat(rateInput)
    if (isNaN(parsed) || parsed < 0) return
    rateMutation.mutate(Math.round(parsed * 100) / 100)
  }

  const estimatedCost = (current.scansThisMonth * 0.1).toFixed(2)
  const trialPct = current.status === 'trial'
    ? Math.round(((30 - current.trialDaysLeft) / 30) * 100)
    : 100

  return (
    <div>
      <div className="px-4 py-4 space-y-4 max-w-2xl">

        {/* Workspace info */}
        <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-xs font-semibold text-text-2 uppercase tracking-wider">Workspace</p>
          </div>
          <div className="divide-y divide-border">
            <SettingRow icon={<Building2 size={16} />} label="Name" value={current.name} />
            <SettingRow icon={<Users size={16} />} label="Your role" value="Owner" />
            <SettingRow
              icon={<Shield size={16} />}
              label="Plan"
              value={current.status === 'trial' ? `Trial · ${current.trialDaysLeft}d left` : 'Active'}
            />
          </div>
        </div>

        {/* Billing */}
        <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <CreditCard size={14} className="text-text-2" />
            <p className="text-xs font-semibold text-text-2 uppercase tracking-wider">Billing</p>
          </div>

          {/* Trial status */}
          {current.status === 'trial' && (
            <div className="px-4 py-4 border-b border-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-text-1">Free trial</span>
                <span className="text-xs text-text-2">{current.trialDaysLeft} days remaining</span>
              </div>
              <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all duration-300"
                  style={{ width: `${trialPct}%` }}
                />
              </div>
              <p className="text-xs text-text-2 mt-2">
                Trial ends in {current.trialDaysLeft} days. Add a card to continue without interruption.
              </p>
            </div>
          )}

          {/* Payment method */}
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div>
              <p className="text-sm text-text-1">Payment method</p>
              {current.status === 'trial' ? (
                <p className="text-xs text-text-2 mt-0.5">No card on file</p>
              ) : (
                <p className="text-xs text-text-2 mt-0.5">Visa •••• 4242</p>
              )}
            </div>
            <button className="text-xs font-semibold text-primary cursor-pointer hover:underline">
              {current.status === 'trial' ? 'Add card' : 'Change'}
            </button>
          </div>

          {/* Usage */}
          <div className="px-4 py-4 border-b border-border">
            <p className="text-sm font-medium text-text-1 mb-3">Usage this month</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-background rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Receipt size={13} className="text-text-2" />
                  <span className="text-xs text-text-2">Scans</span>
                </div>
                <p className="text-xl font-bold text-text-1 tabular-nums">{current.scansThisMonth}</p>
              </div>
              <div className="bg-background rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-xs text-text-2">Estimated</span>
                </div>
                <p className="text-xl font-bold text-text-1 tabular-nums">${estimatedCost}</p>
              </div>
            </div>
            <p className="text-xs text-text-2 mt-2">$0.10 per scan · monthly invoice</p>
          </div>

          {/* Premium */}
          <div className="px-4 py-4">
            {current.isPremium ? (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <Zap size={14} className="text-primary" />
                    <span className="text-sm font-semibold text-text-1">Premium</span>
                  </div>
                  <span className="text-xs font-semibold text-success bg-success/10 px-2 py-0.5 rounded-full">Active</span>
                </div>
                <p className="text-xs text-text-2 mb-3">Fraud detection · Advanced analytics · Priority support</p>
                {canEditPolicies && (
                  <button
                    onClick={() => planMutation.mutate('free')}
                    disabled={planMutation.isPending}
                    className="text-xs font-semibold text-danger cursor-pointer hover:underline disabled:opacity-50"
                  >
                    {planMutation.isPending ? 'Cancelling…' : 'Cancel Premium'}
                  </button>
                )}
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <Zap size={14} className="text-text-2" />
                  <span className="text-sm font-semibold text-text-1">Premium add-on</span>
                </div>
                <p className="text-xs text-text-2 mb-3">$30/month per workspace</p>
                <ul className="space-y-1 mb-4">
                  {['Fraud detection', 'Advanced analytics', 'Priority support'].map((f) => (
                    <li key={f} className="flex items-center gap-2 text-xs text-text-2">
                      <span className="w-1 h-1 rounded-full bg-text-2 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                {canEditPolicies && (
                  <button
                    onClick={() => planMutation.mutate('premium')}
                    disabled={planMutation.isPending}
                    className="w-full h-9 bg-primary text-white text-xs font-semibold rounded-xl disabled:opacity-50 touch-manipulation cursor-pointer"
                  >
                    {planMutation.isPending ? 'Activating…' : 'Upgrade to Premium'}
                  </button>
                )}
              </div>
            )}
            {planMutation.isError && (
              <p className="mt-2 text-xs text-danger">Failed to update plan. Try again.</p>
            )}
          </div>
        </div>

        {/* Policies */}
        <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-xs font-semibold text-text-2 uppercase tracking-wider">Policies</p>
          </div>
          <div className="divide-y divide-border">
            {/* Mileage rate row */}
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2">
                <Navigation size={15} className="text-text-2 shrink-0" />
                <span className="text-sm text-text-1">Mileage rate</span>
              </div>
              {editingRate ? (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 bg-background border border-border rounded-lg overflow-hidden">
                    <span className="pl-2 text-xs text-text-2 select-none">MYR</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={rateInput}
                      onChange={(e) => setRateInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveRate(); if (e.key === 'Escape') setEditingRate(false) }}
                      autoFocus
                      className="w-16 h-8 px-1 text-sm text-right bg-transparent text-text-1 focus:outline-none"
                    />
                    <span className="pr-2 text-xs text-text-2 select-none">/km</span>
                  </div>
                  <button
                    onClick={() => setEditingRate(false)}
                    aria-label="Cancel"
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-text-2 hover:bg-nav-hover-bg transition-colors duration-150 cursor-pointer"
                  >
                    <X size={13} />
                  </button>
                  <button
                    onClick={saveRate}
                    disabled={rateMutation.isPending}
                    aria-label="Save"
                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-primary text-white hover:opacity-90 disabled:opacity-50 transition-opacity duration-150 cursor-pointer"
                  >
                    {rateMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Check size={13} />}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-text-2">
                    MYR {current.mileageRate.toFixed(2)} / km
                  </span>
                  {canEditPolicies && (
                    <button
                      onClick={startEditRate}
                      aria-label="Edit mileage rate"
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-text-2 hover:bg-nav-hover-bg hover:text-text-1 transition-colors duration-150 cursor-pointer"
                    >
                      <Pencil size={13} />
                    </button>
                  )}
                </div>
              )}
            </div>
            {rateMutation.isError && (
              <p className="px-4 py-2 text-xs text-danger">Failed to save. Try again.</p>
            )}
          </div>
        </div>

        {/* Danger zone */}
        <div className="bg-surface rounded-xl border border-danger/20 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-danger/20">
            <p className="text-xs font-semibold text-danger uppercase tracking-wider">Danger Zone</p>
          </div>
          <div className="px-4 py-4">
            <p className="text-sm text-text-1 mb-1">Delete workspace</p>
            <p className="text-xs text-text-2 mb-3">
              Permanently deletes all data. This cannot be undone.
            </p>
            <button className="h-9 px-4 border border-danger text-danger text-xs font-semibold rounded-xl cursor-pointer hover:bg-danger/5 transition-colors duration-150">
              Delete workspace
            </button>
          </div>
        </div>

        <p className="text-xs text-text-2 text-center pb-4">Changes are saved automatically</p>
      </div>
    </div>
  )
}

function SettingRow({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-2">
        {icon && <span className="text-text-2 shrink-0">{icon}</span>}
        <span className="text-sm text-text-1">{label}</span>
      </div>
      <span className="text-sm font-medium text-text-2">{value}</span>
    </div>
  )
}
