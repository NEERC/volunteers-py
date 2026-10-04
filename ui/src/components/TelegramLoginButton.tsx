import { LinearProgress } from "@mui/material";
import { useEffect, useRef, useState } from "react";
import type { TelegramLoginData } from "@/client";
import { TELEGRAM_BOT_HANDLE, TELEGRAM_BOT_ORIGIN } from "@/const";

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

export function TelegramLoginButton({
  onAuth,
}: {
  onAuth: (data: TelegramLoginData) => void;
}) {
  const telegramRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const onAuthRef = useRef(onAuth);
  onAuthRef.current = onAuth;

  useEffect(() => {
    const listener = (event: MessageEvent) => {
      if (
        !telegramRef.current ||
        event.source !== telegramRef.current.contentWindow
      ) {
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
        onAuthRef.current({
          telegram_id: data.auth_data.id,
          telegram_auth_date: data.auth_data.auth_date,
          telegram_first_name: data.auth_data.first_name,
          telegram_last_name: data.auth_data.last_name,
          telegram_photo_url: data.auth_data.photo_url,
          telegram_username: data.auth_data.username,
          telegram_hash: data.auth_data.hash,
        });
      }
    };
    window.addEventListener("message", listener);
    return () => {
      window.removeEventListener("message", listener);
    };
  }, []);

  return (
    <>
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
    </>
  );
}
