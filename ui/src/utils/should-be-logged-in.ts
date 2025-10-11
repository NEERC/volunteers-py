import { redirect } from "@tanstack/react-router";
import type { Route as LoggedInRoute } from "../routes/_logged-in";

export const shouldBeLoggedIn = (
  context: ReturnType<(typeof LoggedInRoute)["useLoaderData"]>,
) => {
  const user = context.user;
  if (user === null) {
    throw redirect({ to: "/login" });
  }
  if (user.is_admin !== true) {
    throw redirect({ to: "/forbidden" });
  }
};
