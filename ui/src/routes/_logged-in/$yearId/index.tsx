import { Box, Typography } from "@mui/material";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" component="div" gutterBottom>
        {t("Use the sidebar to navigate to the desired page.")}
      </Typography>
    </Box>
  );
}
