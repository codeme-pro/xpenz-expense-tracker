import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Receipt, ShieldCheck, ShieldAlert, Shield } from 'lucide-react'
import { fetchWorkspaceExpenses, fetchWorkspaceMembers } from '#/lib/queries'
import { queryKeys } from '#/lib/queryKeys'
import { StatusBadge } from '#/components/StatusBadge'
import { EmptyState } from '#/components/EmptyState'
import { WorkspaceFilterBar } from '#/components/WorkspaceFilterBar'
import { formatCurrency, formatDate } from '#/lib/format'
import { useWorkspace } from '#/context/WorkspaceContext'
import type { ExpenseStatus, WorkspaceFilters, WorkspacePeriod } from '#/lib/types'

export const Route = createFileRoute('/_app/workspace/expenses')({
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
    search: typeof search.search === 'string' ? search.search : undefined,
  }),
  component: WorkspaceExpensesScreen,
})

const AUTHENTICITY_BADGE = {
  likely_authentic: { Icon: ShieldCheck, label: 'Authentic', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/25' },
  suspicious: { Icon: ShieldAlert, label: 'Suspicious', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/25' },
  likely_ai_generated: { Icon: Shield, label: 'AI-Generated', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/25' },
}

const AUTHENTICITY_CARD_BORDER: Record<string, string> = {
  likely_authentic: 'border-l-[3px] border-l-emerald-500',
  suspicious: 'border-l-[3px] border-l-amber-500',
  likely_ai_generated: 'border-l-[3px] border-l-red-500',
}

function AuthBadge({ verdict }: { verdict: string }) {
  const cfg = (AUTHENTICITY_BADGE as Record<string, typeof AUTHENTICITY_BADGE[keyof typeof AUTHENTICITY_BADGE] | undefined>)[verdict]
  if (!cfg) return null
  const { Icon, label, color, bg, border } = cfg
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${color} ${bg} ${border}`}>
      <Icon size={10} />
      {label}
    </span>
  )
}

function WorkspaceExpensesScreen() {
  const filters = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const { current } = useWorkspace()
  const isAdminOrOwner = current.role === 'admin' || current.role === 'owner'
  const showAuth = current.isPremium && isAdminOrOwner

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: queryKeys.workspaceExpenses(filters),
    queryFn: () => fetchWorkspaceExpenses(filters),
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
        filters={filters}
        members={members}
        onFilterChange={handleFilterChange}
        showSearch
      />

      {isLoading ? (
        <div className="mt-3 mx-4 bg-surface rounded-xl border border-border h-32 animate-pulse" />
      ) : expenses.length === 0 ? (
        <EmptyState
          icon={<Receipt size={36} />}
          title="No expenses"
          body="No expenses match the current filters."
        />
      ) : (
        <div className="mt-3 mx-4">

          {/* Mobile card list */}
          <div className="lg:hidden space-y-2">
            {expenses.map((expense, i) => {
              const authBorder = showAuth && expense.authenticityVerdict
                ? (AUTHENTICITY_CARD_BORDER[expense.authenticityVerdict] ?? '')
                : ''
              return (
                <button
                  key={expense.id}
                  onClick={() => navigate({ to: '/expenses/$expenseId', params: { expenseId: expense.id }, search: { ctx: 'workspace' } })}
                  className={`w-full bg-surface rounded-xl border border-border shadow-sm px-4 py-3 text-left hover:bg-primary/5 transition-colors duration-100 cursor-pointer animate-fade-in-up ${authBorder}`}
                  style={{ '--stagger-delay': `${i * 40}ms` } as React.CSSProperties}
                >
                  <div className="flex items-center gap-2">
                    <p className="flex-1 text-sm font-semibold text-text-1 truncate">{expense.merchant}</p>
                    <StatusBadge status={expense.status} />
                    <span className="text-sm font-semibold text-text-1 tabular-nums shrink-0">
                      {expense.reportingAmount != null && expense.reportingCurrency
                        ? formatCurrency(expense.reportingAmount, expense.reportingCurrency)
                        : formatCurrency(expense.amount, expense.currency)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    {expense.submitterName && (
                      <span className="text-xs text-text-2 truncate">{expense.submitterName}</span>
                    )}
                    <span className="text-xs text-text-2">·</span>
                    <span className="text-xs text-text-2">{formatDate(expense.date ?? expense.createdAt)}</span>
                    {expense.category && (
                      <>
                        <span className="text-xs text-text-2">·</span>
                        <span className="text-xs text-text-2 truncate">{expense.category}</span>
                      </>
                    )}
                    {showAuth && expense.authenticityVerdict && (
                      <AuthBadge verdict={expense.authenticityVerdict} />
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden lg:block bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-background">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-text-2">Expense</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-text-2">Member</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-text-2">Date</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-text-2">Status</th>
                    {showAuth && <th className="text-left px-4 py-2.5 text-xs font-semibold text-text-2">Authenticity</th>}
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-text-2">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {expenses.map((expense, i) => (
                    <tr
                      key={expense.id}
                      onClick={() => navigate({ to: '/expenses/$expenseId', params: { expenseId: expense.id }, search: { ctx: 'workspace' } })}
                      className="hover:bg-primary/5 transition-colors duration-100 cursor-pointer animate-fade-in-up"
                      style={{ '--stagger-delay': `${i * 40}ms` } as React.CSSProperties}
                    >
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-text-1 truncate max-w-[160px]">{expense.merchant}</p>
                        <p className="text-xs text-text-2 mt-0.5">{expense.category ?? '—'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-text-2">{expense.submitterName ?? '—'}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-xs text-text-2">{formatDate(expense.date ?? expense.createdAt)}</span>
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={expense.status} /></td>
                      {showAuth && (
                        <td className="px-4 py-3">
                          {expense.authenticityVerdict
                            ? <AuthBadge verdict={expense.authenticityVerdict} />
                            : <span className="text-xs text-text-2/40">—</span>}
                        </td>
                      )}
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-semibold text-text-1 tabular-nums">
                          {expense.reportingAmount != null && expense.reportingCurrency
                            ? formatCurrency(expense.reportingAmount, expense.reportingCurrency)
                            : formatCurrency(expense.amount, expense.currency)}
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
