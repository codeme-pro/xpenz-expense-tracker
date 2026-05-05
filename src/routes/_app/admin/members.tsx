import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { formatCurrency, getInitials } from '#/lib/format'
import { TopBar } from '#/components/TopBar'
import { Avatar } from '#/components/Avatar'
import { fetchWorkspaceMembers } from '#/lib/queries'
import { queryKeys } from '#/lib/queryKeys'
import { useWorkspace } from '#/context/WorkspaceContext'

export const Route = createFileRoute('/_app/admin/members')({
  component: MembersScreen,
})

function MembersScreen() {
  const { current } = useWorkspace()
  const { data: members = [] } = useQuery({
    queryKey: queryKeys.workspaceMembers(current.baseCurrency),
    queryFn: () => fetchWorkspaceMembers(current.baseCurrency),
  })

  return (
    <div>
      <TopBar title="Team Members" />
      <div className="px-4 py-4 space-y-2">
        {members.map((member) => (
          <div
            key={member.id}
            className="bg-surface rounded-xl p-4 border border-border shadow-sm flex items-center gap-3"
          >
            <Avatar initials={getInitials(member.name)} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-1">{member.name}</p>
              <p className="text-xs text-text-2">
                {member.department ?? '—'} ·{' '}
                <span className="capitalize">{member.role}</span>
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-semibold text-text-1 tabular-nums">
                {formatCurrency(member.totalExpenses, current.baseCurrency)}
              </p>
              {member.pendingExpenses > 0 && (
                <p className="text-xs text-blue-600">{member.pendingExpenses} pending</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
