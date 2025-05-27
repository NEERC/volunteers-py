import MainLayout from "@/components/MainLayout";
import { authStore } from "@/store/auth";
import {
  useMatches,
  Outlet,
  redirect,
  createFileRoute,
  useNavigate,
} from "@tanstack/react-router";
import { observer } from "mobx-react-lite";
import { useEffect } from "react";

const LoggedInLayout = observer(() => {
  const matches = useMatches();

  const matchWithTitle = [...matches].reverse().find((d) => d.context.title);

  const navigate = useNavigate();
  useEffect(() => {
    authStore.waitForHydration().then(() => {
      if (authStore.user === null) {
        navigate({ to: "/login" });
      }
    });
  }, [navigate]);

  const title = matchWithTitle?.context.title || "Volunteers";
  return (
    <>
      <MainLayout title={title}>
        <Outlet />
      </MainLayout>
    </>
  );
});

export const Route = createFileRoute("/_logged-in")({
  component: LoggedInLayout,
  beforeLoad: async () => {
    await authStore.waitForHydration();
    if (authStore.user === null) {
      throw redirect({ to: "/login" });
    }
  },
});
