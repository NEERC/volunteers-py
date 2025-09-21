import { useMutation } from "@tanstack/react-query";
import { updateUserApiV1AuthUpdatePost } from "@/client";
import type { UserUpdateRequest } from "@/client/types.gen";
import { authStore } from "@/store/auth";

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
