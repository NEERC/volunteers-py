import { createFileRoute } from "@tanstack/react-router";
import { shouldBeLoggedIn } from "@/utils/should-be-logged-in";

export const Route = createFileRoute("/_logged-in/$yearId/medals")({
  component: RouteComponent,
  beforeLoad: async ({ context }) => {
    shouldBeLoggedIn(context);
    return {
      title: "Medals",
    };
  },
});

function RouteComponent() {
  return <div>Hello "/_logged-in/$yearId/medals"!</div>;
}
