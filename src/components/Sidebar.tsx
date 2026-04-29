import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import {
  Home,
  Bell,
  FileText,
  Receipt,
  Car,
  Users,
  ShieldCheck,
  Settings,
  ChevronDown,
  Camera,
  Check,
  Plus,
  LayoutList,
  MapPin,
} from 'lucide-react'
import { LogoMark } from '#/assets/LogoMark'
import type { UserRole } from '#/lib/types'
import { useQuery } from '@tanstack/react-query'
import { fetchInbox } from '#/lib/queries'
import { queryKeys } from '#/lib/queryKeys'
import { usePanel } from '#/context/PanelContext'
import { useWorkspace } from '#/context/WorkspaceContext'

interface SidebarProps {
  role: UserRole
}

const REPORTS_PATHS = ['/reports', '/expenses', '/mileage']
const WORKSPACE_PATHS = ['/workspace/members', '/workspace/approvals', '/workspace/reports', '/workspace/expenses', '/workspace/mileage', '/workspace/settings']

export function Sidebar({ role }: SidebarProps) {
  const state = useRouterState()
  const pathname = state.location.pathname
  const { openPanel } = usePanel()
  const { current, workspaces, switchWorkspace } = useWorkspace()
  const navigate = useNavigate()

  const [switcherOpen, setSwitcherOpen] = useState(false)
  const [switcherClosing, setSwitcherClosing] = useState(false)
  const switcherRef = useRef<HTMLDivElement>(null)

  const closeSwitcher = () => {
    setSwitcherClosing(true)
    setTimeout(() => {
      setSwitcherOpen(false)
      setSwitcherClosing(false)
    }, 120)
  }

  const reportsActive = REPORTS_PATHS.some((p) => pathname.startsWith(p))
  const workspaceActive = WORKSPACE_PATHS.some((p) => pathname.startsWith(p))

  const [expanded, setExpanded] = useState<Set<string>>(new Set(['reports', 'workspace']))

  const toggle = (key: string) => {
    const isActive = key === 'reports' ? reportsActive : workspaceActive
    if (isActive) return
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  useEffect(() => {
    if (!switcherOpen) return
    const handler = (e: MouseEvent) => {
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) {
        closeSwitcher()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [switcherOpen])

  const { data: inbox = [] } = useQuery({ queryKey: queryKeys.inbox(), queryFn: fetchInbox, staleTime: 30_000 })
  const unreadCount = inbox.filter((i) => !i.read).length
  const showReports = reportsActive || expanded.has('reports')
  const showWorkspace = workspaceActive || expanded.has('workspace')
  const isActive = (to: string) => pathname === to || pathname.startsWith(to + '/')

  const workspaceSubItems = [
    {
      to: '/workspace/members',
      label: 'Members',
      icon: <Users size={14} />,
      roles: ['member', 'admin', 'owner'] as UserRole[],
    },
    {
      to: '/workspace/approvals',
      label: 'Approvals',
      icon: <ShieldCheck size={14} />,
      roles: ['admin', 'owner'] as UserRole[],
    },
    {
      to: '/workspace/reports',
      label: 'Reports',
      icon: <FileText size={14} />,
      roles: ['admin', 'owner'] as UserRole[],
    },
    {
      to: '/workspace/expenses',
      label: 'Expenses',
      icon: <LayoutList size={14} />,
      roles: ['admin', 'owner'] as UserRole[],
    },
    {
      to: '/workspace/mileage',
      label: 'Mileage',
      icon: <MapPin size={14} />,
      roles: ['admin', 'owner'] as UserRole[],
    },
    {
      to: '/workspace/settings',
      label: 'Settings',
      icon: <Settings size={14} />,
      roles: ['owner'] as UserRole[],
    },
  ].filter((item) => item.roles.includes(role))

  return (
    <aside className="fixed top-0 left-0 h-full w-56 z-50 bg-nav border-r border-border flex flex-col">
      {/* Brand */}
      <div className="flex items-center gap-2.5 h-14 px-4 border-b border-border shrink-0">
        <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shrink-0">
          <LogoMark className="w-[18px] h-auto text-white" />
        </div>
        <span className="text-base font-bold text-text-1" style={{ fontFamily: 'var(--font-display)' }}>
          Xpenz
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 overflow-y-auto" aria-label="Main navigation">
        <ul role="list" className="flex flex-col gap-0.5 px-2">
          <li>
            <Link
              to="/home"
              aria-current={isActive('/home') ? 'page' : undefined}
              className={`flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-colors duration-150 ${
                isActive('/home')
                  ? 'bg-primary text-white'
                  : 'text-nav-inactive hover:text-nav-hover-text hover:bg-nav-hover-bg'
              }`}
            >
              <Home size={18} />
              <span>Home</span>
            </Link>
          </li>

          <li>
            <Link
              to="/inbox"
              aria-current={isActive('/inbox') ? 'page' : undefined}
              className={`flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-colors duration-150 ${
                isActive('/inbox')
                  ? 'bg-primary text-white'
                  : 'text-nav-inactive hover:text-nav-hover-text hover:bg-nav-hover-bg'
              }`}
            >
              <Bell size={18} />
              <span className="flex-1">Inbox</span>
              {unreadCount > 0 && (
                <span
                  className={`text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1 ${
                    isActive('/inbox') ? 'bg-white/25 text-white' : 'bg-primary text-white'
                  }`}
                >
                  {unreadCount}
                </span>
              )}
            </Link>
          </li>

          {/* Reports accordion */}
          <li>
            <button
              onClick={() => toggle('reports')}
              aria-expanded={showReports}
              className={`flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-colors duration-150 cursor-pointer ${
                reportsActive
                  ? 'bg-primary/8 text-primary'
                  : 'text-nav-inactive hover:text-nav-hover-text hover:bg-nav-hover-bg'
              }`}
            >
              <FileText size={18} />
              <span className="flex-1 text-left">Reports</span>
              <ChevronDown
                size={14}
                className={`transition-transform duration-200 ${showReports ? 'rotate-180' : ''}`}
              />
            </button>
            <div className={`accordion-grid ${showReports ? 'open' : ''}`}>
              <ul className="mt-0.5 ml-3 pl-3 border-l border-border flex flex-col gap-0.5 py-0.5">
                {[
                  { to: '/reports', label: 'Reports', icon: <FileText size={13} /> },
                  { to: '/expenses', label: 'Expenses', icon: <Receipt size={13} /> },
                  { to: '/mileage', label: 'Mileage', icon: <Car size={13} /> },
                ].map((sub) => (
                  <li key={sub.to}>
                    <Link
                      to={sub.to}
                      aria-current={isActive(sub.to) ? 'page' : undefined}
                      className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-medium transition-colors duration-150 ${
                        isActive(sub.to)
                          ? 'bg-primary/10 text-primary font-semibold'
                          : 'text-text-2 hover:text-nav-hover-text hover:bg-nav-hover-bg'
                      }`}
                    >
                      {sub.icon}
                      {sub.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </li>

          {/* Workspace accordion */}
          <li>
            <button
              onClick={() => toggle('workspace')}
              aria-expanded={showWorkspace}
              className={`flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-colors duration-150 cursor-pointer ${
                workspaceActive
                  ? 'bg-primary/8 text-primary'
                  : 'text-nav-inactive hover:text-nav-hover-text hover:bg-nav-hover-bg'
              }`}
            >
              <Users size={18} />
              <span className="flex-1 text-left">Workspace</span>
              <ChevronDown
                size={14}
                className={`transition-transform duration-200 ${showWorkspace ? 'rotate-180' : ''}`}
              />
            </button>
            <div className={`accordion-grid ${showWorkspace ? 'open' : ''}`}>
              <ul className="mt-0.5 ml-3 pl-3 border-l border-border flex flex-col gap-0.5 py-0.5">
                {workspaceSubItems.map((sub) => (
                  <li key={sub.to}>
                    <Link
                      to={sub.to}
                      aria-current={isActive(sub.to) ? 'page' : undefined}
                      className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-medium transition-colors duration-150 ${
                        isActive(sub.to)
                          ? 'bg-primary/10 text-primary font-semibold'
                          : 'text-text-2 hover:text-nav-hover-text hover:bg-nav-hover-bg'
                      }`}
                    >
                      {sub.icon}
                      {sub.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </li>

          {/* Preferences — below Workspace */}
          <li>
            <Link
              to="/settings"
              aria-current={isActive('/settings') ? 'page' : undefined}
              className={`flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-colors duration-150 ${
                isActive('/settings')
                  ? 'bg-primary text-white'
                  : 'text-nav-inactive hover:text-nav-hover-text hover:bg-nav-hover-bg'
              }`}
            >
              <Settings size={18} />
              <span>Preferences</span>
            </Link>
          </li>
        </ul>
      </nav>

      {/* Bottom — workspace switcher (drop-up) + scan */}
      <div className="px-3 pt-2 pb-3 border-t border-border shrink-0 flex flex-col gap-2">
        <div ref={switcherRef} className="relative">
          <button
            onClick={() => switcherOpen ? closeSwitcher() : setSwitcherOpen(true)}
            aria-haspopup="listbox"
            aria-expanded={switcherOpen}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-nav-hover-bg transition-colors duration-150 cursor-pointer"
          >
            <div className="w-5 h-5 rounded-md bg-primary/15 flex items-center justify-center shrink-0">
              <span className="text-primary font-bold text-[9px] select-none">X</span>
            </div>
            <span className="flex-1 text-xs font-medium text-text-1 truncate text-left">{current.name}</span>
            <ChevronDown
              size={12}
              className={`text-text-2 shrink-0 transition-transform duration-150 ${switcherOpen ? '' : 'rotate-180'}`}
            />
          </button>

          {switcherOpen && (
            <div
              role="listbox"
              className={`absolute left-0 right-0 bottom-full mb-1 z-[80] bg-surface border border-border rounded-xl shadow-lg overflow-hidden ${switcherClosing ? 'animate-dropdown-down' : 'animate-dropdown-up'}`}
            >
              {workspaces.map((ws) => (
                <button
                  key={ws.id}
                  role="option"
                  aria-selected={ws.id === current.id}
                  onClick={() => {
                    switchWorkspace(ws.id)
                    closeSwitcher()
                    navigate({ to: '/home' })
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-nav-hover-bg transition-colors duration-150 cursor-pointer"
                >
                  <Check size={14} className={ws.id === current.id ? 'text-primary' : 'opacity-0'} />
                  <span className={ws.id === current.id ? 'text-text-1 font-medium' : 'text-text-2'}>
                    {ws.name}
                  </span>
                </button>
              ))}
              <div className="border-t border-border">
                <button
                  onClick={() => {
                    closeSwitcher()
                    navigate({ to: '/workspaces/new' })
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-text-2 hover:bg-nav-hover-bg transition-colors duration-150 cursor-pointer"
                >
                  <Plus size={14} />
                  New workspace
                </button>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={() => openPanel('scan')}
          className="w-full flex items-center justify-center gap-1.5 h-9 rounded-lg bg-primary text-white text-xs font-semibold touch-manipulation cursor-pointer hover:opacity-90 transition-opacity duration-150"
        >
          <Camera size={14} />
          Scan
        </button>
      </div>
    </aside>
  )
}
