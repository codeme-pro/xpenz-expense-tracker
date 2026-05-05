import { createFileRoute, Outlet } from '@tanstack/react-router'
import { useWorkspace } from '#/context/WorkspaceContext'
import { TopBar } from '#/components/TopBar'
import { TabStrip } from '#/components/TabStrip'
import { getWorkspaceTabs } from '#/lib/workspaceTabs'

export const Route = createFileRoute('/_app/workspace')({
  component: WorkspaceLayout,
})

function WorkspaceLayout() {
  const { current } = useWorkspace()
  return (
    <div>
      <TopBar title="Workspace" workspaceTitle />
      <div className="lg:hidden">
        <TabStrip tabs={getWorkspaceTabs(current.role)} />
      </div>
      <Outlet />
    </div>
  )
}
