import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  countryApiV1AuthCountryGet,
  linkTelegramApiV1AuthIdentitiesTelegramPost,
  myIdentitiesApiV1AuthIdentitiesGet,
  unlinkIdentityApiV1AuthIdentitiesIdentityIdDelete,
  updateUserApiV1AuthUpdatePost,
} from "@/client";
import type { TelegramLoginData, UserUpdateRequest } from "@/client/types.gen";
import { authStore } from "@/store/auth";
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

export const useCountry = () => {
  return useQuery({
    queryKey: queryKeys.auth.country(),
    queryFn: async () => {
      const { data } = await countryApiV1AuthCountryGet({
        throwOnError: true,
      });
      return data;
    },
    staleTime: Number.POSITIVE_INFINITY,
  });
};

/** Whether Telegram can be used for authentication in the user's country. */
export const useTelegramAvailable = () => {
  const { data, isError } = useCountry();
  // Hide the button until the country is known; on errors don't block anything
  return isError || (data?.auth_methods.includes("telegram") ?? false);
};
