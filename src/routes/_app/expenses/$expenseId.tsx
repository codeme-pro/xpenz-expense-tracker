import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { X, ImageOff, ChevronDown, Pencil, Check, AlertTriangle, ShieldCheck, ShieldAlert, Shield, Loader2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { fetchCurrencies, fetchExpense, fetchScanSignedUrl, updateExpense, updateExpenseItems } from '#/lib/queries'
import { queryKeys } from '#/lib/queryKeys'
import { formatCurrency, formatDate } from '#/lib/format'
import { TopBar } from '#/components/TopBar'
import { StatusBadge } from '#/components/StatusBadge'
import { useWorkspace } from '#/context/WorkspaceContext'
import { useAuth } from '#/context/AuthContext'
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


type EditValues = {
  merchant: string
  date: string
  notes: string
  amount: string
  currency: string
  receiptNumber: string
  paymentMethod: string
  subtotal: string
  discount: string
  rounding: string
}

type EditItem = {
  id: string | null
  name: string
  quantity: string
  unitPrice: string
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

type TaxLine = { label: string; amount: number }

const breakdownInputCls = 'w-28 text-xs text-right text-text-1 bg-background border border-border rounded-md px-2 py-1 focus:outline-none focus:border-primary tabular-nums'

function TotalBreakdown({
  expense,
  isEditMode = false,
  editTaxLines = [],
  onTaxLinesChange,
  editSubtotal,
  editDiscount,
  editRounding,
  onSubtotalChange,
  onDiscountChange,
  onRoundingChange,
  editAmount,
  liveComputed,
  onUseComputed,
  onUseStoredComputed,
}: {
  expense: Expense
  isEditMode?: boolean
  editTaxLines?: TaxLine[]
  onTaxLinesChange?: (lines: TaxLine[]) => void
  editSubtotal?: string
  editDiscount?: string
  editRounding?: string
  onSubtotalChange?: (v: string) => void
  onDiscountChange?: (v: string) => void
  onRoundingChange?: (v: string) => void
  editAmount?: string
  liveComputed?: number | null
  onUseComputed?: () => void
  onUseStoredComputed?: () => void
}) {
  const hasMismatch = expense.flags?.includes('total_mismatch') ?? false
  const showConversion =
    expense.reportingAmount != null &&
    expense.reportingCurrency != null &&
    expense.reportingCurrency !== expense.currency

  const viewBreakdown = expense.taxBreakdown ?? []
  const breakdown = isEditMode ? editTaxLines : viewBreakdown
  const hasMultiple = breakdown.length >= 2
  const hasSingle = breakdown.length === 1

  const breakdownSum = breakdown.reduce((s, t) => s + t.amount, 0)
  const taxSumMismatch = hasMultiple && expense.tax != null && Math.abs(breakdownSum - expense.tax) > 0.01
  const [taxExpanded, setTaxExpanded] = useState(taxSumMismatch)

  const nullVal = <span className="text-xs tabular-nums text-text-2/40">—</span>

  // Compute total from stored breakdown/items for view mode (always fresh)
  const viewComputed = !isEditMode ? (() => {
    const sub = expense.subtotal
    const tax = expense.tax ?? 0
    const disc = expense.discount ?? 0
    const round = expense.rounding ?? 0
    const itemsSum = expense.items.some((i) => i.unitPrice != null)
      ? expense.items.reduce((s, i) => s + (i.totalPrice ?? (i.unitPrice ?? 0) * i.quantity), 0)
      : null
    const base = sub ?? itemsSum
    if (base == null) return null
    return Math.round((base + tax - disc + round) * 100) / 100
  })() : null

  const taxRow = isEditMode && onTaxLinesChange ? (
    <div>
      <div className="flex justify-between gap-4 px-4 py-2.5">
        <span className="text-xs text-text-2">Tax</span>
        {editTaxLines.length > 0
          ? <span className="text-xs text-text-1 tabular-nums">{formatCurrency(breakdownSum, expense.currency)}</span>
          : nullVal}
      </div>
      {editTaxLines.length > 0 && (
        <div className="mx-4 mb-1 pl-3 border-l-2 border-border/60">
          {editTaxLines.map((line, i) => (
            <div key={i} className="flex items-center gap-2 py-1">
              <input
                type="text"
                value={line.label}
                onChange={(e) => {
                  const next = [...editTaxLines]
                  next[i] = { ...next[i], label: e.target.value }
                  onTaxLinesChange(next)
                }}
                placeholder="Tax label"
                className="flex-1 min-w-0 text-xs text-text-1 bg-background border border-border rounded-md px-2 py-1 focus:outline-none focus:border-primary"
              />
              <input
                type="number"
                step="0.01"
                min="0"
                value={line.amount || ''}
                onChange={(e) => {
                  const next = [...editTaxLines]
                  next[i] = { ...next[i], amount: parseFloat(e.target.value) || 0 }
                  onTaxLinesChange(next)
                }}
                className="w-20 text-xs text-right text-text-1 bg-background border border-border rounded-md px-2 py-1 focus:outline-none focus:border-primary tabular-nums"
              />
              <button
                onClick={() => onTaxLinesChange(editTaxLines.filter((_, j) => j !== i))}
                className="text-danger/50 hover:text-danger transition-colors duration-150 shrink-0"
                aria-label="Remove tax line"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="px-4 pb-2">
        <button
          onClick={() => onTaxLinesChange([...editTaxLines, { label: '', amount: 0 }])}
          className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors duration-150"
        >
          <Plus size={11} /> Add tax line
        </button>
      </div>
    </div>
  ) : hasMultiple ? (
    <div>
      <button
        onClick={() => setTaxExpanded((v) => !v)}
        className="w-full flex justify-between gap-4 px-4 py-2.5 cursor-pointer"
      >
        <span className="flex items-center gap-1.5 text-xs text-text-2">
          Tax
          <ChevronDown size={11} className={`transition-transform duration-200 ${taxExpanded ? 'rotate-180' : ''}`} />
          {taxSumMismatch && <span title="Tax lines don't sum to total"><AlertTriangle size={11} className="text-amber-500" /></span>}
        </span>
        <span className="text-xs text-text-1 tabular-nums">
          {expense.tax != null ? formatCurrency(expense.tax, expense.currency) : nullVal}
        </span>
      </button>
      {taxExpanded && (
        <div className="mx-4 mb-1 pl-3 border-l-2 border-border/60">
          {breakdown.map((line, i) => (
            <div
              key={i}
              className="flex justify-between gap-4 py-1.5 animate-fade-in-up"
              style={{ '--stagger-delay': `${i * 40}ms` } as React.CSSProperties}
            >
              <span className="text-xs text-text-2 truncate max-w-[160px]">{line.label}</span>
              <span className="text-xs text-text-2 tabular-nums shrink-0">{formatCurrency(line.amount, expense.currency)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  ) : (
    <div className="flex justify-between gap-4 px-4 py-2.5">
      <span className="text-xs text-text-2">{hasSingle ? breakdown[0].label : 'Tax'}</span>
      {expense.tax != null
        ? <span className="text-xs text-text-1 tabular-nums">{formatCurrency(expense.tax, expense.currency)}</span>
        : nullVal}
    </div>
  )

  // live computed mismatch (edit mode)
  const showComputedMismatch = isEditMode && liveComputed != null && onUseComputed != null

  return (
    <div>
      {/* Subtotal */}
      <div className="flex justify-between gap-4 px-4 py-2.5">
        <span className="text-xs text-text-2">Subtotal</span>
        {isEditMode && onSubtotalChange ? (
          <input
            type="number"
            step="0.01"
            min="0"
            value={editSubtotal ?? ''}
            onChange={(e) => onSubtotalChange(e.target.value)}
            placeholder="—"
            className={breakdownInputCls}
          />
        ) : expense.subtotal != null
          ? <span className="text-xs text-text-1 tabular-nums">{formatCurrency(expense.subtotal, expense.currency)}</span>
          : nullVal}
      </div>

      {/* Tax (with breakdown) */}
      {taxRow}

      {/* Discount */}
      <div className="flex justify-between gap-4 px-4 py-2.5">
        <span className="text-xs text-text-2">Discount</span>
        {isEditMode && onDiscountChange ? (
          <input
            type="number"
            step="0.01"
            min="0"
            value={editDiscount ?? ''}
            onChange={(e) => onDiscountChange(e.target.value)}
            placeholder="—"
            className={breakdownInputCls}
          />
        ) : expense.discount != null
          ? <span className="text-xs text-text-1 tabular-nums">{expense.discount !== 0 ? '- ' : ''}{formatCurrency(expense.discount, expense.currency)}</span>
          : nullVal}
      </div>

      {/* Rounding */}
      <div className="flex justify-between gap-4 px-4 py-2.5">
        <span className="text-xs text-text-2">Rounding</span>
        {isEditMode && onRoundingChange ? (
          <input
            type="number"
            step="0.01"
            value={editRounding ?? ''}
            onChange={(e) => onRoundingChange(e.target.value)}
            placeholder="—"
            className={breakdownInputCls}
          />
        ) : expense.rounding != null
          ? <span className="text-xs text-text-1 tabular-nums">{expense.rounding > 0 ? '+ ' : expense.rounding < 0 ? '- ' : ''}{formatCurrency(Math.abs(expense.rounding), expense.currency)}</span>
          : nullVal}
      </div>

      {/* Computed total row (edit mode: live from inputs; view mode: computed from stored data) */}
      {(isEditMode ? liveComputed : viewComputed) != null && (
        <div className="flex justify-between items-center gap-4 px-4 py-2.5">
          <span className="text-xs text-text-2/60 italic">Computed total</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-1/60 tabular-nums italic">
              {formatCurrency((isEditMode ? liveComputed : viewComputed)!, expense.currency)}
            </span>
            {!isEditMode && onUseStoredComputed && viewComputed !== expense.amount && (
              <button
                onClick={onUseStoredComputed}
                className="text-[10px] font-medium text-primary hover:text-primary/80 transition-colors duration-150"
                title="Set as total"
              >
                Use
              </button>
            )}
          </div>
        </div>
      )}

      {/* Grand Total */}
      <div className="flex justify-between gap-4 px-4 py-3 border-t border-border bg-background/40">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-bold text-text-1">Total</span>
          {hasMismatch && !isEditMode && <span title="Item total doesn't match receipt total"><AlertTriangle size={11} className="text-amber-500" /></span>}
          {showComputedMismatch && (
            <button
              onClick={onUseComputed}
              className="flex items-center gap-0.5 text-[10px] font-medium text-amber-500 hover:text-amber-400 transition-colors duration-150"
              title="Copy computed total into amount"
            >
              <AlertTriangle size={10} />
              Use computed
            </button>
          )}
        </div>
        <span className="text-sm font-bold text-text-1 tabular-nums">
          {formatCurrency(
            isEditMode && editAmount !== undefined ? (parseFloat(editAmount) || expense.amount) : expense.amount,
            expense.currency,
          )}
        </span>
      </div>

      {/* Zone B: Currency conversion (view mode only) */}
      {!isEditMode && showConversion && (
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
  const queryClient = useQueryClient()
  const { current } = useWorkspace()
  const { user } = useAuth()
  const role = current.role

  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [itemsOpen, setItemsOpen] = useState(false)
  const [breakdownOpen, setBreakdownOpen] = useState(true)
  const [isEditMode, setIsEditMode] = useState(false)
  const [editValues, setEditValues] = useState<EditValues>({
    merchant: '', date: '', notes: '', amount: '', currency: '', receiptNumber: '', paymentMethod: '',
    subtotal: '', discount: '', rounding: '',
  })
  const [editTaxLines, setEditTaxLines] = useState<TaxLine[]>([])
  const [editItems, setEditItems] = useState<EditItem[]>([])

  const { data: expense, isLoading } = useQuery({
    queryKey: queryKeys.expense(expenseId),
    queryFn: () => fetchExpense(expenseId),
  })

  const { data: currencies = [] } = useQuery({ queryKey: ['currencies'], queryFn: fetchCurrencies, staleTime: Infinity })

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
      toast.success('Changes saved')
    },
    onError: () => toast.error('Failed to save. Try again.'),
  })

  const saveItems = useMutation({
    mutationFn: (patch: Parameters<typeof updateExpenseItems>[1]) =>
      updateExpenseItems(expenseId, patch, { userId: user!.id, workspaceId: current.id }),
    onError: () => toast.error('Failed to save items. Try again.'),
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
      subtotal: exp.subtotal != null ? exp.subtotal.toFixed(2) : '',
      discount: exp.discount != null ? exp.discount.toFixed(2) : '',
      rounding: exp.rounding != null ? exp.rounding.toFixed(2) : '',
    })
    setEditTaxLines(exp.taxBreakdown ? [...exp.taxBreakdown] : [])
    setEditItems(exp.items.map((item) => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity.toString(),
      unitPrice: item.unitPrice != null ? item.unitPrice.toFixed(2) : '',
    })))
    setDetailsOpen(true)
    setItemsOpen(true)
    setBreakdownOpen(true)
    setIsEditMode(true)
  }

  const handleSaveAll = async (exp: Expense) => {
    const updates: Parameters<typeof updateExpense>[1] = {}
    const merchant = editValues.merchant.trim()
    const date = editValues.date || null
    const notes = editValues.notes.trim() || null
    const parsed = parseFloat(editValues.amount)
    const currency = editValues.currency
    const receiptNumber = editValues.receiptNumber.trim() || null
    const paymentMethod = editValues.paymentMethod.trim() || null
    const subtotal = editValues.subtotal !== '' ? Math.round(parseFloat(editValues.subtotal) * 100) / 100 : null
    const discount = editValues.discount !== '' ? Math.round(parseFloat(editValues.discount) * 100) / 100 : null
    const rounding = editValues.rounding !== '' ? Math.round(parseFloat(editValues.rounding) * 100) / 100 : null

    if (merchant !== exp.merchant) updates.merchant = merchant
    if (date !== exp.date) updates.date = date
    if (notes !== exp.notes) updates.notes = notes
    if (!isNaN(parsed) && parsed > 0 && parsed !== exp.amount) updates.amount = Math.round(parsed * 100) / 100
    if (currency !== exp.currency) updates.currency = currency
    if (receiptNumber !== exp.receiptNumber) updates.receiptNumber = receiptNumber
    if (paymentMethod !== exp.paymentMethod) updates.paymentMethod = paymentMethod
    if (subtotal !== exp.subtotal) updates.subtotal = subtotal
    if (discount !== exp.discount) updates.discount = discount
    if (rounding !== exp.rounding) updates.rounding = rounding

    const origTax = exp.taxBreakdown ?? []
    const taxChanged =
      editTaxLines.length !== origTax.length ||
      editTaxLines.some((l, i) => l.label !== origTax[i]?.label || l.amount !== origTax[i]?.amount)
    if (taxChanged) updates.taxBreakdown = editTaxLines.length > 0 ? editTaxLines : null

    const origItems = exp.items
    const editItemIds = new Set(editItems.filter((i) => i.id !== null).map((i) => i.id as string))

    const toDelete = origItems.filter((i) => !editItemIds.has(i.id)).map((i) => i.id)

    const mapRow = (item: EditItem) => {
      const qty = Math.max(1, parseInt(item.quantity) || 1)
      const unitPrice = item.unitPrice !== '' ? Math.round(parseFloat(item.unitPrice) * 100) / 100 : null
      const totalPrice = unitPrice != null ? Math.round(unitPrice * qty * 100) / 100 : null
      return { name: item.name.trim(), quantity: qty, unitPrice, totalPrice }
    }

    const toInsert = editItems
      .filter((item) => item.id === null && item.name.trim())
      .map(mapRow)

    const toUpdate = editItems
      .filter((item) => {
        if (!item.id || !item.name.trim()) return false
        const orig = origItems.find((o) => o.id === item.id)
        if (!orig) return false
        const qty = Math.max(1, parseInt(item.quantity) || 1)
        const unitPrice = item.unitPrice !== '' ? Math.round(parseFloat(item.unitPrice) * 100) / 100 : null
        return item.name.trim() !== orig.name || qty !== orig.quantity || unitPrice !== orig.unitPrice
      })
      .map((item) => ({ id: item.id as string, ...mapRow(item) }))

    const itemPatch = { toInsert, toUpdate, toDelete }
    const hasPatch = toDelete.length > 0 || toInsert.length > 0 || toUpdate.length > 0

    try {
      if (hasPatch) await saveItems.mutateAsync(itemPatch)
      if (Object.keys(updates).length > 0) {
        await saveAll.mutateAsync(updates)
        // saveAll.onSuccess handles invalidation + toast + setIsEditMode(false)
      } else {
        if (hasPatch) {
          queryClient.invalidateQueries({ queryKey: queryKeys.expense(expenseId) })
          queryClient.invalidateQueries({ queryKey: ['expenses'] })
          toast.success('Changes saved')
        }
        setIsEditMode(false)
      }
    } catch {
      // errors displayed via toast
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
  const canEdit = isDraft && ctx !== 'workspace' && user?.id === expense.submittedBy
  const showReporting =
    expense.reportingCurrency &&
    expense.reportingCurrency !== expense.currency &&
    expense.reportingAmount != null
  const isAdminOrOwner = role === 'admin' || role === 'owner'
  const showAuthenticity = current.isPremium && isAdminOrOwner && ctx === 'workspace'

  // live computed total from edit state (for "Use computed" feature)
  const liveComputed = isEditMode ? (() => {
    const sub = editValues.subtotal !== '' ? parseFloat(editValues.subtotal) : null
    const taxSum = editTaxLines.reduce((s, t) => s + t.amount, 0)
    const disc = editValues.discount !== '' ? parseFloat(editValues.discount) : null
    const round = editValues.rounding !== '' ? parseFloat(editValues.rounding) : null
    // Fall back to items sum when no subtotal
    const itemsSum = editItems.some((i) => i.unitPrice !== '')
      ? editItems.reduce((s, item) => {
          const qty = Math.max(1, parseInt(item.quantity) || 1)
          return s + (item.unitPrice !== '' ? (parseFloat(item.unitPrice) || 0) * qty : 0)
        }, 0)
      : null
    const base = sub ?? itemsSum
    if (base == null) return null
    return Math.round((base + taxSum - (disc ?? 0) + (round ?? 0)) * 100) / 100
  })() : null

  const handleUseComputed = () => {
    if (liveComputed != null) {
      setEditValues((v) => ({ ...v, amount: liveComputed.toFixed(2) }))
    }
  }

  const handleUseStoredComputed = () => {
    if (!expense.computedGrandTotal) return
    enterEditMode({ ...expense, amount: expense.computedGrandTotal })
  }

  const receiptThumb = receiptUrl ? (
    <button
      onClick={() => setLightboxOpen(true)}
      className="w-full bg-surface rounded-xl border border-border shadow-sm overflow-hidden cursor-pointer hover:opacity-90 transition-opacity duration-150"
      aria-label="View receipt image"
    >
      <img src={receiptUrl} alt="Receipt" className="w-full max-h-48 object-cover object-top" loading="lazy" decoding="async" />
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

  const itemCount = isEditMode ? editItems.length : expense.items.length
  const lineItemsHeader = (
    <button
      onClick={() => setItemsOpen((v) => !v)}
      className="w-full flex items-center justify-between px-4 py-2.5 cursor-pointer"
    >
      <h3 className="text-xs font-semibold text-text-2 uppercase tracking-wider">
        Line Items
        <span className="ml-1.5 font-normal normal-case tracking-normal text-text-2/60">
          ({itemCount})
        </span>
      </h3>
      <ChevronDown
        size={14}
        className={`text-text-2 transition-transform duration-200 ${itemsOpen ? 'rotate-180' : ''}`}
      />
    </button>
  )

  const lineItemsList = itemsOpen ? (
    isEditMode ? (
      <div className="p-3 space-y-2">
        {editItems.map((item, i) => {
          const qty = parseInt(item.quantity) || 1
          const unitP = item.unitPrice !== '' ? parseFloat(item.unitPrice) : null
          const total = unitP != null ? unitP * qty : null
          return (
            <div key={i} className="bg-background rounded-xl border border-border p-3 space-y-2.5 animate-fade-in-up" style={{ '--stagger-delay': `${i * 40}ms` } as React.CSSProperties}>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={item.name}
                  onChange={(e) => setEditItems((prev) => prev.map((it, j) => j === i ? { ...it, name: e.target.value } : it))}
                  placeholder="Item name"
                  className={inputCls + ' flex-1'}
                />
                <button
                  onClick={() => setEditItems((prev) => prev.filter((_, j) => j !== i))}
                  className="text-danger/50 hover:text-danger transition-colors duration-150 shrink-0"
                  aria-label="Remove item"
                >
                  <Trash2 size={13} />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <p className="text-[10px] font-medium text-text-2 uppercase tracking-wide">Qty</p>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={item.quantity}
                    onChange={(e) => setEditItems((prev) => prev.map((it, j) => j === i ? { ...it, quantity: e.target.value } : it))}
                    className={inputCls + ' text-center'}
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-medium text-text-2 uppercase tracking-wide">Unit Price</p>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={item.unitPrice}
                    onChange={(e) => setEditItems((prev) => prev.map((it, j) => j === i ? { ...it, unitPrice: e.target.value } : it))}
                    placeholder="0.00"
                    className={inputCls + ' text-right'}
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-medium text-text-2 uppercase tracking-wide">Total</p>
                  <p className="text-xs font-semibold text-text-1 tabular-nums h-[30px] flex items-center justify-end">
                    {total != null ? formatCurrency(total, expense.currency) : <span className="text-text-2/40">—</span>}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
        <button
          onClick={() => setEditItems((prev) => [...prev, { id: null, name: '', quantity: '1', unitPrice: '' }])}
          className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors duration-150 px-1 py-1"
        >
          <Plus size={11} /> Add item
        </button>
      </div>
    ) : (
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
    )
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
          {currencies.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
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
              {canEdit && !isEditMode && (
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
        {(isEditMode || expense.items.length > 0) && (
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
          {breakdownOpen && (
            <TotalBreakdown
              expense={expense}
              isEditMode={isEditMode}
              editTaxLines={editTaxLines}
              onTaxLinesChange={setEditTaxLines}
              editSubtotal={editValues.subtotal}
              editDiscount={editValues.discount}
              editRounding={editValues.rounding}
              onSubtotalChange={(v) => setEditValues((ev) => ({ ...ev, subtotal: v }))}
              onDiscountChange={(v) => setEditValues((ev) => ({ ...ev, discount: v }))}
              onRoundingChange={(v) => setEditValues((ev) => ({ ...ev, rounding: v }))}
              editAmount={isEditMode ? editValues.amount : undefined}
              liveComputed={liveComputed}
              onUseComputed={handleUseComputed}
              onUseStoredComputed={canEdit ? handleUseStoredComputed : undefined}
            />
          )}
        </div>

        {isEditMode && <div className="h-20" />}
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
                  {canEdit && !isEditMode && (
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
            {(isEditMode || expense.items.length > 0) && (
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
              {breakdownOpen && (
            <TotalBreakdown
              expense={expense}
              isEditMode={isEditMode}
              editTaxLines={editTaxLines}
              onTaxLinesChange={setEditTaxLines}
              editSubtotal={editValues.subtotal}
              editDiscount={editValues.discount}
              editRounding={editValues.rounding}
              onSubtotalChange={(v) => setEditValues((ev) => ({ ...ev, subtotal: v }))}
              onDiscountChange={(v) => setEditValues((ev) => ({ ...ev, discount: v }))}
              onRoundingChange={(v) => setEditValues((ev) => ({ ...ev, rounding: v }))}
              editAmount={isEditMode ? editValues.amount : undefined}
              liveComputed={liveComputed}
              onUseComputed={handleUseComputed}
              onUseStoredComputed={canEdit ? handleUseStoredComputed : undefined}
            />
          )}
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
                  <img src={receiptUrl} alt="Receipt" className="w-full h-full object-cover" loading="lazy" decoding="async" />
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
        {isEditMode && <div className="h-20" />}
      </div>

      {/* ── Floating edit bar ── */}
      {isEditMode && (
        <div className="fixed bottom-[76px] lg:bottom-5 left-0 lg:left-56 right-0 z-50 px-4 lg:px-8 pointer-events-none">
          <div className="pointer-events-auto lg:max-w-lg lg:mx-auto bg-surface/95 backdrop-blur-md border border-border rounded-2xl shadow-xl px-3 py-2.5 flex gap-2">
              <button
              onClick={() => setIsEditMode(false)}
              className="flex-1 h-9 text-sm text-text-2 border border-border rounded-xl cursor-pointer hover:bg-nav-hover-bg transition-colors duration-150"
            >
              Cancel
            </button>
            <button
              onClick={() => handleSaveAll(expense)}
              disabled={saveAll.isPending || saveItems.isPending}
              className="flex-1 h-9 flex items-center justify-center gap-1.5 text-sm font-semibold text-white bg-primary rounded-xl disabled:opacity-50 cursor-pointer"
            >
              {(saveAll.isPending || saveItems.isPending) ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Save changes
            </button>
          </div>
        </div>
      )}

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
