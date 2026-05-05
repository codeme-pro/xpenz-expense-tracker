import { Outlet, createRootRoute } from '@tanstack/react-router'
import { Toaster } from 'sonner'
import { AuthProvider } from '#/context/AuthContext'
import { ThemeProvider } from '#/context/ThemeContext'
import '../styles.css'

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Outlet />
        <Toaster position="bottom-center" offset={88} richColors closeButton />
      </AuthProvider>
    </ThemeProvider>
  )
}
