import { db, supabaseAuth } from './supabase'
import type { Category, Currency, Expense, ExpenseItem, ExpenseStatus, InboxItem, MileageEntry, PersonalFilters, Report, UserRole, WorkspaceMember, WorkspaceFilters, WorkspacePeriod } from './types'

type RawItem = {
  id: string
  name: string
  quantity: number
  unit_price: number | null
  total_price: number | null
  category_id: string | null
  lookup_categories: { name: string } | null
}

type RawExpense = Record<string, unknown> & { expense_items: RawItem[] }

function mapExpense(row: RawExpense): Expense {
  const items: ExpenseItem[] = row.expense_items.map((item) => ({
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    unitPrice: item.unit_price,
    totalPrice: item.total_price,
    categoryId: item.category_id,
    categoryName: item.lookup_categories?.name ?? null,
  }))
  const merchant = (row.merchant as string | null) ?? '—'
  return {
    id: row.id as string,
    title: merchant,
    merchant,
    amount: (row.amount as number | null) ?? 0,
    currency: (row.currency as string | null) ?? '',
    reportingCurrency: row.reporting_currency as string | null,
    reportingAmount: row.reporting_amount as number | null,
    reportingAmounts: (row.reporting_amounts as Record<string, number> | null) ?? null,
    currencySource: row.currency_source as string | null,
    categoryId: (row.category_id as string | null) ?? null,
    category:
      (row.lookup_categories as { name: string } | null)?.name ??
      items[0]?.categoryName ??
      null,
    status: row.status as ExpenseStatus,
    date: row.date as string | null,
    notes: row.notes as string | null,
    reportId: row.report_id as string | null,
    reportTitle: (row.reports as { id: string; title: string } | null)?.title ?? null,
    submittedBy: row.user_id as string,
    submitterName: (row.users as { name: string } | null)?.name ?? null,
    scanId: row.scan_id as string | null,
    scanFilePath: (row.scans as { file_path: string } | null)?.file_path ?? null,
    authenticityVerdict: row.authenticity_verdict as string | null,
    authenticityScore: row.authenticity_score as number | null,
    flags: row.flags as string[] | null,
    items,
    createdAt: row.created_at as string,
    subtotal: row.subtotal as number | null ?? null,
    tax: row.tax as number | null ?? null,
    taxBreakdown: (row.tax_breakdown as { label: string; amount: number }[] | null) ?? null,
    discount: row.discount as number | null ?? null,
    rounding: row.rounding as number | null ?? null,
    computedGrandTotal: row.computed_grand_total as number | null ?? null,
    exchangeRate: row.exchange_rate as number | null ?? null,
    exchangeRateDate: row.exchange_rate_date as string | null ?? null,
    exchangeRateSource: row.exchange_rate_source as string | null ?? null,
    receiptNumber: row.receipt_number as string | null ?? null,
    paymentMethod: row.payment_method as string | null ?? null,
    isEdited: (row.is_edited as boolean | null) ?? false,
  }
}

const EXPENSE_SELECT = `
  id, user_id, merchant, amount, currency, date, status, notes,
  report_id, scan_id, reporting_currency, reporting_amount, reporting_amounts, currency_source,
  authenticity_verdict, authenticity_score, flags, created_at,
  subtotal, tax, tax_breakdown, discount, rounding, computed_grand_total,
  exchange_rate, exchange_rate_date, exchange_rate_source,
  receipt_number, payment_method, is_edited,
  category_id, lookup_categories!category_id ( name ),
  scans!scan_id ( file_path ),
  reports!report_id ( id, title ),
  expense_items (
    id, name, quantity, unit_price, total_price, category_id,
    lookup_categories!category_id ( name )
  )
`

export async function fetchScanSignedUrl(filePath: string): Promise<string | null> {
  const { data, error } = await db.storage.from('scans').createSignedUrl(filePath, 3600)
  if (error) return null
  return data.signedUrl
}

export async function fetchExpenses(filters?: PersonalFilters): Promise<Expense[]> {
  let query = db.from('expenses').select(EXPENSE_SELECT).order('created_at', { ascending: false })
  if (filters?.status) query = query.eq('status', filters.status)
  if (filters?.search) query = query.ilike('merchant', `%${filters.search}%`)
  if (filters?.categoryId) query = query.eq('category_id', filters.categoryId)
  const { from, to } = getDateRange(filters?.period)
  if (from) query = query.gte('created_at', from)
  if (to) query = query.lt('created_at', to)
  const { data, error } = await query
  if (error) throw error
  return ((data ?? []) as unknown as RawExpense[]).map(mapExpense)
}

export async function fetchExpense(id: string): Promise<Expense | null> {
  const { data, error } = await db
    .from('expenses')
    .select(EXPENSE_SELECT)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return mapExpense(data as unknown as RawExpense)
}

export async function submitExpense(id: string): Promise<void> {
  const { error } = await db
    .from('expenses')
    .update({ status: 'submitted' })
    .eq('id', id)
    .eq('status', 'draft')
  if (error) throw error
}

type RawMileage = Record<string, unknown>

function mapMileage(row: RawMileage): MileageEntry {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    scanId: row.scan_id as string | null,
    fromLocation: row.from_location as string | null,
    toLocation: row.to_location as string | null,
    distance: row.distance as number,
    unit: row.unit as string,
    duration: row.duration as string | null,
    source: row.source as string,
    purpose: row.purpose as string | null,
    ratePerKm: row.rate_per_km as number,
    amount: row.amount as number,
    estimatedAmount: row.estimated_amount as number | null,
    status: row.status as ExpenseStatus,
    submitterName: (row.users as { name: string } | null)?.name ?? null,
    createdAt: row.created_at as string,
    reportId: row.report_id as string | null ?? null,
    reportTitle: (row.reports as { id: string; title: string } | null)?.title ?? null,
    transportMode: (row.lookup_transport_mode as { name: string } | null)?.name ?? null,
  }
}

const WORKSPACE_MILEAGE_SELECT = `
  id, user_id, scan_id, from_location, to_location, distance, unit,
  duration, source, purpose, rate_per_km, amount, estimated_amount, status, report_id, created_at, transport_mode,
  reports!report_id ( id, title ),
  users!user_id ( name ),
  lookup_transport_mode!transport_mode ( name )
`

function getDateRange(period?: WorkspacePeriod): { from: string | null; to: string | null } {
  if (!period || period === 'all_time') return { from: null, to: null }
  const now = new Date()
  if (period === 'this_month') {
    return { from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(), to: null }
  }
  if (period === 'last_month') {
    return {
      from: new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString(),
      to: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
    }
  }
  if (period === 'last_3_months') {
    return { from: new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString(), to: null }
  }
  return { from: null, to: null }
}

const MILEAGE_SELECT = `
  id, user_id, scan_id, from_location, to_location, distance, unit,
  duration, source, purpose, rate_per_km, amount, estimated_amount, status, report_id, created_at, transport_mode,
  reports!report_id ( id, title ),
  lookup_transport_mode!transport_mode ( name )
`

export async function fetchMileage(filters?: PersonalFilters): Promise<MileageEntry[]> {
  let query = db.from('mileage').select(MILEAGE_SELECT).order('created_at', { ascending: false })
  if (filters?.status) query = query.eq('status', filters.status)
  const { from, to } = getDateRange(filters?.period)
  if (from) query = query.gte('created_at', from)
  if (to) query = query.lt('created_at', to)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map(mapMileage)
}

export async function submitMileage(id: string): Promise<void> {
  const { error } = await db
    .from('mileage')
    .update({ status: 'submitted' })
    .eq('id', id)
    .eq('status', 'draft')
  if (error) throw error
}

type RawReport = {
  id: string
  submitted_by: string
  title: string
  status: string
  total_amount: number
  currency: string
  created_at: string
  submitted_at: string | null
  rejection_note?: string | null
  expenses?: { id: string }[]
  mileage?: { id: string }[]
}

function mapReport(row: RawReport, expenseCount?: number, mileageCount?: number): Report {
  return {
    id: row.id,
    title: row.title,
    status: row.status as ExpenseStatus,
    submittedBy: row.submitted_by,
    createdAt: row.created_at,
    submittedAt: row.submitted_at,
    totalAmount: row.total_amount,
    currency: row.currency,
    expenseCount: expenseCount ?? row.expenses?.length ?? 0,
    mileageCount: mileageCount ?? row.mileage?.length ?? 0,
    rejectionNote: row.rejection_note ?? null,
  }
}

export async function fetchReports(filters?: PersonalFilters): Promise<Report[]> {
  let query = db
    .from('reports')
    .select('id, submitted_by, title, status, total_amount, currency, created_at, submitted_at, rejection_note, expenses(id), mileage(id)')
    .order('created_at', { ascending: false })
  if (filters?.status) query = query.eq('status', filters.status)
  const { from, to } = getDateRange(filters?.period)
  if (from) query = query.gte('created_at', from)
  if (to) query = query.lt('created_at', to)
  const { data, error } = await query
  if (error) throw error
  return ((data ?? []) as unknown as RawReport[]).map(r => mapReport(r))
}

const APPROVAL_SELECT = `
  id, user_id, merchant, amount, currency, date, status, notes,
  report_id, scan_id, reporting_currency, reporting_amount, reporting_amounts, currency_source,
  authenticity_verdict, authenticity_score, flags, created_at,
  category_id, lookup_categories!category_id ( name ),
  scans!scan_id ( file_path ),
  reports!report_id ( id, title ),
  expense_items (
    id, name, quantity, unit_price, total_price, category_id,
    lookup_categories!category_id ( name )
  ),
  users!user_id ( name )
`

export async function fetchSubmittedExpenses(): Promise<Expense[]> {
  const { data, error } = await db
    .from('expenses')
    .select(APPROVAL_SELECT)
    .eq('status', 'submitted')
    .order('created_at', { ascending: false })
  if (error) throw error
  return ((data ?? []) as unknown as RawExpense[]).map(mapExpense)
}

export async function fetchWorkspaceExpenses(filters?: WorkspaceFilters): Promise<Expense[]> {
  let query = db.from('expenses').select(APPROVAL_SELECT).order('created_at', { ascending: false })
  if (filters?.memberId) query = query.eq('user_id', filters.memberId)
  if (filters?.status) query = query.eq('status', filters.status)
  if (filters?.search) query = query.ilike('merchant', `%${filters.search}%`)
  if (filters?.categoryId) query = query.eq('category_id', filters.categoryId)
  const { from, to } = getDateRange(filters?.period)
  if (from) query = query.gte('created_at', from)
  if (to) query = query.lt('created_at', to)
  const { data, error } = await query
  if (error) throw error
  return ((data ?? []) as unknown as RawExpense[]).map(mapExpense)
}

export async function fetchWorkspaceMileage(filters?: WorkspaceFilters): Promise<MileageEntry[]> {
  let query = db.from('mileage').select(WORKSPACE_MILEAGE_SELECT).order('created_at', { ascending: false })
  if (filters?.memberId) query = query.eq('user_id', filters.memberId)
  if (filters?.status) query = query.eq('status', filters.status)
  const { from, to } = getDateRange(filters?.period)
  if (from) query = query.gte('created_at', from)
  if (to) query = query.lt('created_at', to)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map(mapMileage)
}

export async function approveExpense(id: string): Promise<void> {
  const { error } = await db
    .from('expenses')
    .update({ status: 'approved' })
    .eq('id', id)
  if (error) throw error
}

export async function rejectExpense(id: string): Promise<void> {
  const { error } = await db
    .from('expenses')
    .update({ status: 'draft' })
    .eq('id', id)
  if (error) throw error
}

type RawInboxItem = {
  id: string
  type: string
  title: string
  body: string
  related_id: string | null
  read: boolean
  created_at: string
}

function mapInboxItem(row: RawInboxItem): InboxItem {
  return {
    id: row.id,
    type: row.type as InboxItem['type'],
    title: row.title,
    body: row.body,
    timestamp: row.created_at,
    read: row.read,
    relatedId: row.related_id ?? '',
  }
}

export async function fetchInbox(): Promise<InboxItem[]> {
  const { data, error } = await db
    .from('inbox')
    .select('id, type, title, body, related_id, read, created_at')
    .order('created_at', { ascending: false })
  if (error) throw error
  return ((data ?? []) as unknown as RawInboxItem[]).map(mapInboxItem)
}

export async function markInboxRead(id: string): Promise<void> {
  const { error } = await db.from('inbox').update({ read: true }).eq('id', id)
  if (error) throw error
}

type RawMember = {
  id: string
  user_id: string
  role: string
  users: { name: string; department: string | null }
}

export async function fetchWorkspaceMembers(baseCurrency: string): Promise<WorkspaceMember[]> {
  const [membersRes, expensesRes] = await Promise.all([
    db
      .from('workspace_members')
      .select('id, user_id, role, users!user_id(name, department)')
      .order('created_at', { ascending: true }),
    db
      .from('expenses')
      .select('user_id, amount, reporting_amount, reporting_amounts, status')
      .neq('status', 'rejected'),
  ])
  if (membersRes.error) throw membersRes.error
  if (expensesRes.error) throw expensesRes.error
  const expenses = expensesRes.data ?? []
  return ((membersRes.data ?? []) as unknown as RawMember[]).map((m) => {
    const userExpenses = expenses.filter((e) => e.user_id === m.user_id)
    return {
      id: m.id,
      userId: m.user_id,
      name: m.users.name,
      department: m.users.department,
      role: m.role as UserRole,
      totalExpenses: userExpenses.reduce((sum, e) => {
        const amounts = e.reporting_amounts as Record<string, number> | null
        const val = amounts?.[baseCurrency] ?? (e.reporting_amount as number | null) ?? (e.amount as number)
        return sum + val
      }, 0),
      pendingExpenses: userExpenses.filter((e) => e.status === 'submitted').length,
    }
  })
}

export async function createInvite(
  workspaceId: string,
  invitedBy: string,
  email: string,
  role: 'member' | 'admin',
): Promise<string> {
  const code = Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 8)
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const { error } = await db.from('invites').insert({
    workspace_id: workspaceId,
    code,
    role,
    email,
    invited_by: invitedBy,
    expires_at: expiresAt,
  })
  if (error) throw error
  return code
}

export async function updateExpense(
  id: string,
  updates: {
    merchant?: string
    date?: string | null
    notes?: string | null
    amount?: number
    currency?: string
    categoryId?: string | null
    receiptNumber?: string | null
    paymentMethod?: string | null
    taxBreakdown?: { label: string; amount: number }[] | null
    subtotal?: number | null
    discount?: number | null
    rounding?: number | null
  },
): Promise<void> {
  const dbUpdates: Record<string, unknown> = { is_edited: true }
  if (updates.merchant !== undefined) dbUpdates.merchant = updates.merchant
  if ('date' in updates) dbUpdates.date = updates.date ?? null
  if ('notes' in updates) dbUpdates.notes = updates.notes ?? null
  if (updates.amount !== undefined) dbUpdates.amount = updates.amount
  if (updates.currency !== undefined) dbUpdates.currency = updates.currency
  if ('categoryId' in updates) dbUpdates.category_id = updates.categoryId ?? null
  if ('receiptNumber' in updates) dbUpdates.receipt_number = updates.receiptNumber ?? null
  if ('paymentMethod' in updates) dbUpdates.payment_method = updates.paymentMethod ?? null
  if ('taxBreakdown' in updates) {
    const lines = updates.taxBreakdown?.length ? updates.taxBreakdown : null
    dbUpdates.tax_breakdown = lines
    if (lines) {
      dbUpdates.tax = Math.round(lines.reduce((s, t) => s + t.amount, 0) * 100) / 100
    }
  }
  if ('subtotal' in updates) dbUpdates.subtotal = updates.subtotal ?? null
  if ('discount' in updates) dbUpdates.discount = updates.discount ?? null
  if ('rounding' in updates) dbUpdates.rounding = updates.rounding ?? null

  const { error } = await db.from('expenses').update(dbUpdates).eq('id', id)
  if (error) throw error
}

type ExpenseItemRow = { name: string; quantity: number; unitPrice: number | null; totalPrice: number | null }

export async function updateExpenseItems(
  expenseId: string,
  patch: {
    toInsert: ExpenseItemRow[]
    toUpdate: ({ id: string } & ExpenseItemRow)[]
    toDelete: string[]
  },
  meta: { userId: string; workspaceId: string },
): Promise<void> {
  const ops: PromiseLike<void>[] = []

  if (patch.toDelete.length > 0) {
    ops.push(
      db.from('expense_items').delete().in('id', patch.toDelete)
        .then(({ error }) => { if (error) throw error }),
    )
  }

  for (const item of patch.toUpdate) {
    ops.push(
      db.from('expense_items').update({
        name: item.name,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        total_price: item.totalPrice,
      }).eq('id', item.id)
        .then(({ error }) => { if (error) throw error }),
    )
  }

  if (patch.toInsert.length > 0) {
    ops.push(
      db.from('expense_items').insert(
        patch.toInsert.map((item) => ({
          expense_id: expenseId,
          user_id: meta.userId,
          workspace_id: meta.workspaceId,
          name: item.name,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          total_price: item.totalPrice,
        })),
      ).then(({ error }) => { if (error) throw error }),
    )
  }

  await Promise.all(ops)
}

export async function updateMileageRate(workspaceId: string, rate: number): Promise<void> {
  const { error } = await db
    .from('workspaces')
    .update({ mileage_rate_per_km: rate })
    .eq('id', workspaceId)
  if (error) throw error
}

export async function updateWorkspacePlan(workspaceId: string, plan: 'free' | 'premium'): Promise<void> {
  const { error } = await db
    .from('workspaces')
    .update({ plan })
    .eq('id', workspaceId)
  if (error) throw error
}

export async function updateUserProfile(
  userId: string,
  updates: { name?: string; department?: string | null; reportingCurrency?: string },
): Promise<void> {
  const dbUpdates: Record<string, unknown> = {}
  if (updates.name !== undefined) dbUpdates.name = updates.name
  if ('department' in updates) dbUpdates.department = updates.department
  if (updates.reportingCurrency !== undefined) dbUpdates.reporting_currency = updates.reportingCurrency
  const { error } = await db.from('users').update(dbUpdates).eq('id', userId)
  if (error) throw error
}

export async function sendPasswordReset(email: string): Promise<void> {
  const { error } = await supabaseAuth.auth.resetPasswordForEmail(email)
  if (error) throw error
}

export async function fetchReport(id: string): Promise<{ report: Report; expenses: Expense[]; mileage: MileageEntry[] } | null> {
  const [reportRes, expensesRes, mileageRes] = await Promise.all([
    db
      .from('reports')
      .select('id, submitted_by, title, status, total_amount, currency, created_at, submitted_at, rejection_note')
      .eq('id', id)
      .maybeSingle(),
    db
      .from('expenses')
      .select(EXPENSE_SELECT)
      .eq('report_id', id)
      .order('created_at', { ascending: false }),
    db
      .from('mileage')
      .select(MILEAGE_SELECT)
      .eq('report_id', id)
      .order('created_at', { ascending: false }),
  ])
  if (reportRes.error) throw reportRes.error
  if (expensesRes.error) throw expensesRes.error
  if (mileageRes.error) throw mileageRes.error
  if (!reportRes.data) return null
  const expenses = ((expensesRes.data ?? []) as unknown as RawExpense[]).map(mapExpense)
  const mileage = (mileageRes.data ?? []).map(mapMileage)
  return { report: mapReport(reportRes.data as RawReport, expenses.length, mileage.length), expenses, mileage }
}

export async function createReport(title: string, workspaceId: string, baseCurrency: string): Promise<Report> {
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data, error } = await db
    .from('reports')
    .insert({ title, workspace_id: workspaceId, submitted_by: user.id, status: 'draft', total_amount: 0, currency: baseCurrency })
    .select('id, submitted_by, title, status, total_amount, currency, created_at, submitted_at, rejection_note')
    .single()
  if (error) throw error
  return mapReport(data as RawReport, 0, 0)
}

export async function submitReport(reportId: string): Promise<void> {
  const { error: rErr } = await db.from('reports').update({ status: 'submitted', submitted_at: new Date().toISOString() }).eq('id', reportId)
  if (rErr) throw rErr
  const { error: eErr } = await db.from('expenses').update({ status: 'submitted' }).eq('report_id', reportId).eq('status', 'draft')
  if (eErr) throw eErr
  const { error: mErr } = await db.from('mileage').update({ status: 'submitted' }).eq('report_id', reportId).eq('status', 'draft')
  if (mErr) throw mErr
}

export async function approveReport(reportId: string): Promise<void> {
  const { error: rErr } = await db.from('reports').update({ status: 'approved' }).eq('id', reportId)
  if (rErr) throw rErr
  const { error: eErr } = await db.from('expenses').update({ status: 'approved' }).eq('report_id', reportId)
  if (eErr) throw eErr
  const { error: mErr } = await db.from('mileage').update({ status: 'approved' }).eq('report_id', reportId)
  if (mErr) throw mErr
}

export async function rejectReport(reportId: string, note: string): Promise<void> {
  const { error: rErr } = await db.from('reports').update({ status: 'draft', rejection_note: note }).eq('id', reportId)
  if (rErr) throw rErr
  const { error: eErr } = await db.from('expenses').update({ status: 'draft' }).eq('report_id', reportId)
  if (eErr) throw eErr
  const { error: mErr } = await db.from('mileage').update({ status: 'draft' }).eq('report_id', reportId)
  if (mErr) throw mErr
}

export async function addExpenseToReport(reportId: string, expenseId: string): Promise<void> {
  const { error } = await db.from('expenses').update({ report_id: reportId }).eq('id', expenseId)
  if (error) throw error
}

export async function removeExpenseFromReport(expenseId: string): Promise<void> {
  const { error } = await db.from('expenses').update({ report_id: null }).eq('id', expenseId)
  if (error) throw error
}

export async function addMileageToReport(reportId: string, mileageId: string): Promise<void> {
  const { error } = await db.from('mileage').update({ report_id: reportId }).eq('id', mileageId)
  if (error) throw error
}

export async function removeMileageFromReport(mileageId: string): Promise<void> {
  const { error } = await db.from('mileage').update({ report_id: null }).eq('id', mileageId)
  if (error) throw error
}

export async function fetchWorkspaceReports(filters?: WorkspaceFilters): Promise<Report[]> {
  let query = db
    .from('reports')
    .select('id, submitted_by, title, status, total_amount, currency, created_at, submitted_at, rejection_note, expenses(id), mileage(id)')
    .order('created_at', { ascending: false })
  if (filters?.memberId) query = query.eq('submitted_by', filters.memberId)
  if (filters?.status) query = query.eq('status', filters.status)
  const { from, to } = getDateRange(filters?.period)
  if (from) query = query.gte('created_at', from)
  if (to) query = query.lt('created_at', to)
  const { data, error } = await query
  if (error) throw error
  return ((data ?? []) as unknown as RawReport[]).map(r => mapReport(r))
}

export async function deleteExpense(id: string): Promise<void> {
  const { error } = await db.from('expenses').delete().eq('id', id).eq('status', 'draft')
  if (error) throw error
}

export async function updateMileage(
  id: string,
  fields: { fromLocation?: string; toLocation?: string },
): Promise<void> {
  const update: Record<string, string> = {}
  if (fields.fromLocation !== undefined) update.from_location = fields.fromLocation
  if (fields.toLocation !== undefined) update.to_location = fields.toLocation
  const { error } = await db.from('mileage').update(update).eq('id', id).eq('status', 'draft')
  if (error) throw error
}

export async function deleteMileage(id: string): Promise<void> {
  const { error } = await db.from('mileage').delete().eq('id', id).eq('status', 'draft')
  if (error) throw error
}

export async function deleteReport(id: string): Promise<void> {
  const { error } = await db.from('reports').delete().eq('id', id).eq('status', 'draft')
  if (error) throw error
}

export async function fetchCurrencies(): Promise<Currency[]> {
  const { data, error } = await db
    .from('lookup_currencies')
    .select('code, name, symbol')
    .order('sort_order')
  if (error) throw error
  return (data ?? []).map((c) => ({ code: c.code, name: c.name, symbol: c.symbol }))
}

export async function updateWorkspaceBaseCurrency(workspaceId: string, baseCurrency: string): Promise<void> {
  const { error } = await db
    .from('workspaces')
    .update({ base_currency: baseCurrency })
    .eq('id', workspaceId)
  if (error) throw error
}

export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await db
    .from('lookup_categories')
    .select('id, name, group_name, description, sort_order')
    .order('sort_order')
  if (error) throw error
  return (data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    groupName: c.group_name,
    description: c.description,
    sortOrder: c.sort_order,
  }))
}

export async function createExpense(data: {
  merchant: string
  amount: number
  currency: string
  date: string | null
  notes: string | null
  categoryId?: string | null
  paymentMethod: string | null
  workspaceId: string
  userId: string
}): Promise<string> {
  const { data: row, error } = await db
    .from('expenses')
    .insert({
      merchant: data.merchant,
      amount: data.amount,
      currency: data.currency,
      date: data.date,
      notes: data.notes,
      category_id: data.categoryId ?? null,
      payment_method: data.paymentMethod,
      workspace_id: data.workspaceId,
      user_id: data.userId,
      status: 'draft',
      scan_id: null,
    })
    .select('id')
    .single()
  if (error) throw error
  return row.id
}

export async function createWorkspace(name: string, baseCurrency: string): Promise<string> {
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const planExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: ws, error: wsError } = await db
    .from('workspaces')
    .insert({ name, base_currency: baseCurrency, plan: 'trial', plan_expires_at: planExpiresAt })
    .select('id')
    .single()
  if (wsError) throw wsError
  const { error: memberError } = await db
    .from('workspace_members')
    .insert({ workspace_id: ws.id, user_id: user.id, role: 'owner' })
  if (memberError) throw memberError
  return ws.id
}
