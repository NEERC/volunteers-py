import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getFormYearApiV1YearYearIdGet,
  saveFormYearApiV1YearYearIdPost,
  updateUserApiV1AuthUpdatePost,
} from "@/client";
import type {
  ApplicationFormYearSaveRequest,
  UserUpdateRequest,
} from "@/client/types.gen";
import { authStore } from "@/store/auth";
import { queryKeys } from "./query-keys";

// Year query options
export const yearFormQueryOptions = (yearId: string | number) => ({
  queryKey: queryKeys.year.form(yearId),
  queryFn: async () => {
    const response = await getFormYearApiV1YearYearIdGet({
      path: { year_id: Number(yearId) },
      throwOnError: true,
    });
    return response.data;
  },
  enabled: !!yearId,
});

// Year hooks
export const useYearForm = (yearId: string | number) => {
  return useQuery(yearFormQueryOptions(yearId));
};

export const useSaveYearForm = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      yearId,
      data,
    }: {
      yearId: string | number;
      data: ApplicationFormYearSaveRequest;
    }) => {
      await saveFormYearApiV1YearYearIdPost({
        path: { year_id: Number(yearId) },
        body: data,
        throwOnError: true,
      }); // no response expected
    },
    onSuccess: (_, { yearId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.year.form(yearId) });
    },
  });
};

export const useSaveRegistration = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      yearId,
      formData,
      userData,
    }: {
      yearId: string | number;
      formData: ApplicationFormYearSaveRequest;
      userData: UserUpdateRequest;
    }) => {
      const [formResponse, userResponse] = await Promise.all([
        saveFormYearApiV1YearYearIdPost({
          path: { year_id: Number(yearId) },
          body: formData,
          throwOnError: true,
        }),
        updateUserApiV1AuthUpdatePost({
          body: userData,
          throwOnError: true,
        }),
      ]);
      return { formResponse, userResponse };
    },
    onSuccess: (_, { yearId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.year.form(yearId) });
      // Update MobX store with fresh user data (single source of truth for auth)
      authStore.fetchUser();
    },
  });
};
