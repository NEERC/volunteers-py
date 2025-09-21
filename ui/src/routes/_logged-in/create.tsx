import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  TextField,
  Typography,
} from "@mui/material";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAddYear } from "@/data";

export const Route = createFileRoute("/_logged-in/create")({
  component: RouteComponent,
  loader: async ({ context }) => {
    const user = context.user;
    if (user.is_admin !== true) {
      throw redirect({ to: "/forbidden" });
    }
    return {
      title: "Создать год",
    };
  },
});

function RouteComponent() {
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
              Создать новый год
            </Typography>
            <TextField
              autoFocus
              margin="normal"
              label="Название года"
              fullWidth
              value={yearName}
              onChange={(e) => setYearName(e.target.value)}
              error={createYearMutation.isError}
              helperText={createYearMutation.error?.message}
              disabled={createYearMutation.isPending}
            />
          </CardContent>
          <CardActions sx={{ justifyContent: "flex-end", p: 2 }}>
            <Button onClick={() => navigate({ to: "/" })}>Отмена</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={!yearName.trim() || createYearMutation.isPending}
            >
              Создать
            </Button>
          </CardActions>
        </form>
      </Card>
    </Box>
  );
}
