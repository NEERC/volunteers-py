import { Typography } from "@mui/material";
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
    <Typography>
      {t("Welcome to the volunteer system. Select a year on the left.")}
    </Typography>
  );
}
