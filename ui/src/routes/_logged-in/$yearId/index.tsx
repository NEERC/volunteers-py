import { createFileRoute } from "@tanstack/react-router";
import { yearsQueryOptions } from "@/data/use-years";

export const Route = createFileRoute("/_logged-in/$yearId/")({
  component: RouteComponent,
  beforeLoad: async ({ context, params }) => {
    const yearId = Number(params.yearId);
    const data = await context.queryClient.ensureQueryData(yearsQueryOptions);
    const thisYear = data.years.find((year) => year.year_id === yearId);
    return {
      title: thisYear?.year_name ?? "Год не найден",
    };
  },
});

function RouteComponent() {
  const { yearId } = Route.useParams();
  return <div>Hello "/_logged-in/$yearId/"! {yearId}</div>;
}
