import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  TextField,
  Typography,
} from "@mui/material";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAddYear } from "@/data";
import { shouldBeAdmin } from "@/utils/should-be-logged-in";

export const Route = createFileRoute("/_logged-in/create")({
  component: RouteComponent,
  beforeLoad: async ({ context }) => {
    shouldBeAdmin(context);
    return {
      title: "Create new year",
    };
  },
});

function RouteComponent() {
  const { t } = useTranslation();
  const [yearName, setYearName] = useState("");
  const navigate = useNavigate();

  const createYearMutation = useAddYear();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (yearName.trim()) {
      createYearMutation.mutate(
        { year_name: yearName.trim() },
        {
          onSuccess: (data) => {
            navigate({ to: `/${data.year_id}` });
          },
        },
      );
    }
  };

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        pt: 4,
      }}
    >
      <Card sx={{ maxWidth: 600, width: "100%" }}>
        <form onSubmit={handleSubmit}>
          <CardContent>
            <Typography variant="h5" component="div" gutterBottom>
              {t("Create new year")}
            </Typography>
            <TextField
              autoFocus
              margin="normal"
              label={t("Year Name")}
              fullWidth
              value={yearName}
              onChange={(e) => setYearName(e.target.value)}
              error={createYearMutation.isError}
              helperText={createYearMutation.error?.message}
              disabled={createYearMutation.isPending}
            />
          </CardContent>
          <CardActions sx={{ justifyContent: "flex-end", p: 2 }}>
            <Button onClick={() => navigate({ to: "/" })}>{t("Cancel")}</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={!yearName.trim() || createYearMutation.isPending}
            >
              {t("Create Year")}
            </Button>
          </CardActions>
        </form>
      </Card>
    </Box>
  );
}
