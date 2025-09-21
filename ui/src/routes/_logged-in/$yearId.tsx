import { createFileRoute, Outlet } from "@tanstack/react-router";
import { yearFormQueryOptions } from "@/data/use-year";
import { getContext } from "@/integrations/tanstack-query/root-provider";

export const Route = createFileRoute("/_logged-in/$yearId")({
  component: RouteComponent,
  beforeLoad: async ({ params }) => {
    // Load the year to the context using query client
    const yearId = params.yearId;
    const { queryClient } = getContext();

    const year = await queryClient.ensureQueryData(
      yearFormQueryOptions(yearId),
    );

    return { year };
  },
});

function RouteComponent() {
  return <Outlet />;
}
