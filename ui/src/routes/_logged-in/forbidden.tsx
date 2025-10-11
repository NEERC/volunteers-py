import { Box, Button, Typography } from "@mui/material";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/_logged-in/forbidden")({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "60vh",
        textAlign: "center",
        p: 3,
      }}
    >
      <Typography variant="h3" component="h1" gutterBottom color="error">
        {t("Access Forbidden")}
      </Typography>
      <Typography
        variant="h6"
        component="p"
        color="text.secondary"
        sx={{ mb: 4 }}
      >
        {t("You are not authorized to access this page")}
      </Typography>
      <Button
        variant="contained"
        onClick={() => navigate({ to: "/" })}
        size="large"
      >
        {t("Go to Main Page")}
      </Button>
    </Box>
  );
}
