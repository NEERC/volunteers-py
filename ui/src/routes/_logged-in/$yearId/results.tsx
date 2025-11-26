import { createFileRoute } from "@tanstack/react-router";
import { shouldBeAdmin } from "@/utils/should-be-logged-in";

export const Route = createFileRoute("/_logged-in/$yearId/results")({
  component: RouteComponent,
  beforeLoad: async ({ context }) => {
    shouldBeAdmin(context);
    return {
      title: "Results",
    };
  },
});

function RouteComponent() {
  return <div>Hello "/_logged-in/$yearId/results"!</div>;
}
