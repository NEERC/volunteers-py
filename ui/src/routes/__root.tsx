import { Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

import TanStackQueryLayout from "../integrations/tanstack-query/layout.tsx";

import type { QueryClient } from "@tanstack/react-query";
import { NotFound } from "../components/NotFound";

interface MyRouterContext {
  queryClient: QueryClient;
  title: string;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  component: () => {
    return (
      <>
        <Outlet />
        <TanStackRouterDevtools />
        <TanStackQueryLayout />
      </>
    );
  },
  notFoundComponent: NotFound,
});
