import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { X, ImageOff, ChevronDown, Pencil, Check, AlertTriangle, ShieldCheck, ShieldAlert, Shield, Loader2 } from 'lucide-react'
import { fetchExpense, fetchScanSignedUrl, updateExpense } from '#/lib/queries'
import { queryKeys } from '#/lib/queryKeys'
import { formatCurrency, formatDate } from '#/lib/format'
import { TopBar } from '#/components/TopBar'
import { StatusBadge } from '#/components/StatusBadge'
import { useWorkspace } from '#/context/WorkspaceContext'
import type { Expense } from '#/lib/types'

export const Route = createFileRoute('/_app/expenses/$expenseId')({
  validateSearch: (search: Record<string, unknown>) => ({
    ctx: search.ctx === 'workspace' ? ('workspace' as const) : undefined,
  }),
  component: ExpenseDetail,
})

// ─── Sub-components ───────────────────────────────────────────────────────────

const CURRENCY_SOURCE_LABELS: Record<string, string> = {
  from_address: 'Detected from address',
  from_symbol: 'Detected from symbol',
  from_hint: 'Workspace default',
  from_hint_override: 'Detected from receipt',
  unknown: 'Not detected',
}

const AUTHENTICITY_CONFIG = {
  likely_authentic: {
    label: 'Authentic',
    Icon: ShieldCheck,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/25',
  },
  suspicious: {
    label: 'Suspicious',
    Icon: ShieldAlert,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/25',
  },
  likely_ai_generated: {
    label: 'AI-Generated',
    Icon: Shield,
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/25',
  },
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 px-4 py-3">
      <span className="text-xs text-text-2 shrink-0">{label}</span>
      <span className="text-xs text-text-1 font-medium text-right">{value}</span>
    </div>
  )
}

function AuthenticityRow({ verdict }: { verdict: string }) {
  const config = (AUTHENTICITY_CONFIG as Record<string, typeof AUTHENTICITY_CONFIG[keyof typeof AUTHENTICITY_CONFIG] | undefined>)[verdict]
  if (!config) return <DetailRow label="Authenticity" value={verdict} />
  const { Icon, label, color, bg, border } = config
  return (
    <div className="flex justify-between items-center gap-4 px-4 py-3">
      <span className="text-xs text-text-2 shrink-0">Authenticity</span>
      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${color} ${bg} ${border}`}>
        <Icon size={11} />
        {label}
      </span>
    </div>
  )
}

const COMMON_CURRENCIES = [
  'MYR','USD','EUR','GBP','SGD','AUD','CAD','CHF','JPY','CNY',
  'HKD','THB','IDR','PHP','INR','KRW','TWD','NZD','SEK','NOK',
  'DKK','AED','SAR','QAR','BHD','KWD','ZAR','BRL','MXN','TRY',
]

type EditValues = {
  merchant: string
  date: string
  notes: string
  amount: string
  currency: string
  receiptNumber: string
  paymentMethod: string
}

function EditRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <span className="text-xs text-text-2 shrink-0 w-24">{label}</span>
      <div className="flex-1 min-w-0 flex justify-end">{children}</div>
    </div>
  )
}

const inputCls = 'text-xs text-text-1 bg-background border border-border rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-primary w-full'

function TotalBreakdown({ expense }: { expense: Expense }) {
  const hasMismatch = expense.flags?.includes('total_mismatch') ?? false
  const showConversion =
    expense.reportingAmount != null &&
    expense.reportingCurrency != null &&
    expense.reportingCurrency !== expense.currency

  const nullVal = <span className="text-xs tabular-nums text-text-2/40">—</span>

  return (
    <div>
      {/* Receipt breakdown — always show all rows */}
      <div className="flex justify-between gap-4 px-4 py-2.5">
        <span className="text-xs text-text-2">Subtotal</span>
        {expense.subtotal != null
          ? <span className="text-xs text-text-1 tabular-nums">{formatCurrency(expense.subtotal, expense.currency)}</span>
          : nullVal}
      </div>
      <div className="flex justify-between gap-4 px-4 py-2.5">
        <span className="text-xs text-text-2">Tax</span>
        {expense.tax != null
          ? <span className="text-xs text-text-1 tabular-nums">{formatCurrency(expense.tax, expense.currency)}</span>
          : nullVal}
      </div>
      <div className="flex justify-between gap-4 px-4 py-2.5">
        <span className="text-xs text-text-2">Discount</span>
        {expense.discount != null
          ? <span className="text-xs text-text-1 tabular-nums">{expense.discount !== 0 ? '- ' : ''}{formatCurrency(expense.discount, expense.currency)}</span>
          : nullVal}
      </div>
      <div className="flex justify-between gap-4 px-4 py-2.5">
        <span className="text-xs text-text-2">Rounding</span>
        {expense.rounding != null
          ? <span className="text-xs text-text-1 tabular-nums">{expense.rounding > 0 ? '+ ' : expense.rounding < 0 ? '- ' : ''}{formatCurrency(Math.abs(expense.rounding), expense.currency)}</span>
          : nullVal}
      </div>
      {expense.computedGrandTotal != null && (
        <div className="flex justify-between gap-4 px-4 py-2.5">
          <span className="text-xs text-text-2/60 italic">Computed total</span>
          <span className="text-xs text-text-1/60 tabular-nums italic">
            {formatCurrency(expense.computedGrandTotal, expense.currency)}
          </span>
        </div>
      )}
      {/* Grand Total */}
      <div className="flex justify-between gap-4 px-4 py-3 border-t border-border bg-background/40">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-text-1">Total</span>
          {hasMismatch && <AlertTriangle size={11} className="text-amber-500" title="Item total doesn't match receipt total" />}
        </div>
        <span className="text-sm font-bold text-text-1 tabular-nums">
          {formatCurrency(expense.amount, expense.currency)}
        </span>
      </div>

      {/* Zone B: Currency conversion */}
      {showConversion && (
        <>
          <div className="flex items-center gap-3 px-4 py-2">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[10px] font-medium text-text-2/50 uppercase tracking-widest shrink-0">
              Converted to {expense.reportingCurrency}
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>
          {expense.exchangeRate != null && (
            <div className="flex justify-between gap-4 px-4 py-2.5">
              <span className="text-xs text-text-2 shrink-0">Rate</span>
              <div className="text-right">
                <span className="text-xs text-text-1 tabular-nums">
                  1 {expense.currency} = {expense.exchangeRate.toFixed(4)} {expense.reportingCurrency}
                </span>
                {(expense.exchangeRateDate || expense.exchangeRateSource) && (
                  <p className="text-[10px] text-text-2/60 mt-0.5">
                    {[expense.exchangeRateDate ? formatDate(expense.exchangeRateDate) : null, expense.exchangeRateSource]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                )}
              </div>
            </div>
          )}
          <div className="flex justify-between gap-4 px-4 py-3 border-t border-border bg-background/40">
            <span className="text-xs font-bold text-text-1">Total ({expense.reportingCurrency})</span>
            <span className="text-sm font-bold text-text-1 tabular-nums">
              {formatCurrency(expense.reportingAmount!, expense.reportingCurrency!)}
            </span>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

function ExpenseDetail() {
  const { expenseId } = Route.useParams()
  const { ctx } = Route.useSearch()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { current } = useWorkspace()
  const role = current.role

  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [itemsOpen, setItemsOpen] = useState(false)
  const [breakdownOpen, setBreakdownOpen] = useState(true)
  const [isEditMode, setIsEditMode] = useState(false)
  const [editValues, setEditValues] = useState<EditValues>({
    merchant: '', date: '', notes: '', amount: '', currency: '', receiptNumber: '', paymentMethod: '',
  })

  const { data: expense, isLoading } = useQuery({
    queryKey: queryKeys.expense(expenseId),
    queryFn: () => fetchExpense(expenseId),
  })

  const { data: receiptUrl } = useQuery({
    queryKey: queryKeys.scanUrl(expense?.scanFilePath ?? ''),
    queryFn: () => fetchScanSignedUrl(expense!.scanFilePath!),
    enabled: !!expense?.scanFilePath,
    staleTime: 55 * 60 * 1000,
  })

  const saveAll = useMutation({
    mutationFn: (updates: Parameters<typeof updateExpense>[1]) =>
      updateExpense(expenseId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.expense(expenseId) })
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      setIsEditMode(false)
    },
  })

  const enterEditMode = (exp: Expense) => {
    setEditValues({
      merchant: exp.merchant,
      date: exp.date ?? '',
      notes: exp.notes ?? '',
      amount: exp.amount.toFixed(2),
      currency: exp.currency,
      receiptNumber: exp.receiptNumber ?? '',
      paymentMethod: exp.paymentMethod ?? '',
    })
    setDetailsOpen(true)
    setIsEditMode(true)
  }

  const handleSaveAll = (exp: Expense) => {
    const updates: Parameters<typeof updateExpense>[1] = {}
    const merchant = editValues.merchant.trim()
    const date = editValues.date || null
    const notes = editValues.notes.trim() || null
    const parsed = parseFloat(editValues.amount)
    const currency = editValues.currency
    const receiptNumber = editValues.receiptNumber.trim() || null
    const paymentMethod = editValues.paymentMethod.trim() || null

    if (merchant !== exp.merchant) updates.merchant = merchant
    if (date !== exp.date) updates.date = date
    if (notes !== exp.notes) updates.notes = notes
    if (!isNaN(parsed) && parsed > 0 && parsed !== exp.amount) updates.amount = Math.round(parsed * 100) / 100
    if (currency !== exp.currency) updates.currency = currency
    if (receiptNumber !== exp.receiptNumber) updates.receiptNumber = receiptNumber
    if (paymentMethod !== exp.paymentMethod) updates.paymentMethod = paymentMethod

    if (Object.keys(updates).length > 0) {
      saveAll.mutate(updates)
    } else {
      setIsEditMode(false)
    }
  }

  if (isLoading) return <div className="min-h-dvh bg-background" />
  if (!expense) {
    return (
      <div>
        <TopBar title="Expense" showBack />
        <p className="text-sm text-text-2 text-center mt-12">Expense not found.</p>
      </div>
    )
  }

  const isDraft = expense.status === 'draft'
  const showReporting =
    expense.reportingCurrency &&
    expense.reportingCurrency !== expense.currency &&
    expense.reportingAmount != null
  const isAdminOrOwner = role === 'admin' || role === 'owner'
  const showAuthenticity = current.isPremium && isAdminOrOwner && ctx === 'workspace'

  const receiptThumb = receiptUrl ? (
    <button
      onClick={() => setLightboxOpen(true)}
      className="w-full bg-surface rounded-xl border border-border shadow-sm overflow-hidden cursor-pointer hover:opacity-90 transition-opacity duration-150"
      aria-label="View receipt image"
    >
      <img src={receiptUrl} alt="Receipt" className="w-full max-h-48 object-cover object-top" />
    </button>
  ) : null

  const detailsHeader = (
    <button
      onClick={() => setDetailsOpen((v) => !v)}
      className="w-full flex items-center justify-between px-4 py-2.5 cursor-pointer"
    >
      <h3 className="text-xs font-semibold text-text-2 uppercase tracking-wider">Receipt Details</h3>
      <ChevronDown
        size={14}
        className={`text-text-2 transition-transform duration-200 ${detailsOpen ? 'rotate-180' : ''}`}
      />
    </button>
  )

  const breakdownHeader = (
    <button
      onClick={() => setBreakdownOpen((v) => !v)}
      className="w-full flex items-center justify-between px-4 py-2.5 cursor-pointer"
    >
      <h3 className="text-xs font-semibold text-text-2 uppercase tracking-wider">Breakdown</h3>
      <ChevronDown
        size={14}
        className={`text-text-2 transition-transform duration-200 ${breakdownOpen ? 'rotate-180' : ''}`}
      />
    </button>
  )

  const lineItemsHeader = (
    <button
      onClick={() => setItemsOpen((v) => !v)}
      className="w-full flex items-center justify-between px-4 py-2.5 cursor-pointer"
    >
      <h3 className="text-xs font-semibold text-text-2 uppercase tracking-wider">
        Line Items
        <span className="ml-1.5 font-normal normal-case tracking-normal text-text-2/60">
          ({expense.items.length})
        </span>
      </h3>
      <ChevronDown
        size={14}
        className={`text-text-2 transition-transform duration-200 ${itemsOpen ? 'rotate-180' : ''}`}
      />
    </button>
  )

  const lineItemsList = itemsOpen ? (
    <div className="divide-y divide-border">
      {expense.items.map((item) => (
        <div key={item.id} className="flex items-start justify-between gap-3 px-4 py-3 animate-fade-in-up">
          <div className="min-w-0">
            <p className="text-xs font-medium text-text-1 leading-snug">{item.name}</p>
            {item.categoryName && (
              <p className="text-xs text-text-2 mt-0.5">{item.categoryName}</p>
            )}
          </div>
          <span className="text-xs text-text-1 font-medium tabular-nums shrink-0">
            {item.quantity > 1 ? `${item.quantity}× ` : ''}
            {formatCurrency(item.totalPrice ?? item.unitPrice ?? 0, expense.currency)}
          </span>
        </div>
      ))}
    </div>
  ) : null

  const viewMetaRows = (
    <>
      <DetailRow label="Amount" value={formatCurrency(expense.amount, expense.currency)} />
      <DetailRow label="Currency" value={expense.currency} />
      <DetailRow label="Merchant" value={expense.merchant} />
      <DetailRow label="Date" value={formatDate(expense.date ?? expense.createdAt)} />
      {expense.notes && <DetailRow label="Notes" value={expense.notes} />}
      <DetailRow label="Receipt no." value={expense.receiptNumber ?? '—'} />
      <DetailRow label="Payment" value={expense.paymentMethod ?? '—'} />
      {expense.category && <DetailRow label="Category" value={expense.category} />}
      {expense.currencySource && (
        <DetailRow
          label="Currency source"
          value={CURRENCY_SOURCE_LABELS[expense.currencySource] ?? expense.currencySource}
        />
      )}
      {showAuthenticity && expense.authenticityVerdict && (
        <AuthenticityRow verdict={expense.authenticityVerdict} />
      )}
    </>
  )

  const set = (k: keyof EditValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setEditValues((v) => ({ ...v, [k]: e.target.value }))

  const editMetaRows = (
    <>
      <EditRow label="Amount">
        <input type="number" step="0.01" min="0" value={editValues.amount} onChange={set('amount')} className={inputCls + ' text-right'} />
      </EditRow>
      <EditRow label="Currency">
        <select value={editValues.currency} onChange={set('currency')} className={inputCls}>
          {COMMON_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </EditRow>
      <EditRow label="Merchant">
        <input type="text" value={editValues.merchant} onChange={set('merchant')} className={inputCls} />
      </EditRow>
      <EditRow label="Date">
        <input type="date" value={editValues.date} onChange={set('date')} className={inputCls} />
      </EditRow>
      <EditRow label="Notes">
        <textarea value={editValues.notes} onChange={set('notes')} rows={3} className={inputCls + ' resize-none'} />
      </EditRow>
      <EditRow label="Receipt no.">
        <input type="text" value={editValues.receiptNumber} onChange={set('receiptNumber')} className={inputCls} />
      </EditRow>
      <EditRow label="Payment">
        <input type="text" value={editValues.paymentMethod} onChange={set('paymentMethod')} className={inputCls} />
      </EditRow>
      {expense.category && <DetailRow label="Category" value={expense.category} />}
      {/* Save / Cancel */}
      <div className="flex gap-2 px-4 py-3 bg-background/60 border-t border-border">
        <button
          onClick={() => setIsEditMode(false)}
          className="flex-1 h-9 text-xs text-text-2 border border-border rounded-lg cursor-pointer hover:bg-nav-hover-bg transition-colors duration-150"
        >
          Cancel
        </button>
        <button
          onClick={() => handleSaveAll(expense)}
          disabled={saveAll.isPending}
          className="flex-1 h-9 flex items-center justify-center gap-1.5 text-xs font-semibold text-white bg-primary rounded-lg disabled:opacity-50 cursor-pointer"
        >
          {saveAll.isPending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
          Save changes
        </button>
      </div>
      {saveAll.isError && (
        <p className="text-xs text-danger px-4 pb-3">Failed to save. Try again.</p>
      )}
    </>
  )

  return (
    <div>
      <TopBar title="Expense" showBack />

      {/* ── MOBILE layout ── */}
      <div className="lg:hidden px-4 py-4 space-y-3">

        {/* Header */}
        <div className="bg-surface rounded-xl p-4 border border-border shadow-sm">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h2 className="text-sm font-semibold text-text-1 flex-1">{expense.merchant}</h2>
            <div className="flex items-center gap-1.5 shrink-0">
              {expense.isEdited && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-500">
                  Edited
                </span>
              )}
              <StatusBadge status={expense.status} />
              {isDraft && !isEditMode && (
                <button
                  onClick={() => enterEditMode(expense)}
                  className="flex items-center gap-1 h-6 px-2 text-[11px] font-medium text-text-2 border border-border rounded-lg cursor-pointer hover:text-primary hover:border-primary/40 transition-colors duration-150"
                >
                  <Pencil size={10} /> Edit
                </button>
              )}
            </div>
          </div>
          <p className="text-2xl font-bold text-text-1 tabular-nums mt-2">
            {formatCurrency(expense.amount, expense.currency)}
          </p>
          {showReporting && (
            <p className="text-xs text-text-2 mt-1 tabular-nums">
              ≈ {formatCurrency(expense.reportingAmount!, expense.reportingCurrency!)}
            </p>
          )}
        </div>

        {receiptThumb}

        {/* Receipt details */}
        <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
          <div className={`bg-background/40 ${detailsOpen ? 'border-b border-border' : ''}`}>
            {detailsHeader}
          </div>
          {detailsOpen && (
            <div className="divide-y divide-border">
              {isEditMode ? editMetaRows : viewMetaRows}
            </div>
          )}
        </div>

        {/* Line items */}
        {expense.items.length > 0 && (
          <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="border-b border-border bg-background/40">
              {lineItemsHeader}
            </div>
            {lineItemsList}
          </div>
        )}

        {/* Totals breakdown */}
        <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
          <div className={`bg-background/40 ${breakdownOpen ? 'border-b border-border' : ''}`}>
            {breakdownHeader}
          </div>
          {breakdownOpen && <TotalBreakdown expense={expense} />}
        </div>

      </div>

      {/* ── DESKTOP layout ── */}
      <div className="hidden lg:block px-6 py-6">
        <div className="grid grid-cols-[3fr_2fr] gap-6 items-start">

          {/* Left: Details card */}
          <div className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden min-w-0">

            {/* Header */}
            <div className="px-6 py-5 border-b border-border">
              <div className="flex items-start justify-between gap-3 mb-3">
                <h2 className="text-base font-semibold text-text-1 leading-snug flex-1">
                  {expense.merchant}
                </h2>
                <div className="flex items-center gap-2 shrink-0">
                  {expense.isEdited && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-500">
                      Edited
                    </span>
                  )}
                  <StatusBadge status={expense.status} />
                  {isDraft && !isEditMode && (
                    <button
                      onClick={() => enterEditMode(expense)}
                      className="flex items-center gap-1 h-7 px-2.5 text-xs font-medium text-text-2 border border-border rounded-lg cursor-pointer hover:text-primary hover:border-primary/40 transition-colors duration-150"
                    >
                      <Pencil size={11} /> Edit
                    </button>
                  )}
                </div>
              </div>
              <p className="text-3xl font-bold text-text-1 tabular-nums">
                {formatCurrency(expense.amount, expense.currency)}
              </p>
              {showReporting && (
                <p className="text-sm text-text-2 mt-1.5 tabular-nums">
                  ≈ {formatCurrency(expense.reportingAmount!, expense.reportingCurrency!)}
                </p>
              )}
            </div>

            {/* Receipt details */}
            <div className="border-b border-border">
              <div className={`bg-background/40 ${detailsOpen ? 'border-b border-border' : ''}`}>
                {detailsHeader}
              </div>
              {detailsOpen && (
                <div className="divide-y divide-border">
                  {isEditMode ? editMetaRows : viewMetaRows}
                </div>
              )}
            </div>

            {/* Line items */}
            {expense.items.length > 0 && (
              <div className="border-b border-border">
                <div className="bg-background/40 border-b border-border">
                  {lineItemsHeader}
                </div>
                {lineItemsList}
              </div>
            )}

            {/* Totals breakdown */}
            <div className="border-b border-border">
              <div className={`bg-background/40 ${breakdownOpen ? 'border-b border-border' : ''}`}>
                {breakdownHeader}
              </div>
              {breakdownOpen && <TotalBreakdown expense={expense} />}
            </div>

          </div>

          {/* Right: Image card (sticky, separate surface) */}
          <div className="sticky top-14 self-start rounded-2xl border border-border shadow-sm overflow-hidden bg-black/70">
            {receiptUrl ? (
              <button
                onClick={() => setLightboxOpen(true)}
                className="w-full cursor-pointer hover:opacity-90 transition-opacity duration-150 block"
                aria-label="View receipt image"
              >
                <div className="aspect-[4/5] overflow-hidden">
                  <img src={receiptUrl} alt="Receipt" className="w-full h-full object-cover" />
                </div>
              </button>
            ) : (
              <div className="aspect-[4/5] flex flex-col items-center justify-center gap-2 text-text-2">
                <ImageOff size={32} strokeWidth={1.5} />
                <p className="text-xs">No receipt image</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightboxOpen && receiptUrl && (
        <div
          className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors cursor-pointer"
            aria-label="Close"
            onClick={() => setLightboxOpen(false)}
          >
            <X size={24} />
          </button>
          <img
            src={receiptUrl}
            alt="Receipt"
            className="max-w-full max-h-full object-contain rounded-xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}
