import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon: ReactNode
  title: string
  body?: string
  action?: ReactNode
}

export function EmptyState({ icon, title, body, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="text-text-2 mb-3">{icon}</div>
      <p className="text-sm font-semibold text-text-1 mb-1">{title}</p>
      {body && <p className="text-xs text-text-2 mb-4">{body}</p>}
      {action}
    </div>
  )
}
