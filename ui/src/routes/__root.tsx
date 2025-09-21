import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { NotFound } from "../components/NotFound";
import TanStackQueryLayout from "../integrations/tanstack-query/layout.tsx";

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
