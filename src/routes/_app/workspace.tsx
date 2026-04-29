import { createFileRoute, Outlet } from '@tanstack/react-router'
import { useAuth } from '#/context/AuthContext'
import { TopBar } from '#/components/TopBar'
import { TabStrip } from '#/components/TabStrip'
import { getWorkspaceTabs } from '#/lib/workspaceTabs'

export const Route = createFileRoute('/_app/workspace')({
  component: WorkspaceLayout,
})

function WorkspaceLayout() {
  const { role } = useAuth()
  return (
    <div>
      <TopBar title="Workspace" workspaceTitle />
      <div className="lg:hidden">
        <TabStrip tabs={getWorkspaceTabs(role)} />
      </div>
      <Outlet />
    </div>
  )
}
