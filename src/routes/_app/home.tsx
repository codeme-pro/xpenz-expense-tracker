import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Receipt, FileText, CheckCircle, TrendingUp, Bell, Trash2, X, Check, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { fetchExpenses, fetchReports, fetchInbox, deleteExpense, deleteReport } from '#/lib/queries'
import { queryKeys } from '#/lib/queryKeys'
import { TopBar } from '#/components/TopBar'
import { StatusBadge } from '#/components/StatusBadge'
import { formatCurrency } from '#/lib/format'
import { supabaseAuth } from '#/lib/supabase'
import { useAuth } from '#/context/AuthContext'
import { useWorkspace } from '#/context/WorkspaceContext'
import { useLongPress } from '#/lib/useLongPress'
import type { Expense, ExpenseStatus } from '#/lib/types'
import type { RealtimeChannel } from '@supabase/supabase-js'

export const Route = createFileRoute('/_app/home')({
  component: HomeScreen,
})

type ActionSheet = {
  id: string
  title: string
  status: ExpenseStatus
  type: 'expense' | 'report'
  confirmingDelete: boolean
}

function HomeScreen() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { current } = useWorkspace()
  const reportingCurrency = user?.reportingCurrency || current.baseCurrency

  const [pendingDeleteExpenseId, setPendingDeleteExpenseId] = useState<string | null>(null)
  const [pendingDeleteReportId, setPendingDeleteReportId] = useState<string | null>(null)
  const [actionSheet, setActionSheet] = useState<ActionSheet | null>(null)
  const lp = useLongPress()

  const { data: expenses = [] } = useQuery({
    queryKey: queryKeys.expenses(),
    queryFn: () => fetchExpenses(),
  })
  const { data: reports = [] } = useQuery({
    queryKey: queryKeys.reports(),
    queryFn: () => fetchReports(),
  })
  const { data: inbox = [] } = useQuery({
    queryKey: queryKeys.inbox(),
    queryFn: fetchInbox,
    staleTime: 30_000,
  })
  const unreadCount = inbox.filter((i) => !i.read).length

  const deleteExpenseMutation = useMutation({
    mutationFn: (id: string) => deleteExpense(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      toast.success('Expense deleted')
    },
    onError: () => toast.error('Failed to delete. Try again.'),
  })

  const deleteReportMutation = useMutation({
    mutationFn: (id: string) => deleteReport(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      toast.success('Report deleted')
    },
    onError: () => toast.error('Failed to delete. Try again.'),
  })

  // ── Scan processing toast ────────────────────────────────────────────────
  const channelRef = useRef<RealtimeChannel | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const SCAN_TOAST = 'scan-processing'

  useEffect(() => {
    const setup = async () => {
      const { data: { session } } = await supabaseAuth.auth.getSession()
      if (!session) return
      const userId = session.user.id

      const { data: pending } = await supabaseAuth
        .from('scans')
        .select('id')
        .eq('user_id', userId)
        .in('status', ['uploaded', 'processing'])
        .gte('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString())

      if (pending?.length) {
        toast.loading('Scanning receipt with AI…', { id: SCAN_TOAST })
        timeoutRef.current = setTimeout(() => {
          toast.error('Scan timed out. Try again from the scan screen.', { id: SCAN_TOAST })
        }, 45000)
      }

      channelRef.current = supabaseAuth
        .channel(`home-scans-${userId}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'scans', filter: `user_id=eq.${userId}` },
          (payload) => {
            const scan = payload.new as { status: string }
            if (scan.status === 'processing' || scan.status === 'uploaded') {
              clearTimeout(timeoutRef.current!)
              toast.loading('Scanning receipt with AI…', { id: SCAN_TOAST })
              timeoutRef.current = setTimeout(() => {
                toast.error('Scan timed out. Try again from the scan screen.', { id: SCAN_TOAST })
              }, 45000)
            } else if (scan.status === 'parsed') {
              clearTimeout(timeoutRef.current!)
              toast.success('Receipt scanned successfully', { id: SCAN_TOAST })
              queryClient.invalidateQueries({ queryKey: queryKeys.expenses() })
              queryClient.invalidateQueries({ queryKey: queryKeys.mileage() })
            } else if (scan.status === 'failed') {
              clearTimeout(timeoutRef.current!)
              toast.error('Scan failed. Try again from the scan screen.', { id: SCAN_TOAST })
            } else if (scan.status === 'unknown') {
              clearTimeout(timeoutRef.current!)
              toast.error('Not a receipt or map image. Please scan a valid receipt.', { id: SCAN_TOAST })
            }
          },
        )
        .subscribe()
    }

    setup()

    return () => {
      channelRef.current?.unsubscribe()
      clearTimeout(timeoutRef.current!)
    }
  }, [queryClient])

  const { totalThisMonth, pendingCount, approvedCount, draftCount } = useMemo(() => {
    const currentMonth = new Date().toISOString().slice(0, 7)
    let totalThisMonth = 0, pendingCount = 0, approvedCount = 0, draftCount = 0
    for (const e of expenses) {
      if (e.createdAt.startsWith(currentMonth)) {
        const converted =
          e.reportingAmounts?.[reportingCurrency] ??
          (e.reportingCurrency === reportingCurrency ? e.reportingAmount : null) ??
          (e.currency === reportingCurrency ? e.amount : null)
        if (converted !== null) totalThisMonth += converted
      }
      if (e.status === 'submitted') pendingCount++
      else if (e.status === 'approved') approvedCount++
      else if (e.status === 'draft') draftCount++
    }
    return { totalThisMonth, pendingCount, approvedCount, draftCount }
  }, [expenses, reportingCurrency])

  return (
    <>
    <div>
      <TopBar title="Home" workspaceTitle />

      <div className="px-4 py-4 space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-text-1" style={{ fontFamily: 'var(--font-display)' }}>
              Welcome back 👋
            </h2>
            <p className="text-sm text-text-2 mt-0.5">Here's your expense overview</p>
          </div>
          <button
            onClick={() => navigate({ to: '/inbox' })}
            aria-label={unreadCount > 0 ? `Inbox, ${unreadCount} unread` : 'Inbox'}
            className="lg:hidden relative p-2 rounded-xl text-text-2 hover:text-text-1 hover:bg-surface transition-colors duration-150 cursor-pointer mt-0.5"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[15px] h-[15px] bg-primary text-white text-[9px] font-bold flex items-center justify-center rounded-full px-1 leading-none">
                {unreadCount}
              </span>
            )}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="Total Monthly"
            value={formatCurrency(totalThisMonth, reportingCurrency)}
            icon={<TrendingUp size={16} />}
            colorClass="text-primary bg-primary/10"
          />
          <StatCard
            label="Pending"
            value={String(pendingCount)}
            icon={<Receipt size={16} />}
            colorClass="text-amber-600 bg-amber-50 dark:bg-amber-900/20"
          />
          <StatCard
            label="Approved"
            value={String(approvedCount)}
            icon={<CheckCircle size={16} />}
            colorClass="text-success bg-success-light"
          />
          <StatCard
            label="Drafts"
            value={String(draftCount)}
            icon={<FileText size={16} />}
            colorClass="text-text-2 bg-border/50"
          />
        </div>

        {reports.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-text-2 uppercase tracking-wider mb-2">
              Recent Reports
            </h3>
            <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
              {reports.slice(0, 3).map((r, i) => (
                <div
                  key={r.id}
                  onPointerDown={(e) => lp.start(r.id, () => setActionSheet({ id: r.id, title: r.title, status: r.status, type: 'report', confirmingDelete: false }), e)}
                  onPointerUp={lp.cancel}
                  onPointerMove={lp.move}
                  onPointerCancel={lp.cancel}
                  onClick={() => { if (lp.checkFired()) return; navigate({ to: '/reports/$reportId', params: { reportId: r.id } }) }}
                  onMouseLeave={() => { if (pendingDeleteReportId === r.id) setPendingDeleteReportId(null) }}
                  className={`group/row w-full flex items-center justify-between px-4 py-3 text-left transition-colors duration-100 cursor-pointer select-none ${
                    i > 0 ? 'border-t border-border' : ''
                  } ${pendingDeleteReportId === r.id ? 'bg-danger/5' : lp.pressingId === r.id ? 'bg-primary/10' : 'hover:bg-primary/5'}`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-1 truncate">{r.title}</p>
                    <p className="text-xs text-text-2 mt-0.5">{r.expenseCount} {r.expenseCount === 1 ? 'expense' : 'expenses'}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    {pendingDeleteReportId === r.id ? (
                      <div className="hidden lg:flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <span className="text-xs text-danger font-medium">Delete?</span>
                        <button
                          onClick={() => { deleteReportMutation.mutate(r.id); setPendingDeleteReportId(null) }}
                          disabled={deleteReportMutation.isPending}
                          className="p-1.5 rounded-lg bg-danger/10 text-danger hover:bg-danger/20 transition-colors duration-150 cursor-pointer"
                        >
                          {deleteReportMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                        </button>
                        <button
                          onClick={() => setPendingDeleteReportId(null)}
                          className="p-1.5 rounded-lg text-text-2 hover:bg-background transition-colors duration-150 cursor-pointer"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ) : r.status === 'draft' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setPendingDeleteReportId(r.id) }}
                        className="hidden lg:flex items-center opacity-0 group-hover/row:opacity-100 translate-x-1 group-hover/row:translate-x-0 p-1.5 rounded-lg text-danger/50 hover:text-danger hover:bg-danger/10 transition-all duration-150 cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                    <StatusBadge status={r.status} />
                    <span className={`text-sm font-semibold tabular-nums ${pendingDeleteReportId === r.id ? 'text-text-2 opacity-40' : 'text-text-1'}`}>
                      {formatCurrency(r.totalAmount, r.currency)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {expenses.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-text-2 uppercase tracking-wider mb-2">
              Recent Expenses
            </h3>
            <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
              {expenses.slice(0, 4).map((e: Expense, i) => (
                <div
                  key={e.id}
                  onPointerDown={(ev) => lp.start(e.id, () => setActionSheet({ id: e.id, title: e.merchant, status: e.status, type: 'expense', confirmingDelete: false }), ev)}
                  onPointerUp={lp.cancel}
                  onPointerMove={lp.move}
                  onPointerCancel={lp.cancel}
                  onClick={() => { if (lp.checkFired()) return; navigate({ to: '/expenses/$expenseId', params: { expenseId: e.id } }) }}
                  onMouseLeave={() => { if (pendingDeleteExpenseId === e.id) setPendingDeleteExpenseId(null) }}
                  className={`group/row w-full flex items-center justify-between px-4 py-3 text-left transition-colors duration-100 cursor-pointer select-none ${
                    i > 0 ? 'border-t border-border' : ''
                  } ${pendingDeleteExpenseId === e.id ? 'bg-danger/5' : lp.pressingId === e.id ? 'bg-primary/10' : 'hover:bg-primary/5'}`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-1 truncate">{e.merchant}</p>
                    <p className="text-xs text-text-2 mt-0.5">{e.category ?? '—'}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    {pendingDeleteExpenseId === e.id ? (
                      <div className="hidden lg:flex items-center gap-1.5" onClick={(ev) => ev.stopPropagation()}>
                        <span className="text-xs text-danger font-medium">Delete?</span>
                        <button
                          onClick={() => { deleteExpenseMutation.mutate(e.id); setPendingDeleteExpenseId(null) }}
                          disabled={deleteExpenseMutation.isPending}
                          className="p-1.5 rounded-lg bg-danger/10 text-danger hover:bg-danger/20 transition-colors duration-150 cursor-pointer"
                        >
                          {deleteExpenseMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                        </button>
                        <button
                          onClick={() => setPendingDeleteExpenseId(null)}
                          className="p-1.5 rounded-lg text-text-2 hover:bg-background transition-colors duration-150 cursor-pointer"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ) : e.status === 'draft' && (
                      <button
                        onClick={(ev) => { ev.stopPropagation(); setPendingDeleteExpenseId(e.id) }}
                        className="hidden lg:flex items-center opacity-0 group-hover/row:opacity-100 translate-x-1 group-hover/row:translate-x-0 p-1.5 rounded-lg text-danger/50 hover:text-danger hover:bg-danger/10 transition-all duration-150 cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                    <StatusBadge status={e.status} />
                    <span className={`text-sm font-semibold tabular-nums ${pendingDeleteExpenseId === e.id ? 'text-text-2 opacity-40' : 'text-text-1'}`}>
                      {(() => {
                        const conv = e.reportingAmounts?.[reportingCurrency]
                          ?? (e.reportingCurrency === reportingCurrency ? e.reportingAmount : null)
                        return formatCurrency(conv ?? e.amount, conv != null ? reportingCurrency : e.currency)
                      })()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>

    {/* Mobile action sheet */}

    {actionSheet && (
      <>
        <div className="lg:hidden fixed inset-0 z-40 bg-black/40" onClick={() => setActionSheet(null)} />
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface rounded-t-2xl border-t border-border shadow-xl animate-slide-up">
          <div className="p-4 pb-8">
            <div className="w-10 h-1 bg-border rounded-full mx-auto mb-4" />
            <p className="text-sm font-semibold text-text-1 mb-1 truncate px-1">{actionSheet.title}</p>
            {!actionSheet.confirmingDelete ? (
              <div className="mt-3 flex flex-col gap-1">
                {actionSheet.status === 'draft' && (
                  <button
                    onClick={() => setActionSheet((s) => s ? { ...s, confirmingDelete: true } : null)}
                    className="flex items-center gap-3 w-full px-3 py-3 rounded-xl text-sm text-danger hover:bg-danger/10 transition-colors duration-150 cursor-pointer"
                  >
                    <Trash2 size={16} className="shrink-0" />
                    Delete {actionSheet.type}
                  </button>
                )}
                <button
                  onClick={() => setActionSheet(null)}
                  className="flex items-center gap-3 w-full px-3 py-3 rounded-xl text-sm text-text-2 hover:bg-background transition-colors duration-150 mt-1 cursor-pointer"
                >
                  <X size={16} className="shrink-0" />
                  Cancel
                </button>
              </div>
            ) : (
              <div className="mt-3">
                <p className="text-sm text-text-2 px-1 mb-4">This cannot be undone.</p>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => {
                      if (actionSheet.type === 'expense') deleteExpenseMutation.mutate(actionSheet.id)
                      else deleteReportMutation.mutate(actionSheet.id)
                      setActionSheet(null)
                    }}
                    disabled={deleteExpenseMutation.isPending || deleteReportMutation.isPending}
                    className="flex items-center justify-center gap-2 w-full h-11 rounded-xl text-sm font-semibold text-white bg-danger disabled:opacity-50 transition-opacity duration-150 cursor-pointer"
                  >
                    {(deleteExpenseMutation.isPending || deleteReportMutation.isPending) ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                    Yes, delete
                  </button>
                  <button
                    onClick={() => setActionSheet((s) => s ? { ...s, confirmingDelete: false } : null)}
                    className="flex items-center justify-center w-full h-11 rounded-xl text-sm text-text-2 border border-border hover:bg-background transition-colors duration-150 cursor-pointer"
                  >
                    Go back
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </>
    )}
    </>
  )
}

function StatCard({
  label,
  value,
  icon,
  colorClass,
}: {
  label: string
  value: string
  icon: React.ReactNode
  colorClass: string
}) {
  return (
    <div className="bg-surface rounded-xl border border-border shadow-sm p-4">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2.5 ${colorClass}`}>
        {icon}
      </div>
      <p className="text-xl font-bold text-text-1 tabular-nums leading-tight">{value}</p>
      <p className="text-xs text-text-2 mt-0.5">{label}</p>
    </div>
  )
}
