import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle } from 'lucide-react'
import { fetchWorkspaceReports, fetchWorkspaceMembers } from '#/lib/queries'
import { queryKeys } from '#/lib/queryKeys'
import { StatusBadge } from '#/components/StatusBadge'
import { EmptyState } from '#/components/EmptyState'
import { WorkspaceFilterBar } from '#/components/WorkspaceFilterBar'
import { formatCurrency, formatDate } from '#/lib/format'
import type { WorkspaceFilters } from '#/lib/types'

export const Route = createFileRoute('/_app/workspace/approvals')({
  validateSearch: (search: Record<string, unknown>): WorkspaceFilters => ({
    memberId: typeof search.memberId === 'string' ? search.memberId : undefined,
    status: 'submitted',
    period: 'all_time',
  }),
  component: WorkspaceApprovalsScreen,
})

function WorkspaceApprovalsScreen() {
  const navigate = useNavigate({ from: Route.fullPath })

  const { data: reports = [], isLoading } = useQuery({
    queryKey: queryKeys.workspaceReports({ status: 'submitted' }),
    queryFn: () => fetchWorkspaceReports({ status: 'submitted' }),
  })

  const { data: members = [] } = useQuery({
    queryKey: queryKeys.workspaceMembers(),
    queryFn: fetchWorkspaceMembers,
  })

  const handleFilterChange = (updates: Partial<WorkspaceFilters>) => {
    navigate({
      search: (prev) => {
        const next = { ...prev, ...updates } as Record<string, string | undefined>
        return Object.fromEntries(
          Object.entries(next).filter(([, v]) => v !== undefined),
        )
      },
    })
  }

  return (
    <div>
      <WorkspaceFilterBar
        filters={{ status: 'submitted', period: 'all_time' }}
        members={members}
        onFilterChange={handleFilterChange}
      />

      {isLoading ? (
        <div className="mt-3 mx-4 bg-surface rounded-xl border border-border h-32 animate-pulse" />
      ) : reports.length === 0 ? (
        <EmptyState
          icon={<CheckCircle size={36} />}
          title="All clear"
          body="No reports waiting for approval."
        />
      ) : (
        <div className="mt-3 mx-4">
          <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">

            {/* Mobile card list */}
            <div className="lg:hidden divide-y divide-border">
              {reports.map((r, i) => (
                <button
                  key={r.id}
                  onClick={() => navigate({ to: '/reports/$reportId', params: { reportId: r.id }, search: { ctx: 'admin' } })}
                  className="w-full px-4 py-3 text-left hover:bg-primary/5 transition-colors duration-100 cursor-pointer animate-fade-in-up"
                  style={{ '--stagger-delay': `${i * 40}ms` } as React.CSSProperties}
                >
                  <div className="flex items-center gap-2">
                    <p className="flex-1 text-sm font-semibold text-text-1 truncate">{r.title}</p>
                    <span className="text-sm font-semibold text-text-1 tabular-nums shrink-0">
                      {formatCurrency(r.totalAmount, r.currency)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <StatusBadge status={r.status} />
                    <span className="text-xs text-text-2">·</span>
                    <span className="text-xs text-text-2">
                      {r.expenseCount + r.mileageCount} {r.expenseCount + r.mileageCount === 1 ? 'item' : 'items'}
                    </span>
                    {r.submittedAt && (
                      <>
                        <span className="text-xs text-text-2">·</span>
                        <span className="text-xs text-text-2">{formatDate(r.submittedAt)}</span>
                      </>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-background">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-text-2">Report</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-text-2">Submitted</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-text-2">Items</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-text-2">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {reports.map((r, i) => (
                    <tr
                      key={r.id}
                      onClick={() => navigate({ to: '/reports/$reportId', params: { reportId: r.id }, search: { ctx: 'admin' } })}
                      className="hover:bg-primary/5 transition-colors duration-100 cursor-pointer animate-fade-in-up"
                      style={{ '--stagger-delay': `${i * 40}ms` } as React.CSSProperties}
                    >
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-text-1 truncate max-w-[200px]">{r.title}</p>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-xs text-text-2">
                          {r.submittedAt ? formatDate(r.submittedAt) : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-text-2">
                          {r.expenseCount + r.mileageCount}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-semibold text-text-1 tabular-nums">
                          {formatCurrency(r.totalAmount, r.currency)}
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
