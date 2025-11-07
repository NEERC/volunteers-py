import { blue, green, red, yellow } from "@mui/material/colors";
import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { NotFound } from "../components/NotFound";
import TanStackQueryLayout from "../integrations/tanstack-query/layout.tsx";

interface MyRouterContext {
  queryClient: QueryClient;
  title: string;
}

const EnvBadge = ({ label, color }: { label: string; color: string }) => {
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        background: color,
        color: "black",
        padding: "4px 16px",
        zIndex: 10000000000,
        fontSize: "0.9rem",
        borderBottomLeftRadius: "8px",
        opacity: 0.85,
        pointerEvents: "none",
        fontFamily: "monospace",
      }}
    >
      {label}
    </div>
  );
};

const MODE_COLORS = {
  development: green[500],
  production: red[500],
  staging: blue[500],
  "public-beta": yellow[500],
};

export const Route = createRootRouteWithContext<MyRouterContext>()({
  component: () => {
    return (
      <>
        {import.meta.env.MODE !== "production" ? (
          <EnvBadge
            label={import.meta.env.MODE}
            color={
              MODE_COLORS[import.meta.env.MODE as keyof typeof MODE_COLORS]
            }
          />
        ) : (
          <EnvBadge label={"public-beta"} color={MODE_COLORS["public-beta"]} />
        )}
        <Outlet />
        <TanStackRouterDevtools />
        <TanStackQueryLayout />
      </>
    );
  },
  notFoundComponent: NotFound,
});
