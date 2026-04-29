import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell } from 'lucide-react'
import { fetchInbox, markInboxRead } from '#/lib/queries'
import { queryKeys } from '#/lib/queryKeys'
import { TopBar } from '#/components/TopBar'
import { EmptyState } from '#/components/EmptyState'
import { formatRelative } from '#/lib/format'
import type { InboxItem } from '#/lib/types'

export const Route = createFileRoute('/_app/inbox')({
  component: InboxScreen,
})

function InboxScreen() {
  const queryClient = useQueryClient()

  const { data: inbox = [], isLoading } = useQuery({
    queryKey: queryKeys.inbox(),
    queryFn: fetchInbox,
  })

  const markRead = useMutation({
    mutationFn: markInboxRead,
    onMutate: (id) => {
      const prev = queryClient.getQueryData<InboxItem[]>(queryKeys.inbox())
      queryClient.setQueryData<InboxItem[]>(queryKeys.inbox(), (old) =>
        old?.map((item) => (item.id === id ? { ...item, read: true } : item)) ?? [],
      )
      return { prev }
    },
    onError: (_err, _id, context) => {
      if (context?.prev) queryClient.setQueryData(queryKeys.inbox(), context.prev)
    },
  })

  const unreadCount = inbox.filter((i) => !i.read).length

  return (
    <div>
      <TopBar title={unreadCount > 0 ? `Inbox (${unreadCount})` : 'Inbox'} workspaceTitle />
      {isLoading ? (
        <div className="mt-3 mx-4 bg-surface rounded-xl border border-border h-32 animate-pulse" />
      ) : inbox.length === 0 ? (
        <EmptyState icon={<Bell size={36} />} title="All caught up" body="No new notifications." />
      ) : (
        <div className="mt-3 mx-4">
          <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-background">
                    <th className="w-6 px-4 py-2.5" />
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-text-2">
                      Title
                    </th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-text-2 hidden md:table-cell">
                      Message
                    </th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-text-2">
                      Time
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {inbox.map((item, i) => (
                    <tr
                      key={item.id}
                      onClick={() => !item.read && markRead.mutate(item.id)}
                      className={`transition-colors duration-100 animate-fade-in-up ${
                        !item.read ? 'cursor-pointer hover:bg-primary/5' : ''
                      }`}
                      style={{ '--stagger-delay': `${i * 40}ms` } as React.CSSProperties}
                    >
                      <td className="px-4 py-3">
                        {!item.read && (
                          <span className="block w-2 h-2 rounded-full bg-primary" aria-label="Unread" />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p
                          className={`text-sm truncate max-w-[200px] ${
                            !item.read ? 'font-semibold text-text-1' : 'font-medium text-text-1'
                          }`}
                        >
                          {item.title}
                        </p>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <p className="text-xs text-text-2 line-clamp-1 max-w-sm">{item.body}</p>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <span className="text-xs text-text-2">{formatRelative(item.timestamp)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
