import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
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
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useFormik } from "formik";
import { observer } from "mobx-react-lite";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import * as Yup from "yup";
import { useSaveRegistration } from "@/data/use-year";
import { authStore } from "@/store/auth";

export const Route = createFileRoute("/_logged-in/$yearId/registration")({
  component: observer(RouteComponent),
});

function RouteComponent() {
  const { t } = useTranslation();
  const year = Route.useRouteContext().year;
  const { yearId } = Route.useParams();
  const navigate = useNavigate();
  const user = authStore.user;

  const saveMutation = useSaveRegistration();

  const formik = useFormik({
    initialValues: {
      desired_positions:
        year?.desired_positions?.map((p) => p.position_id) ?? [],
      itmo_group: year?.itmo_group ?? "",
      comments: year?.comments ?? "",
      first_name_ru: user?.first_name_ru ?? "",
      last_name_ru: user?.last_name_ru ?? "",
      full_name_en: user?.full_name_en ?? "",
      isu_id: user?.isu_id ?? null,
      patronymic_ru: user?.patronymic_ru ?? "",
      phone: user?.phone ?? "",
      email: user?.email ?? "",
    },
    enableReinitialize: true,
    validationSchema: Yup.object({
      desired_positions: Yup.array()
        .of(Yup.number())
        .min(1, t("Please select at least one position")),
      itmo_group: Yup.string().nullable(),
      comments: Yup.string(),
      first_name_ru: Yup.string().required(t("Required")),
      last_name_ru: Yup.string().required(t("Required")),
      full_name_en: Yup.string().required(t("Required")),
      isu_id: Yup.number().nullable(),
      patronymic_ru: Yup.string().nullable(),
      phone: Yup.string().required(t("Phone is required")),
      email: Yup.string()
        .email(t("Invalid email format"))
        .required(t("Email is required")),
    }),
    onSubmit: async (values) => {
      try {
        await saveMutation.mutateAsync({
          yearId,
          formData: {
            desired_positions_ids: values.desired_positions,
            itmo_group: values.itmo_group,
            comments: values.comments,
          },
          userData: {
            first_name_ru: values.first_name_ru,
            last_name_ru: values.last_name_ru,
            full_name_en: values.full_name_en,
            isu_id: values.isu_id,
            patronymic_ru: values.patronymic_ru,
            phone: values.phone,
            email: values.email,
          },
        });
        // User data will be updated via the mutation's cache invalidation
        // navigate({ to: `/${yearId}` });
      } catch (error) {
        // Error is handled by the mutation's error state
        console.error("Registration failed:", error);
      }
    },
  });

  const positionId = useId();

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
          {t("Registration Form")}
        </Typography>

        <form onSubmit={formik.handleSubmit}>
          <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
            {t("Personal Information")}
          </Typography>

          <TextField
            fullWidth
            label={t("First Name (RU)")}
            name="first_name_ru"
            value={formik.values.first_name_ru}
            onChange={formik.handleChange}
            disabled={!year.open_for_registration}
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
            label={t("Last Name (RU)")}
            name="last_name_ru"
            value={formik.values.last_name_ru}
            onChange={formik.handleChange}
            disabled={!year.open_for_registration}
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
            label={t("Patronymic (RU)")}
            name="patronymic_ru"
            value={formik.values.patronymic_ru}
            onChange={formik.handleChange}
            disabled={!year.open_for_registration}
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
            label={t("Full Name (EN)")}
            name="full_name_en"
            value={formik.values.full_name_en}
            onChange={formik.handleChange}
            disabled={!year.open_for_registration}
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
            label={t("ISU ID")}
            name="isu_id"
            type="number"
            value={formik.values.isu_id || ""}
            onChange={formik.handleChange}
            disabled={!year.open_for_registration}
            error={formik.touched.isu_id && Boolean(formik.errors.isu_id)}
            helperText={formik.touched.isu_id && formik.errors.isu_id}
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label={t("Phone")}
            name="phone"
            type="tel"
            value={formik.values.phone}
            onChange={formik.handleChange}
            disabled={!year.open_for_registration}
            error={formik.touched.phone && Boolean(formik.errors.phone)}
            helperText={formik.touched.phone && formik.errors.phone}
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label={t("Email")}
            name="email"
            type="email"
            value={formik.values.email}
            onChange={formik.handleChange}
            disabled={!year.open_for_registration}
            error={formik.touched.email && Boolean(formik.errors.email)}
            helperText={formik.touched.email && formik.errors.email}
            sx={{ mb: 3 }}
          />

          <Divider sx={{ my: 3 }} />

          <Typography variant="h6" gutterBottom>
            {t("Registration Details")}
          </Typography>

          <FormControl fullWidth sx={{ mb: 3 }}>
            <InputLabel id={positionId}>{t("Desired Positions")}</InputLabel>
            <Select
              labelId={positionId}
              label={t("Desired Positions")}
              multiple
              value={formik.values.desired_positions}
              disabled={!year.open_for_registration}
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
                  .map((p) => p.name);
                return (
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                    {selectedPositions.map((value) => (
                      <Chip key={value} label={value} />
                    ))}
                  </Box>
                );
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
            label={t("ITMO Group")}
            name="itmo_group"
            value={formik.values.itmo_group}
            onChange={formik.handleChange}
            disabled={!year.open_for_registration}
            error={
              formik.touched.itmo_group && Boolean(formik.errors.itmo_group)
            }
            helperText={formik.touched.itmo_group && formik.errors.itmo_group}
            sx={{ mb: 3 }}
          />

          <TextField
            fullWidth
            label={t("Comments")}
            name="comments"
            multiline
            rows={4}
            value={formik.values.comments}
            onChange={formik.handleChange}
            disabled={!year.open_for_registration}
            error={formik.touched.comments && Boolean(formik.errors.comments)}
            helperText={formik.touched.comments && formik.errors.comments}
            sx={{ mb: 3 }}
          />

          <Box sx={{ display: "flex", gap: 2, justifyContent: "flex-end" }}>
            <Button onClick={() => navigate({ to: `/${yearId}` })}>
              {t("Cancel")}
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={
                !formik.isValid ||
                formik.isSubmitting ||
                saveMutation.isPending ||
                !year.open_for_registration
              }
              startIcon={
                saveMutation.isPending ? <CircularProgress size={20} /> : null
              }
            >
              {saveMutation.isPending ? t("Saving...") : t("Submit")}
            </Button>
          </Box>

          {saveMutation.isSuccess && (
            <Alert severity="success" sx={{ mt: 2 }}>
              {t("Registration saved successfully!")}
            </Alert>
          )}

          {saveMutation.isError && (
            <Alert
              severity="error"
              sx={{ mt: 2 }}
              action={
                <Button
                  color="inherit"
                  size="small"
                  onClick={() => saveMutation.reset()}
                >
                  {t("Dismiss")}
                </Button>
              }
            >
              {saveMutation.error?.message ||
                t("Failed to save registration. Please try again.")}
            </Alert>
          )}
        </form>
      </Paper>
    </Container>
  );
}
