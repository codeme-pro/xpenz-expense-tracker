import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Car } from 'lucide-react'
import { fetchWorkspaceMileage, fetchWorkspaceMembers } from '#/lib/queries'
import { queryKeys } from '#/lib/queryKeys'
import { StatusBadge } from '#/components/StatusBadge'
import { EmptyState } from '#/components/EmptyState'
import { WorkspaceFilterBar } from '#/components/WorkspaceFilterBar'
import { formatCurrency, formatDate } from '#/lib/format'
import type { ExpenseStatus, WorkspaceFilters, WorkspacePeriod } from '#/lib/types'

export const Route = createFileRoute('/_app/workspace/mileage')({
  validateSearch: (search: Record<string, unknown>): WorkspaceFilters => ({
    memberId: typeof search.memberId === 'string' ? search.memberId : undefined,
    status: (['draft', 'submitted', 'approved', 'rejected'] as ExpenseStatus[]).includes(
      search.status as ExpenseStatus,
    )
      ? (search.status as ExpenseStatus)
      : undefined,
    period: (['all_time', 'this_month', 'last_month', 'last_3_months'] as WorkspacePeriod[]).includes(
      search.period as WorkspacePeriod,
    )
      ? (search.period as WorkspacePeriod)
      : 'all_time',
  }),
  component: WorkspaceMileageScreen,
})

function WorkspaceMileageScreen() {
  const filters = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })

  const { data: entries = [], isLoading } = useQuery({
    queryKey: queryKeys.workspaceMileage(filters),
    queryFn: () => fetchWorkspaceMileage(filters),
  })

  const { data: members = [] } = useQuery({
    queryKey: queryKeys.workspaceMembers(),
    queryFn: fetchWorkspaceMembers,
  })

  const handleFilterChange = (updates: Partial<WorkspaceFilters>) => {
    navigate({
      search: (prev) => {
        const next = { ...prev, ...updates }
        return Object.fromEntries(
          Object.entries(next).filter(([, v]) => v !== undefined),
        )
      },
    })
  }

  return (
    <div>
      <WorkspaceFilterBar
        filters={filters}
        members={members}
        onFilterChange={handleFilterChange}
      />

      {isLoading ? (
        <div className="mt-3 mx-4 bg-surface rounded-xl border border-border h-32 animate-pulse" />
      ) : entries.length === 0 ? (
        <EmptyState
          icon={<Car size={36} />}
          title="No mileage entries"
          body="No mileage matches the current filters."
        />
      ) : (
        <div className="mt-3 mx-4">

          {/* Mobile card list */}
          <div className="lg:hidden space-y-2">
            {entries.map((entry, i) => (
              <div
                key={entry.id}
                className="bg-surface rounded-xl border border-border shadow-sm px-4 py-3 animate-fade-in-up"
                style={{ '--stagger-delay': `${i * 40}ms` } as React.CSSProperties}
              >
                <div className="flex items-start gap-2">
                  <p className="flex-1 text-sm font-semibold text-text-1 min-w-0">
                    {entry.fromLocation ?? '—'}
                    <span className="text-text-2 font-normal"> → </span>
                    {entry.toLocation ?? '—'}
                  </p>
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-text-2 tabular-nums">{entry.distance} {entry.unit}</p>
                    <p className="text-sm font-semibold text-text-1 tabular-nums">
                      {formatCurrency(entry.amount)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <StatusBadge status={entry.status} />
                  {entry.submitterName && (
                    <>
                      <span className="text-xs text-text-2">·</span>
                      <span className="text-xs text-text-2">{entry.submitterName}</span>
                    </>
                  )}
                  <span className="text-xs text-text-2">·</span>
                  <span className="text-xs text-text-2">{formatDate(entry.createdAt)}</span>
                </div>
                {entry.reportTitle && (
                  <p className="mt-1 text-xs text-primary truncate">{entry.reportTitle}</p>
                )}
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden lg:block bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-background">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-text-2">Trip</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-text-2">Member</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-text-2">Date</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-text-2">Distance</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-text-2">Status</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-text-2">Report</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-text-2">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {entries.map((entry, i) => (
                    <tr
                      key={entry.id}
                      className="animate-fade-in-up"
                      style={{ '--stagger-delay': `${i * 40}ms` } as React.CSSProperties}
                    >
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-text-1 truncate max-w-[180px]">
                          {entry.fromLocation ?? '—'} → {entry.toLocation ?? '—'}
                        </p>
                        {entry.purpose && (
                          <p className="text-xs text-text-2 mt-0.5 truncate max-w-[180px]">{entry.purpose}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-text-2">{entry.submitterName ?? '—'}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-xs text-text-2">{formatDate(entry.createdAt)}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-xs text-text-2 tabular-nums">{entry.distance} {entry.unit}</span>
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={entry.status} /></td>
                      <td className="px-4 py-3">
                        {entry.reportId ? (
                          <Link
                            to="/reports/$reportId"
                            params={{ reportId: entry.reportId }}
                            className="text-xs text-primary hover:underline truncate max-w-[120px] block cursor-pointer"
                          >
                            {entry.reportTitle ?? entry.reportId}
                          </Link>
                        ) : (
                          <span className="text-xs text-text-2">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-semibold text-text-1 tabular-nums">
                          {formatCurrency(entry.amount)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}
    </div>
  )
}
