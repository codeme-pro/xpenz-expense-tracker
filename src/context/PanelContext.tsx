import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'

type PanelId = 'scan' | 'workspace-switcher' | 'add-expense'

interface PanelContextValue {
  activePanel: PanelId | null
  openPanel: (id: PanelId) => void
  closePanel: () => void
}

const PanelContext = createContext<PanelContextValue | null>(null)

export function PanelProvider({ children }: { children: ReactNode }) {
  const [activePanel, setActivePanel] = useState<PanelId | null>(null)

  return (
    <PanelContext.Provider
      value={{
        activePanel,
        openPanel: (id) => setActivePanel(id),
        closePanel: () => setActivePanel(null),
      }}
    >
      {children}
    </PanelContext.Provider>
  )
}

export function usePanel() {
  const ctx = useContext(PanelContext)
  if (!ctx) throw new Error('usePanel must be used within PanelProvider')
  return ctx
}
