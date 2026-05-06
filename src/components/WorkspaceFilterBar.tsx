import { Search } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchCategories } from '#/lib/queries'
import type { Category, ExpenseStatus, WorkspaceFilters, WorkspaceMember, WorkspacePeriod } from '#/lib/types'

const PERIOD_OPTIONS: { value: WorkspacePeriod; label: string }[] = [
  { value: 'all_time', label: 'All time' },
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'last_3_months', label: 'Last 3 months' },
]

const STATUS_OPTIONS: { value: ExpenseStatus | ''; label: string }[] = [
  { value: '', label: 'All status' },
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
]

interface WorkspaceFilterBarProps {
  filters: WorkspaceFilters
  members: WorkspaceMember[]
  onFilterChange: (updates: Partial<WorkspaceFilters>) => void
  showSearch?: boolean
}

const selectClass =
  'h-8 pl-2.5 pr-5 text-xs border border-border rounded-lg bg-surface text-text-1 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer shrink-0'

export function WorkspaceFilterBar({
  filters,
  members,
  onFilterChange,
  showSearch = false,
}: WorkspaceFilterBarProps) {
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

  return (
    <div className="px-4 py-2.5 border-b border-border bg-background flex items-center gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      <select
        value={filters.memberId ?? ''}
        onChange={(e) => onFilterChange({ memberId: e.target.value || undefined })}
        className={selectClass}
      >
        <option value="">All members</option>
        {members.map((m) => (
          <option key={m.userId} value={m.userId}>
            {m.name}
          </option>
        ))}
      </select>

      <select
        value={filters.status ?? ''}
        onChange={(e) =>
          onFilterChange({ status: (e.target.value as ExpenseStatus) || undefined })
        }
        className={selectClass}
      >
        {STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      <select
        value={filters.period ?? 'all_time'}
        onChange={(e) =>
          onFilterChange({ period: e.target.value as WorkspacePeriod })
        }
        className={selectClass}
      >
        {PERIOD_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      <select
        value={filters.categoryId ?? ''}
        onChange={(e) => onFilterChange({ categoryId: e.target.value || undefined })}
        className={selectClass}
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

      {showSearch && (
        <div className="relative flex-1 min-w-[130px]">
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
  )
}
