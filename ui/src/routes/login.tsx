import {
  Alert,
  Box,
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
import { Form, FormikProvider, useFormik } from "formik";
import { observer } from "mobx-react-lite";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import * as Yup from "yup";
import { TELEGRAM_BOT_HANDLE, TELEGRAM_BOT_ORIGIN } from "@/const";
import { authStore, UserNotFoundError } from "@/store/auth";

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
  const telegramRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authFlow, setAuthFlow] = useState<"login" | "register" | "migrate">(
    "login",
  );
  const navigate = useNavigate();

  const regForm = useFormik({
    initialValues: {
      first_name_ru: "",
      last_name_ru: "",
      patronymic_ru: null,
      full_name_en: "",
      isu_id: null,
    },
    validationSchema: Yup.object().shape({
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
    }),
    onSubmit: (values) => {
      console.log(values);
    },
  });

  const migrateForm = useFormik({
    initialValues: {
      email: "",
      password: "",
    },
    validationSchema: Yup.object().shape({
      email: Yup.string()
        .email(t("Invalid email"))
        .required(t("Email is required")),
      password: Yup.string().required(t("Password is required")),
    }),
    onSubmit: (values) => {
      console.log(values);
    },
  });

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
        const telegramData = {
          telegram_id: data.auth_data.id,
          telegram_auth_date: data.auth_data.auth_date,
          telegram_first_name: data.auth_data.first_name,
          telegram_last_name: data.auth_data.last_name,
          telegram_photo_url: data.auth_data.photo_url,
          telegram_username: data.auth_data.username,
          telegram_hash: data.auth_data.hash,
        };
        try {
          if (authFlow === "register") {
            const errors = await regForm.validateForm();
            if (Object.keys(errors).length > 0) {
              return;
            }
            await authStore.registerTelegram({
              ...telegramData,
              first_name_ru: regForm.values.first_name_ru,
              last_name_ru: regForm.values.last_name_ru,
              isu_id: regForm.values.isu_id,
              full_name_en: regForm.values.full_name_en,
              patronymic_ru: regForm.values.patronymic_ru,
            });
          } else if (authFlow === "migrate") {
            const errors = await migrateForm.validateForm();
            if (Object.keys(errors).length > 0) {
              return;
            }
            await authStore.migrateTelegram({
              ...telegramData,
              email: migrateForm.values.email,
              password: migrateForm.values.password,
            });
          } else {
            await authStore.loginTelegram(telegramData);
          }
          navigate({ to: "/" });
        } catch (error) {
          if (error instanceof UserNotFoundError) {
            setAuthFlow("migrate");
          } else {
            console.error(error);
            setError(error instanceof Error ? error.message : "Unknown error");
          }
        }
      }
    };
    window.addEventListener("message", listener);
    return () => {
      window.removeEventListener("message", listener);
    };
  }, [regForm, migrateForm, authFlow, navigate]);

  return (
    <Container
      maxWidth="sm"
      sx={{
        height: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
        gap: 2,
      }}
    >
      <Paper elevation={3} sx={{ p: 4, width: "100%", textAlign: "center" }}>
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
            <Tabs value={authFlow} onChange={(_, value) => setAuthFlow(value)}>
              <Tab label={t("Migrate")} value="migrate" />
              <Tab label={t("Register")} value="register" />
              <Tab label={t("Login")} value="login" />
            </Tabs>
            {authFlow === "register" && (
              <FormikProvider value={regForm}>
                <Form>
                  <TextField
                    name="first_name_ru"
                    label={t("Name on Russian")}
                    fullWidth
                    margin="dense"
                    onChange={regForm.handleChange}
                    value={regForm.values.first_name_ru}
                    error={!!regForm.errors.first_name_ru}
                    helperText={regForm.errors.first_name_ru}
                  />
                  <TextField
                    name="last_name_ru"
                    label={t("Surname on Russian")}
                    fullWidth
                    margin="dense"
                    onChange={regForm.handleChange}
                    value={regForm.values.last_name_ru}
                    error={!!regForm.errors.last_name_ru}
                    helperText={regForm.errors.last_name_ru}
                  />
                  <TextField
                    name="patronymic_ru"
                    label={t("Patronymic on Russian")}
                    fullWidth
                    margin="dense"
                    onChange={regForm.handleChange}
                    value={regForm.values.patronymic_ru}
                    error={!!regForm.errors.patronymic_ru}
                    helperText={regForm.errors.patronymic_ru}
                  />
                  <TextField
                    name="full_name_en"
                    label={t("Full name in English")}
                    fullWidth
                    margin="dense"
                    onChange={regForm.handleChange}
                    value={regForm.values.full_name_en}
                    error={!!regForm.errors.full_name_en}
                    helperText={regForm.errors.full_name_en}
                  />
                  <TextField
                    name="isu_id"
                    label={t("ISU Number")}
                    fullWidth
                    margin="dense"
                    onChange={regForm.handleChange}
                    value={regForm.values.isu_id}
                    error={!!regForm.errors.isu_id}
                    helperText={regForm.errors.isu_id}
                  />
                </Form>
              </FormikProvider>
            )}
            {authFlow === "migrate" && (
              <FormikProvider value={migrateForm}>
                <Form>
                  <TextField
                    name="email"
                    label={t("Email")}
                    fullWidth
                    margin="dense"
                    onChange={migrateForm.handleChange}
                    value={migrateForm.values.email}
                    error={!!migrateForm.errors.email}
                    helperText={migrateForm.errors.email}
                  />
                  <TextField
                    name="password"
                    label={t("Password")}
                    type="password"
                    fullWidth
                    margin="dense"
                    onChange={migrateForm.handleChange}
                    value={migrateForm.values.password}
                    error={!!migrateForm.errors.password}
                    helperText={migrateForm.errors.password}
                  />
                </Form>
              </FormikProvider>
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
        </Box>
        {error && <Alert severity="error">{error}</Alert>}
      </Paper>
    </Container>
  );
}
