import {
  Alert,
  Box,
  Button,
  Container,
  LinearProgress,
  Link,
  Paper,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Field, Form, Formik } from "formik";
import { observer } from "mobx-react-lite";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import * as Yup from "yup";
import type { TelegramLoginRequest } from "@/client";
import { TELEGRAM_BOT_HANDLE, TELEGRAM_BOT_ORIGIN } from "@/const";
import { authStore, UserNotFoundError } from "@/store/auth";

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

type TelegramEvent =
  | {
      event: "auth_user";
      auth_data: {
        id: number;
        first_name: string;
        last_name: string;
        username: string | null;
        photo_url: string;
        auth_date: number;
        hash: string;
      };
    }
  | {
      event: "ready";
    }
  | {
      event: "resize";
      width: number;
      height: number;
    };

function RouteComponent() {
  const { t } = useTranslation();
  const registerFormId = useId();
  const migrateFormId = useId();
  const telegramRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authFlow, setAuthFlow] = useState<"login" | "register" | "migrate">(
    "login",
  );
  const [storedTelegramData, setStoredTelegramData] =
    useState<TelegramLoginRequest | null>(null);
  const [isRegisterSubmitting, setIsRegisterSubmitting] = useState(false);
  const [isMigrateSubmitting, setIsMigrateSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleRegisterSubmit = async (values: {
    first_name_ru: string;
    last_name_ru: string;
    patronymic_ru: string | null;
    full_name_en: string;
    isu_id: number | "" | null;
  }) => {
    setIsRegisterSubmitting(true);
    setError(null); // Clear any previous errors
    try {
      if (!storedTelegramData) {
        setAuthFlow("login");
        setError(t("Please, log in again"));
        throw new Error("No Telegram data stored");
      }
      await authStore.registerTelegram({
        ...storedTelegramData,
        first_name_ru: values.first_name_ru,
        last_name_ru: values.last_name_ru,
        ...(values.isu_id != null && values.isu_id !== ""
          ? { isu_id: values.isu_id }
          : {}),
        full_name_en: values.full_name_en,
        patronymic_ru: values.patronymic_ru,
      });
      navigate({ to: "/" });
    } catch (error) {
      console.error("Registration error:", error);
      setError(
        error instanceof Error
          ? error.message
          : t("Registration failed. Please try again."),
      );
    } finally {
      setIsRegisterSubmitting(false);
    }
  };

  const handleMigrateSubmit = async (values: {
    email: string;
    password: string;
  }) => {
    setIsMigrateSubmitting(true);
    setError(null); // Clear any previous errors
    try {
      if (!storedTelegramData) {
        setAuthFlow("login");
        setError(t("Please, log in again"));
        throw new Error("No Telegram data stored");
      }
      await authStore.migrateTelegram({
        ...storedTelegramData,
        email: values.email,
        password: values.password,
      });
      navigate({ to: "/" });
    } catch (error) {
      console.error("Migration error:", error);
      setError(
        error instanceof Error
          ? error.message
          : t("Migration failed. Please try again."),
      );
    } finally {
      setIsMigrateSubmitting(false);
    }
  };

  useEffect(() => {
    const listener = async (event: MessageEvent) => {
      if (event.source !== telegramRef.current?.contentWindow) {
        return;
      }

      if (!telegramRef.current) {
        return;
      }

      const data = JSON.parse(event.data) as TelegramEvent;
      if (data.event === "resize") {
        telegramRef.current.style.width = `${data.width}px`;
        telegramRef.current.style.height = `${data.height}px`;
      }
      if (data.event === "ready") {
        setIsLoading(false);
      }
      if (data.event === "auth_user") {
        const loginData = {
          telegram_id: data.auth_data.id,
          telegram_auth_date: data.auth_data.auth_date,
          telegram_first_name: data.auth_data.first_name,
          telegram_last_name: data.auth_data.last_name,
          telegram_photo_url: data.auth_data.photo_url,
          telegram_username: data.auth_data.username,
          telegram_hash: data.auth_data.hash,
        };
        try {
          await authStore.loginTelegram(loginData);
          navigate({ to: "/" });
        } catch (error) {
          if (error instanceof UserNotFoundError) {
            setStoredTelegramData(loginData);
            setAuthFlow("migrate");
          } else {
            setError(error instanceof Error ? error.message : "Unknown error");
          }
        }
      }
    };
    window.addEventListener("message", listener);
    return () => {
      window.removeEventListener("message", listener);
    };
  }, [navigate]);

  return (
    <Container
      maxWidth="sm"
      sx={{
        height: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "stretch",
        flexDirection: "column",
        gap: 2,
      }}
    >
      <Paper elevation={3} sx={{ p: 4, textAlign: "center" }}>
        <Typography variant="h4" component="h1" gutterBottom>
          {t("Login with Telegram")}
        </Typography>
        {authFlow === "login" ? (
          <>
            <Typography variant="body1" gutterBottom>
              {t("Click the button below to authenticate")}
            </Typography>
            <Typography variant="body2">
              {t("Don't have Telegram?")}{" "}
              <Link
                href="https://telegram.org/"
                target="_blank"
                underline="hover"
              >
                {t("Download it here")}
              </Link>
            </Typography>
          </>
        ) : (
          <>
            <Typography variant="body1" gutterBottom>
              {t(
                "We couldn't find your account. Either migrate your email and password account, or create a new one.",
              )}
            </Typography>
            <Tabs
              value={authFlow}
              onChange={(_, value) => {
                setAuthFlow(value);
                setError(null); // Clear errors when switching tabs
              }}
            >
              <Tab label={t("Migrate")} value="migrate" />
              <Tab label={t("Register")} value="register" />
              <Tab label={t("Login")} value="login" />
            </Tabs>
            {authFlow === "register" && (
              <Formik
                initialValues={{
                  first_name_ru: "",
                  last_name_ru: "",
                  patronymic_ru: null,
                  full_name_en: "",
                  isu_id: null,
                }}
                validationSchema={Yup.object().shape({
                  first_name_ru: Yup.string().required(
                    t("First name on Russian is required"),
                  ),
                  last_name_ru: Yup.string().required(
                    t("Last name on Russian is required"),
                  ),
                  full_name_en: Yup.string().required(
                    t("Full name in English is required"),
                  ),
                  isu_id: Yup.number().nullable(),
                  patronymic_ru: Yup.string().nullable(),
                })}
                onSubmit={handleRegisterSubmit}
              >
                {() => (
                  <Form id={registerFormId}>
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
                      name="full_name_en"
                      component={TextFieldComponent}
                      label={t("Full name in English")}
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
                  </Form>
                )}
              </Formik>
            )}
            {authFlow === "migrate" && (
              <Formik
                initialValues={{
                  email: "",
                  password: "",
                }}
                validationSchema={Yup.object().shape({
                  email: Yup.string()
                    .email(t("Invalid email"))
                    .required(t("Email is required")),
                  password: Yup.string().required(t("Password is required")),
                })}
                onSubmit={handleMigrateSubmit}
              >
                {() => (
                  <Form id={migrateFormId}>
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
                  </Form>
                )}
              </Formik>
            )}
            {error && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {error}
              </Alert>
            )}
          </>
        )}
        <Box
          sx={{
            my: 3,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            position: "relative",
            minHeight: 40,
          }}
        >
          {isLoading && <LinearProgress sx={{ width: "200px" }} />}
          {storedTelegramData && authFlow !== "login" ? (
            <Button
              fullWidth
              variant="contained"
              type="submit"
              form={authFlow === "register" ? registerFormId : migrateFormId}
              disabled={isRegisterSubmitting || isMigrateSubmitting}
            >
              {isRegisterSubmitting || isMigrateSubmitting
                ? t("Logging in...")
                : t("Continue")}
            </Button>
          ) : (
            <iframe
              id={`telegram-login-${TELEGRAM_BOT_HANDLE}`}
              title="Telegram login"
              src={`https://oauth.telegram.org/embed/${TELEGRAM_BOT_HANDLE}?origin=${TELEGRAM_BOT_ORIGIN}&return_to=${TELEGRAM_BOT_ORIGIN}&size=medium&request_access=write`}
              height={40}
              seamless={true}
              style={{
                overflow: "hidden",
                colorScheme: "light dark",
                border: "none",
                opacity: isLoading ? 0 : 1,
                position: isLoading ? "absolute" : "relative",
              }}
              ref={telegramRef}
            />
          )}
        </Box>
      </Paper>
    </Container>
  );
}
