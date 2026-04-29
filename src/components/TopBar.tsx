import { useRouter } from '@tanstack/react-router'
import { ArrowLeft, ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'
import { useWorkspace } from '#/context/WorkspaceContext'
import { usePanel } from '#/context/PanelContext'

interface TopBarProps {
  title?: string
  workspaceTitle?: boolean
  showBack?: boolean
  right?: ReactNode
}

export function TopBar({ title, workspaceTitle = false, showBack = false, right }: TopBarProps) {
  const router = useRouter()
  const { current } = useWorkspace()
  const { openPanel } = usePanel()

  return (
    <header className="sticky top-0 z-30 bg-background">
      <div className="flex items-center h-14 px-4 gap-2 border-b border-border">
        {showBack && (
          <button
            onClick={() => router.history.back()}
            aria-label="Go back"
            className="flex items-center justify-center w-8 h-8 -ml-1 text-text-2 touch-manipulation cursor-pointer"
          >
            <ArrowLeft size={20} />
          </button>
        )}

        {workspaceTitle ? (
          <>
            {/* Mobile: tappable workspace name → bottom sheet switcher */}
            <button
              onClick={() => openPanel('workspace-switcher')}
              aria-label={`Current workspace: ${current.name}. Tap to switch.`}
              className="lg:hidden flex-1 flex items-center gap-1 min-w-0 touch-manipulation cursor-pointer"
            >
              <h1 className="text-sm font-semibold text-text-1 truncate">{current.name}</h1>
              <ChevronDown size={14} className="text-text-2 shrink-0" />
            </button>
            {/* Desktop: static page title — sidebar already shows workspace context */}
            <h1 className="hidden lg:block flex-1 text-sm font-semibold text-text-1 truncate">
              {title}
            </h1>
          </>
        ) : (
          <h1 className="flex-1 text-sm font-semibold text-text-1 truncate">{title}</h1>
        )}

        {right && <div className="flex items-center">{right}</div>}
      </div>
    </header>
  )
}
