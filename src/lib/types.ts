export type ExpenseStatus = 'draft' | 'submitted' | 'approved' | 'rejected'
export type UserRole = 'member' | 'admin' | 'owner'

export type ExpenseCategory =
  | 'meals'
  | 'transport'
  | 'accommodation'
  | 'office'
  | 'client'
  | 'tech'
  | 'other'

export interface ExpenseItem {
  id: string
  name: string
  quantity: number
  unitPrice: number | null
  totalPrice: number | null
  categoryId: string | null
  categoryName: string | null
}

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  department: string
  reportingCurrency: string
  workspaceId: string | null
  onboarded: boolean
}

export interface Expense {
  id: string
  title: string           // = merchant (backward compat)
  merchant: string
  amount: number
  currency: string
  reportingCurrency: string | null
  reportingAmount: number | null
  currencySource: string | null
  category: string | null // human-readable category name
  status: ExpenseStatus
  date: string | null
  notes: string | null
  reportId: string | null
  submittedBy: string     // = user_id
  submitterName: string | null
  scanId: string | null
  scanFilePath: string | null
  authenticityVerdict: string | null
  authenticityScore: number | null
  flags: string[] | null
  items: ExpenseItem[]
  createdAt: string
  // Totals breakdown
  subtotal: number | null
  tax: number | null
  discount: number | null
  rounding: number | null
  computedGrandTotal: number | null
  // Currency conversion
  exchangeRate: number | null
  exchangeRateDate: string | null
  exchangeRateSource: string | null
  // Transaction metadata
  receiptNumber: string | null
  paymentMethod: string | null
  // Edit tracking
  isEdited: boolean
}

export interface Report {
  id: string
  title: string
  status: ExpenseStatus
  submittedBy: string
  createdAt: string
  submittedAt: string | null
  totalAmount: number
  currency: string
  expenseCount: number
  mileageCount: number
  rejectionNote: string | null
}

export interface MileageEntry {
  id: string
  fromLocation: string | null
  toLocation: string | null
  distance: number
  unit: string
  duration: string | null
  source: string
  purpose: string | null
  ratePerKm: number
  amount: number
  estimatedAmount: number | null
  status: ExpenseStatus
  userId: string
  scanId: string | null
  submitterName?: string | null
  createdAt: string
  reportId: string | null
}

export type WorkspacePeriod = 'all_time' | 'this_month' | 'last_month' | 'last_3_months'

export interface WorkspaceFilters {
  memberId?: string
  status?: ExpenseStatus
  period?: WorkspacePeriod
  search?: string
}

export interface PersonalFilters {
  status?: ExpenseStatus
  period?: WorkspacePeriod
  search?: string
}

export interface WorkspaceMember {
  id: string
  userId: string
  name: string
  department: string | null
  role: UserRole
  totalExpenses: number
  pendingExpenses: number
}

export interface InboxItem {
  id: string
  type:
    | 'expense_approved'
    | 'expense_rejected'
    | 'report_ready'
    | 'report_submitted'
    | 'trial_notice'
  title: string
  body: string
  timestamp: string
  read: boolean
  relatedId: string
}
