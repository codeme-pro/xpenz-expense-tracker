import type { Expense } from '#/lib/types'
import { formatCurrency, formatDate } from '#/lib/format'
import { StatusBadge } from './StatusBadge'
import { ChevronRight } from 'lucide-react'

interface ExpenseRowProps {
  expense: Expense
  onClick?: () => void
  useReportingAmount?: boolean
}

export function ExpenseRow({ expense, onClick, useReportingAmount }: ExpenseRowProps) {
  const showReporting = useReportingAmount && expense.reportingAmount != null && expense.reportingCurrency != null
  const displayAmount = showReporting ? expense.reportingAmount! : expense.amount
  const displayCurrency = showReporting ? expense.reportingCurrency! : expense.currency

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 bg-surface text-left touch-manipulation active:bg-primary/10 cursor-pointer"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-1 truncate">
          {expense.title}
        </p>
        <p className="text-xs text-text-2 mt-0.5">
          {expense.merchant} · {formatDate(expense.date ?? expense.createdAt)}
        </p>
        <div className="mt-1.5">
          <StatusBadge status={expense.status} />
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold text-text-1 tabular-nums">
          {formatCurrency(displayAmount, displayCurrency)}
        </p>
        {showReporting && expense.currency !== expense.reportingCurrency && (
          <p className="text-[10px] text-text-2/60 tabular-nums mt-0.5">
            {formatCurrency(expense.amount, expense.currency)}
          </p>
        )}
        <ChevronRight size={14} className="text-text-2 ml-auto mt-1" />
      </div>
    </button>
  )
}
