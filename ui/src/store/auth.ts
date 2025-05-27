import { makeAutoObservable } from "mobx";
import { makePersistable } from "mobx-persist-store";
import { client } from "../client/client.gen";
import {
  loginApiV1AuthTelegramLoginPost,
  meApiV1AuthMeGet,
  refreshApiV1AuthRefreshPost,
  registerApiV1AuthTelegramRegisterPost,
} from "@/client/sdk.gen";
import type {
  RegistrationRequest,
  TelegramLoginRequest,
  UserResponse,
} from "@/client/types.gen";

export class UserNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserNotFoundError";
  }
}

class AuthStore {
  user: UserResponse | null = null;
  private accessToken: string | null = null;
  refreshToken: string | null = null;
  private hydrationPromise: Promise<void> | null = null;

  constructor() {
    makeAutoObservable(this);

    this.hydrationPromise = makePersistable(this, {
      name: "AuthStore",
      properties: ["user", "refreshToken"],
      storage: window.localStorage,
    }).then(async () => {
      this.installMiddleware();
      try {
        await this.fetchUser();
      } catch (error) {
        console.error(error);
      }
    });
  }

  waitForHydration(): Promise<void> {
    if (this.hydrationPromise === null) {
      throw new Error("Hydration promise not found. This should never happen.");
    }
    return this.hydrationPromise;
  }

  async loginTelegram(data: TelegramLoginRequest) {
    const response = await loginApiV1AuthTelegramLoginPost({ body: data });

    if (response.status === 403) {
      throw new UserNotFoundError("User not found");
    }

    if (!response.data || response.data.success !== true) {
      throw new Error("Failed to login");
    }

    this.accessToken = response.data.token;
    this.refreshToken = response.data.refresh_token;

    await this.fetchUser();
  }

  async registerTelegram(telegramData: RegistrationRequest) {
    const response = await registerApiV1AuthTelegramRegisterPost({
      body: telegramData,
    });

    if (!response.data || response.data.success !== true) {
      throw new Error("Failed to register");
    }

    this.accessToken = response.data.token;
    this.refreshToken = response.data.refresh_token;

    await this.fetchUser();
  }

  installMiddleware() {
    client.instance.interceptors.request.use((request) => {
      if (request.url?.includes("/api/v1/")) {
        request.headers.set("Authorization", `Bearer ${this.accessToken}`);
      }
      return request;
    });

    client.instance.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          await this.refresh();
          return client.instance(originalRequest);
        }
        return Promise.reject(error);
      },
    );
  }

  async fetchUser() {
    const { data } = await meApiV1AuthMeGet({ throwOnError: true });
    this.user = data;
  }

  async logout() {
    this.user = null;
    this.accessToken = null;
    this.refreshToken = null;
  }

  private async refresh() {
    if (!this.refreshToken) {
      throw new Error("No refresh token");
    }

    const { data } = await refreshApiV1AuthRefreshPost({
      throwOnError: true,
      body: { refresh_token: this.refreshToken },
    });

    if (data.success === false) {
      throw new Error(data.description);
    }

    if (data.success !== true) {
      throw new Error("Could not refresh token");
    }

    this.accessToken = data.token;
    this.refreshToken = data.refresh_token;
  }
}

export const authStore = new AuthStore();
