import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { fetchCurrencies, createExpense } from '#/lib/queries'
import { TopBar } from '#/components/TopBar'
import { useWorkspace } from '#/context/WorkspaceContext'
import { useAuth } from '#/context/AuthContext'

export const Route = createFileRoute('/_app/expenses/new')({
  component: NewExpense,
})

const inputCls = 'w-full h-11 px-3 text-sm border border-border rounded-xl bg-surface text-text-1 focus:outline-none focus:ring-2 focus:ring-primary'

function NewExpense() {
  const navigate = useNavigate()
  const { current } = useWorkspace()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const today = new Date().toISOString().slice(0, 10)
  const [merchant, setMerchant] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState(current.baseCurrency)
  const [date, setDate] = useState(today)
  const [paymentMethod, setPaymentMethod] = useState('')
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<{ merchant?: string; amount?: string; currency?: string }>({})

  const { data: currencies = [] } = useQuery({ queryKey: ['currencies'], queryFn: fetchCurrencies, staleTime: Infinity })

  const create = useMutation({
    mutationFn: () => createExpense({
      merchant: merchant.trim(),
      amount: Math.round(parseFloat(amount) * 100) / 100,
      currency,
      date: date || null,
      notes: notes.trim() || null,
      paymentMethod: paymentMethod.trim() || null,
      workspaceId: current.id,
      userId: user!.id,
    }),
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
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
    <div className="min-h-dvh bg-background">
      <TopBar title="Add Expense" showBack />

      <form onSubmit={handleSubmit} noValidate className="px-4 py-4 space-y-4 max-w-lg mx-auto">

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
              className={inputCls + ' cursor-pointer'}
            >
              <option value="" disabled>Select…</option>
              {currencies.map((c) => (
                <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
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
            rows={4}
            placeholder="Optional notes…"
            className={inputCls + ' h-auto py-2.5 resize-none'}
          />
        </div>

        <button
          type="submit"
          disabled={create.isPending}
          className="w-full h-11 flex items-center justify-center gap-2 bg-primary text-white text-sm font-semibold rounded-xl disabled:opacity-50 cursor-pointer touch-manipulation transition-opacity duration-150"
        >
          {create.isPending ? <Loader2 size={16} className="animate-spin" /> : null}
          {create.isPending ? 'Creating…' : 'Add expense'}
        </button>

      </form>
    </div>
  )
}
