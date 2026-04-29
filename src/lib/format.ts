import type { ExpenseCategory, ExpenseStatus } from './types'

export function formatCurrency(amount: number, currency = 'MYR'): string {
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(isoDate: string | null | undefined): string {
  if (!isoDate) return '—'
  return new Intl.DateTimeFormat('en-MY', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(isoDate))
}

export function formatRelative(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  return formatDate(isoDate)
}

export function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export const STATUS_LABEL: Record<ExpenseStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  approved: 'Approved',
  rejected: 'Rejected',
}

export const STATUS_CLASS: Record<ExpenseStatus, string> = {
  draft: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300',
  submitted: 'bg-blue-50 text-blue-600',
  approved: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-red-50 text-red-600',
}

export const CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  meals: 'Meals & Food',
  transport: 'Transport',
  accommodation: 'Accommodation',
  office: 'Office Supplies',
  client: 'Client Entertainment',
  tech: 'Technology',
  other: 'Other',
}
