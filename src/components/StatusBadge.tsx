import type { ExpenseStatus } from '#/lib/types'
import { STATUS_CLASS, STATUS_LABEL } from '#/lib/format'

interface StatusBadgeProps {
  status: ExpenseStatus
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CLASS[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  )
}
