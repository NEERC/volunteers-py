import { Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { IdentityProvider } from "@/client";
import { PROVIDER_NAMES } from "@/const";
import { useCountry, useTelegramAvailable } from "@/data/use-auth";

const countryName = (code: string, language: string) => {
  try {
    return new Intl.DisplayNames([language], { type: "region" }).of(code);
  } catch {
    return code;
  }
};

export function AuthMethodsInfo() {
  const { t, i18n } = useTranslation();
  const { data } = useCountry();
  const telegramAvailable = useTelegramAvailable();

  if (!data) {
    return null;
  }

  const authMethods: IdentityProvider[] = telegramAvailable
    ? ["keycloak", "telegram", "legacy"]
    : ["keycloak", "legacy"];

  return (
    <Typography variant="body2" color="text.secondary">
      {t("Your country")}:{" "}
      {data.country_code
        ? countryName(data.country_code, i18n.language)
        : t("not determined")}
      . {t("The following sign-in methods are available to you")}:{" "}
      {authMethods.map((m) => t(PROVIDER_NAMES[m])).join(", ")}
    </Typography>
  );
}
