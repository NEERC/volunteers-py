import type { QueryClient } from "@tanstack/react-query";
import { redirect } from "@tanstack/react-router";
import { yearsQueryOptions } from "../data/use-years";
import type { Route as LoggedInRoute } from "../routes/_logged-in";

export const shouldBeAdmin = (
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

export const shouldBeManager = async (
  context: ReturnType<(typeof LoggedInRoute)["useLoaderData"]> & {
    queryClient: QueryClient;
  },
  yearId: string | number,
) => {
  const user = context.user;
  if (user === null) {
    throw redirect({ to: "/login" });
  }
  // Admins can always access
  if (user.is_admin === true) {
    return;
  }
  // Check if user is manager for this year
  const data = await context.queryClient.ensureQueryData(yearsQueryOptions);
  const yearsData = data as {
    years: Array<{ year_id: number; is_manager: boolean }>;
  };
  const yearIdNum = typeof yearId === "string" ? Number(yearId) : yearId;
  const thisYear = yearsData.years.find((year) => year.year_id === yearIdNum);
  if (!thisYear || !thisYear.is_manager) {
    throw redirect({ to: "/forbidden" });
  }
};
