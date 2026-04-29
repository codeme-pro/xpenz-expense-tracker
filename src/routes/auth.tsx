import { createFileRoute, Outlet } from '@tanstack/react-router'
import { WordMark } from '#/assets/WordMark'

export const Route = createFileRoute('/auth')({
  component: AuthLayout,
})

function AuthLayout() {
  return (
    <div className="min-h-dvh bg-background flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <WordMark className="h-9 w-auto text-primary mx-auto block mb-2" />
            <p className="text-xs text-text-2">Expense management</p>
          </div>
          <Outlet />
        </div>
      </div>
    </div>
  )
}
