import type { AssignmentMode, MailingFilter } from "@/client/types.gen";
import { authStore } from "@/store/auth";

export type PrintTemplateSummary = {
  template_id: number;
  year_id: number;
  title: string;
};

export type PrintAsset = {
  asset_id: number;
  file_name: string;
  content_type: string;
  size: number;
};

export type PrintTemplate = PrintTemplateSummary & {
  source: string;
  assets: PrintAsset[];
};

export type PrintContext = {
  day_id: number;
  filter: MailingFilter;
  assignment_mode: AssignmentMode;
  excluded_form_ids: number[];
};

export type PrintRecipient = {
  form_id: number;
  user_day_id: number;
  name: string;
};

export function templatesPath(yearId: string) {
  return `/api/v1/admin/print-template/year/${yearId}`;
}

export function jsonBody(data: object): Pick<RequestInit, "body" | "headers"> {
  return {
    body: JSON.stringify(data),
    headers: { "Content-Type": "application/json" },
  };
}

export async function printRequest(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${authStore.getAccessToken()}`);
  const response = await fetch(path, { ...init, headers });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(
      typeof body?.detail === "string"
        ? body.detail
        : body?.description || `HTTP ${response.status}`,
    );
  }
  return response;
}

export async function printJson<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  return (await printRequest(path, init)).json();
}
