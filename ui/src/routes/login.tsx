import { UserNotFoundError, authStore } from "@/store/auth";
import {
  Alert,
  Box,
  Container,
  LinearProgress,
  Link,
  Paper,
  TextField,
  Typography,
} from "@mui/material";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Form, FormikProvider, useFormik } from "formik";
import { observer } from "mobx-react-lite";
import { useEffect, useRef, useState } from "react";
import * as Yup from "yup";

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
  const telegramRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shouldRegister, setShouldRegister] = useState(false);
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
      first_name_ru: Yup.string().required("Имя на русском обязательно"),
      last_name_ru: Yup.string().required("Фамилия на русском обязательна"),
      full_name_en: Yup.string().required("Full name in English is required"),
      isu_id: Yup.number().nullable(),
      patronymic_ru: Yup.string().nullable(),
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
          if (shouldRegister) {
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
          } else {
            await authStore.loginTelegram(telegramData);
          }
          navigate({ to: "/" });
        } catch (error) {
          if (error instanceof UserNotFoundError) {
            setShouldRegister(true);
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
  }, [regForm, shouldRegister, navigate]);

  return (
    <Container
      maxWidth="sm"
      sx={{ height: "100vh", display: "flex", alignItems: "center" }}
    >
      <Paper elevation={3} sx={{ p: 4, width: "100%", textAlign: "center" }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Login with Telegram
        </Typography>
        {!shouldRegister ? (
          <>
            <Typography variant="body1" gutterBottom>
              Click the button below to authenticate
            </Typography>
            <Typography variant="body2">
              Don't have Telegram?{" "}
              <Link
                href="https://telegram.org/"
                target="_blank"
                underline="hover"
              >
                Download it here
              </Link>
            </Typography>
          </>
        ) : (
          <>
            <Typography variant="body1" gutterBottom>
              It looks like you don't have an account yet. Please register.
            </Typography>
            <FormikProvider value={regForm}>
              <Form>
                <TextField
                  name="first_name_ru"
                  label="Имя на русском"
                  fullWidth
                  margin="dense"
                  onChange={regForm.handleChange}
                  value={regForm.values.first_name_ru}
                  error={!!regForm.errors.first_name_ru}
                  helperText={regForm.errors.first_name_ru}
                />
                <TextField
                  name="last_name_ru"
                  label="Фамилия на русском"
                  fullWidth
                  margin="dense"
                  onChange={regForm.handleChange}
                  value={regForm.values.last_name_ru}
                  error={!!regForm.errors.last_name_ru}
                  helperText={regForm.errors.last_name_ru}
                />
                <TextField
                  name="patronymic_ru"
                  label="Отчество на русском"
                  fullWidth
                  margin="dense"
                  onChange={regForm.handleChange}
                  value={regForm.values.patronymic_ru}
                  error={!!regForm.errors.patronymic_ru}
                  helperText={regForm.errors.patronymic_ru}
                />
                <TextField
                  name="full_name_en"
                  label="Full name in English"
                  fullWidth
                  margin="dense"
                  onChange={regForm.handleChange}
                  value={regForm.values.full_name_en}
                  error={!!regForm.errors.full_name_en}
                  helperText={regForm.errors.full_name_en}
                />
                <TextField
                  name="isu_id"
                  label="Номер ИСУ"
                  fullWidth
                  margin="dense"
                  onChange={regForm.handleChange}
                  value={regForm.values.isu_id}
                  error={!!regForm.errors.isu_id}
                  helperText={regForm.errors.isu_id}
                />
              </Form>
            </FormikProvider>
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
            id="telegram-login-nerc_volunteers_bot"
            title="Telegram login"
            src="https://oauth.telegram.org/embed/nerc_volunteers_bot?origin=https%3A%2F%2Fnerc-volunteers.itmo.ru&amp;return_to=https%3A%2F%2Fnerc-volunteers.itmo.ru%2F&amp;size=medium&amp;request_access=write"
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
