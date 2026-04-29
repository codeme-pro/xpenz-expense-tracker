import { createFileRoute, Outlet, redirect, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { sessionActive } from '#/lib/supabase'
import { BottomNav } from '#/components/BottomNav'
import { Sidebar } from '#/components/Sidebar'
import { ScanPanel } from '#/components/ScanPanel'
import { WorkspaceSwitcherSheet } from '#/components/WorkspaceSwitcherSheet'
import { PanelProvider, usePanel } from '#/context/PanelContext'
import { WorkspaceProvider, useWorkspace } from '#/context/WorkspaceContext'
import { HardLockScreen } from '#/components/HardLockScreen'
import { TrialBanner } from '#/components/TrialBanner'
import { useAuth } from '#/context/AuthContext'

export const Route = createFileRoute('/_app')({
  beforeLoad: () => {
    // sessionActive() is synchronous — no lock competition with Supabase's
    // _recoverAndRefresh() which runs on tab focus and holds the same mutex
    // that getSession() needs. null = not yet initialized, let pass.
    if (sessionActive() === false) throw redirect({ to: '/auth/sign-in' })
  },
  component: AppLayoutWrapper,
})

function AppLayoutWrapper() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: '/auth/sign-in' })
    } else if (!loading && user && !user.onboarded) {
      navigate({ to: '/auth/onboarding' })
    }
  }, [loading, user, navigate])

  if (loading) return <div className="min-h-dvh bg-background" />
  if (!user || !user.onboarded) return <div className="min-h-dvh bg-background" />

  return (
    <WorkspaceProvider>
      <PanelProvider>
        <AppLayout />
      </PanelProvider>
    </WorkspaceProvider>
  )
}

function AppLayout() {
  const { role } = useAuth()
  const { activePanel } = usePanel()
  const { current, loading: workspaceLoading } = useWorkspace()
  if (workspaceLoading) return <div className="min-h-dvh bg-background" />
  if (current.status === 'locked') return <HardLockScreen />

  return (
    <div className="min-h-dvh bg-background lg:flex">
      <div className="hidden lg:block">
        {role && <Sidebar role={role} />}
      </div>
      <main className="flex-1 pb-[68px] lg:pb-0 lg:ml-56">
        <div className="lg:hidden">
          <TrialBanner variant="inline" />
        </div>
        <Outlet />
      </main>
      <div className="lg:hidden">
        {role && <BottomNav />}
      </div>

      {activePanel === 'scan' && <ScanPanel />}
      {activePanel === 'workspace-switcher' && (
        <div className="lg:hidden">
          <WorkspaceSwitcherSheet />
        </div>
      )}
    </div>
  )
}
