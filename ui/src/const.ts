import type { IdentityProvider } from "@/client";

/**
 * Configuration of the deployment, written to config.js by the frontend container on start
 * (see docker-entrypoint.sh), so one image serves every environment. In development
 * config.js is empty and the Vite env is used.
 */
type RuntimeConfig = {
  mode?: string;
  telegramBotHandle?: string;
  telegramBotOrigin?: string;
};

declare global {
  interface Window {
    __VMS_CONFIG__?: RuntimeConfig;
  }
}

const runtimeConfig = window.__VMS_CONFIG__ ?? {};

export const MODE = runtimeConfig.mode || import.meta.env.MODE;
export const TELEGRAM_BOT_HANDLE =
  runtimeConfig.telegramBotHandle || import.meta.env.VITE_TELEGRAM_BOT_HANDLE;
export const TELEGRAM_BOT_ORIGIN =
  runtimeConfig.telegramBotOrigin || import.meta.env.VITE_TELEGRAM_BOT_ORIGIN;

// Translation keys of identity provider names
export const PROVIDER_NAMES: Record<IdentityProvider, string> = {
  telegram: "Telegram",
  keycloak: "ITMO ID",
  legacy: "Old account",
};
