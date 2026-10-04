import { Link, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { PROVIDER_NAMES } from "@/const";
import { useCountry } from "@/data/use-auth";

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

  if (!data) {
    return null;
  }

  return (
    <>
      <Typography variant="body2" color="text.secondary">
        {t("Your country")}:{" "}
        {data.country_code
          ? countryName(data.country_code, i18n.language)
          : t("not determined")}
        . {t("The following sign-in methods are available to you")}:{" "}
        {data.auth_methods.map((m) => t(PROVIDER_NAMES[m])).join(", ")}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        <Link
          href="https://db-ip.com"
          target="_blank"
          rel="noopener"
          underline="hover"
          color="inherit"
        >
          {t("IP Geolocation by DB-IP")}
        </Link>
      </Typography>
    </>
  );
}
