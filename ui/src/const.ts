import type { IdentityProvider } from "@/client";

export const TELEGRAM_BOT_HANDLE = import.meta.env.VITE_TELEGRAM_BOT_HANDLE;
export const TELEGRAM_BOT_ORIGIN = import.meta.env.VITE_TELEGRAM_BOT_ORIGIN;

// Translation keys of identity provider names
export const PROVIDER_NAMES: Record<IdentityProvider, string> = {
  telegram: "Telegram",
  keycloak: "ITMO ID",
  legacy: "Old account",
};
