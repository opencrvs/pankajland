import {
  AppShell,
  Container} from '@mantine/core'
import { ReactNode } from 'react'
import { QueryErrorBoundary } from './QueryErrorBoundary'

export function Shell({ children }: { children: ReactNode }) {

  return (
    <AppShell
      padding="md"
    >
      <AppShell.Main>
        <QueryErrorBoundary>
          <Container>{children}</Container>
        </QueryErrorBoundary>
      </AppShell.Main>
    </AppShell>
  )
}
