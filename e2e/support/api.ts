import { readFileSync } from "node:fs";
import {
  type APIRequestContext,
  type APIResponse,
  request,
} from "@playwright/test";
import { BACKEND_URL } from "../stack.config.mjs";
import { authFile } from "./users";

/** Reads the refresh token saved by the setup project for the user. */
function refreshTokenOf(key: string): string {
  const state = JSON.parse(readFileSync(authFile(key), "utf8")) as {
    origins: { localStorage: { name: string; value: string }[] }[];
  };
  for (const origin of state.origins) {
    const item = origin.localStorage.find((i) => i.name === "AuthStore");
    if (item) {
      return JSON.parse(item.value).refreshToken;
    }
  }
  throw new Error(`No refresh token in ${authFile(key)}`);
}

async function ok<T>(response: APIResponse): Promise<T> {
  if (!response.ok()) {
    throw new Error(
      `${response.url()} -> ${response.status()}: ${await response.text()}`,
    );
  }
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/**
 * Backend API client authorized as one of the setup users. Used to prepare
 * preconditions quickly; the behaviour under test is exercised through the UI.
 */
export class Api {
  private constructor(private readonly ctx: APIRequestContext) {}

  static async as(key: string): Promise<Api> {
    const anon = await request.newContext({ baseURL: BACKEND_URL });
    const { token } = await ok<{ token: string }>(
      await anon.post("/api/v1/auth/refresh", {
        data: { refresh_token: refreshTokenOf(key) },
      }),
    );
    await anon.dispose();
    const ctx = await request.newContext({
      baseURL: BACKEND_URL,
      extraHTTPHeaders: { Authorization: `Bearer ${token}` },
    });
    return new Api(ctx);
  }

  async dispose() {
    await this.ctx.dispose();
  }

  get<T = unknown>(path: string): Promise<T> {
    return this.ctx.get(`/api/v1${path}`).then((r) => ok<T>(r));
  }

  post<T = unknown>(path: string, data?: unknown): Promise<T> {
    return this.ctx.post(`/api/v1${path}`, { data }).then((r) => ok<T>(r));
  }

  me() {
    return this.get<{ user_id: number; is_admin: boolean }>("/auth/me");
  }

  // --- admin ---

  async createYear(yearName: string): Promise<number> {
    const { year_id } = await this.post<{ year_id: number }>(
      "/admin/year/add",
      { year_name: yearName },
    );
    return year_id;
  }

  editYear(
    yearId: number,
    data: { year_name?: string; open_for_registration?: boolean },
  ) {
    return this.post(`/admin/year/${yearId}/edit`, data);
  }

  async createDay(data: {
    year_id: number;
    name: string;
    information?: string;
    score?: number;
    mandatory?: boolean;
    assignment_published?: boolean;
  }): Promise<number> {
    const { day_id } = await this.post<{ day_id: number }>("/admin/day/add", {
      information: "",
      score: 1,
      mandatory: true,
      assignment_published: false,
      ...data,
    });
    return day_id;
  }

  editDay(
    dayId: number,
    data: {
      name?: string;
      information?: string;
      score?: number;
      mandatory?: boolean;
      assignment_published?: boolean;
    },
  ) {
    return this.post(`/admin/day/${dayId}/edit`, data);
  }

  async createPosition(data: {
    year_id: number;
    name: string;
    can_desire?: boolean;
    has_halls?: boolean;
    is_manager?: boolean;
    save_for_next_year?: boolean;
    score?: number;
    description?: string;
  }): Promise<number> {
    const { position_id } = await this.post<{ position_id: number }>(
      "/admin/position/add",
      { can_desire: true, ...data },
    );
    return position_id;
  }

  async createHall(data: {
    year_id: number;
    name: string;
    description?: string;
  }): Promise<number> {
    const { hall_id } = await this.post<{ hall_id: number }>(
      "/admin/hall/add",
      data,
    );
    return hall_id;
  }

  registrationForms(yearId: number) {
    return this.get<{
      forms: { form_id: number; user_id: number; last_name_en: string }[];
    }>(`/admin/year/${yearId}/registration-forms`);
  }

  /** Application form id of the user in the year. */
  async formIdOf(yearId: number, userId: number): Promise<number> {
    const { forms } = await this.registrationForms(yearId);
    const form = forms.find((f) => f.user_id === userId);
    if (!form) {
      throw new Error(`User ${userId} has no application form in ${yearId}`);
    }
    return form.form_id;
  }

  async assign(data: {
    application_form_id: number;
    day_id: number;
    position_id: number;
    hall_id?: number | null;
    information?: string;
  }): Promise<number> {
    const { user_day_id } = await this.post<{ user_day_id: number }>(
      "/admin/user-day/add",
      { information: "", ...data },
    );
    return user_day_id;
  }

  setAttendance(
    userDayId: number,
    attendance: "yes" | "no" | "late" | "sick" | "unknown",
  ) {
    return this.post("/attendance/save", {
      user_day_id: userDayId,
      attendance,
    });
  }

  async addAssessment(data: {
    user_day_id: number;
    comment: string;
    value: number;
  }): Promise<number> {
    const { assessment_id } = await this.post<{ assessment_id: number }>(
      "/admin/assessment/add",
      data,
    );
    return assessment_id;
  }

  // --- volunteer ---

  /** Submits (or updates) the application form of the current user. */
  apply(
    yearId: number,
    data: {
      desired_positions_ids: number[];
      itmo_group?: string;
      comments?: string;
      additional_skills?: string;
      needs_invitation?: boolean;
    },
  ) {
    return this.post(`/year/${yearId}`, data);
  }
}
