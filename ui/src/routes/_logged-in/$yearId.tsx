import { getFormYearApiV1YearYearIdGet } from "@/client/sdk.gen";
import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_logged-in/$yearId")({
  component: RouteComponent,
  beforeLoad: async ({ params }) => {
    // Load the year to the context
    const yearId = params.yearId;
    const year = await getFormYearApiV1YearYearIdGet({
      path: { year_id: Number(yearId) },
    });
    return { year: year.data };
  },
});

function RouteComponent() {
  return <Outlet />;
}
