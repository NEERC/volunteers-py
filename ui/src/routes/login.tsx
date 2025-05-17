import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react';
import { Box, Container, Typography, Link, Paper, LinearProgress, Alert, TextField } from '@mui/material';
import { authStore, UserNotFoundError } from '@/store/auth';
import { observer } from 'mobx-react-lite';
import { Formik, Form, Field, FormikProvider, useFormik } from 'formik';
import * as Yup from 'yup';

export const Route = createFileRoute('/login')({
    component: observer(RouteComponent),
})

type TelegramEvent = {
    event: 'auth_user'
    auth_data: {
        id: number
        first_name: string
        last_name: string
        username: string | null
        photo_url: string
        auth_date: number
        hash: string
    }
} | {
    event: 'ready'
} | {
    event: 'resize',
    width: number
    height: number
}

function RouteComponent() {
    const telegramRef = useRef<HTMLIFrameElement>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [shouldRegister, setShouldRegister] = useState(false)

    const regForm = useFormik({
        initialValues: {
            first_name_ru: '',
            last_name_ru: '',
            patronymic_ru: null,
            full_name_en: '',
            isu_id: null,
        },
        validationSchema: Yup.object().shape({
            first_name_ru: Yup.string().required('First name is required'),
            last_name_ru: Yup.string().required('Last name is required'),
            full_name_en: Yup.string().required('Full name is required'),
            isu_id: Yup.number().nullable(),
            patronymic_ru: Yup.string().nullable(),
        }),
        onSubmit: (values) => {
            console.log(values)
        }
    })

    useEffect(() => {
        const listener = async (event: MessageEvent) => {
            console.info(event)
            if (event.source !== telegramRef.current?.contentWindow) {
                return;
            }

            const data = JSON.parse(event.data) as TelegramEvent;
            if (data.event === 'resize') {
                telegramRef.current!.style.width = `${data.width}px`
                telegramRef.current!.style.height = `${data.height}px`
            }
            if (data.event === 'ready') {
                setIsLoading(false)
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
                }
                try {
                    if (shouldRegister) {
                        return await authStore.registerTelegram({
                            ...telegramData,
                            first_name_ru: regForm.values.first_name_ru,
                            last_name_ru: regForm.values.last_name_ru,
                            full_name_en: regForm.values.full_name_en,
                            isu_id: regForm.values.isu_id,
                            patronymic_ru: regForm.values.patronymic_ru,
                        })
                    }
                    await authStore.loginTelegram(telegramData)
                } catch (error) {
                    if (error instanceof UserNotFoundError) {
                        setShouldRegister(true)
                    } else {
                        setError(error instanceof Error ? error.message : 'Unknown error')
                    }
                }
            }
        };
        window.addEventListener("message", listener);
        return () => {
            window.removeEventListener("message", listener);
        };
    }, [regForm, shouldRegister]);

    return (
        <Container maxWidth="sm" sx={{ height: '100vh', display: 'flex', alignItems: 'center' }}>
            <Paper elevation={3} sx={{ p: 4, width: '100%', textAlign: 'center' }}>
                <Typography variant="h4" component="h1" gutterBottom>
                    Login with Telegram
                </Typography>
                {!shouldRegister ? (
                    <>
                        <Typography variant="body1" gutterBottom>
                            Click the button below to authenticate
                        </Typography>
                        {authStore.user && (
                            <Typography variant="body1" gutterBottom>
                                {authStore.user.user_id}
                                {JSON.stringify(authStore.user)}
                            </Typography>
                        )}
                        <Typography variant="body2">
                            Don't have Telegram?{' '}
                            <Link href="https://telegram.org/" target="_blank" underline="hover">
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
                                />
                                <TextField
                                    name="last_name_ru"
                                    label="Фамилия на русском"
                                    fullWidth
                                />
                                <TextField
                                    name="patronymic_ru"
                                    label="Отчество на русском"
                                    fullWidth
                                />
                                <TextField
                                    name="full_name_en"
                                    label="Full name in English"
                                    fullWidth
                                />
                                <TextField
                                    name="isu_id"
                                    label="Номер ИСУ"
                                    fullWidth
                                />
                            </Form>
                        </FormikProvider>
                    </>
                )}
                <Box sx={{ my: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative', minHeight: 40 }}>
                    {isLoading && <LinearProgress sx={{ width: '240px' }} />}
                    <iframe
                        id="telegram-login-nerc_volunteers_bot"
                        src="https://oauth.telegram.org/embed/nerc_volunteers_bot?origin=https%3A%2F%2Fnerc-volunteers.itmo.ru&amp;return_to=https%3A%2F%2Fnerc-volunteers.itmo.ru%2F&amp;size=large&amp;request_access=write"
                        height={40}
                        seamless={true}
                        style={{
                            overflow: 'hidden',
                            colorScheme: 'light dark',
                            border: 'none',
                            opacity: isLoading ? 0 : 1,
                            position: isLoading ? 'absolute' : 'relative',
                        }}
                        ref={telegramRef}
                    />
                </Box>
                {error && (
                    <Alert severity="error">
                        {error}
                    </Alert>
                )}
            </Paper>
        </Container>
    );
}
