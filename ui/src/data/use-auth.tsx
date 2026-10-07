import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  linkTelegramApiV1AuthIdentitiesTelegramPost,
  myIdentitiesApiV1AuthIdentitiesGet,
  unlinkIdentityApiV1AuthIdentitiesIdentityIdDelete,
  updateUserApiV1AuthUpdatePost,
} from "@/client";
import type { TelegramLoginData, UserUpdateRequest } from "@/client/types.gen";
import { authStore } from "@/store/auth";
import { useTelegramOverride } from "@/utils/telegramOverride";
import { queryKeys } from "./query-keys";

export const useUpdateUser = () => {
  return useMutation({
    mutationFn: async (data: UserUpdateRequest) => {
      await updateUserApiV1AuthUpdatePost({
        body: data,
        throwOnError: true,
      });
    },
    onSuccess: () => {
      // Update the MobX store (single source of truth for auth)
      authStore.fetchUser();
    },
  });
};

export const useMyIdentities = () => {
  return useQuery({
    queryKey: queryKeys.auth.identities(),
    queryFn: async () => {
      const { data } = await myIdentitiesApiV1AuthIdentitiesGet({
        throwOnError: true,
      });
      return data;
    },
  });
};

export const useLinkTelegram = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: TelegramLoginData) => {
      const { data } = await linkTelegramApiV1AuthIdentitiesTelegramPost({
        body,
        throwOnError: true,
      });
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.auth.identities(), data);
      authStore.fetchUser();
    },
  });
};

export const useUnlinkIdentity = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (identityId: number) => {
      const { data } = await unlinkIdentityApiV1AuthIdentitiesIdentityIdDelete({
        path: { identity_id: identityId },
        throwOnError: true,
      });
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.auth.identities(), data);
    },
  });
};

type GeoIPResponse = {
  // ISO 3166-1 alpha-2 code
  code?: string;
};

/** Country of the user detected by IP, fetched once per page load. */
export const useCountry = () => {
  return useQuery({
    queryKey: queryKeys.auth.country(),
    queryFn: async () => {
      const response = await fetch("https://api.2ip.io/");
      if (!response.ok) {
        throw new Error(`2ip.io responded with ${response.status}`);
      }
      const data = (await response.json()) as GeoIPResponse;
      return { country_code: data.code || null };
    },
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
    retry: false,
  });
};

// Telegram can't be used for authentication in these countries
const TELEGRAM_BLOCKED_COUNTRIES = ["RU"];

/** Whether Telegram can be used for authentication in the user's country. */
export const useTelegramAvailable = () => {
  const { data } = useCountry();
  const override = useTelegramOverride();
  if (override) {
    return true;
  }
  // Show only when the country is known for sure: hide while loading, on errors
  // and when it could not be determined
  const countryCode = data?.country_code;
  return !!countryCode && !TELEGRAM_BLOCKED_COUNTRIES.includes(countryCode);
};
