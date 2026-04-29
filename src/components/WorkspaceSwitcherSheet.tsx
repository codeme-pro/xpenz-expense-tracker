import { useNavigate } from '@tanstack/react-router'
import { Check, Plus, X } from 'lucide-react'
import { usePanel } from '#/context/PanelContext'
import { useWorkspace } from '#/context/WorkspaceContext'

export function WorkspaceSwitcherSheet() {
  const { closePanel } = usePanel()
  const { current, workspaces, switchWorkspace } = useWorkspace()
  const navigate = useNavigate()

  return (
    <>
      <div
        className="fixed inset-0 z-[60] bg-black/40"
        onClick={closePanel}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-label="Switch workspace"
        className="fixed bottom-0 left-0 right-0 z-[70] bg-surface rounded-t-2xl shadow-2xl animate-slide-up"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-text-1">Switch Workspace</h2>
          <button
            onClick={closePanel}
            aria-label="Close"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-text-2 hover:bg-nav-hover-bg transition-colors duration-150 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div role="listbox" aria-label="Workspaces" className="py-2">
          {workspaces.map((ws) => (
            <button
              key={ws.id}
              role="option"
              aria-selected={ws.id === current.id}
              onClick={() => {
                switchWorkspace(ws.id)
                closePanel()
                navigate({ to: '/home' })
              }}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-nav-hover-bg transition-colors duration-150 cursor-pointer touch-manipulation"
            >
              <Check size={16} className={ws.id === current.id ? 'text-primary' : 'opacity-0'} />
              <span className={`text-sm ${ws.id === current.id ? 'font-semibold text-text-1' : 'text-text-2'}`}>
                {ws.name}
              </span>
            </button>
          ))}
        </div>

        <div className="border-t border-border py-2 pb-6">
          <button
            onClick={() => {
              closePanel()
              navigate({ to: '/workspaces/new' })
            }}
            className="w-full flex items-center gap-3 px-4 py-3 text-text-2 hover:bg-nav-hover-bg transition-colors duration-150 cursor-pointer touch-manipulation"
          >
            <Plus size={16} />
            <span className="text-sm">New workspace</span>
          </button>
        </div>
      </div>
    </>
  )
}
