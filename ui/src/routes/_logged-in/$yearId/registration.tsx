import { updateUserApiV1AuthUpdatePost } from "@/client";
import { saveFormYearApiV1YearYearIdPost } from "@/client";
import { authStore } from "@/store/auth";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Container,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useFormik } from "formik";
import { observer } from "mobx-react-lite";
import * as Yup from "yup";

export const Route = createFileRoute("/_logged-in/$yearId/registration")({
  component: observer(RouteComponent),
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
      first_name_ru: string | null;
      last_name_ru: string | null;
      full_name_en: string | null;
      isu_id: number | null;
      patronymic_ru: string | null;
      phone: string | null;
      email: string | null;
    }) => {
      const [formResponse, userResponse] = await Promise.all([
        saveFormYearApiV1YearYearIdPost({
          path: { year_id: Number.parseInt(yearId) },
          body: {
            desired_positions_ids: values.desired_positions,
            itmo_group: values.itmo_group,
            comments: values.comments,
          },
          throwOnError: true,
        }),
        updateUserApiV1AuthUpdatePost({
          body: {
            first_name_ru: values.first_name_ru,
            last_name_ru: values.last_name_ru,
            full_name_en: values.full_name_en,
            isu_id: values.isu_id,
            patronymic_ru: values.patronymic_ru,
            phone: values.phone,
            email: values.email,
          },
          throwOnError: true,
        }),
      ]);
      return { formResponse, userResponse };
    },
    onSuccess: async () => {
      await authStore.fetchUser();
      navigate({ to: `/${yearId}` });
    },
  });

  const formik = useFormik({
    initialValues: {
      desired_positions:
        year?.desired_positions?.map((p) => p.position_id) ?? [],
      itmo_group: year?.itmo_group ?? "",
      comments: year?.comments ?? "",
      first_name_ru: authStore.user?.first_name_ru ?? "",
      last_name_ru: authStore.user?.last_name_ru ?? "",
      full_name_en: authStore.user?.full_name_en ?? "",
      isu_id: authStore.user?.isu_id ?? null,
      patronymic_ru: authStore.user?.patronymic_ru ?? "",
      phone: authStore.user?.phone ?? "",
      email: authStore.user?.email ?? "",
    },
    enableReinitialize: true,
    validationSchema: Yup.object({
      desired_positions: Yup.array()
        .of(Yup.number())
        .min(1, "Please select at least one position"),
      itmo_group: Yup.string().nullable(),
      comments: Yup.string(),
      first_name_ru: Yup.string().required("Required"),
      last_name_ru: Yup.string().required("Required"),
      full_name_en: Yup.string().required("Required"),
      isu_id: Yup.number().nullable(),
      patronymic_ru: Yup.string().nullable(),
      phone: Yup.string().required("Phone is required"),
      email: Yup.string()
        .email("Invalid email format")
        .required("Email is required"),
    }),
    onSubmit: (values) => {
      saveMutation.mutate(values);
    },
  });

  if (!year) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="80vh"
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Registration Form
        </Typography>

        <form onSubmit={formik.handleSubmit}>
          <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
            Personal Information
          </Typography>

          <TextField
            fullWidth
            label="First Name (RU)"
            name="first_name_ru"
            value={formik.values.first_name_ru}
            onChange={formik.handleChange}
            error={
              formik.touched.first_name_ru &&
              Boolean(formik.errors.first_name_ru)
            }
            helperText={
              formik.touched.first_name_ru && formik.errors.first_name_ru
            }
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label="Last Name (RU)"
            name="last_name_ru"
            value={formik.values.last_name_ru}
            onChange={formik.handleChange}
            error={
              formik.touched.last_name_ru && Boolean(formik.errors.last_name_ru)
            }
            helperText={
              formik.touched.last_name_ru && formik.errors.last_name_ru
            }
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label="Patronymic (RU)"
            name="patronymic_ru"
            value={formik.values.patronymic_ru}
            onChange={formik.handleChange}
            error={
              formik.touched.patronymic_ru &&
              Boolean(formik.errors.patronymic_ru)
            }
            helperText={
              formik.touched.patronymic_ru && formik.errors.patronymic_ru
            }
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label="Full Name (EN)"
            name="full_name_en"
            value={formik.values.full_name_en}
            onChange={formik.handleChange}
            error={
              formik.touched.full_name_en && Boolean(formik.errors.full_name_en)
            }
            helperText={
              formik.touched.full_name_en && formik.errors.full_name_en
            }
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label="ISU ID"
            name="isu_id"
            type="number"
            value={formik.values.isu_id || ""}
            onChange={formik.handleChange}
            error={formik.touched.isu_id && Boolean(formik.errors.isu_id)}
            helperText={formik.touched.isu_id && formik.errors.isu_id}
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label="Phone"
            name="phone"
            type="tel"
            value={formik.values.phone}
            onChange={formik.handleChange}
            error={formik.touched.phone && Boolean(formik.errors.phone)}
            helperText={formik.touched.phone && formik.errors.phone}
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label="Email"
            name="email"
            type="email"
            value={formik.values.email}
            onChange={formik.handleChange}
            error={formik.touched.email && Boolean(formik.errors.email)}
            helperText={formik.touched.email && formik.errors.email}
            sx={{ mb: 3 }}
          />

          <Divider sx={{ my: 3 }} />

          <Typography variant="h6" gutterBottom>
            Registration Details
          </Typography>

          <FormControl fullWidth sx={{ mb: 3 }}>
            <InputLabel id="positions-label">Desired Positions</InputLabel>
            <Select
              labelId="positions-label"
              multiple
              value={formik.values.desired_positions}
              onChange={(e) =>
                formik.setFieldValue("desired_positions", e.target.value)
              }
              error={
                formik.touched.desired_positions &&
                Boolean(formik.errors.desired_positions)
              }
              renderValue={(selected) => {
                const selectedPositions = year.positions
                  .filter((p) => selected.includes(p.position_id))
                  .map((p) => p.name)
                  .join(", ");
                return selectedPositions;
              }}
            >
              {year.positions.map((position) => (
                <MenuItem
                  key={position.position_id}
                  value={position.position_id}
                >
                  <Checkbox
                    checked={formik.values.desired_positions.includes(
                      position.position_id,
                    )}
                  />
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
            error={
              formik.touched.itmo_group && Boolean(formik.errors.itmo_group)
            }
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

          <Box sx={{ display: "flex", gap: 2, justifyContent: "flex-end" }}>
            <Button onClick={() => navigate({ to: `/${yearId}` })}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={
                !formik.isValid || formik.isSubmitting || saveMutation.isPending
              }
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
