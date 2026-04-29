import { Outlet, createRootRoute } from '@tanstack/react-router'
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
      </AuthProvider>
    </ThemeProvider>
  )
}
