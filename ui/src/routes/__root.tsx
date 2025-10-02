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
        {import.meta.env.MODE !== "production" && (
          <div
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              background: "#222",
              color: "#fff",
              padding: "4px 16px",
              zIndex: 10000000000,
              fontSize: "0.9rem",
              borderBottomLeftRadius: "8px",
              opacity: 0.85,
              pointerEvents: "none",
              fontFamily: "monospace",
            }}
          >
            {import.meta.env.MODE}
          </div>
        )}
        <Outlet />
        <TanStackRouterDevtools />
        <TanStackQueryLayout />
      </>
    );
  },
  notFoundComponent: NotFound,
});
