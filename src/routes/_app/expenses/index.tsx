import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Receipt, Trash2, X, Check, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { fetchExpenses, deleteExpense } from '#/lib/queries'
import { queryKeys } from '#/lib/queryKeys'
import { TopBar } from '#/components/TopBar'
import { StatusBadge } from '#/components/StatusBadge'
import { EmptyState } from '#/components/EmptyState'
import { TabStrip } from '#/components/TabStrip'
import { PersonalFilterBar } from '#/components/PersonalFilterBar'
import { formatCurrency, formatDate } from '#/lib/format'
import type { ExpenseStatus, PersonalFilters, WorkspacePeriod } from '#/lib/types'
import { useState } from 'react'
import { useLongPress } from '#/lib/useLongPress'
import { useAuth } from '#/context/AuthContext'
import { useWorkspace } from '#/context/WorkspaceContext'

const REPORTS_TABS = [
  { to: '/reports', label: 'Reports' },
  { to: '/expenses', label: 'Expenses' },
  { to: '/mileage', label: 'Mileage' },
]

type ActionSheet = {
  id: string
  title: string
  status: ExpenseStatus
  confirmingDelete: boolean
}

export const Route = createFileRoute('/_app/expenses/')({
  validateSearch: (search: Record<string, unknown>): PersonalFilters => ({
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
    categoryId: typeof search.categoryId === 'string' ? search.categoryId : undefined,
  }),
  component: ExpensesScreen,
})

function ExpensesScreen() {
  const filters = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { current } = useWorkspace()
  const reportingCurrency = user?.reportingCurrency || current.baseCurrency

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [actionSheet, setActionSheet] = useState<ActionSheet | null>(null)
  const lp = useLongPress()

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: queryKeys.expenses(filters),
    queryFn: () => fetchExpenses(filters),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteExpense(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      toast.success('Expense deleted')
    },
    onError: () => toast.error('Failed to delete. Try again.'),
  })

  const handleFilterChange = (updates: Partial<PersonalFilters>) => {
    navigate({
      search: (prev) => {
        const next = { ...prev, ...updates }
        return Object.fromEntries(
          Object.entries(next).filter(([, v]) => v !== undefined),
        )
      },
    })
  }

  const closeActionSheet = () => setActionSheet(null)

  return (
    <div>
      <TopBar title="Expenses" workspaceTitle />
      <div className="lg:hidden">
        <TabStrip tabs={REPORTS_TABS} />
      </div>
      <PersonalFilterBar filters={filters} onFilterChange={handleFilterChange} showSearch />

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
            {expenses.map((expense, i) => (
              <div
                key={expense.id}
                onPointerDown={(e) => lp.start(expense.id, () => setActionSheet({ id: expense.id, title: expense.merchant, status: expense.status, confirmingDelete: false }), e)}
                onPointerUp={lp.cancel}
                onPointerMove={lp.move}
                onPointerCancel={lp.cancel}
                onClick={() => { if (lp.checkFired()) return; navigate({ to: '/expenses/$expenseId', params: { expenseId: expense.id } }) }}
                className={`w-full bg-surface rounded-xl border border-border shadow-sm px-4 py-3 text-left transition-all duration-150 cursor-pointer animate-fade-in-up ${lp.pressingId === expense.id ? 'scale-[0.97] opacity-80' : 'hover:bg-primary/5'}`}
                style={{ '--stagger-delay': `${i * 40}ms` } as React.CSSProperties}
              >
                <div className="flex items-center gap-2">
                  <p className="flex-1 text-sm font-semibold text-text-1 truncate">{expense.merchant}</p>
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <StatusBadge status={expense.status} />
                  <span className="text-xs text-text-2">·</span>
                  <span className="text-xs text-text-2">{formatDate(expense.date ?? expense.createdAt)}</span>
                  {expense.category && (
                    <>
                      <span className="text-xs text-text-2">·</span>
                      <span className="text-xs text-text-2 truncate">{expense.category}</span>
                    </>
                  )}
                  <span className="flex-1" />
                  <span className="text-sm font-semibold text-text-1 tabular-nums shrink-0">
                    {(() => {
                      const conv = expense.reportingAmounts?.[reportingCurrency]
                        ?? (expense.reportingCurrency === reportingCurrency ? expense.reportingAmount : null)
                      return formatCurrency(conv ?? expense.amount, conv != null ? reportingCurrency : expense.currency)
                    })()}
                  </span>
                </div>
                {expense.reportTitle && (
                  <button
                    onClick={(e) => { e.stopPropagation(); navigate({ to: '/reports/$reportId', params: { reportId: expense.reportId! } }) }}
                    className="mt-1 text-xs text-primary hover:underline truncate block text-left cursor-pointer"
                  >
                    {expense.reportTitle}
                  </button>
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
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-text-2">Expense</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-text-2">Date</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-text-2">Status</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-text-2">Report</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-text-2">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {expenses.map((expense, i) => (
                    <tr
                      key={expense.id}
                      onClick={() => pendingDeleteId !== expense.id && navigate({ to: '/expenses/$expenseId', params: { expenseId: expense.id } })}
                      onMouseLeave={() => { if (pendingDeleteId === expense.id) setPendingDeleteId(null) }}
                      className={`group/row transition-colors duration-100 cursor-pointer animate-fade-in-up ${pendingDeleteId === expense.id ? 'bg-danger/5' : 'hover:bg-primary/5'}`}
                      style={{ '--stagger-delay': `${i * 40}ms` } as React.CSSProperties}
                    >
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-text-1 truncate max-w-[160px]">{expense.merchant}</p>
                        <p className="text-xs text-text-2 mt-0.5">{expense.category ?? '—'}</p>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-xs text-text-2">{formatDate(expense.date ?? expense.createdAt)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={expense.status} />
                      </td>
                      <td className="px-4 py-3" onClick={(e) => expense.reportId && e.stopPropagation()}>
                        {expense.reportId ? (
                          <button
                            onClick={() => navigate({ to: '/reports/$reportId', params: { reportId: expense.reportId! } })}
                            className="text-xs text-primary hover:underline truncate max-w-[120px] block text-left cursor-pointer"
                          >
                            {expense.reportTitle ?? expense.reportId}
                          </button>
                        ) : (
                          <span className="text-xs text-text-2">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {pendingDeleteId === expense.id ? (
                            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                              <span className="text-xs text-danger font-medium mr-1">Delete?</span>
                              <button
                                onClick={() => { deleteMutation.mutate(expense.id); setPendingDeleteId(null) }}
                                disabled={deleteMutation.isPending}
                                className="p-1.5 rounded-lg bg-danger/10 text-danger hover:bg-danger/20 transition-colors duration-150 cursor-pointer"
                              >
                                {deleteMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                              </button>
                              <button
                                onClick={() => setPendingDeleteId(null)}
                                className="p-1.5 rounded-lg text-text-2 hover:bg-background transition-colors duration-150 cursor-pointer"
                              >
                                <X size={13} />
                              </button>
                            </div>
                          ) : (
                            expense.status === 'draft' && (
                              <div
                                className="flex items-center opacity-0 group-hover/row:opacity-100 translate-x-1 group-hover/row:translate-x-0 transition-all duration-150 ease-out"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  onClick={() => setPendingDeleteId(expense.id)}
                                  className="p-1.5 rounded-lg text-danger/50 hover:text-danger hover:bg-danger/10 transition-colors duration-150 cursor-pointer"
                                  title="Delete"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            )
                          )}
                          <span className={`text-sm font-semibold tabular-nums transition-opacity duration-150 ${pendingDeleteId === expense.id ? 'text-text-2 opacity-40' : 'text-text-1 group-hover/row:opacity-60'}`}>
                            {(() => {
                              const converted = expense.reportingAmounts?.[reportingCurrency]
                                ?? (expense.reportingCurrency === reportingCurrency ? expense.reportingAmount : null)
                              return formatCurrency(converted ?? expense.amount, converted != null ? reportingCurrency : expense.currency)
                            })()}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* Mobile action sheet */}
      {actionSheet && (
        <>
          <div className="lg:hidden fixed inset-0 z-40 bg-black/40" onClick={closeActionSheet} />
          <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface rounded-t-2xl border-t border-border shadow-xl animate-slide-up">
            <div className="p-4 pb-8">
              <div className="w-10 h-1 bg-border rounded-full mx-auto mb-4" />
              <p className="text-sm font-semibold text-text-1 mb-1 truncate px-1">{actionSheet.title}</p>
              {!actionSheet.confirmingDelete ? (
                <div className="mt-3 flex flex-col gap-1">
                  {actionSheet.status === 'draft' && (
                    <button
                      onClick={() => setActionSheet((s) => s ? { ...s, confirmingDelete: true } : null)}
                      className="flex items-center gap-3 w-full px-3 py-3 rounded-xl text-sm text-danger hover:bg-danger/10 transition-colors duration-150 cursor-pointer"
                    >
                      <Trash2 size={16} className="shrink-0" />
                      Delete expense
                    </button>
                  )}
                  <button
                    onClick={closeActionSheet}
                    className="flex items-center gap-3 w-full px-3 py-3 rounded-xl text-sm text-text-2 hover:bg-background transition-colors duration-150 mt-1 cursor-pointer"
                  >
                    <X size={16} className="shrink-0" />
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="mt-3">
                  <p className="text-sm text-text-2 px-1 mb-4">This cannot be undone.</p>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => { deleteMutation.mutate(actionSheet.id); closeActionSheet() }}
                      disabled={deleteMutation.isPending}
                      className="flex items-center justify-center gap-2 w-full h-11 rounded-xl text-sm font-semibold text-white bg-danger disabled:opacity-50 transition-opacity duration-150 cursor-pointer"
                    >
                      {deleteMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                      Yes, delete
                    </button>
                    <button
                      onClick={() => setActionSheet((s) => s ? { ...s, confirmingDelete: false } : null)}
                      className="flex items-center justify-center w-full h-11 rounded-xl text-sm text-text-2 border border-border hover:bg-background transition-colors duration-150 cursor-pointer"
                    >
                      Go back
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
