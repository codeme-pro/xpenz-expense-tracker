import type { PersonalFilters, WorkspaceFilters } from './types'

export const queryKeys = {
  expenses: (filters?: PersonalFilters) => ['expenses', filters] as const,
  expense: (id: string) => ['expenses', id] as const,
  reports: (filters?: PersonalFilters) => ['reports', filters] as const,
  report: (id: string) => ['reports', id] as const,
  mileage: (filters?: PersonalFilters) => ['mileage', filters] as const,
  inbox: () => ['inbox'] as const,
  submittedExpenses: () => ['submittedExpenses'] as const,
  workspaceMembers: () => ['workspaceMembers'] as const,
  workspaceExpenses: (filters?: WorkspaceFilters) => ['workspaceExpenses', filters] as const,
  workspaceMileage: (filters?: WorkspaceFilters) => ['workspaceMileage', filters] as const,
  workspaceReports: (filters?: WorkspaceFilters) => ['workspaceReports', filters] as const,
  scanUrl: (filePath: string) => ['scanUrl', filePath] as const,
}
