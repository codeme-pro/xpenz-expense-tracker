import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FileText, Plus, X, Check, Loader2, Download, Trash2, MoreVertical } from 'lucide-react'
import { fetchReports, createReport, deleteReport } from '#/lib/queries'
import { queryKeys } from '#/lib/queryKeys'
import { TopBar } from '#/components/TopBar'
import { StatusBadge } from '#/components/StatusBadge'
import { EmptyState } from '#/components/EmptyState'
import { TabStrip } from '#/components/TabStrip'
import { PersonalFilterBar } from '#/components/PersonalFilterBar'
import { formatCurrency, formatDate } from '#/lib/format'
import { useWorkspace } from '#/context/WorkspaceContext'
import type { ExpenseStatus, PersonalFilters, WorkspacePeriod } from '#/lib/types'
import { useState } from 'react'

const REPORTS_TABS = [
  { to: '/reports', label: 'Reports' },
  { to: '/expenses', label: 'Expenses' },
  { to: '/mileage', label: 'Mileage' },
]

type ActionSheet = {
  id: string
  title: string
  status: ExpenseStatus
  confirmingDelete: boolean
}

export const Route = createFileRoute('/_app/reports/')({
  validateSearch: (search: Record<string, unknown>): PersonalFilters => ({
    status: (['draft', 'submitted', 'approved', 'rejected'] as ExpenseStatus[]).includes(
      search.status as ExpenseStatus,
    )
      ? (search.status as ExpenseStatus)
      : undefined,
    period: (['all_time', 'this_month', 'last_month', 'last_3_months'] as WorkspacePeriod[]).includes(
      search.period as WorkspacePeriod,
    )
      ? (search.period as WorkspacePeriod)
      : 'all_time',
  }),
  component: ReportsScreen,
})

function ReportsScreen() {
  const filters = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const { current } = useWorkspace()
  const queryClient = useQueryClient()

  const [creating, setCreating] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [actionSheet, setActionSheet] = useState<ActionSheet | null>(null)

  const { data: reports = [], isLoading } = useQuery({
    queryKey: queryKeys.reports(filters),
    queryFn: () => fetchReports(filters),
  })

  const createMutation = useMutation({
    mutationFn: () => createReport(newTitle.trim(), current.id),
    onSuccess: (report) => {
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      setCreating(false)
      setNewTitle('')
      navigate({ to: '/reports/$reportId', params: { reportId: report.id } })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteReport(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reports'] }),
  })

  const handleFilterChange = (updates: Partial<PersonalFilters>) => {
    navigate({
      search: (prev) => {
        const next = { ...prev, ...updates }
        return Object.fromEntries(
          Object.entries(next).filter(([, v]) => v !== undefined),
        )
      },
    })
  }

  const handleCreate = () => {
    if (!newTitle.trim()) return
    createMutation.mutate()
  }

  const handleExport = (reportId: string) => {
    window.open(`/reports/${reportId}?print=1`, '_blank')
  }

  const closeActionSheet = () => setActionSheet(null)

  return (
    <div>
      <TopBar title="Reports" workspaceTitle />
      <div className="lg:hidden">
        <TabStrip tabs={REPORTS_TABS} />
      </div>
      <PersonalFilterBar filters={filters} onFilterChange={handleFilterChange} />

      {/* New report inline form */}
      {creating && (
        <div className="mx-4 mt-3 bg-surface rounded-xl border border-primary/40 shadow-sm p-4 animate-fade-in-up">
          <p className="text-xs font-semibold text-text-2 uppercase tracking-wider mb-2">New Report</p>
          <input
            type="text"
            placeholder="Report title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate()
              if (e.key === 'Escape') { setCreating(false); setNewTitle('') }
            }}
            autoFocus
            className="w-full text-sm text-text-1 bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:border-primary mb-3"
          />
          {createMutation.isError && (
            <p className="text-xs text-danger mb-2">Failed to create report. Try again.</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => { setCreating(false); setNewTitle('') }}
              className="h-9 px-4 text-xs text-text-2 border border-border rounded-lg cursor-pointer hover:bg-nav-hover-bg transition-colors duration-150"
            >
              <X size={13} className="inline mr-1" />Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!newTitle.trim() || createMutation.isPending}
              className="h-9 px-4 flex items-center gap-1.5 text-xs font-semibold text-white bg-primary rounded-lg disabled:opacity-50 cursor-pointer transition-opacity duration-150"
            >
              {createMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              Create
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="mt-3 mx-4 bg-surface rounded-xl border border-border h-32 animate-pulse" />
      ) : reports.length === 0 && !creating ? (
        <EmptyState
          icon={<FileText size={36} />}
          title="No reports"
          body="Create a report to group expenses for approval."
          action={<button onClick={() => setCreating(true)} className="mt-3 h-9 px-4 flex items-center gap-1.5 text-xs font-semibold text-white bg-primary rounded-xl cursor-pointer mx-auto">
            <Plus size={14} /> New Report
          </button>}
        />
      ) : (
        <div className="mt-3 mx-4">

          {/* Mobile card list */}
          <div className="lg:hidden space-y-2">
            {reports.map((r, i) => (
              <div
                key={r.id}
                onClick={() => navigate({ to: '/reports/$reportId', params: { reportId: r.id } })}
                className="w-full bg-surface rounded-xl border border-border shadow-sm px-4 py-3 text-left hover:bg-primary/5 transition-colors duration-100 cursor-pointer animate-fade-in-up"
                style={{ '--stagger-delay': `${i * 40}ms` } as React.CSSProperties}
              >
                <div className="flex items-center gap-2">
                  <p className="flex-1 text-sm font-semibold text-text-1 truncate">{r.title}</p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setActionSheet({ id: r.id, title: r.title, status: r.status as ExpenseStatus, confirmingDelete: false })
                    }}
                    className="p-1.5 -mr-1 rounded-lg text-text-2 active:bg-background transition-colors duration-150 cursor-pointer"
                    aria-label="More actions"
                  >
                    <MoreVertical size={15} />
                  </button>
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <StatusBadge status={r.status as ExpenseStatus} />
                  <span className="text-xs text-text-2">·</span>
                  <span className="text-xs text-text-2">
                    {r.submittedAt ? formatDate(r.submittedAt) : formatDate(r.createdAt)}
                  </span>
                  <span className="flex-1" />
                  <span className="text-sm font-semibold text-text-1 tabular-nums">
                    {formatCurrency(r.totalAmount, r.currency)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden lg:block">
            {!creating && (
              <div className="flex justify-end mb-3">
                <button
                  onClick={() => setCreating(true)}
                  className="h-8 px-4 flex items-center gap-1.5 text-xs font-semibold text-white bg-primary rounded-lg cursor-pointer hover:opacity-90 transition-opacity duration-150"
                >
                  <Plus size={13} /> New Report
                </button>
              </div>
            )}
            <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
            <div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-background">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-text-2">Report</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-text-2">Date</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-text-2">Status</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-text-2">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {reports.map((r, i) => (
                    <tr
                      key={r.id}
                      onClick={() => pendingDeleteId !== r.id && navigate({ to: '/reports/$reportId', params: { reportId: r.id } })}
                      onMouseLeave={() => { if (pendingDeleteId === r.id) setPendingDeleteId(null) }}
                      className={`group/row transition-colors duration-100 cursor-pointer animate-fade-in-up ${pendingDeleteId === r.id ? 'bg-danger/5' : 'hover:bg-primary/5'}`}
                      style={{ '--stagger-delay': `${i * 40}ms` } as React.CSSProperties}
                    >
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-text-1 truncate max-w-[200px]">{r.title}</p>
                        <p className="text-xs text-text-2 mt-0.5">
                          {r.expenseCount} {r.expenseCount === 1 ? 'expense' : 'expenses'}
                          {r.mileageCount > 0 && ` · ${r.mileageCount} mileage`}
                        </p>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-xs text-text-2">
                          {r.submittedAt ? formatDate(r.submittedAt) : formatDate(r.createdAt)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={r.status as ExpenseStatus} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {/* Actions — hover-reveal, or always visible when confirming delete */}
                          {pendingDeleteId === r.id ? (
                            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                              <span className="text-xs text-danger font-medium mr-1">Delete?</span>
                              <button
                                onClick={() => { deleteMutation.mutate(r.id); setPendingDeleteId(null) }}
                                disabled={deleteMutation.isPending}
                                className="p-1.5 rounded-lg bg-danger/10 text-danger hover:bg-danger/20 transition-colors duration-150 cursor-pointer"
                              >
                                {deleteMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                              </button>
                              <button
                                onClick={() => setPendingDeleteId(null)}
                                className="p-1.5 rounded-lg text-text-2 hover:bg-background transition-colors duration-150 cursor-pointer"
                              >
                                <X size={13} />
                              </button>
                            </div>
                          ) : (
                            <div
                              className="flex items-center gap-0.5 opacity-0 group-hover/row:opacity-100 translate-x-1 group-hover/row:translate-x-0 transition-all duration-150 ease-out"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                onClick={() => handleExport(r.id)}
                                className="p-1.5 rounded-lg text-text-2/60 hover:text-text-1 hover:bg-background transition-colors duration-150 cursor-pointer"
                                title="Export PDF"
                              >
                                <Download size={13} />
                              </button>
                              {r.status === 'draft' && (
                                <button
                                  onClick={() => setPendingDeleteId(r.id)}
                                  className="p-1.5 rounded-lg text-danger/50 hover:text-danger hover:bg-danger/10 transition-colors duration-150 cursor-pointer"
                                  title="Delete"
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          )}
                          <span className={`text-sm font-semibold tabular-nums transition-opacity duration-150 ${pendingDeleteId === r.id ? 'text-text-2 opacity-40' : 'text-text-1 group-hover/row:opacity-60'}`}>
                            {formatCurrency(r.totalAmount, r.currency)}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </div>
          </div>

        </div>
      )}

      {/* Mobile FAB */}
      {!creating && (
        <button
          onClick={() => setCreating(true)}
          className="lg:hidden fixed bottom-24 right-4 w-14 h-14 bg-primary text-white rounded-full shadow-lg flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity duration-150 z-50"
          aria-label="New report"
        >
          <Plus size={24} />
        </button>
      )}

      {/* Mobile action sheet */}
      {actionSheet && (
        <>
          <div className="lg:hidden fixed inset-0 z-40 bg-black/40" onClick={closeActionSheet} />
          <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface rounded-t-2xl border-t border-border shadow-xl animate-slide-up">
            <div className="p-4 pb-8">
              <div className="w-10 h-1 bg-border rounded-full mx-auto mb-4" />
              <p className="text-sm font-semibold text-text-1 mb-1 truncate px-1">{actionSheet.title}</p>
              {!actionSheet.confirmingDelete ? (
                <div className="mt-3 flex flex-col gap-1">
                  <button
                    onClick={() => { handleExport(actionSheet.id); closeActionSheet() }}
                    className="flex items-center gap-3 w-full px-3 py-3 rounded-xl text-sm text-text-1 hover:bg-primary/5 transition-colors duration-150 cursor-pointer"
                  >
                    <Download size={16} className="text-text-2 shrink-0" />
                    Export PDF
                  </button>
                  {actionSheet.status === 'draft' && (
                    <button
                      onClick={() => setActionSheet((s) => s ? { ...s, confirmingDelete: true } : null)}
                      className="flex items-center gap-3 w-full px-3 py-3 rounded-xl text-sm text-danger hover:bg-danger/10 transition-colors duration-150 cursor-pointer"
                    >
                      <Trash2 size={16} className="shrink-0" />
                      Delete report
                    </button>
                  )}
                  <button
                    onClick={closeActionSheet}
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
                      onClick={() => { deleteMutation.mutate(actionSheet.id); closeActionSheet() }}
                      disabled={deleteMutation.isPending}
                      className="flex items-center justify-center gap-2 w-full h-11 rounded-xl text-sm font-semibold text-white bg-danger disabled:opacity-50 transition-opacity duration-150 cursor-pointer"
                    >
                      {deleteMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
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
    </div>
  )
}
