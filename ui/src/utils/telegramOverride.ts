import { useSyncExternalStore } from "react";

// Typing this anywhere on the page enables Telegram login regardless of the country
const SECRET = "trustme";
const STORAGE_KEY = "telegramOverride";

const readStored = () => {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
};

let enabled = readStored();
let typed = "";
const listeners = new Set<() => void>();

const onKeyDown = (event: KeyboardEvent) => {
  if (enabled || event.key.length !== 1) {
    return;
  }
  typed = (typed + event.key.toLowerCase()).slice(-SECRET.length);
  if (typed !== SECRET) {
    return;
  }
  enabled = true;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // Keep the override for this page load only
  }
  for (const listener of listeners) {
    listener();
  }
};

const subscribe = (listener: () => void) => {
  if (listeners.size === 0) {
    window.addEventListener("keydown", onKeyDown);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.removeEventListener("keydown", onKeyDown);
    }
  };
};

/** Whether the user has unlocked Telegram login by typing the secret word. */
export const useTelegramOverride = () =>
  useSyncExternalStore(subscribe, () => enabled);
