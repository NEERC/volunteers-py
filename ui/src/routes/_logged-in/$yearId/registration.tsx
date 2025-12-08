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
  FormHelperText,
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
import type { Gender } from "@/client/types.gen";
import { useSaveRegistration } from "@/data/use-year";
import { authStore } from "@/store/auth";
import { submitOnCtrlEnter } from "@/utils/formShortcuts";
import { GENDER_OPTIONS, getGenderLabel } from "@/utils/gender";

export const Route = createFileRoute("/_logged-in/$yearId/registration")({
  component: observer(RouteComponent),
});

export const requiredLabel = (label: string) => `${label} *`;

export const shouldDisplayFieldError = (error: unknown, touched?: boolean) =>
  Boolean(error && touched);

type RegistrationFormValues = {
  desired_positions: number[];
  itmo_group: string;
  comments: string;
  needs_invitation: boolean;
  first_name_ru: string;
  last_name_ru: string;
  first_name_en: string;
  last_name_en: string;
  isu_id: number | null;
  patronymic_ru: string;
  phone: string;
  email: string;
  gender: string;
};

function RouteComponent() {
  const { t } = useTranslation();
  const year = Route.useRouteContext().year;
  const { yearId } = Route.useParams();
  const navigate = useNavigate();
  const user = authStore.user;

  const saveMutation = useSaveRegistration();

  const formik = useFormik<RegistrationFormValues>({
    initialValues: {
      desired_positions:
        year?.desired_positions?.map((p) => p.position_id) ?? [],
      itmo_group: year?.itmo_group ?? "",
      comments: year?.comments ?? "",
      needs_invitation: year?.needs_invitation ?? false,
      first_name_ru: user?.first_name_ru ?? "",
      last_name_ru: user?.last_name_ru ?? "",
      first_name_en: user?.first_name_en ?? "",
      last_name_en: user?.last_name_en ?? "",
      isu_id: user?.isu_id ?? null,
      patronymic_ru: user?.patronymic_ru ?? "",
      phone: user?.phone ?? "",
      email: user?.email ?? "",
      gender: user?.gender ?? "",
    },
    enableReinitialize: true,
    validationSchema: Yup.object({
      desired_positions: Yup.array()
        .of(Yup.number())
        .min(1, t("Please select at least one position")),
      itmo_group: Yup.string().nullable(),
      comments: Yup.string(),
      needs_invitation: Yup.boolean(),
      first_name_ru: Yup.string().required(t("Required")),
      last_name_ru: Yup.string().required(t("Required")),
      first_name_en: Yup.string().required(t("Required")),
      last_name_en: Yup.string().required(t("Required")),
      isu_id: Yup.number().nullable(),
      patronymic_ru: Yup.string().nullable(),
      phone: Yup.string().required(t("Phone is required")),
      email: Yup.string()
        .email(t("Invalid email format"))
        .required(t("Email is required")),
      gender: Yup.string().required(t("Gender is required")),
    }),
    onSubmit: async (values) => {
      try {
        await saveMutation.mutateAsync({
          yearId,
          formData: {
            desired_positions_ids: values.desired_positions,
            itmo_group: values.itmo_group,
            comments: values.comments,
            needs_invitation: values.needs_invitation,
          },
          userData: {
            first_name_ru: values.first_name_ru,
            last_name_ru: values.last_name_ru,
            first_name_en: values.first_name_en,
            last_name_en: values.last_name_en,
            isu_id: values.isu_id,
            patronymic_ru: values.patronymic_ru,
            phone: values.phone,
            email: values.email,
            gender: values.gender as Gender | null,
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

  const hasFieldError = (field: keyof RegistrationFormValues) =>
    shouldDisplayFieldError(formik.errors[field], formik.touched[field]);

  const getFieldError = (field: keyof RegistrationFormValues) => {
    if (!hasFieldError(field)) {
      return undefined;
    }

    const error = formik.errors[field];
    return typeof error === "string" ? error : undefined;
  };

  const getFieldErrorProps = (field: keyof RegistrationFormValues) => ({
    error: hasFieldError(field),
    helperText: getFieldError(field),
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
          {t("Registration Form")}
        </Typography>

        <form onSubmit={formik.handleSubmit}>
          <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
            {t("Personal Information")}
          </Typography>

          <TextField
            fullWidth
            label={requiredLabel(t("First Name (RU)"))}
            name="first_name_ru"
            value={formik.values.first_name_ru}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            disabled={!year.open_for_registration}
            {...getFieldErrorProps("first_name_ru")}
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label={requiredLabel(t("Last Name (RU)"))}
            name="last_name_ru"
            value={formik.values.last_name_ru}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            disabled={!year.open_for_registration}
            {...getFieldErrorProps("last_name_ru")}
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label={t("Patronymic (RU)")}
            name="patronymic_ru"
            value={formik.values.patronymic_ru}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            disabled={!year.open_for_registration}
            {...getFieldErrorProps("patronymic_ru")}
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label={requiredLabel(t("First Name (EN)"))}
            name="first_name_en"
            value={formik.values.first_name_en}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            disabled={!year.open_for_registration}
            {...getFieldErrorProps("first_name_en")}
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label={requiredLabel(t("Last Name (EN)"))}
            name="last_name_en"
            value={formik.values.last_name_en}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            disabled={!year.open_for_registration}
            {...getFieldErrorProps("last_name_en")}
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label={t("ISU ID")}
            name="isu_id"
            type="number"
            value={formik.values.isu_id || ""}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            disabled={!year.open_for_registration}
            {...getFieldErrorProps("isu_id")}
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label={requiredLabel(t("Phone"))}
            name="phone"
            type="tel"
            value={formik.values.phone}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            disabled={!year.open_for_registration}
            {...getFieldErrorProps("phone")}
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label={requiredLabel(t("Email"))}
            name="email"
            type="email"
            value={formik.values.email}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            disabled={!year.open_for_registration}
            {...getFieldErrorProps("email")}
            sx={{ mb: 2 }}
          />

          <FormControl
            fullWidth
            sx={{ mb: 3 }}
            error={hasFieldError("gender")}
            disabled={!year.open_for_registration}
          >
            <InputLabel>{requiredLabel(t("Gender"))}</InputLabel>
            <Select
              name="gender"
              value={formik.values.gender}
              onChange={formik.handleChange}
              onBlur={() => formik.setFieldTouched("gender", true)}
              label={t("Gender")}
            >
              {GENDER_OPTIONS.map((option) => (
                <MenuItem key={option} value={option}>
                  {getGenderLabel(option, t)}
                </MenuItem>
              ))}
            </Select>
            {hasFieldError("gender") && (
              <Typography
                variant="caption"
                color="error"
                sx={{ mt: 0.5, ml: 2 }}
              >
                {getFieldError("gender")}
              </Typography>
            )}
          </FormControl>

          <Divider sx={{ my: 3 }} />

          <Typography variant="h6" gutterBottom>
            {t("Registration Details")}
          </Typography>

          <FormControl
            fullWidth
            sx={{ mb: 3 }}
            error={hasFieldError("desired_positions")}
          >
            <InputLabel id={positionId}>
              {requiredLabel(t("Desired Positions"))}
            </InputLabel>
            <Select
              labelId={positionId}
              label={t("Desired Positions")}
              multiple
              value={formik.values.desired_positions}
              disabled={!year.open_for_registration}
              onChange={(e) =>
                formik.setFieldValue("desired_positions", e.target.value)
              }
              onBlur={() => formik.setFieldTouched("desired_positions", true)}
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
            <FormHelperText>
              {getFieldError("desired_positions")}
            </FormHelperText>
          </FormControl>

          <TextField
            fullWidth
            label={t("ITMO Group")}
            name="itmo_group"
            value={formik.values.itmo_group}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            disabled={!year.open_for_registration}
            {...getFieldErrorProps("itmo_group")}
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
            onBlur={formik.handleBlur}
            onKeyDown={(event) =>
              submitOnCtrlEnter(event, {
                canSubmit:
                  year.open_for_registration &&
                  formik.isValid &&
                  !formik.isSubmitting &&
                  !saveMutation.isPending,
                submit: formik.submitForm,
              })
            }
            disabled={!year.open_for_registration}
            {...getFieldErrorProps("comments")}
            sx={{ mb: 3 }}
          />

          <Box sx={{ mb: 3 }}>
            <FormControl>
              <Box sx={{ display: "flex", alignItems: "center" }}>
                <Checkbox
                  checked={formik.values.needs_invitation}
                  onChange={formik.handleChange}
                  name="needs_invitation"
                  disabled={!year.open_for_registration}
                />
                <Typography>
                  {t("I need an invitation for work/study")}
                </Typography>
              </Box>
            </FormControl>
          </Box>

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
