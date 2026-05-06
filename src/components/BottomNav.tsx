import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Home, FileText, Camera, Users, Settings, FilePen, Plus, X } from 'lucide-react'
import { fetchInbox } from '#/lib/queries'
import { queryKeys } from '#/lib/queryKeys'

export function BottomNav() {
  const state = useRouterState()
  const pathname = state.location.pathname
  const navigate = useNavigate()
  const { data: inbox = [] } = useQuery({ queryKey: queryKeys.inbox(), queryFn: fetchInbox, staleTime: 30_000 })
  const unreadCount = inbox.filter((i) => !i.read).length
  const [speedDialOpen, setSpeedDialOpen] = useState(false)

  const isActive = (paths: string[]) =>
    paths.some((p) => pathname === p || pathname.startsWith(p + '/') || pathname.startsWith(p))

  const linkCls = (active: boolean) =>
    `relative flex flex-col items-center justify-center gap-1 w-full py-2 rounded-xl transition-colors duration-150 touch-manipulation ${
      active
        ? 'bg-primary text-white'
        : 'text-nav-inactive hover:text-nav-hover-text hover:bg-nav-hover-bg'
    }`

  const iconCls = (active: boolean) =>
    `transition-transform duration-150 ease-out motion-reduce:transition-none ${active ? 'scale-110' : 'scale-100'}`

  return (
    <nav
      aria-label="Main navigation"
      className="fixed bottom-0 left-0 right-0 bg-nav border-t border-border z-40 overflow-visible"
    >
      {/* Speed dial backdrop */}
      {speedDialOpen && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => setSpeedDialOpen(false)}
        />
      )}

      <ul className="flex px-2 py-2 gap-1" role="list">

        {/* Home */}
        <li className="flex-1">
          <Link
            to="/home"
            aria-current={isActive(['/home']) ? 'page' : undefined}
            className={linkCls(isActive(['/home']))}
          >
            <span className={iconCls(isActive(['/home']))}><Home size={20} /></span>
            <span className="text-[10px] font-semibold leading-none">Home</span>
            {unreadCount > 0 && !isActive(['/home']) && (
              <span className="absolute top-1.5 right-3 min-w-[16px] h-4 bg-primary text-white text-[9px] font-bold flex items-center justify-center rounded-full px-1">
                {unreadCount}
              </span>
            )}
          </Link>
        </li>

        {/* Activity */}
        <li className="flex-1">
          <Link
            to="/reports"
            aria-current={isActive(['/reports', '/expenses', '/mileage']) ? 'page' : undefined}
            className={linkCls(isActive(['/reports', '/expenses', '/mileage']))}
          >
            <span className={iconCls(isActive(['/reports', '/expenses', '/mileage']))}><FileText size={20} /></span>
            <span className="text-[10px] font-semibold leading-none">Activity</span>
          </Link>
        </li>

        {/* Center FAB — speed dial */}
        <li className="flex-1 flex items-center justify-center relative">
          {speedDialOpen && (
            <div className="absolute bottom-[calc(100%+4px)] left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-40 pb-1">
              <button
                onClick={() => { setSpeedDialOpen(false); navigate({ to: '/expenses/new' }) }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-surface border border-border shadow-lg text-sm font-medium text-text-1 whitespace-nowrap touch-manipulation cursor-pointer active:scale-95 transition-transform duration-100"
              >
                <FilePen size={15} className="text-primary" />
                Add manually
              </button>
              <button
                onClick={() => { setSpeedDialOpen(false); navigate({ to: '/scan' }) }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-surface border border-border shadow-lg text-sm font-medium text-text-1 whitespace-nowrap touch-manipulation cursor-pointer active:scale-95 transition-transform duration-100"
              >
                <Camera size={15} className="text-primary" />
                Scan
              </button>
            </div>
          )}
          <button
            onClick={() => setSpeedDialOpen((v) => !v)}
            aria-label="Add expense"
            aria-expanded={speedDialOpen}
            className={`-translate-y-4 w-14 h-14 rounded-full bg-primary text-white shadow-lg shadow-primary/40 flex items-center justify-center touch-manipulation cursor-pointer active:scale-95 transition-all duration-200 z-40 relative ${speedDialOpen ? 'rotate-45' : ''}`}
          >
            {speedDialOpen ? <X size={22} /> : <Plus size={22} />}
          </button>
        </li>

        {/* Workspace */}
        <li className="flex-1">
          <Link
            to="/workspace/members"
            aria-current={isActive(['/workspace']) ? 'page' : undefined}
            className={linkCls(isActive(['/workspace']))}
          >
            <span className={iconCls(isActive(['/workspace']))}><Users size={20} /></span>
            <span className="text-[10px] font-semibold leading-none">Workspace</span>
          </Link>
        </li>

        {/* Preferences */}
        <li className="flex-1">
          <Link
            to="/settings"
            aria-current={isActive(['/settings']) ? 'page' : undefined}
            className={linkCls(isActive(['/settings']))}
          >
            <span className={iconCls(isActive(['/settings']))}><Settings size={20} /></span>
            <span className="text-[10px] font-semibold leading-none">Preferences</span>
          </Link>
        </li>

      </ul>
    </nav>
  )
}
