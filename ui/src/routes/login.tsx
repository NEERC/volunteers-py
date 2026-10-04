import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Divider,
  Link,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Field, Form, Formik } from "formik";
import { observer } from "mobx-react-lite";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import * as Yup from "yup";
import type {
  AuthFlowResponse,
  IdentityProvider,
  RegistrationPrefill,
} from "@/client";
import { AuthMethodsInfo } from "@/components/AuthMethodsInfo";
import { TelegramLoginButton } from "@/components/TelegramLoginButton";
import { PROVIDER_NAMES } from "@/const";
import { useTelegramAvailable } from "@/data/use-auth";
import { authStore } from "@/store/auth";
import { apiErrorMessage } from "@/utils/apiErrorHandling";
import { consumeKeycloakCallback, startKeycloakLogin } from "@/utils/keycloak";

// Custom TextField component for Field
const TextFieldComponent = ({
  field,
  form,
  ...props
}: {
  field: {
    name: string;
    value: string | number | null;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onBlur: (e: React.FocusEvent<HTMLInputElement>) => void;
  };
  form: {
    errors: Record<string, string>;
    touched: Record<string, boolean>;
  };
  [key: string]: unknown;
}) => (
  <TextField
    {...field}
    {...props}
    error={!!(form.errors[field.name] && form.touched[field.name])}
    helperText={
      form.errors[field.name] && form.touched[field.name]
        ? form.errors[field.name]
        : ""
    }
  />
);

export const Route = createFileRoute("/login")({
  component: observer(RouteComponent),
});

type RegistrationValues = {
  first_name_ru: string;
  last_name_ru: string;
  patronymic_ru: string | null;
  first_name_en: string;
  last_name_en: string;
  isu_id: number | "" | null;
  email: string;
};

const CYRILLIC = /[А-Яа-яЁё]/;

const registrationInitialValues = (
  prefill: RegistrationPrefill | null | undefined,
): RegistrationValues => {
  const firstName = prefill?.first_name ?? "";
  const lastName = prefill?.last_name ?? "";
  const isRussian = CYRILLIC.test(firstName + lastName);
  return {
    first_name_ru: isRussian ? firstName : "",
    last_name_ru: isRussian ? lastName : "",
    patronymic_ru: null,
    first_name_en: isRussian ? "" : firstName,
    last_name_en: isRussian ? "" : lastName,
    isu_id: null,
    email: prefill?.email ?? "",
  };
};

function RouteComponent() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const telegramAvailable = useTelegramAvailable();
  const [flow, setFlow] = useState<AuthFlowResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showLegacy, setShowLegacy] = useState(false);
  const [registrationTab, setRegistrationTab] = useState<
    "register" | "telegram" | "legacy"
  >("register");

  const pendingToken = flow?.pending_token ?? null;
  const hasIdentity = (provider: IdentityProvider) =>
    flow?.identities?.some((i) => i.provider === provider) ?? false;

  const runStep = useCallback(
    async (step: () => Promise<AuthFlowResponse>) => {
      setIsSubmitting(true);
      setError(null);
      try {
        const result = await step();
        if (result.status === "success") {
          navigate({ to: "/" });
          return;
        }
        setFlow(result);
        setShowLegacy(false);
        setRegistrationTab("register");
      } catch (error) {
        console.error("Login error:", error);
        setError(t(apiErrorMessage(error, "Unknown error")));
      } finally {
        setIsSubmitting(false);
      }
    },
    [navigate, t],
  );

  // Handle the redirect back from ITMO Keycloak
  const callbackHandled = useRef(false);
  useEffect(() => {
    if (callbackHandled.current) {
      return;
    }
    callbackHandled.current = true;
    const callback = consumeKeycloakCallback();
    if (callback === "error") {
      setError(t("ITMO login failed. Please try again."));
    } else if (callback) {
      runStep(() =>
        authStore.authKeycloak({
          code: callback.code,
          code_verifier: callback.codeVerifier,
          redirect_uri: callback.redirectUri,
          pending_token: callback.pendingToken,
        }),
      );
    }
  }, [runStep, t]);

  const handleKeycloak = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await startKeycloakLogin(pendingToken);
    } catch (error) {
      console.error("Keycloak error:", error);
      setError(t(apiErrorMessage(error, "Unknown error")));
      setIsSubmitting(false);
    }
  };

  const keycloakButton = (
    <Button
      fullWidth
      size="large"
      variant="contained"
      onClick={handleKeycloak}
      disabled={isSubmitting}
    >
      {t("Sign in with ITMO ID")}
    </Button>
  );

  const telegramButton = (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        position: "relative",
        minHeight: 40,
      }}
    >
      <TelegramLoginButton
        onAuth={(data) =>
          runStep(() =>
            authStore.authTelegram({ ...data, pending_token: pendingToken }),
          )
        }
      />
    </Box>
  );

  const legacyForm = (
    <Formik
      initialValues={{ email: "", password: "" }}
      validationSchema={Yup.object().shape({
        email: Yup.string()
          .email(t("Invalid email"))
          .required(t("Email is required")),
        password: Yup.string().required(t("Password is required")),
      })}
      onSubmit={(values) =>
        runStep(() =>
          authStore.authLegacy({ ...values, pending_token: pendingToken }),
        )
      }
    >
      <Form>
        <Typography variant="body2" color="text.secondary">
          {t("Use the email and password from the old volunteers system")}
        </Typography>
        <Field
          name="email"
          component={TextFieldComponent}
          label={t("Email")}
          fullWidth
          margin="dense"
        />
        <Field
          name="password"
          component={TextFieldComponent}
          label={t("Password")}
          type="password"
          fullWidth
          margin="dense"
        />
        <Button
          fullWidth
          variant="outlined"
          type="submit"
          disabled={isSubmitting}
          sx={{ mt: 1 }}
        >
          {t("Continue")}
        </Button>
      </Form>
    </Formik>
  );

  const registrationForm = pendingToken && (
    <Formik
      initialValues={registrationInitialValues(flow?.prefill)}
      validationSchema={Yup.object().shape({
        first_name_ru: Yup.string().required(
          t("First name on Russian is required"),
        ),
        last_name_ru: Yup.string().required(
          t("Last name on Russian is required"),
        ),
        first_name_en: Yup.string().required(
          t("First name in English is required"),
        ),
        last_name_en: Yup.string().required(
          t("Last name in English is required"),
        ),
        isu_id: Yup.number().nullable(),
        patronymic_ru: Yup.string().nullable(),
        email: Yup.string().email(t("Invalid email")),
      })}
      onSubmit={(values) =>
        runStep(() =>
          authStore.register({
            pending_token: pendingToken,
            first_name_ru: values.first_name_ru,
            last_name_ru: values.last_name_ru,
            patronymic_ru: values.patronymic_ru || null,
            first_name_en: values.first_name_en,
            last_name_en: values.last_name_en,
            ...(values.isu_id != null && values.isu_id !== ""
              ? { isu_id: values.isu_id }
              : {}),
            email: values.email || null,
          }),
        )
      }
    >
      <Form>
        <Field
          name="first_name_ru"
          component={TextFieldComponent}
          label={t("Name on Russian")}
          fullWidth
          margin="dense"
        />
        <Field
          name="last_name_ru"
          component={TextFieldComponent}
          label={t("Surname on Russian")}
          fullWidth
          margin="dense"
        />
        <Field
          name="patronymic_ru"
          component={TextFieldComponent}
          label={t("Patronymic on Russian")}
          fullWidth
          margin="dense"
        />
        <Field
          name="first_name_en"
          component={TextFieldComponent}
          label={t("First name in English")}
          fullWidth
          margin="dense"
        />
        <Field
          name="last_name_en"
          component={TextFieldComponent}
          label={t("Last name in English")}
          fullWidth
          margin="dense"
        />
        <Field
          name="isu_id"
          component={TextFieldComponent}
          label={t("ISU Number")}
          fullWidth
          margin="dense"
        />
        <Field
          name="email"
          component={TextFieldComponent}
          label={t("Email")}
          fullWidth
          margin="dense"
        />
        <Button
          fullWidth
          variant="contained"
          type="submit"
          disabled={isSubmitting}
          sx={{ mt: 1 }}
        >
          {isSubmitting ? t("Logging in...") : t("Register")}
        </Button>
      </Form>
    </Formik>
  );

  const legacyToggle = (
    <>
      <Link
        component="button"
        type="button"
        variant="body2"
        underline="hover"
        onClick={() => setShowLegacy((v) => !v)}
      >
        {t("I have an account in the old volunteers system")}
      </Link>
      {showLegacy && legacyForm}
    </>
  );

  let description: string;
  let content: React.ReactNode;
  if (flow === null) {
    description = telegramAvailable
      ? t("Sign in with your ITMO account or Telegram")
      : t("Sign in with your ITMO account");
    content = (
      <>
        {keycloakButton}
        {telegramAvailable && (
          <>
            <Divider>{t("or")}</Divider>
            {telegramButton}
          </>
        )}
        {legacyToggle}
      </>
    );
  } else if (flow.status === "keycloak_required") {
    description = flow.user_found
      ? t(
          "Your account is found. To finish signing in, link your ITMO account.",
        )
      : t(
          "We couldn't find your account. Sign in with your ITMO account to continue, or use your account from the old volunteers system.",
        );
    content = (
      <>
        {keycloakButton}
        {!flow.user_found && !hasIdentity("legacy") && legacyToggle}
      </>
    );
  } else {
    description = t(
      "We couldn't find your account. Register a new one, or link your existing account.",
    );
    content = (
      <>
        <Tabs
          value={registrationTab}
          onChange={(_, value) => {
            setRegistrationTab(value);
            setError(null);
          }}
          variant="fullWidth"
        >
          <Tab label={t("Register")} value="register" />
          {telegramAvailable && !hasIdentity("telegram") && (
            <Tab label="Telegram" value="telegram" />
          )}
          <Tab label={t("Old account")} value="legacy" />
        </Tabs>
        {registrationTab === "register" && registrationForm}
        {registrationTab === "telegram" && telegramAvailable && (
          <>
            <Typography variant="body2" color="text.secondary">
              {t("Sign in with the Telegram account linked to your profile")}
            </Typography>
            {telegramButton}
          </>
        )}
        {registrationTab === "legacy" && legacyForm}
      </>
    );
  }

  return (
    <Container
      maxWidth="sm"
      sx={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "stretch",
        flexDirection: "column",
        gap: 2,
        py: 2,
      }}
    >
      <Paper elevation={3} sx={{ p: 4, textAlign: "center" }}>
        <Typography variant="h4" component="h1" gutterBottom>
          {t("Login")}
        </Typography>
        <Typography variant="body1" gutterBottom>
          {description}
        </Typography>
        {flow && (flow.identities?.length ?? 0) > 0 && (
          <Stack
            direction="row"
            spacing={1}
            useFlexGap
            sx={{ justifyContent: "center", flexWrap: "wrap", my: 1 }}
          >
            {flow.identities?.map((identity) => (
              <Chip
                key={identity.provider}
                color="success"
                variant="outlined"
                label={
                  identity.display_name
                    ? `${t(PROVIDER_NAMES[identity.provider])}: ${identity.display_name}`
                    : t(PROVIDER_NAMES[identity.provider])
                }
              />
            ))}
          </Stack>
        )}
        <Stack spacing={2} sx={{ mt: 3, textAlign: "left" }}>
          {content}
        </Stack>
        {flow && (
          <Button
            sx={{ mt: 2 }}
            size="small"
            onClick={() => {
              setFlow(null);
              setError(null);
            }}
          >
            {t("Start over")}
          </Button>
        )}
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
        <AuthMethodsInfo />
      </Paper>
    </Container>
  );
}
