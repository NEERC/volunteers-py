import { Outlet, createRootRouteWithContext, useMatches, useRouterState } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'

import MainLayout from '../components/MainLayout.tsx'

import TanStackQueryLayout from '../integrations/tanstack-query/layout.tsx'

import type { QueryClient } from '@tanstack/react-query'
import { NotFound } from '../components/NotFound'
import type { UserResponse } from '@/client/types.gen.ts'

interface MyRouterContext {
  queryClient: QueryClient,
  getTitle: () => string,
  user?: UserResponse // TODO: use some other type
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  component: () => {
    return (
      <>
        <Outlet />
        <TanStackRouterDevtools />
        <TanStackQueryLayout />
      </>
    )
  },
  notFoundComponent: NotFound,
})
