import { Button, Container, Stack, Title } from '@mantine/core'
import { useQueryErrorResetBoundary } from '@tanstack/react-query'
import { useLocation } from '@tanstack/react-router'
import { ReactNode, useEffect } from 'react'
import { ErrorBoundary } from 'react-error-boundary'

export const QueryErrorBoundary = ({ children }: { children: ReactNode }) => {
  const location = useLocation()
  const { reset } = useQueryErrorResetBoundary()

  let resetFunc = () => {}

  useEffect(() => {
    resetFunc()
  }, [location.pathname, resetFunc])

  return (
    <ErrorBoundary
      onReset={reset}
      fallbackRender={({ resetErrorBoundary }) => {
        resetFunc = resetErrorBoundary
        return (
          <Container
            style={{
              justifyItems: 'center',
              height: '100%'
            }}
            mt={24}
          >
            <Stack style={{ maxWidth: 400, alignItems: 'center' }}>
              <Title size="xl">There was an error fetching data!</Title>
              <Button
                style={{ width: 100 }}
                onClick={() => resetErrorBoundary()}
              >
                Try again
              </Button>
            </Stack>
          </Container>
        )
      }}
    >
      {children}
    </ErrorBoundary>
  )
}
