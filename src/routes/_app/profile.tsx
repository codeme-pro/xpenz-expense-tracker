import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { LogOut, User, Building2, Sun, Moon } from 'lucide-react'
import { useAuth } from '#/context/AuthContext'
import { useWorkspace } from '#/context/WorkspaceContext'
import { useTheme } from '#/context/ThemeContext'
import { TopBar } from '#/components/TopBar'
import { Avatar } from '#/components/Avatar'
import { getInitials } from '#/lib/format'

export const Route = createFileRoute('/_app/profile')({
  component: ProfileScreen,
})

function ProfileScreen() {
  const { user, signOut } = useAuth()
  const { current: workspace } = useWorkspace()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    await navigate({ to: '/auth/sign-in' })
  }

  if (!user) return null

  return (
    <div>
      <TopBar title="Profile" />
      <div className="px-4 py-4 space-y-4">
        <div className="bg-surface rounded-xl p-4 border border-border shadow-sm flex items-center gap-3">
          <Avatar initials={getInitials(user.name)} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-text-1">{user.name}</p>
            <p className="text-xs text-text-2 truncate">{user.email}</p>
            <p className="text-xs text-primary font-medium capitalize mt-0.5">
              {workspace.role}
            </p>
          </div>
        </div>

        <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <Building2 size={16} className="text-text-2 shrink-0" />
              <span className="text-sm text-text-1">{user.department}</span>
            </div>
          </div>
          <div className="h-px bg-border mx-4" />
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
              className="flex items-center gap-1.5 text-xs font-semibold text-primary touch-manipulation cursor-pointer"
            >
              {theme === 'dark' ? 'Dark' : 'Light'}
            </button>
          </div>
          <div className="h-px bg-border mx-4" />
          <div className="flex items-center gap-2 px-4 py-3">
            <User size={16} className="text-text-2 shrink-0" />
            <span className="text-sm text-text-2 capitalize">{workspace.role}</span>
          </div>
        </div>

        <button
          onClick={handleSignOut}
          className="w-full h-11 flex items-center justify-center gap-2 bg-danger/10 border border-danger/60 text-danger text-sm font-semibold rounded-xl touch-manipulation cursor-pointer hover:bg-danger/20 transition-colors duration-150"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </div>
  )
}
