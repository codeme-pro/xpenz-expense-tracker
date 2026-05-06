import { Search, SlidersHorizontal } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchCategories } from '#/lib/queries'
import type { Category, ExpenseStatus, PersonalFilters, WorkspacePeriod } from '#/lib/types'

const PERIOD_OPTIONS: { value: WorkspacePeriod; label: string }[] = [
  { value: 'all_time', label: 'All time' },
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'last_3_months', label: '3 months' },
]

const STATUS_OPTIONS: { value: ExpenseStatus | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
]

interface PersonalFilterBarProps {
  filters: PersonalFilters
  onFilterChange: (updates: Partial<PersonalFilters>) => void
  showSearch?: boolean
}

export function PersonalFilterBar({ filters, onFilterChange, showSearch = false }: PersonalFilterBarProps) {
  const [open, setOpen] = useState(false)
  const [searchInput, setSearchInput] = useState(filters.search ?? '')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { data: categories = [] } = useQuery<Category[]>({ queryKey: ['categories'], queryFn: fetchCategories, staleTime: Infinity })
  const categoryGroups = categories.reduce<Record<string, Category[]>>((acc, cat) => {
    if (!acc[cat.groupName]) acc[cat.groupName] = []
    acc[cat.groupName].push(cat)
    return acc
  }, {})

  useEffect(() => {
    setSearchInput(filters.search ?? '')
  }, [filters.search])

  const handleSearch = useCallback(
    (value: string) => {
      setSearchInput(value)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        onFilterChange({ search: value || undefined })
      }, 300)
    },
    [onFilterChange],
  )

  const activePeriod = filters.period ?? 'all_time'
  const activeStatus = filters.status ?? ''
  const secondaryCount = (filters.status ? 1 : 0) + (filters.search ? 1 : 0) + (filters.categoryId ? 1 : 0)

  function clearSecondary() {
    onFilterChange({ status: undefined, search: undefined, categoryId: undefined })
    setSearchInput('')
  }

  return (
    <div>
      {/* Period strip + filter button */}
      <div className="flex items-center border-b border-border bg-background">
        <div className="flex-1 flex items-center gap-1.5 px-4 py-2.5 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onFilterChange({ period: opt.value })}
              className={[
                'shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors duration-100',
                activePeriod === opt.value
                  ? 'bg-primary text-white'
                  : 'border border-border text-text-2 bg-surface hover:border-primary/40 hover:text-text-1',
              ].join(' ')}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="shrink-0 px-3 border-l border-border">
          <button
            onClick={() => setOpen((v) => !v)}
            className={[
              'relative flex items-center justify-center w-8 h-8 rounded-lg transition-colors duration-100',
              open || secondaryCount > 0
                ? 'bg-primary/10 text-primary'
                : 'text-text-2 hover:text-text-1 hover:bg-surface',
            ].join(' ')}
            aria-label="Toggle filters"
          >
            <SlidersHorizontal size={15} />
            {secondaryCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-primary text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
                {secondaryCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Slide-down secondary filter panel */}
      {open && (
        <div className="border-b border-border bg-background px-4 py-3 space-y-3 animate-fade-in-up">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-text-2">Status</span>
              {secondaryCount > 0 && (
                <button onClick={clearSecondary} className="text-xs text-primary hover:opacity-70">
                  Clear
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => onFilterChange({ status: opt.value ? opt.value : undefined })}
                  className={[
                    'rounded-full px-3 py-1 text-xs font-medium transition-colors duration-100',
                    activeStatus === opt.value
                      ? 'bg-primary text-white'
                      : 'border border-border text-text-2 bg-surface hover:border-primary/40 hover:text-text-1',
                  ].join(' ')}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="text-xs font-medium text-text-2 block mb-2">Category</span>
            <select
              value={filters.categoryId ?? ''}
              onChange={(e) => onFilterChange({ categoryId: e.target.value || undefined })}
              className="w-full h-8 px-2 text-xs border border-border rounded-lg bg-surface text-text-1 focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">All categories</option>
              {Object.entries(categoryGroups).map(([group, cats]) => (
                <optgroup key={group} label={group}>
                  {cats.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {showSearch && (
            <div className="relative">
              <Search
                size={12}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-2 pointer-events-none"
              />
              <input
                type="search"
                placeholder="Search merchant…"
                value={searchInput}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full h-8 pl-7 pr-2 text-xs border border-border rounded-lg bg-surface text-text-1 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
