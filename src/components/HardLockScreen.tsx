import { useNavigate } from '@tanstack/react-router'
import { Lock } from 'lucide-react'
import { useWorkspace } from '#/context/WorkspaceContext'

export function HardLockScreen() {
  const { current, workspaces } = useWorkspace()
  const navigate = useNavigate()
  const isOwner = current.role === 'owner'
  const otherWorkspaces = workspaces.filter((w) => w.id !== current.id && w.status !== 'locked')

  return (
    <div className="min-h-dvh bg-background flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        <div className="w-16 h-16 rounded-2xl bg-danger/10 flex items-center justify-center mx-auto mb-6">
          <Lock size={30} className="text-danger" />
        </div>

        <h1 className="text-xl font-bold text-text-1 mb-2">
          {isOwner ? 'Your trial has ended' : 'Workspace locked'}
        </h1>

        {isOwner ? (
          <>
            <p className="text-sm text-text-2 mb-2">
              Add a payment method to continue using <strong className="text-text-1">{current.name}</strong>.
            </p>
            <p className="text-sm text-text-2 mb-8">
              You scanned{' '}
              <strong className="text-text-1">{current.scansThisMonth} receipts</strong>{' '}
              during your trial.
            </p>
            <button
              onClick={() => navigate({ to: '/workspace/settings' })}
              className="w-full h-11 bg-primary text-white text-sm font-semibold rounded-xl touch-manipulation cursor-pointer mb-3"
            >
              Add payment method
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-text-2 mb-2">
              <strong className="text-text-1">{current.ownerName}</strong> needs to add a payment
              method to restore access to{' '}
              <strong className="text-text-1">{current.name}</strong>.
            </p>
            <p className="text-sm text-text-2 mb-8">
              Contact the workspace owner to continue.
            </p>
          </>
        )}

        {otherWorkspaces.length > 0 && (
          <button
            onClick={() => navigate({ to: '/workspaces/' })}
            className="w-full h-11 border border-border text-sm font-medium text-text-2 rounded-xl touch-manipulation cursor-pointer hover:bg-surface transition-colors duration-150"
          >
            Switch workspace
          </button>
        )}
      </div>
    </div>
  )
}
