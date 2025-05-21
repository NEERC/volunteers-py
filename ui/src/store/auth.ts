import { makeAutoObservable } from "mobx"
import { client } from "../client/client.gen"
import { loginApiV1AuthTelegramLoginPost, meApiV1AuthMeGet, refreshApiV1AuthRefreshPost, registerApiV1AuthTelegramRegisterPost } from "@/client/sdk.gen"
import type { RegisterApiV1AuthTelegramRegisterPostData, RegistrationRequest, TelegramLoginRequest, UserResponse } from "@/client/types.gen"

export class UserNotFoundError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'UserNotFoundError'
    }
}

class AuthStore {
    user: UserResponse | null = null
    private accessToken: string | null = null
    private refreshToken: string | null = null

    constructor() {
        makeAutoObservable(this)
    }

    async loginTelegram(data: TelegramLoginRequest) {
        const response = await loginApiV1AuthTelegramLoginPost({
            body: data
        })
        if (response.status === 403) {
            throw new UserNotFoundError("User not found")
        }
        if (!response.data) {
            throw response.error
        }
        if (response.data.success !== true) {
            throw new Error("Failed to login")
        }

        this.accessToken = response.data.token
        this.refreshToken = response.data.refresh_token
        // TODO: save tokens to local storage

        await this.fetchUser()
    }

    async registerTelegram(telegramData: RegistrationRequest) {
        const response = await registerApiV1AuthTelegramRegisterPost({
            body: telegramData
        })
        if (!response.data) {
            throw response.error
        }
        if (response.data.success !== true) {
            throw new Error("Failed to register")
        }

        this.accessToken = response.data.token
        this.refreshToken = response.data.refresh_token
        // TODO: save tokens to local storage

        await this.fetchUser()
    }

    installMiddleware() {
        // not sure if this is needed
        // client.instance.interceptors.request.clear()
        // client.instance.interceptors.response.clear()
        client.instance.interceptors.request.use((request) => {
            if (request.url?.includes("/api/v1/")) {
                request.headers.set("Authorization", `Bearer ${this.accessToken}`)
            }
            return request
        })
        client.instance.interceptors.response.use(response => response, async (error) => {
            const originalRequest = error.config;
            if (error.response?.status === 401 && !originalRequest._retry) {
                originalRequest._retry = true
                await this.refresh()
                return client.instance(originalRequest)
            }
            return Promise.reject(error)
        })
    }

    async fetchUser() {
        const {data} = await meApiV1AuthMeGet({
            throwOnError: true,
        })
        this.user = data
    }

    private async refresh() {
        if (!this.refreshToken) {
            throw new Error("No refresh token")
        }
        const {data} = await refreshApiV1AuthRefreshPost({
            throwOnError: true,
            body: {
                refresh_token: this.refreshToken
            }
        })
        if (data.success === false) {
            throw new Error(data.description)
        }
        if (data.success !== true) {
            throw new Error("Could not refresh token")
        }
        this.accessToken = data.token
        this.refreshToken = data.refresh_token
    }
}

export const authStore = new AuthStore()
authStore.installMiddleware()
