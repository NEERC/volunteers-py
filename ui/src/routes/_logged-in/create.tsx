import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { Box, Button, Card, CardActions, CardContent, TextField, Typography } from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addYearApiV1AdminYearAddPost } from '@/client';
import type { AddYearResponse } from '@/client/types.gen';
import { useState } from 'react';

export const Route = createFileRoute('/_logged-in/create')({
  component: RouteComponent,
  loader: async ({ context }) => {
    const user = context.user;
    if (user.is_admin !== true) {
      throw redirect({ to: "/forbidden" });
    }
    return {
      title: "Создать год"
    };
  },
})

function RouteComponent() {
  const [yearName, setYearName] = useState("");
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const createYearMutation = useMutation<AddYearResponse, Error, string>({
    mutationFn: async (yearName: string): Promise<AddYearResponse> => {
      const response = await addYearApiV1AdminYearAddPost({
        body: { year_name: yearName },
        throwOnError: true
      });
      const data = response.data as AddYearResponse;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["years"] });
      navigate({ to: `/${data.year_id}` });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (yearName.trim()) {
      createYearMutation.mutate(yearName);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        pt: 4
      }}
    >
      <Card sx={{ maxWidth: 600, width: '100%' }}>
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
          <CardActions sx={{ justifyContent: 'flex-end', p: 2 }}>
            <Button onClick={() => navigate({ to: "/" })}>
              Отмена
            </Button>
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
