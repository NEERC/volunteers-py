import { authStore } from "@/store/auth";

export type ServerSentEvent = {
  id?: string;
  event: string;
  data: string;
};

const RECONNECT_DELAY_MS = 2000;

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve();
    });
  });

/** URL of an API path (as in the generated client, "/api/v1/...") under the base path. */
export const apiUrl = (path: string) =>
  `${import.meta.env.BASE_URL.replace(/\/$/, "")}${path}`;

/**
 * Reads server-sent events with fetch, as EventSource can't send the Authorization header.
 * Reconnects with Last-Event-ID after network errors, until the server sends an `end` event,
 * the request fails with a client error or the signal is aborted.
 */
export async function streamEvents(
  path: string,
  {
    signal,
    onEvent,
    onError,
  }: {
    signal: AbortSignal;
    onEvent: (event: ServerSentEvent) => void;
    onError?: (error: Error) => void;
  },
): Promise<void> {
  let lastEventId: string | undefined;
  let refreshed = false;

  while (!signal.aborted) {
    try {
      const headers: Record<string, string> = { Accept: "text/event-stream" };
      const token = authStore.getAccessToken();
      if (token) headers.Authorization = `Bearer ${token}`;
      if (lastEventId) headers["Last-Event-ID"] = lastEventId;

      const response = await fetch(apiUrl(path), { headers, signal });
      if (response.status === 401 && !refreshed) {
        refreshed = true;
        await authStore.refresh();
        continue;
      }
      if (response.status >= 400 && response.status < 500) {
        onError?.(new Error(`HTTP ${response.status}`));
        return;
      }
      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status}`);
      }
      refreshed = false;

      const reader = response.body
        .pipeThrough(new TextDecoderStream())
        .getReader();
      let buffer = "";
      let event: ServerSentEvent = { event: "message", data: "" };
      let data: string[] = [];
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (line === "") {
            if (data.length > 0) {
              event.data = data.join("\n");
              if (event.id) lastEventId = event.id;
              if (event.event === "end") return;
              onEvent(event);
            }
            event = { event: "message", data: "" };
            data = [];
            continue;
          }
          if (line.startsWith(":")) continue;
          const colon = line.indexOf(":");
          const field = colon === -1 ? line : line.slice(0, colon);
          const fieldValue =
            colon === -1 ? "" : line.slice(colon + 1).replace(/^ /, "");
          if (field === "data") data.push(fieldValue);
          else if (field === "event") event.event = fieldValue;
          else if (field === "id") event.id = fieldValue;
        }
      }
    } catch (error) {
      if (signal.aborted) return;
      console.warn("Event stream interrupted, reconnecting", error);
    }
    await sleep(RECONNECT_DELAY_MS, signal);
  }
}
