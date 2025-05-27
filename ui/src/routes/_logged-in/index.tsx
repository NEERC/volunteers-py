import { Typography } from "@mui/material";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_logged-in/")({
  component: App,
  beforeLoad: () => {
    return {
      title: "Main page",
    };
  },
});

function App() {
  return (
    <Typography>
      Добро пожаловать в волонтерскую систему. Выберите год слева.
    </Typography>
  );
}
