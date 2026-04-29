import { Link, useRouterState } from '@tanstack/react-router'

interface TabItem {
  to: string
  label: string
}

interface TabStripProps {
  tabs: TabItem[]
}

export function TabStrip({ tabs }: TabStripProps) {
  const pathname = useRouterState().location.pathname

  return (
    <div className="flex gap-1.5 px-4 pt-3 pb-2.5 border-b border-border overflow-x-auto">
      {tabs.map((tab) => {
        const active =
          pathname === tab.to || pathname.startsWith(tab.to + '/')
        return (
          <Link
            key={tab.to}
            to={tab.to}
            className={`shrink-0 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors duration-150 whitespace-nowrap ${
              active
                ? 'bg-primary text-white'
                : 'text-text-2 hover:bg-nav-hover-bg hover:text-nav-hover-text'
            }`}
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
