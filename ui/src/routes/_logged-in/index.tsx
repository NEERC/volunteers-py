import { Box, Typography } from "@mui/material";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/_logged-in/")({
  component: App,
  beforeLoad: () => {
    return {
      title: "Main page",
    };
  },
});

function App() {
  const { t } = useTranslation();
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
      <Typography variant="h4" component="h1" gutterBottom>
        {t(
          "Welcome to the volunteer system. Select a year in the top left corner.",
        )}
      </Typography>
    </Box>
  );
}
