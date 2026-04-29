import type { InboxItem } from '#/lib/types'
import { formatRelative } from '#/lib/format'
import { Bell } from 'lucide-react'

interface InboxRowProps {
  item: InboxItem
  onClick?: () => void
}

export function InboxRow({ item, onClick }: InboxRowProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex gap-3 px-4 py-3 text-left touch-manipulation active:bg-gray-50 cursor-pointer ${
        !item.read ? 'bg-primary-light/40' : 'bg-surface'
      }`}
    >
      <div className="shrink-0 mt-0.5">
        <div className="w-8 h-8 rounded-full bg-primary-light flex items-center justify-center">
          <Bell size={14} className="text-primary" />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p
            className={`text-sm truncate ${
              !item.read
                ? 'font-semibold text-text-1'
                : 'font-medium text-text-1'
            }`}
          >
            {item.title}
          </p>
          <span className="text-xs text-text-2 whitespace-nowrap shrink-0">
            {formatRelative(item.timestamp)}
          </span>
        </div>
        <p className="text-xs text-text-2 mt-0.5 line-clamp-2">{item.body}</p>
      </div>
      {!item.read && (
        <div
          className="shrink-0 w-2 h-2 rounded-full bg-primary mt-2"
          aria-label="Unread"
        />
      )}
    </button>
  )
}
