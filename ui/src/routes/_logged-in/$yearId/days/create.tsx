import { addDayApiV1AdminDayAddPost } from "@/client";
import {
  Box,
  Button,
  Container,
  Paper,
  TextField,
  Typography,
} from "@mui/material";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/_logged-in/$yearId/days/create")({
  component: RouteComponent,
});

function RouteComponent() {
  const { yearId } = Route.useParams();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [information, setInformation] = useState("");

  const createDay = useMutation({
    mutationFn: async () => {
      const response = await addDayApiV1AdminDayAddPost({
        body: {
          year_id: Number(yearId),
          name,
          information,
        },
      });
      return response.data;
    },
    onSuccess: () => {
      navigate({ to: `/${yearId}` });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createDay.mutate();
  };

  return (
    <Container maxWidth="md">
      <Paper sx={{ p: 4, mt: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Create New Day
        </Typography>
        <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
          <TextField
            fullWidth
            label="Day Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Information"
            value={information}
            onChange={(e) => setInformation(e.target.value)}
            required
            multiline
            rows={4}
            sx={{ mb: 3 }}
          />
          <Box sx={{ display: "flex", gap: 2 }}>
            <Button
              variant="contained"
              type="submit"
              disabled={createDay.isPending}
            >
              {createDay.isPending ? "Creating..." : "Create Day"}
            </Button>
            <Button
              variant="outlined"
              onClick={() => navigate({ to: `/${yearId}` })}
            >
              Cancel
            </Button>
          </Box>
        </Box>
      </Paper>
    </Container>
  );
}
