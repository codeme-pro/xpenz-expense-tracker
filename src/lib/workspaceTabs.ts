import type { UserRole } from './types'

export function getWorkspaceTabs(role: UserRole | null) {
  return [
    { to: '/workspace/members', label: 'Members' },
    ...(role === 'admin' || role === 'owner'
      ? [
          { to: '/workspace/approvals', label: 'Approvals' },
          { to: '/workspace/expenses', label: 'Expenses' },
          { to: '/workspace/mileage', label: 'Mileage' },
          { to: '/workspace/reports', label: 'Reports' },
        ]
      : []),
    ...(role === 'owner' ? [{ to: '/workspace/settings', label: 'Settings' }] : []),
  ]
}
