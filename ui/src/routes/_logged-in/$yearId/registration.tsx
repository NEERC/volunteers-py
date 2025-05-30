import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useMutation } from '@tanstack/react-query';
import { saveFormYearApiV1YearYearIdPost } from '@/client';
import { Box, Container, Typography, Paper, Button, TextField, FormControl, InputLabel, Select, MenuItem, Checkbox, CircularProgress, Alert } from '@mui/material';
import { useFormik } from 'formik';
import * as Yup from 'yup';

export const Route = createFileRoute('/_logged-in/$yearId/registration')({
  component: RouteComponent,
});

function RouteComponent() {
  const year = Route.useRouteContext().year;
  const { yearId } = Route.useParams();
  const navigate = useNavigate();


  const saveMutation = useMutation({
    mutationFn: async (values: {
      desired_positions: number[];
      itmo_group: string | null;
      comments: string;
    }) => {
      return saveFormYearApiV1YearYearIdPost({
        path: { year_id: parseInt(yearId) },
        body: {
          desired_positions_ids: values.desired_positions,
          itmo_group: values.itmo_group,
          comments: values.comments,
        },
        throwOnError: true
      });
    },
    onSuccess: () => {
      navigate({ to: `/${yearId}` });
    },
  });

  const formik = useFormik({
    initialValues: {
      desired_positions: year?.desired_positions?.map(p => p.position_id) ?? [],
      itmo_group: year?.itmo_group ?? '',
      comments: year?.comments ?? '',
    },
    enableReinitialize: true,
    validationSchema: Yup.object({
      desired_positions: Yup.array().of(Yup.number()).min(1, 'Please select at least one position'),
      itmo_group: Yup.string().nullable(),
      comments: Yup.string(),
    }),
    onSubmit: (values) => {
      saveMutation.mutate(values);
    },
  });

  if (!year) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }

  if (!year) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Alert severity="error">
          Failed to load registration form. Please try again later.
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Registration Form
        </Typography>
        
        <form onSubmit={formik.handleSubmit}>
          <FormControl fullWidth sx={{ mb: 3 }}>
            <InputLabel id="positions-label">Desired Positions</InputLabel>
            <Select
              labelId="positions-label"
              multiple
              value={formik.values.desired_positions}
              onChange={(e) => formik.setFieldValue('desired_positions', e.target.value)}
              error={formik.touched.desired_positions && Boolean(formik.errors.desired_positions)}
              renderValue={(selected) => {
                const selectedPositions = year.positions
                  .filter(p => selected.includes(p.position_id))
                  .map(p => p.name)
                  .join(', ');
                return selectedPositions;
              }}
            >
              {year.positions.map((position) => (
                <MenuItem key={position.position_id} value={position.position_id}>
                  <Checkbox checked={formik.values.desired_positions.includes(position.position_id)} />
                  {position.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            fullWidth
            label="ITMO Group"
            name="itmo_group"
            value={formik.values.itmo_group}
            onChange={formik.handleChange}
            error={formik.touched.itmo_group && Boolean(formik.errors.itmo_group)}
            helperText={formik.touched.itmo_group && formik.errors.itmo_group}
            sx={{ mb: 3 }}
          />

          <TextField
            fullWidth
            label="Comments"
            name="comments"
            multiline
            rows={4}
            value={formik.values.comments}
            onChange={formik.handleChange}
            error={formik.touched.comments && Boolean(formik.errors.comments)}
            helperText={formik.touched.comments && formik.errors.comments}
            sx={{ mb: 3 }}
          />

          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
            <Button onClick={() => navigate({ to: `/${yearId}` })}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={!formik.isValid || formik.isSubmitting || saveMutation.isPending}
            >
              Submit
            </Button>
          </Box>

          {saveMutation.isError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              Failed to save registration. Please try again.
            </Alert>
          )}
        </form>
      </Paper>
    </Container>
  );
}
