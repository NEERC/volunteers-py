import { AxiosError } from "axios";
import { action, makeAutoObservable } from "mobx";
import { makePersistable } from "mobx-persist-store";
import {
  keycloakAuthApiV1AuthKeycloakPost,
  legacyAuthApiV1AuthLegacyPost,
  meApiV1AuthMeGet,
  refreshApiV1AuthRefreshPost,
  registerApiV1AuthRegisterPost,
  telegramAuthApiV1AuthTelegramPost,
} from "@/client/sdk.gen";
import type {
  AuthFlowResponse,
  KeycloakAuthRequest,
  LegacyAuthRequest,
  RegistrationRequest,
  TelegramAuthRequest,
  VolunteersApiV1AuthSchemasUserResponse,
} from "@/client/types.gen";
import { client } from "../client/client.gen";

class AuthStore {
  private _user: VolunteersApiV1AuthSchemasUserResponse | null = null;
  private accessToken: string | null = null;
  refreshToken: string | null = null;
  private hydrationPromise: Promise<void> | null = null;

  constructor() {
    makeAutoObservable(this);

    this.hydrationPromise = makePersistable(this, {
      name: "AuthStore",
      properties: ["refreshToken"],
      storage: window.localStorage,
    }).then(async () => {
      this.installMiddleware();
      try {
        if (!this.refreshToken) {
          console.log("No refresh token");
          return;
        }
        if (!this.accessToken) {
          await this.refresh();
        }
        await this.fetchUser();
      } catch (error) {
        console.error(error);
      }
    });
  }

  get user() {
    return this._user;
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  waitForHydration(): Promise<void> {
    if (this.hydrationPromise === null) {
      throw new Error("Hydration promise not found. This should never happen.");
    }
    return this.hydrationPromise;
  }

  /**
   * Authentication steps. Each step verifies one identity and returns the next
   * required step. Tokens are stored once the flow succeeds.
   */
  @action
  async authTelegram(body: TelegramAuthRequest) {
    const response = await telegramAuthApiV1AuthTelegramPost({
      body,
      throwOnError: true,
    });
    return this.handleAuthFlow(response.data);
  }

  @action
  async authKeycloak(body: KeycloakAuthRequest) {
    const response = await keycloakAuthApiV1AuthKeycloakPost({
      body,
      throwOnError: true,
    });
    return this.handleAuthFlow(response.data);
  }

  @action
  async authLegacy(body: LegacyAuthRequest) {
    const response = await legacyAuthApiV1AuthLegacyPost({
      body,
      throwOnError: true,
    });
    return this.handleAuthFlow(response.data);
  }

  @action
  async register(body: RegistrationRequest) {
    const response = await registerApiV1AuthRegisterPost({
      body,
      throwOnError: true,
    });
    return this.handleAuthFlow(response.data);
  }

  @action
  private async handleAuthFlow(flow: AuthFlowResponse) {
    if (flow.status === "success" && flow.tokens) {
      this.accessToken = flow.tokens.token;
      this.refreshToken = flow.tokens.refresh_token;
      await this.fetchUser();
    }
    return flow;
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
        if (
          error.response?.status === 401 &&
          !originalRequest._retry &&
          !originalRequest.url?.includes("/api/v1/auth/refresh")
        ) {
          originalRequest._retry = true;
          await this.refresh();
          return client.instance(originalRequest);
        }
        return Promise.reject(error);
      },
    );
  }

  @action
  async fetchUser() {
    const { data } = await meApiV1AuthMeGet({ throwOnError: true });
    this._user = data;
  }

  @action
  async logout() {
    this._user = null;
    this.accessToken = null;
    this.refreshToken = null;
  }

  @action
  private async refresh() {
    if (!this.refreshToken) {
      throw new Error("No refresh token");
    }

    let data: Awaited<ReturnType<typeof refreshApiV1AuthRefreshPost>>["data"];
    try {
      ({ data } = await refreshApiV1AuthRefreshPost({
        throwOnError: true,
        body: { refresh_token: this.refreshToken },
      }));
    } catch (error) {
      if (error instanceof AxiosError && error.response?.status === 401) {
        // The session is no longer valid (e.g. the ITMO account is not linked yet)
        this.logout();
      }
      throw error;
    }

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
