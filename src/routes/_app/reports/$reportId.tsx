import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient, useQueries } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { AlertTriangle, Plus, Trash2, CheckCircle, XCircle, Loader2, Car, X, Check } from 'lucide-react'
import { toast } from 'sonner'
import {
  fetchReport, submitReport, approveReport, rejectReport,
  addExpenseToReport, removeExpenseFromReport,
  addMileageToReport, removeMileageFromReport,
  fetchExpenses, fetchMileage, fetchScanSignedUrl,
} from '#/lib/queries'
import { queryKeys } from '#/lib/queryKeys'
import { formatCurrency, formatDate } from '#/lib/format'
import { TopBar } from '#/components/TopBar'
import { StatusBadge } from '#/components/StatusBadge'
import { ExpenseRow } from '#/components/ExpenseRow'
import { useWorkspace } from '#/context/WorkspaceContext'
import { WordMark } from '#/assets/WordMark'
import type { Expense, MileageEntry } from '#/lib/types'

export const Route = createFileRoute('/_app/reports/$reportId')({
  validateSearch: (search: Record<string, unknown>) => ({
    ctx: search.ctx === 'admin' ? ('admin' as const) : undefined,
    print: !!search.print ? (true as const) : undefined,
  }),
  component: ReportDetail,
})

function ReportDetail() {
  const { reportId } = Route.useParams()
  const { ctx, print: isPrint } = Route.useSearch()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { current } = useWorkspace()
  const isAdminOrOwner = current.role === 'admin' || current.role === 'owner'
  const isAdminCtx = ctx === 'admin' && isAdminOrOwner

  const [activeTab, setActiveTab] = useState<'expenses' | 'mileage'>('expenses')
  const [addingExpenses, setAddingExpenses] = useState(false)
  const [addingMileage, setAddingMileage] = useState(false)
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<Set<string>>(new Set())
  const [selectedMileageIds, setSelectedMileageIds] = useState<Set<string>>(new Set())
  const [rejectNote, setRejectNote] = useState('')
  const [showRejectModal, setShowRejectModal] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.report(reportId),
    queryFn: () => fetchReport(reportId),
  })

  const { data: draftExpenses = [] } = useQuery({
    queryKey: [...queryKeys.expenses({ status: 'draft' }), 'no-report'],
    queryFn: () => fetchExpenses({ status: 'draft' }),
    enabled: addingExpenses,
    select: (expenses: Expense[]) => expenses.filter((e) => !e.reportId),
  })

  const { data: draftMileage = [] } = useQuery({
    queryKey: [...queryKeys.mileage({ status: 'draft' }), 'no-report'],
    queryFn: () => fetchMileage({ status: 'draft' }),
    enabled: addingMileage,
    select: (entries: MileageEntry[]) => entries.filter((m) => !m.reportId),
  })

  // Fetch signed URLs for all expense images (print mode only)
  const expensesWithImages = isPrint ? (data?.expenses ?? []).filter((e) => !!e.scanFilePath) : []
  const imageResults = useQueries({
    queries: expensesWithImages.map((e) => ({
      queryKey: queryKeys.scanUrl(e.scanFilePath!),
      queryFn: () => fetchScanSignedUrl(e.scanFilePath!),
    })),
  })
  const imageMap: Record<string, string | null> = {}
  expensesWithImages.forEach((e, i) => {
    imageMap[e.id] = imageResults[i]?.data ?? null
  })
  const imagesLoading = imageResults.some((q) => q.isLoading)

  useEffect(() => {
    if (!isPrint || isLoading || imagesLoading) return
    const timer = setTimeout(() => window.print(), 600)
    return () => clearTimeout(timer)
  }, [isPrint, isLoading, imagesLoading])

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.report(reportId) })
    queryClient.invalidateQueries({ queryKey: ['expenses'] })
    queryClient.invalidateQueries({ queryKey: ['mileage'] })
    queryClient.invalidateQueries({ queryKey: ['reports'] })
  }

  const submitMutation = useMutation({
    mutationFn: () => submitReport(reportId),
    onSuccess: () => { invalidate(); toast.success('Report submitted for approval') },
    onError: () => toast.error('Failed to submit. Try again.'),
  })

  const approveMutation = useMutation({
    mutationFn: () => approveReport(reportId),
    onSuccess: () => { invalidate(); toast.success('Report approved') },
    onError: () => toast.error('Failed to approve. Try again.'),
  })

  const rejectMutation = useMutation({
    mutationFn: () => rejectReport(reportId, rejectNote),
    onSuccess: () => { invalidate(); setShowRejectModal(false); setRejectNote(''); toast.success('Report rejected') },
    onError: () => toast.error('Failed to reject. Try again.'),
  })

  const addExpenses = useMutation({
    mutationFn: (ids: string[]) => Promise.all(ids.map((id) => addExpenseToReport(reportId, id))),
    onSuccess: (_, ids) => { invalidate(); setAddingExpenses(false); setSelectedExpenseIds(new Set()); toast.success(`${ids.length} expense${ids.length > 1 ? 's' : ''} added`) },
    onError: () => toast.error('Failed to add expenses. Try again.'),
  })

  const removeExpense = useMutation({
    mutationFn: (expenseId: string) => removeExpenseFromReport(expenseId),
    onSuccess: () => { invalidate(); toast.success('Expense removed') },
    onError: () => toast.error('Failed to remove expense. Try again.'),
  })

  const addMileageEntries = useMutation({
    mutationFn: (ids: string[]) => Promise.all(ids.map((id) => addMileageToReport(reportId, id))),
    onSuccess: (_, ids) => { invalidate(); setAddingMileage(false); setSelectedMileageIds(new Set()); toast.success(`${ids.length} mileage entr${ids.length > 1 ? 'ies' : 'y'} added`) },
    onError: () => toast.error('Failed to add mileage. Try again.'),
  })

  const removeMileageEntry = useMutation({
    mutationFn: (mileageId: string) => removeMileageFromReport(mileageId),
    onSuccess: () => { invalidate(); toast.success('Mileage entry removed') },
    onError: () => toast.error('Failed to remove mileage. Try again.'),
  })

  const closeExpensePicker = () => { setAddingExpenses(false); setSelectedExpenseIds(new Set()) }
  const closeMileagePicker = () => { setAddingMileage(false); setSelectedMileageIds(new Set()) }

  const toggleExpense = (id: string) =>
    setSelectedExpenseIds((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })

  const toggleMileage = (id: string) =>
    setSelectedMileageIds((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })

  const toggleAllExpenses = () =>
    setSelectedExpenseIds((prev) =>
      prev.size === draftExpenses.length ? new Set() : new Set(draftExpenses.map((e) => e.id))
    )

  const toggleAllMileage = () =>
    setSelectedMileageIds((prev) =>
      prev.size === draftMileage.length ? new Set() : new Set(draftMileage.map((m) => m.id))
    )

  if (isLoading) return <div className="min-h-dvh bg-background" />
  if (!data) {
    return (
      <div>
        <TopBar title="Report" showBack />
        <p className="text-sm text-text-2 text-center mt-12">Report not found.</p>
      </div>
    )
  }

  const { report, expenses, mileage } = data
  const isDraft = report.status === 'draft'
  const canSubmit = isDraft && (expenses.length > 0 || mileage.length > 0)
  const itemCount = expenses.length + mileage.length

  // ── Print view ─────────────────────────────────────────────────────────────
  if (isPrint) {
    return (
      <div className="min-h-screen bg-white p-8 max-w-4xl mx-auto font-sans text-[#1E1B4B]">
        {/* Header */}
        <div className="flex items-start justify-between mb-6 pb-4 border-b border-gray-200">
          <div>
            <WordMark className="h-6 w-auto text-[#6366F1] mb-1" />
            <p className="text-xs text-gray-500">{current.name}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400">Generated {new Date().toLocaleDateString('en-MY', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
        </div>

        {/* Report info */}
        <div className="mb-6">
          <div className="flex items-start gap-3 mb-2">
            <h1 className="text-xl font-bold text-[#1E1B4B] flex-1">{report.title}</h1>
            <StatusBadge status={report.status} />
          </div>
          <p className="text-2xl font-bold text-[#6366F1] tabular-nums mb-1">
            {formatCurrency(report.totalAmount, report.currency)}
          </p>
          <p className="text-xs text-gray-500">
            {itemCount} {itemCount === 1 ? 'item' : 'items'} ·{' '}
            {report.submittedAt
              ? `Submitted ${formatDate(report.submittedAt)}`
              : `Created ${formatDate(report.createdAt)}`}
          </p>
          {report.rejectionNote && (
            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <p className="text-xs font-semibold text-amber-700">Rejected</p>
              <p className="text-xs text-amber-600 mt-0.5">{report.rejectionNote}</p>
            </div>
          )}
        </div>

        {/* Expenses */}
        {expenses.length > 0 && (
          <div className="mb-6">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
              Expenses ({expenses.length})
            </h2>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 pr-3 text-xs font-semibold text-gray-500 w-12">Receipt</th>
                  <th className="text-left py-2 pr-3 text-xs font-semibold text-gray-500">Description</th>
                  <th className="text-left py-2 pr-3 text-xs font-semibold text-gray-500">Date</th>
                  <th className="text-left py-2 pr-3 text-xs font-semibold text-gray-500">Category</th>
                  <th className="text-right py-2 text-xs font-semibold text-gray-500">Amount</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id} className="border-b border-gray-100">
                    <td className="py-2 pr-3 align-top">
                      {imageMap[e.id] ? (
                        <img
                          src={imageMap[e.id]!}
                          alt="Receipt"
                          className="w-10 h-12 object-cover rounded object-top"
                        />
                      ) : (
                        <div className="w-10 h-12 rounded bg-gray-100 flex items-center justify-center">
                          <span className="text-[8px] text-gray-400">N/A</span>
                        </div>
                      )}
                    </td>
                    <td className="py-2 pr-3 align-top">
                      <p className="font-medium text-[#1E1B4B]">{e.title}</p>
                      {e.merchant && <p className="text-xs text-gray-500 mt-0.5">{e.merchant}</p>}
                      {e.receiptNumber && <p className="text-[10px] text-gray-400 mt-0.5">#{e.receiptNumber}</p>}
                    </td>
                    <td className="py-2 pr-3 align-top whitespace-nowrap">
                      <span className="text-xs text-gray-600">{formatDate(e.date ?? e.createdAt)}</span>
                    </td>
                    <td className="py-2 pr-3 align-top">
                      <span className="text-xs text-gray-600">{e.category ?? '—'}</span>
                    </td>
                    <td className="py-2 align-top text-right">
                      <p className="font-semibold tabular-nums text-[#1E1B4B]">
                        {formatCurrency(e.reportingAmount ?? e.amount, e.reportingCurrency ?? e.currency)}
                      </p>
                      {e.reportingAmount != null && e.currency !== e.reportingCurrency && (
                        <p className="text-[10px] text-gray-400 tabular-nums">
                          {formatCurrency(e.amount, e.currency)}
                        </p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Mileage */}
        {mileage.length > 0 && (
          <div className="mb-6">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
              Mileage ({mileage.length})
            </h2>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 pr-3 text-xs font-semibold text-gray-500">Route</th>
                  <th className="text-left py-2 pr-3 text-xs font-semibold text-gray-500">Date</th>
                  <th className="text-left py-2 pr-3 text-xs font-semibold text-gray-500">Distance</th>
                  <th className="text-right py-2 text-xs font-semibold text-gray-500">Amount</th>
                </tr>
              </thead>
              <tbody>
                {mileage.map((m) => (
                  <tr key={m.id} className="border-b border-gray-100">
                    <td className="py-2 pr-3">
                      <p className="font-medium text-[#1E1B4B]">{m.fromLocation ?? '—'} → {m.toLocation ?? '—'}</p>
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      <span className="text-xs text-gray-600">{formatDate(m.createdAt)}</span>
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      <span className="text-xs text-gray-600">{m.distance} {m.unit}</span>
                    </td>
                    <td className="py-2 text-right">
                      <span className="font-semibold tabular-nums text-[#1E1B4B]">{formatCurrency(m.amount)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Total summary */}
        <div className="flex justify-end pt-3 border-t border-gray-200">
          <div className="text-right">
            <p className="text-xs text-gray-500 mb-0.5">Total</p>
            <p className="text-xl font-bold text-[#6366F1] tabular-nums">
              {formatCurrency(report.totalAmount, report.currency)}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-gray-100">
          <p className="text-[10px] text-gray-400 text-center">
            Generated by Xpenz · {current.name} · {new Date().toLocaleString()}
          </p>
        </div>
      </div>
    )
  }

  // ── Shared sub-components ──────────────────────────────────────────────────

  const rejectionBanner = report.rejectionNote && isDraft ? (
    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 flex items-start gap-3">
      <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
      <div>
        <p className="text-xs font-semibold text-amber-500">Report rejected</p>
        <p className="text-xs text-text-2 mt-0.5">{report.rejectionNote}</p>
      </div>
    </div>
  ) : null

  const addBtn = (onClick: () => void) => isDraft ? (
    <button
      onClick={onClick}
      className="h-6 px-2.5 flex items-center gap-1 text-[11px] font-semibold text-primary border border-primary/30 rounded-lg cursor-pointer hover:bg-primary/5 active:bg-primary/10 transition-colors duration-150"
    >
      <Plus size={11} /> Add
    </button>
  ) : null

  const expenseRows = expenses.map((e) => (
    <div key={e.id} className="flex items-center gap-2 pr-3">
      <div className="flex-1 min-w-0">
        <ExpenseRow
          expense={e}
          useReportingAmount
          onClick={() => navigate({ to: '/expenses/$expenseId', params: { expenseId: e.id } })}
        />
      </div>
      {isDraft && (
        <button
          onClick={() => removeExpense.mutate(e.id)}
          disabled={removeExpense.isPending}
          aria-label="Remove expense"
          className="shrink-0 w-7 h-7 flex items-center justify-center text-text-2/50 hover:text-danger active:text-danger transition-colors duration-150 cursor-pointer disabled:opacity-40"
        >
          <Trash2 size={13} />
        </button>
      )}
    </div>
  ))

  const mileageRows = mileage.map((m) => (
    <div key={m.id} className="flex items-center gap-2 px-4 py-3">
      <Car size={14} className="text-text-2 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-text-1 truncate">
          {m.fromLocation ?? '—'} → {m.toLocation ?? '—'}
        </p>
        <p className="text-[11px] text-text-2">{m.distance} {m.unit} · {formatDate(m.createdAt)}</p>
      </div>
      <span className="text-xs font-semibold text-text-1 tabular-nums shrink-0">
        {formatCurrency(m.amount)}
      </span>
      {isDraft && (
        <button
          onClick={() => removeMileageEntry.mutate(m.id)}
          disabled={removeMileageEntry.isPending}
          aria-label="Remove mileage"
          className="shrink-0 w-7 h-7 flex items-center justify-center text-text-2/50 hover:text-danger active:text-danger transition-colors duration-150 cursor-pointer disabled:opacity-40"
        >
          <Trash2 size={13} />
        </button>
      )}
    </div>
  ))

  const submitCTA = isDraft && !isAdminCtx ? (
    <div className="space-y-1.5">
      <button
        onClick={() => submitMutation.mutate()}
        disabled={!canSubmit || submitMutation.isPending}
        aria-busy={submitMutation.isPending}
        className="w-full h-11 bg-primary text-white text-sm font-semibold rounded-xl disabled:opacity-50 touch-manipulation cursor-pointer transition-opacity duration-150"
      >
        {submitMutation.isPending ? 'Submitting…' : 'Submit for Approval'}
      </button>
      {!canSubmit && (
        <p className="text-xs text-text-2 text-center">Add at least one item to submit.</p>
      )}
    </div>
  ) : isAdminCtx && report.status === 'submitted' ? (
    <div className="flex gap-3">
      <button
        onClick={() => setShowRejectModal(true)}
        disabled={rejectMutation.isPending || approveMutation.isPending}
        className="flex-1 h-11 flex items-center justify-center gap-1.5 text-sm font-medium text-danger border border-danger/30 rounded-xl touch-manipulation cursor-pointer hover:bg-danger/5 transition-colors duration-150 disabled:opacity-50"
      >
        <XCircle size={16} /> Reject
      </button>
      <button
        onClick={() => approveMutation.mutate()}
        disabled={approveMutation.isPending || rejectMutation.isPending}
        className="flex-1 h-11 flex items-center justify-center gap-1.5 text-sm font-semibold text-white bg-primary rounded-xl touch-manipulation cursor-pointer hover:opacity-90 transition-opacity duration-150 disabled:opacity-50"
      >
        {approveMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
        Approve
      </button>
    </div>
  ) : null

  return (
    <div>
      <TopBar title={report.title} showBack />

      {/* ── MOBILE layout ── */}
      <div className="lg:hidden">

        {/* Summary + rejection */}
        <div className="px-4 pt-3 pb-2 space-y-2">
          {rejectionBanner}
          <div className="bg-surface rounded-xl px-4 py-3 border border-border shadow-sm">
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="text-sm font-semibold text-text-1 truncate flex-1">{report.title}</p>
              <StatusBadge status={report.status} />
            </div>
            <p className="text-xl font-bold text-text-1 tabular-nums">
              {formatCurrency(report.totalAmount, report.currency)}
            </p>
            <p className="text-xs text-text-2 mt-0.5">
              {itemCount} {itemCount === 1 ? 'item' : 'items'} ·{' '}
              {report.submittedAt ? `Submitted ${formatDate(report.submittedAt)}` : `Created ${formatDate(report.createdAt)}`}
            </p>
          </div>
        </div>

        {/* Tab strip — sticky below TopBar */}
        <div className="sticky top-14 z-10 bg-background border-b border-border px-4 py-2 flex items-center gap-2">
          <button
            onClick={() => setActiveTab('expenses')}
            className={`flex-1 h-8 rounded-lg text-xs font-semibold transition-colors duration-150 cursor-pointer ${
              activeTab === 'expenses' ? 'bg-primary text-white' : 'text-text-2 hover:text-text-1 bg-surface'
            }`}
          >
            Expenses{expenses.length > 0 ? ` (${expenses.length})` : ''}
          </button>
          <button
            onClick={() => setActiveTab('mileage')}
            className={`flex-1 h-8 rounded-lg text-xs font-semibold transition-colors duration-150 cursor-pointer ${
              activeTab === 'mileage' ? 'bg-primary text-white' : 'text-text-2 hover:text-text-1 bg-surface'
            }`}
          >
            Mileage{mileage.length > 0 ? ` (${mileage.length})` : ''}
          </button>
          {isDraft && (
            <button
              onClick={() => activeTab === 'expenses'
                ? (setAddingExpenses(true), setAddingMileage(false))
                : (setAddingMileage(true), setAddingExpenses(false))
              }
              className="h-8 px-3 flex items-center gap-1 text-[11px] font-semibold text-primary border border-primary/30 rounded-lg cursor-pointer hover:bg-primary/5 active:bg-primary/10 transition-colors"
            >
              <Plus size={11} /> Add
            </button>
          )}
        </div>

        {/* Tab content */}
        <div className="px-4 py-3 pb-36">
          {activeTab === 'expenses' ? (
            <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
              {expenses.length === 0
                ? <p className="text-xs text-text-2 px-4 py-4 text-center">No expenses added yet.</p>
                : <div className="divide-y divide-border">{expenseRows}</div>
              }
            </div>
          ) : (
            <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
              {mileage.length === 0
                ? <p className="text-xs text-text-2 px-4 py-4 text-center">No mileage added yet.</p>
                : <div className="divide-y divide-border">{mileageRows}</div>
              }
            </div>
          )}
        </div>

        {/* Sticky bottom CTA */}
        {submitCTA && (
          <div className="fixed bottom-[84px] left-4 right-4 bg-surface rounded-2xl border border-border shadow-xl px-4 py-3 z-20">
            {submitCTA}
          </div>
        )}
      </div>

      {/* ── DESKTOP layout ── */}
      <div className="hidden lg:block px-6 py-5">
        <div className="space-y-4">

          {rejectionBanner}

          {/* Summary card */}
          <div className="bg-surface rounded-xl px-5 py-4 border border-border shadow-sm flex items-center justify-between gap-6">
            <div>
              <p className="text-sm font-semibold text-text-1 mb-1">{report.title}</p>
              <p className="text-2xl font-bold text-text-1 tabular-nums">
                {formatCurrency(report.totalAmount, report.currency)}
              </p>
              <p className="text-xs text-text-2 mt-1">
                {itemCount} {itemCount === 1 ? 'item' : 'items'} ·{' '}
                {report.submittedAt ? `Submitted ${formatDate(report.submittedAt)}` : `Created ${formatDate(report.createdAt)}`}
              </p>
            </div>
            <StatusBadge status={report.status} />
          </div>

          {/* Two-column: expenses + mileage */}
          <div className="grid grid-cols-[3fr_2fr] gap-4 items-start">

            {/* Expenses table */}
            <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-background/40">
                <p className="text-xs font-semibold text-text-2 uppercase tracking-wider">
                  Expenses {expenses.length > 0 && `(${expenses.length})`}
                </p>
                {addBtn(() => { setAddingExpenses(true); setAddingMileage(false) })}
              </div>
              {expenses.length === 0 ? (
                <p className="text-xs text-text-2 px-4 py-3">No expenses added yet.</p>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-4 py-2 text-xs font-semibold text-text-2">Expense</th>
                      <th className="text-left px-4 py-2 text-xs font-semibold text-text-2">Date</th>
                      <th className="text-left px-4 py-2 text-xs font-semibold text-text-2">Status</th>
                      <th className="text-right px-4 py-2 text-xs font-semibold text-text-2">Amount</th>
                      {isDraft && <th className="px-4 py-2" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {expenses.map((e) => (
                      <tr
                        key={e.id}
                        onClick={() => navigate({ to: '/expenses/$expenseId', params: { expenseId: e.id } })}
                        className="hover:bg-primary/5 transition-colors duration-100 cursor-pointer"
                      >
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-text-1 truncate max-w-[180px]">{e.title}</p>
                          <p className="text-xs text-text-2 mt-0.5 truncate max-w-[180px]">{e.merchant}</p>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-xs text-text-2">{formatDate(e.date ?? e.createdAt)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={e.status} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <p className="text-sm font-semibold text-text-1 tabular-nums">
                            {formatCurrency(e.reportingAmount ?? e.amount, e.reportingCurrency ?? e.currency)}
                          </p>
                          {e.reportingAmount != null && e.currency !== e.reportingCurrency && (
                            <p className="text-[10px] text-text-2/60 tabular-nums">
                              {formatCurrency(e.amount, e.currency)}
                            </p>
                          )}
                        </td>
                        {isDraft && (
                          <td className="px-3 py-3">
                            <button
                              onClick={(ev) => { ev.stopPropagation(); removeExpense.mutate(e.id) }}
                              disabled={removeExpense.isPending}
                              aria-label="Remove expense"
                              className="w-7 h-7 flex items-center justify-center text-text-2/50 hover:text-danger transition-colors duration-150 cursor-pointer disabled:opacity-40"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Mileage table */}
            <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-background/40">
                <p className="text-xs font-semibold text-text-2 uppercase tracking-wider">
                  Mileage {mileage.length > 0 && `(${mileage.length})`}
                </p>
                {addBtn(() => { setAddingMileage(true); setAddingExpenses(false) })}
              </div>
              {mileage.length === 0 ? (
                <p className="text-xs text-text-2 px-4 py-3">No mileage added yet.</p>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-4 py-2 text-xs font-semibold text-text-2">Route</th>
                      <th className="text-right px-4 py-2 text-xs font-semibold text-text-2">Amount</th>
                      {isDraft && <th className="px-4 py-2" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {mileage.map((m) => (
                      <tr key={m.id} className="hover:bg-primary/5 transition-colors duration-100">
                        <td className="px-4 py-3">
                          <p className="text-xs font-medium text-text-1 truncate max-w-[160px]">
                            {m.fromLocation ?? '—'} → {m.toLocation ?? '—'}
                          </p>
                          <p className="text-[11px] text-text-2 mt-0.5">{m.distance} {m.unit} · {formatDate(m.createdAt)}</p>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-xs font-semibold text-text-1 tabular-nums">
                            {formatCurrency(m.amount)}
                          </span>
                        </td>
                        {isDraft && (
                          <td className="px-3 py-3">
                            <button
                              onClick={() => removeMileageEntry.mutate(m.id)}
                              disabled={removeMileageEntry.isPending}
                              aria-label="Remove mileage"
                              className="w-7 h-7 flex items-center justify-center text-text-2/50 hover:text-danger transition-colors duration-150 cursor-pointer disabled:opacity-40"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

          </div>

          {/* CTA */}
          {submitCTA && <div>{submitCTA}</div>}

        </div>
      </div>

      {/* Add expense picker modal */}
      {addingExpenses && (
        <div
          className="fixed inset-0 z-[200] bg-black/60 flex items-end lg:items-center justify-center p-4 lg:p-6"
          onClick={closeExpensePicker}
        >
          <div
            className="w-full max-w-md bg-surface rounded-2xl border border-border shadow-xl overflow-hidden animate-fade-in-up flex flex-col max-h-[70vh] lg:max-h-[560px]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-border shrink-0">
              <div className="flex items-center gap-3">
                <p className="text-sm font-semibold text-text-1">Add expenses</p>
                {draftExpenses.length > 0 && (
                  <button
                    onClick={toggleAllExpenses}
                    className="text-xs text-primary hover:opacity-70 cursor-pointer transition-opacity"
                  >
                    {selectedExpenseIds.size === draftExpenses.length ? 'Deselect all' : 'Select all'}
                  </button>
                )}
              </div>
              <button onClick={closeExpensePicker} className="text-text-2 hover:text-text-1 cursor-pointer p-1">
                <X size={16} />
              </button>
            </div>

            {/* List */}
            {draftExpenses.length === 0 ? (
              <p className="text-sm text-text-2 text-center py-10 flex-1">No draft expenses available.</p>
            ) : (
              <div className="divide-y divide-border overflow-y-auto flex-1">
                {draftExpenses.map((e) => {
                  const selected = selectedExpenseIds.has(e.id)
                  return (
                    <button
                      key={e.id}
                      onClick={() => toggleExpense(e.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors duration-100 cursor-pointer ${
                        selected ? 'bg-primary/8 border-l-2 border-primary' : 'hover:bg-primary/5 active:bg-primary/10 border-l-2 border-transparent'
                      }`}
                    >
                      {/* Checkbox */}
                      <span className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors duration-100 ${
                        selected ? 'bg-primary border-primary' : 'border-border'
                      }`}>
                        {selected && <Check size={11} className="text-white" strokeWidth={3} />}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-1 truncate">{e.merchant}</p>
                        <p className="text-xs text-text-2 mt-0.5">{formatDate(e.date ?? e.createdAt)}</p>
                      </div>
                      <span className="text-sm font-semibold text-text-1 tabular-nums shrink-0">
                        {formatCurrency(e.amount, e.currency)}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}

            {/* Sticky footer */}
            <div className="px-4 py-3 border-t border-border shrink-0">
              <button
                onClick={() => addExpenses.mutate([...selectedExpenseIds])}
                disabled={selectedExpenseIds.size === 0 || addExpenses.isPending}
                className="w-full h-10 flex items-center justify-center gap-2 text-sm font-semibold text-white bg-primary rounded-xl disabled:opacity-40 cursor-pointer transition-opacity duration-150"
              >
                {addExpenses.isPending
                  ? <Loader2 size={14} className="animate-spin" />
                  : selectedExpenseIds.size === 0
                    ? 'Select expenses'
                    : `Add ${selectedExpenseIds.size} expense${selectedExpenseIds.size > 1 ? 's' : ''}`
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add mileage picker modal */}
      {addingMileage && (
        <div
          className="fixed inset-0 z-[200] bg-black/60 flex items-end lg:items-center justify-center p-4 lg:p-6"
          onClick={closeMileagePicker}
        >
          <div
            className="w-full max-w-md bg-surface rounded-2xl border border-border shadow-xl overflow-hidden animate-fade-in-up flex flex-col max-h-[70vh] lg:max-h-[560px]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-border shrink-0">
              <div className="flex items-center gap-3">
                <p className="text-sm font-semibold text-text-1">Add mileage</p>
                {draftMileage.length > 0 && (
                  <button
                    onClick={toggleAllMileage}
                    className="text-xs text-primary hover:opacity-70 cursor-pointer transition-opacity"
                  >
                    {selectedMileageIds.size === draftMileage.length ? 'Deselect all' : 'Select all'}
                  </button>
                )}
              </div>
              <button onClick={closeMileagePicker} className="text-text-2 hover:text-text-1 cursor-pointer p-1">
                <X size={16} />
              </button>
            </div>

            {/* List */}
            {draftMileage.length === 0 ? (
              <p className="text-sm text-text-2 text-center py-10 flex-1">No draft mileage available.</p>
            ) : (
              <div className="divide-y divide-border overflow-y-auto flex-1">
                {draftMileage.map((m) => {
                  const selected = selectedMileageIds.has(m.id)
                  return (
                    <button
                      key={m.id}
                      onClick={() => toggleMileage(m.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors duration-100 cursor-pointer ${
                        selected ? 'bg-primary/8 border-l-2 border-primary' : 'hover:bg-primary/5 active:bg-primary/10 border-l-2 border-transparent'
                      }`}
                    >
                      {/* Checkbox */}
                      <span className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors duration-100 ${
                        selected ? 'bg-primary border-primary' : 'border-border'
                      }`}>
                        {selected && <Check size={11} className="text-white" strokeWidth={3} />}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-1 truncate">
                          {m.fromLocation ?? '—'} → {m.toLocation ?? '—'}
                        </p>
                        <p className="text-xs text-text-2 mt-0.5">{m.distance} {m.unit} · {formatDate(m.createdAt)}</p>
                      </div>
                      <span className="text-sm font-semibold text-text-1 tabular-nums shrink-0">
                        {formatCurrency(m.amount)}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}

            {/* Sticky footer */}
            <div className="px-4 py-3 border-t border-border shrink-0">
              <button
                onClick={() => addMileageEntries.mutate([...selectedMileageIds])}
                disabled={selectedMileageIds.size === 0 || addMileageEntries.isPending}
                className="w-full h-10 flex items-center justify-center gap-2 text-sm font-semibold text-white bg-primary rounded-xl disabled:opacity-40 cursor-pointer transition-opacity duration-150"
              >
                {addMileageEntries.isPending
                  ? <Loader2 size={14} className="animate-spin" />
                  : selectedMileageIds.size === 0
                    ? 'Select mileage'
                    : `Add ${selectedMileageIds.size} mileage entr${selectedMileageIds.size > 1 ? 'ies' : 'y'}`
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject modal */}
      {showRejectModal && (
        <div
          className="fixed inset-0 z-[200] bg-black/60 flex items-end lg:items-center justify-center p-4"
          onClick={() => setShowRejectModal(false)}
        >
          <div
            className="w-full max-w-md bg-surface rounded-2xl border border-border shadow-xl p-5 animate-fade-in-up"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-semibold text-text-1 mb-1">Reject report</p>
            <p className="text-xs text-text-2 mb-3">Provide a note for the member explaining why this report was rejected.</p>
            <textarea
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder="Rejection reason…"
              rows={3}
              autoFocus
              className="w-full text-xs text-text-1 bg-background border border-border rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:border-primary mb-3"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowRejectModal(false)}
                className="flex-1 h-10 text-xs text-text-2 border border-border rounded-xl cursor-pointer hover:bg-nav-hover-bg transition-colors duration-150"
              >
                Cancel
              </button>
              <button
                onClick={() => rejectMutation.mutate()}
                disabled={!rejectNote.trim() || rejectMutation.isPending}
                className="flex-1 h-10 flex items-center justify-center gap-1.5 text-xs font-semibold text-white bg-danger rounded-xl disabled:opacity-50 cursor-pointer"
              >
                {rejectMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : null}
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
