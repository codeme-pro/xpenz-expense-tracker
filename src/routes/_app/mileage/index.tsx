import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Car, Trash2, MoreVertical, X, Check, Loader2, Pencil, ArrowUpDown } from 'lucide-react'
import { toast } from 'sonner'
import { fetchMileage, deleteMileage, updateMileage } from '#/lib/queries'
import { queryKeys } from '#/lib/queryKeys'
import { TopBar } from '#/components/TopBar'
import { StatusBadge } from '#/components/StatusBadge'
import { EmptyState } from '#/components/EmptyState'
import { TabStrip } from '#/components/TabStrip'
import { PersonalFilterBar } from '#/components/PersonalFilterBar'
import { formatCurrency, formatDate } from '#/lib/format'
import type { ExpenseStatus, PersonalFilters, WorkspacePeriod } from '#/lib/types'
import { useState } from 'react'

export const Route = createFileRoute('/_app/mileage/')({
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
  component: MileageScreen,
})

const REPORTS_TABS = [
  { to: '/reports', label: 'Reports' },
  { to: '/expenses', label: 'Expenses' },
  { to: '/mileage', label: 'Mileage' },
]

type ActionSheetView = 'actions' | 'confirmDelete' | 'editRoute'

type ActionSheet = {
  id: string
  title: string
  status: ExpenseStatus
  view: ActionSheetView
  from: string
  to: string
}

function MileageScreen() {
  const filters = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const queryClient = useQueryClient()

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [actionSheet, setActionSheet] = useState<ActionSheet | null>(null)

  // Desktop inline edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editFrom, setEditFrom] = useState('')
  const [editTo, setEditTo] = useState('')

  const { data: entries = [], isLoading } = useQuery({
    queryKey: queryKeys.mileage(filters),
    queryFn: () => fetchMileage(filters),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteMileage(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mileage'] })
      toast.success('Mileage entry deleted')
    },
    onError: () => toast.error('Failed to delete. Try again.'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, from, to }: { id: string; from: string; to: string }) =>
      updateMileage(id, { fromLocation: from, toLocation: to }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mileage'] })
      setEditingId(null)
      setActionSheet((s) => s ? { ...s, view: 'actions' } : null)
      toast.success('Route saved')
    },
    onError: () => toast.error('Failed to save. Try again.'),
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

  const closeActionSheet = () => setActionSheet(null)

  const startDesktopEdit = (entry: { id: string; fromLocation: string | null; toLocation: string | null }) => {
    setEditingId(entry.id)
    setEditFrom(entry.fromLocation ?? '')
    setEditTo(entry.toLocation ?? '')
    setPendingDeleteId(null)
  }

  const cancelDesktopEdit = () => {
    setEditingId(null)
    updateMutation.reset()
  }

  const saveDesktopEdit = (id: string) => {
    updateMutation.mutate({ id, from: editFrom, to: editTo })
  }

  const swapDesktop = () => {
    const tmp = editFrom
    setEditFrom(editTo)
    setEditTo(tmp)
  }

  const swapSheet = () => {
    if (!actionSheet) return
    setActionSheet((s) => s ? { ...s, from: s.to, to: s.from } : null)
  }

  const saveSheet = () => {
    if (!actionSheet) return
    updateMutation.mutate(
      { id: actionSheet.id, from: actionSheet.from, to: actionSheet.to },
    )
  }

  const inputCls = 'w-full h-8 px-2 text-xs bg-background border border-border rounded-lg text-text-1 placeholder:text-text-2 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary'

  return (
    <div>
      <TopBar title="Mileage" workspaceTitle />
      <div className="lg:hidden">
        <TabStrip tabs={REPORTS_TABS} />
      </div>
      <PersonalFilterBar filters={filters} onFilterChange={handleFilterChange} />

      {isLoading ? (
        <div className="mt-3 mx-4 bg-surface rounded-xl border border-border h-32 animate-pulse" />
      ) : entries.length === 0 ? (
        <EmptyState
          icon={<Car size={36} />}
          title="No mileage entries"
          body="No mileage matches the current filters."
        />
      ) : (
        <div className="mt-3 mx-4">

          {/* Mobile card list */}
          <div className="lg:hidden space-y-2">
            {entries.map((entry, i) => (
              <div
                key={entry.id}
                className="bg-surface rounded-xl border border-border shadow-sm px-4 py-3 animate-fade-in-up"
                style={{ '--stagger-delay': `${i * 40}ms` } as React.CSSProperties}
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-text-2 truncate">↑ {entry.fromLocation ?? '—'}</p>
                    <p className="text-sm font-semibold text-text-1 truncate mt-0.5">↓ {entry.toLocation ?? '—'}</p>
                  </div>
                  <button
                    onClick={() => setActionSheet({
                      id: entry.id,
                      title: `${entry.fromLocation ?? '—'} → ${entry.toLocation ?? '—'}`,
                      status: entry.status,
                      view: 'actions',
                      from: entry.fromLocation ?? '',
                      to: entry.toLocation ?? '',
                    })}
                    className="p-1.5 -mr-1 rounded-lg text-text-2 active:bg-background transition-colors duration-150 cursor-pointer shrink-0"
                    aria-label="More actions"
                  >
                    <MoreVertical size={15} />
                  </button>
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <StatusBadge status={entry.status} />
                  <span className="text-xs text-text-2">·</span>
                  <span className="text-xs text-text-2">{formatDate(entry.createdAt)}</span>
                  {entry.transportMode && (
                    <>
                      <span className="text-xs text-text-2">·</span>
                      <span className="text-xs text-text-2">{entry.transportMode}</span>
                    </>
                  )}
                  <span className="flex-1" />
                  <span className="text-xs text-text-2 tabular-nums">{entry.distance} {entry.unit}</span>
                  <span className="text-xs text-text-2 mx-1">·</span>
                  <span className="text-sm font-semibold text-text-1 tabular-nums">{formatCurrency(entry.amount)}</span>
                </div>
                {entry.reportTitle && (
                  <p className="mt-1 text-xs text-primary truncate">{entry.reportTitle}</p>
                )}
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden lg:block bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-background">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-text-2">Trip</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-text-2">Date</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-text-2">Distance</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-text-2">Status</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-text-2">Report</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-text-2">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {entries.map((entry, i) => {
                    const isEditing = editingId === entry.id
                    return (
                      <tr
                        key={entry.id}
                        onMouseLeave={() => {
                          if (pendingDeleteId === entry.id) setPendingDeleteId(null)
                        }}
                        className={`group/row transition-colors duration-100 animate-fade-in-up ${
                          pendingDeleteId === entry.id ? 'bg-danger/5'
                          : isEditing ? 'bg-primary/5'
                          : 'hover:bg-primary/5'
                        }`}
                        style={{ '--stagger-delay': `${i * 40}ms` } as React.CSSProperties}
                      >
                        {/* Trip cell — display or edit */}
                        <td className="px-4 py-3">
                          {isEditing ? (
                            <div className="space-y-1.5 w-[200px]" onClick={(e) => e.stopPropagation()}>
                              <input
                                value={editFrom}
                                onChange={(e) => setEditFrom(e.target.value)}
                                placeholder="From"
                                autoFocus
                                className={inputCls}
                              />
                              <div className="flex justify-center">
                                <button
                                  onClick={swapDesktop}
                                  title="Swap from / to"
                                  className="p-1 rounded-md text-text-2 hover:text-primary hover:bg-primary/10 transition-colors duration-150 cursor-pointer"
                                >
                                  <ArrowUpDown size={12} />
                                </button>
                              </div>
                              <input
                                value={editTo}
                                onChange={(e) => setEditTo(e.target.value)}
                                placeholder="To"
                                className={inputCls}
                              />
                              <div className="flex items-center gap-1.5 pt-0.5">
                                <button
                                  onClick={() => saveDesktopEdit(entry.id)}
                                  disabled={updateMutation.isPending}
                                  className="flex items-center gap-1 h-7 px-2.5 text-xs font-semibold bg-primary text-white rounded-lg disabled:opacity-50 cursor-pointer"
                                >
                                  {updateMutation.isPending ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                                  Save
                                </button>
                                <button
                                  onClick={cancelDesktopEdit}
                                  className="flex items-center gap-1 h-7 px-2.5 text-xs text-text-2 border border-border rounded-lg hover:bg-background cursor-pointer"
                                >
                                  <X size={11} />
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="group/trip flex items-start gap-2">
                              <div className="min-w-0">
                                <p className="text-xs text-text-2 truncate max-w-[180px]">↑ {entry.fromLocation ?? '—'}</p>
                                <p className="text-sm font-medium text-text-1 truncate max-w-[180px] mt-0.5">↓ {entry.toLocation ?? '—'}</p>
                                {(entry.purpose || entry.transportMode) && (
                                  <p className="text-xs text-text-2 mt-0.5 truncate max-w-[180px]">
                                    {[entry.transportMode, entry.purpose].filter(Boolean).join(' · ')}
                                  </p>
                                )}
                              </div>
                              {entry.status === 'draft' && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); startDesktopEdit(entry) }}
                                  title="Edit route"
                                  className="mt-0.5 p-1 rounded-md text-text-2/40 hover:text-primary hover:bg-primary/10 opacity-0 group-hover/row:opacity-100 transition-all duration-150 cursor-pointer shrink-0"
                                >
                                  <Pencil size={11} />
                                </button>
                              )}
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-xs text-text-2">{formatDate(entry.createdAt)}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-xs text-text-2 tabular-nums">{entry.distance} {entry.unit}</span>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={entry.status} />
                        </td>
                        <td className="px-4 py-3">
                          {entry.reportId ? (
                            <span className="text-xs text-primary truncate max-w-[120px] block">
                              {entry.reportTitle ?? entry.reportId}
                            </span>
                          ) : (
                            <span className="text-xs text-text-2">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            {!isEditing && (pendingDeleteId === entry.id ? (
                              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                <span className="text-xs text-danger font-medium mr-1">Delete?</span>
                                <button
                                  onClick={() => { deleteMutation.mutate(entry.id); setPendingDeleteId(null) }}
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
                              entry.status === 'draft' && (
                                <div
                                  className="flex items-center opacity-0 group-hover/row:opacity-100 translate-x-1 group-hover/row:translate-x-0 transition-all duration-150 ease-out"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button
                                    onClick={() => setPendingDeleteId(entry.id)}
                                    className="p-1.5 rounded-lg text-danger/50 hover:text-danger hover:bg-danger/10 transition-colors duration-150 cursor-pointer"
                                    title="Delete"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              )
                            ))}
                            <span className={`text-sm font-semibold tabular-nums transition-opacity duration-150 ${pendingDeleteId === entry.id ? 'text-text-2 opacity-40' : 'text-text-1 group-hover/row:opacity-60'}`}>
                              {formatCurrency(entry.amount)}
                            </span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* Mobile action sheet */}
      {actionSheet && (
        <>
          <div className="lg:hidden fixed inset-0 z-40 bg-black/40" onClick={closeActionSheet} />
          <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface rounded-t-2xl border-t border-border shadow-xl animate-slide-up">
            <div className="p-4 pb-8">
              <div className="w-10 h-1 bg-border rounded-full mx-auto mb-4" />

              {actionSheet.view === 'actions' && (
                <>
                  <p className="text-sm font-semibold text-text-1 mb-1 truncate px-1">
                    {actionSheet.from || '—'} → {actionSheet.to || '—'}
                  </p>
                  <div className="mt-3 flex flex-col gap-1">
                    {actionSheet.status === 'draft' && (
                      <button
                        onClick={() => setActionSheet((s) => s ? { ...s, view: 'editRoute' } : null)}
                        className="flex items-center gap-3 w-full px-3 py-3 rounded-xl text-sm text-text-1 hover:bg-nav-hover-bg transition-colors duration-150 cursor-pointer"
                      >
                        <Pencil size={16} className="shrink-0 text-text-2" />
                        Edit route
                      </button>
                    )}
                    {actionSheet.status === 'draft' && (
                      <button
                        onClick={() => setActionSheet((s) => s ? { ...s, view: 'confirmDelete' } : null)}
                        className="flex items-center gap-3 w-full px-3 py-3 rounded-xl text-sm text-danger hover:bg-danger/10 transition-colors duration-150 cursor-pointer"
                      >
                        <Trash2 size={16} className="shrink-0" />
                        Delete entry
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
                </>
              )}

              {actionSheet.view === 'editRoute' && (
                <>
                  <p className="text-xs font-semibold text-text-2 uppercase tracking-wider px-1 mb-3">Edit route</p>
                  <div className="space-y-2">
                    <div>
                      <label className="block text-xs text-text-2 mb-1">From</label>
                      <input
                        value={actionSheet.from}
                        onChange={(e) => setActionSheet((s) => s ? { ...s, from: e.target.value } : null)}
                        placeholder="Origin"
                        className="w-full h-10 px-3 text-sm bg-background border border-border rounded-xl text-text-1 placeholder:text-text-2 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                      />
                    </div>
                    <div className="flex justify-center">
                      <button
                        onClick={swapSheet}
                        title="Swap from / to"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-text-2 hover:text-primary hover:bg-primary/10 transition-colors duration-150 cursor-pointer"
                      >
                        <ArrowUpDown size={13} />
                        Swap
                      </button>
                    </div>
                    <div>
                      <label className="block text-xs text-text-2 mb-1">To</label>
                      <input
                        value={actionSheet.to}
                        onChange={(e) => setActionSheet((s) => s ? { ...s, to: e.target.value } : null)}
                        placeholder="Destination"
                        className="w-full h-10 px-3 text-sm bg-background border border-border rounded-xl text-text-1 placeholder:text-text-2 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 mt-4">
                    <button
                      onClick={saveSheet}
                      disabled={updateMutation.isPending}
                      className="flex items-center justify-center gap-2 w-full h-11 rounded-xl text-sm font-semibold text-white bg-primary disabled:opacity-50 transition-opacity duration-150 cursor-pointer"
                    >
                      {updateMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                      Save route
                    </button>
                    <button
                      onClick={() => setActionSheet((s) => s ? { ...s, view: 'actions' } : null)}
                      className="flex items-center justify-center w-full h-11 rounded-xl text-sm text-text-2 border border-border hover:bg-background transition-colors duration-150 cursor-pointer"
                    >
                      Back
                    </button>
                  </div>
                </>
              )}

              {actionSheet.view === 'confirmDelete' && (
                <>
                  <p className="text-sm font-semibold text-text-1 mb-1 truncate px-1">
                    {actionSheet.from || '—'} → {actionSheet.to || '—'}
                  </p>
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
                        onClick={() => setActionSheet((s) => s ? { ...s, view: 'actions' } : null)}
                        className="flex items-center justify-center w-full h-11 rounded-xl text-sm text-text-2 border border-border hover:bg-background transition-colors duration-150 cursor-pointer"
                      >
                        Go back
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
