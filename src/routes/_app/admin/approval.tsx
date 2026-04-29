import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, XCircle } from 'lucide-react'
import { fetchSubmittedExpenses, approveExpense, rejectExpense } from '#/lib/queries'
import { queryKeys } from '#/lib/queryKeys'
import { formatCurrency, formatDate } from '#/lib/format'
import { TopBar } from '#/components/TopBar'
import { StatusBadge } from '#/components/StatusBadge'
import { EmptyState } from '#/components/EmptyState'

export const Route = createFileRoute('/_app/admin/approval')({
  component: ApprovalQueue,
})

function ApprovalQueue() {
  const queryClient = useQueryClient()

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: queryKeys.submittedExpenses(),
    queryFn: fetchSubmittedExpenses,
  })

  const approve = useMutation({
    mutationFn: approveExpense,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.submittedExpenses() }),
  })

  const reject = useMutation({
    mutationFn: rejectExpense,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.submittedExpenses() }),
  })

  return (
    <div>
      <TopBar title={expenses.length > 0 ? `Approvals (${expenses.length})` : 'Approvals'} />

      {isLoading ? (
        <div className="px-4 py-4 bg-surface rounded-xl border border-border h-32 animate-pulse mx-4 mt-3" />
      ) : expenses.length === 0 ? (
        <EmptyState
          icon={<CheckCircle size={36} />}
          title="All clear"
          body="No expenses waiting for approval."
        />
      ) : (
        <div className="px-4 py-4 space-y-3">
          {expenses.map((expense) => (
            <div key={expense.id} className="bg-surface rounded-xl p-4 border border-border shadow-sm">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-1 truncate">{expense.merchant}</p>
                  <p className="text-xs text-text-2 mt-0.5">
                    {expense.submitterName ?? '—'} · {formatDate(expense.date)}
                  </p>
                </div>
                <p className="text-sm font-semibold text-text-1 tabular-nums shrink-0">
                  {formatCurrency(expense.amount, expense.currency)}
                </p>
              </div>
              <div className="mb-3">
                <StatusBadge status={expense.status} />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => reject.mutate(expense.id)}
                  disabled={reject.isPending || approve.isPending}
                  className="flex-1 h-9 flex items-center justify-center gap-1.5 text-xs font-medium text-danger border border-danger/30 rounded-lg touch-manipulation cursor-pointer disabled:opacity-50"
                >
                  <XCircle size={14} /> Reject
                </button>
                <button
                  onClick={() => approve.mutate(expense.id)}
                  disabled={approve.isPending || reject.isPending}
                  className="flex-1 h-9 flex items-center justify-center gap-1.5 text-xs font-semibold text-white bg-primary rounded-lg touch-manipulation cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle size={14} /> Approve
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
