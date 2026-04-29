import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { LogOut, Sun, Moon, Lock, Pencil, Check, X, Loader2, ChevronRight } from 'lucide-react'
import { useAuth } from '#/context/AuthContext'
import { useTheme } from '#/context/ThemeContext'
import { TopBar } from '#/components/TopBar'
import { Avatar } from '#/components/Avatar'
import { getInitials } from '#/lib/format'
import { updateUserProfile, sendPasswordReset } from '#/lib/queries'

export const Route = createFileRoute('/_app/settings')({
  component: PreferencesScreen,
})

const CURRENCIES = ['MYR', 'USD', 'SGD', 'EUR', 'GBP', 'AUD', 'JPY', 'THB', 'IDR', 'PHP']

function PreferencesScreen() {
  const { user, role, signOut, refreshUser } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [editingProfile, setEditingProfile] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDept, setEditDept] = useState('')
  const [pwSent, setPwSent] = useState(false)

  const profileMutation = useMutation({
    mutationFn: ({ name, department }: { name: string; department: string }) =>
      updateUserProfile(user!.id, { name, department: department || null }),
    onSuccess: async () => {
      await refreshUser()
      setEditingProfile(false)
    },
  })

  const currencyMutation = useMutation({
    mutationFn: (currency: string) =>
      updateUserProfile(user!.id, { reportingCurrency: currency }),
    onSuccess: () => refreshUser(),
  })

  const passwordMutation = useMutation({
    mutationFn: () => sendPasswordReset(user!.email),
    onSuccess: () => {
      setPwSent(true)
      setTimeout(() => setPwSent(false), 5000)
    },
  })

  const handleSignOut = async () => {
    await signOut()
    queryClient.clear()
    navigate({ to: '/auth/sign-in' })
  }

  const startEdit = () => {
    setEditName(user?.name ?? '')
    setEditDept(user?.department ?? '')
    setEditingProfile(true)
  }

  const cancelEdit = () => {
    setEditingProfile(false)
    profileMutation.reset()
  }

  const saveProfile = () => {
    if (!editName.trim()) return
    profileMutation.mutate({ name: editName.trim(), department: editDept.trim() })
  }

  if (!user) return null

  return (
    <div>
      <TopBar title="Preferences" />
      <div className="px-4 py-4 space-y-4">

        {/* Profile */}
        <div
          className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden animate-fade-in-up"
          style={{ '--stagger-delay': '0ms' } as React.CSSProperties}
        >
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <p className="text-xs font-semibold text-text-2 uppercase tracking-wider">Profile</p>
            {!editingProfile ? (
              <button
                onClick={startEdit}
                aria-label="Edit profile"
                className="w-7 h-7 flex items-center justify-center rounded-lg text-text-2 hover:bg-nav-hover-bg hover:text-text-1 transition-colors duration-150 cursor-pointer"
              >
                <Pencil size={14} />
              </button>
            ) : (
              <div className="flex items-center gap-1">
                <button
                  onClick={cancelEdit}
                  aria-label="Cancel edit"
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-text-2 hover:bg-nav-hover-bg transition-colors duration-150 cursor-pointer"
                >
                  <X size={14} />
                </button>
                <button
                  onClick={saveProfile}
                  disabled={profileMutation.isPending || !editName.trim()}
                  aria-label="Save profile"
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-primary text-white hover:opacity-90 disabled:opacity-50 transition-opacity duration-150 cursor-pointer"
                >
                  {profileMutation.isPending ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Check size={14} />
                  )}
                </button>
              </div>
            )}
          </div>

          <div className="p-4 flex items-center gap-3">
            <Avatar initials={getInitials(user.name)} />
            <div className="flex-1 min-w-0">
              {editingProfile ? (
                <div className="space-y-2">
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Full name"
                    autoFocus
                    className="w-full h-9 px-3 text-sm bg-background border border-border rounded-lg text-text-1 placeholder:text-text-2 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                  <input
                    value={editDept}
                    onChange={(e) => setEditDept(e.target.value)}
                    placeholder="Department (optional)"
                    className="w-full h-9 px-3 text-sm bg-background border border-border rounded-lg text-text-1 placeholder:text-text-2 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                  {profileMutation.isError && (
                    <p className="text-xs text-danger">Failed to save. Try again.</p>
                  )}
                </div>
              ) : (
                <>
                  <p className="text-sm font-semibold text-text-1">{user.name}</p>
                  {user.department && (
                    <p className="text-xs text-text-2 mt-0.5">{user.department}</p>
                  )}
                  <p className="text-xs text-primary font-medium capitalize mt-0.5">{role}</p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Account */}
        <div
          className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden animate-fade-in-up"
          style={{ '--stagger-delay': '60ms' } as React.CSSProperties}
        >
          <div className="px-4 py-3 border-b border-border">
            <p className="text-xs font-semibold text-text-2 uppercase tracking-wider">Account</p>
          </div>
          <div className="divide-y divide-border">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-text-1">{user.email}</span>
              <span className="text-xs text-text-2">Email</span>
            </div>
            <button
              onClick={() => passwordMutation.mutate()}
              disabled={passwordMutation.isPending || pwSent}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-nav-hover-bg transition-colors duration-150 cursor-pointer disabled:opacity-60"
            >
              <div className="flex items-center gap-2">
                <Lock size={15} className="text-text-2 shrink-0" />
                <span className="text-sm text-text-1">Change password</span>
              </div>
              {passwordMutation.isPending ? (
                <Loader2 size={14} className="text-text-2 animate-spin" />
              ) : pwSent ? (
                <span className="text-xs text-success font-medium">Email sent</span>
              ) : (
                <ChevronRight size={14} className="text-text-2" />
              )}
            </button>
            {passwordMutation.isError && (
              <p className="px-4 py-2 text-xs text-danger">Failed to send. Try again.</p>
            )}
          </div>
        </div>

        {/* Preferences */}
        <div
          className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden animate-fade-in-up"
          style={{ '--stagger-delay': '120ms' } as React.CSSProperties}
        >
          <div className="px-4 py-3 border-b border-border">
            <p className="text-xs font-semibold text-text-2 uppercase tracking-wider">Preferences</p>
          </div>
          <div className="divide-y divide-border">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-text-1">Reporting currency</span>
              <div className="flex items-center gap-2">
                {currencyMutation.isPending && (
                  <Loader2 size={12} className="text-text-2 animate-spin" />
                )}
                <select
                  value={user.reportingCurrency}
                  onChange={(e) => currencyMutation.mutate(e.target.value)}
                  disabled={currencyMutation.isPending}
                  className="text-sm text-text-1 bg-background border border-border rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary cursor-pointer disabled:opacity-60"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2">
                {theme === 'dark' ? (
                  <Moon size={16} className="text-text-2 shrink-0" />
                ) : (
                  <Sun size={16} className="text-text-2 shrink-0" />
                )}
                <span className="text-sm text-text-1">Appearance</span>
              </div>
              <button
                onClick={toggleTheme}
                aria-label="Toggle theme"
                className="text-xs font-semibold text-primary touch-manipulation cursor-pointer"
              >
                {theme === 'dark' ? 'Dark' : 'Light'}
              </button>
            </div>
          </div>
        </div>

        {/* About */}
        <div
          className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden animate-fade-in-up"
          style={{ '--stagger-delay': '180ms' } as React.CSSProperties}
        >
          <div className="px-4 py-3 border-b border-border">
            <p className="text-xs font-semibold text-text-2 uppercase tracking-wider">About</p>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-text-1">Version</span>
            <span className="text-sm text-text-2">1.0.0</span>
          </div>
        </div>

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          className="w-full h-11 flex items-center justify-center gap-2 bg-danger/10 border border-danger/60 text-danger text-sm font-semibold rounded-xl touch-manipulation cursor-pointer hover:bg-danger/20 transition-colors duration-150 animate-fade-in-up"
          style={{ '--stagger-delay': '240ms' } as React.CSSProperties}
        >
          <LogOut size={16} />
          Sign out
        </button>

      </div>
    </div>
  )
}
