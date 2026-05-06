import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef } from 'react'
import { Receipt, FileText, CheckCircle, TrendingUp, Bell } from 'lucide-react'
import { toast } from 'sonner'
import { fetchExpenses, fetchReports, fetchInbox } from '#/lib/queries'
import { queryKeys } from '#/lib/queryKeys'
import { TopBar } from '#/components/TopBar'
import { StatusBadge } from '#/components/StatusBadge'
import { formatCurrency } from '#/lib/format'
import { supabaseAuth } from '#/lib/supabase'
import { useAuth } from '#/context/AuthContext'
import { useWorkspace } from '#/context/WorkspaceContext'
import type { Expense } from '#/lib/types'
import type { RealtimeChannel } from '@supabase/supabase-js'

export const Route = createFileRoute('/_app/home')({
  component: HomeScreen,
})

function HomeScreen() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { current } = useWorkspace()
  const reportingCurrency = user?.reportingCurrency || current.baseCurrency

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
                <button
                  key={r.id}
                  onClick={() => navigate({ to: '/reports/$reportId', params: { reportId: r.id } })}
                  className={`w-full flex items-center justify-between px-4 py-3 text-left hover:bg-primary/5 transition-colors duration-100 cursor-pointer ${
                    i > 0 ? 'border-t border-border' : ''
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-1 truncate">{r.title}</p>
                    <p className="text-xs text-text-2 mt-0.5">{r.expenseCount} {r.expenseCount === 1 ? 'expense' : 'expenses'}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-3">
                    <StatusBadge status={r.status} />
                    <span className="text-sm font-semibold text-text-1 tabular-nums">
                      {formatCurrency(r.totalAmount, r.currency)}
                    </span>
                  </div>
                </button>
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
                <button
                  key={e.id}
                  onClick={() =>
                    navigate({ to: '/expenses/$expenseId', params: { expenseId: e.id } })
                  }
                  className={`w-full flex items-center justify-between px-4 py-3 text-left hover:bg-primary/5 transition-colors duration-100 cursor-pointer ${
                    i > 0 ? 'border-t border-border' : ''
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-1 truncate">{e.merchant}</p>
                    <p className="text-xs text-text-2 mt-0.5">{e.category ?? '—'}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-3">
                    <StatusBadge status={e.status} />
                    <span className="text-sm font-semibold text-text-1 tabular-nums">
                      {(() => {
                        const conv = e.reportingAmounts?.[reportingCurrency]
                          ?? (e.reportingCurrency === reportingCurrency ? e.reportingAmount : null)
                        return formatCurrency(conv ?? e.amount, conv != null ? reportingCurrency : e.currency)
                      })()}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
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
