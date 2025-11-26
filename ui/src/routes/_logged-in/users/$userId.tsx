import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Container,
  FormControlLabel,
  Paper,
  TextField,
  Typography,
} from "@mui/material";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useFormik } from "formik";
import { useTranslation } from "react-i18next";
import * as yup from "yup";
import { useEditUser, useUser } from "@/data/use-admin";
import { shouldBeAdmin } from "@/utils/should-be-logged-in";

export const Route = createFileRoute("/_logged-in/users/$userId")({
  component: RouteComponent,
  beforeLoad: async ({ context }) => {
    shouldBeAdmin(context);
    return {
      title: "Edit User",
    };
  },
});

const validationSchema = yup.object({
  first_name_ru: yup.string().required("First name (RU) is required"),
  last_name_ru: yup.string().required("Last name (RU) is required"),
  first_name_en: yup.string().required("First name (EN) is required"),
  last_name_en: yup.string().required("Last name (EN) is required"),
  isu_id: yup.number().nullable(),
  patronymic_ru: yup.string().nullable(),
  phone: yup.string().nullable(),
  email: yup.string().email("Invalid email format").nullable(),
  telegram_username: yup.string().nullable(),
  telegram_id: yup.number().nullable(),
  is_admin: yup.boolean(),
});

function RouteComponent() {
  const { t } = useTranslation();
  const { userId } = Route.useParams();
  const navigate = useNavigate();
  const { data: user, isLoading, error } = useUser(userId);
  const editUserMutation = useEditUser();

  const formik = useFormik({
    initialValues: user || {
      first_name_ru: "",
      last_name_ru: "",
      patronymic_ru: "",
      first_name_en: "",
      last_name_en: "",
      isu_id: null as number | null,
      phone: "",
      email: "",
      telegram_username: "",
      telegram_id: null as number | null,
      is_admin: false,
    },
    validationSchema,
    onSubmit: async (values) => {
      try {
        await editUserMutation.mutateAsync({
          userId,
          data: {
            first_name_ru: values.first_name_ru || null,
            last_name_ru: values.last_name_ru || null,
            patronymic_ru: values.patronymic_ru || null,
            first_name_en: values.first_name_en || null,
            last_name_en: values.last_name_en || null,
            isu_id: values.isu_id || null,
            phone: values.phone || null,
            email: values.email || null,
            telegram_username: values.telegram_username || null,
            telegram_id: values.telegram_id || null,
            is_admin: values.is_admin || null,
          },
        });
        navigate({ to: "/users" });
      } catch (error) {
        console.error("Failed to update user:", error);
      }
    },
    enableReinitialize: true,
  });

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={4}>
        <Alert severity="error">
          {t("Failed to load user")}: {error.message}
        </Alert>
      </Box>
    );
  }

  if (!user) {
    return (
      <Box p={4}>
        <Alert severity="warning">{t("User not found")}</Alert>
      </Box>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          {t("Edit User")}
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
            error={
              formik.touched.first_name_ru &&
              Boolean(formik.errors.first_name_ru)
            }
            helperText={
              formik.touched.first_name_ru && formik.errors.first_name_ru
            }
            sx={{ mb: 2 }}
            required
          />

          <TextField
            fullWidth
            label={t("Last Name (RU)")}
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
            required
          />

          <TextField
            fullWidth
            label={t("Patronymic (RU)")}
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
            label={t("First Name (EN)")}
            name="first_name_en"
            value={formik.values.first_name_en}
            onChange={formik.handleChange}
            error={
              formik.touched.first_name_en &&
              Boolean(formik.errors.first_name_en)
            }
            helperText={
              formik.touched.first_name_en && formik.errors.first_name_en
            }
            sx={{ mb: 2 }}
            required
          />

          <TextField
            fullWidth
            label={t("Last Name (EN)")}
            name="last_name_en"
            value={formik.values.last_name_en}
            onChange={formik.handleChange}
            error={
              formik.touched.last_name_en && Boolean(formik.errors.last_name_en)
            }
            helperText={
              formik.touched.last_name_en && formik.errors.last_name_en
            }
            sx={{ mb: 2 }}
            required
          />

          <TextField
            fullWidth
            label={t("ISU ID")}
            name="isu_id"
            type="number"
            value={formik.values.isu_id || ""}
            onChange={(e) =>
              formik.setFieldValue(
                "isu_id",
                e.target.value ? Number(e.target.value) : null,
              )
            }
            error={formik.touched.isu_id && Boolean(formik.errors.isu_id)}
            helperText={formik.touched.isu_id && formik.errors.isu_id}
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label={t("Phone")}
            name="phone"
            value={formik.values.phone}
            onChange={formik.handleChange}
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
            error={formik.touched.email && Boolean(formik.errors.email)}
            helperText={formik.touched.email && formik.errors.email}
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label={t("Telegram Username")}
            name="telegram_username"
            value={formik.values.telegram_username}
            onChange={formik.handleChange}
            error={
              formik.touched.telegram_username &&
              Boolean(formik.errors.telegram_username)
            }
            helperText={
              formik.touched.telegram_username &&
              formik.errors.telegram_username
            }
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label={t("Telegram ID")}
            name="telegram_id"
            type="number"
            value={formik.values.telegram_id || ""}
            onChange={(e) =>
              formik.setFieldValue(
                "telegram_id",
                e.target.value ? Number(e.target.value) : null,
              )
            }
            error={
              formik.touched.telegram_id && Boolean(formik.errors.telegram_id)
            }
            helperText={formik.touched.telegram_id && formik.errors.telegram_id}
            sx={{ mb: 2 }}
          />

          <FormControlLabel
            control={
              <Checkbox
                checked={formik.values.is_admin}
                onChange={formik.handleChange}
                name="is_admin"
              />
            }
            label={t("Admin")}
            sx={{ mb: 2 }}
          />

          <Box sx={{ display: "flex", gap: 2, mt: 3 }}>
            <Button
              variant="outlined"
              onClick={() => navigate({ to: "/users" })}
              disabled={editUserMutation.isPending}
            >
              {t("Cancel")}
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={editUserMutation.isPending}
            >
              {editUserMutation.isPending ? t("Saving...") : t("Save Changes")}
            </Button>
          </Box>

          {editUserMutation.isError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {t("Failed to update user")}:{" "}
              {editUserMutation.error?.message || t("Unknown error")}
            </Alert>
          )}
        </form>
      </Paper>
    </Container>
  );
}
