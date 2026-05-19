import { Outlet, createRootRoute } from '@tanstack/react-router'
import { Shell } from '../components/AppShell/Shell'

export const Route = createRootRoute({
  component: RootComponent
})

function RootComponent() {
  return (
    <>
      <Shell>
        <Outlet />
      </Shell>
    </>
  )
}
