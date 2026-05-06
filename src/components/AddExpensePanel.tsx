import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { X, FilePen, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { usePanel } from '#/context/PanelContext'
import { useWorkspace } from '#/context/WorkspaceContext'
import { useAuth } from '#/context/AuthContext'
import { fetchCategories, fetchCurrencies, createExpense } from '#/lib/queries'
import type { Category } from '#/lib/types'

const inputCls = 'w-full h-10 px-3 text-sm border border-border rounded-xl bg-background text-text-1 focus:outline-none focus:ring-2 focus:ring-primary'

export function AddExpensePanel() {
  const { closePanel } = usePanel()
  const { current } = useWorkspace()
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const today = new Date().toISOString().slice(0, 10)
  const [merchant, setMerchant] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState(current.baseCurrency)
  const [date, setDate] = useState(today)
  const [categoryId, setCategoryId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<{ merchant?: string; amount?: string; currency?: string }>({})

  const { data: currencies = [] } = useQuery({ queryKey: ['currencies'], queryFn: fetchCurrencies, staleTime: Infinity })
  const { data: categories = [] } = useQuery<Category[]>({ queryKey: ['categories'], queryFn: fetchCategories, staleTime: Infinity })

  const categoryGroups = categories.reduce<Record<string, Category[]>>((acc, cat) => {
    if (!acc[cat.groupName]) acc[cat.groupName] = []
    acc[cat.groupName].push(cat)
    return acc
  }, {})

  const create = useMutation({
    mutationFn: () => createExpense({
      merchant: merchant.trim(),
      amount: Math.round(parseFloat(amount) * 100) / 100,
      currency,
      date: date || null,
      notes: notes.trim() || null,
      categoryId: categoryId || null,
      paymentMethod: paymentMethod.trim() || null,
      workspaceId: current.id,
      userId: user!.id,
    }),
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      closePanel()
      navigate({ to: '/expenses/$expenseId', params: { expenseId: id } })
    },
    onError: () => toast.error('Failed to create expense. Try again.'),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const errs: typeof errors = {}
    if (!merchant.trim()) errs.merchant = 'Required'
    const parsed = parseFloat(amount)
    if (!amount || isNaN(parsed) || parsed <= 0) errs.amount = 'Enter a valid amount'
    if (!currency) errs.currency = 'Required'
    if (Object.keys(errs).length) { setErrors(errs); return }
    setErrors({})
    create.mutate()
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[60] bg-black/40" onClick={closePanel} aria-hidden="true" />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-sm z-[70] bg-surface border-l border-border shadow-2xl flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <FilePen size={18} className="text-primary" />
            <h2 className="text-sm font-semibold text-text-1">Add Expense</h2>
          </div>
          <button
            onClick={closePanel}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-text-2 hover:bg-nav-hover-bg transition-colors duration-150 cursor-pointer"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-1 mb-1">
              Merchant <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              placeholder="e.g. McDonald's"
              autoFocus
              className={inputCls}
            />
            {errors.merchant && <p className="mt-1 text-xs text-danger">{errors.merchant}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-1 mb-1">
                Amount <span className="text-danger">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className={inputCls}
              />
              {errors.amount && <p className="mt-1 text-xs text-danger">{errors.amount}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-text-1 mb-1">
                Currency <span className="text-danger">*</span>
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className={inputCls}
              >
                <option value="" disabled>Select…</option>
                {currencies.map((c) => (
                  <option key={c.code} value={c.code}>{c.code}</option>
                ))}
              </select>
              {errors.currency && <p className="mt-1 text-xs text-danger">{errors.currency}</p>}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-1 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-1 mb-1">Category</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className={inputCls}
            >
              <option value="">— No category —</option>
              {Object.entries(categoryGroups).map(([group, cats]) => (
                <optgroup key={group} label={group}>
                  {cats.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-1 mb-1">Payment method</label>
            <input
              type="text"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              placeholder="e.g. Credit card"
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-1 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Optional notes…"
              className={inputCls + ' h-auto py-2.5 resize-none'}
            />
          </div>
        </form>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border shrink-0">
          <button
            onClick={handleSubmit}
            disabled={create.isPending}
            className="w-full h-11 flex items-center justify-center gap-2 bg-primary text-white text-sm font-semibold rounded-xl disabled:opacity-50 cursor-pointer touch-manipulation transition-opacity duration-150"
          >
            {create.isPending ? <Loader2 size={16} className="animate-spin" /> : null}
            {create.isPending ? 'Creating…' : 'Add expense'}
          </button>
        </div>
      </div>
    </>
  )
}
