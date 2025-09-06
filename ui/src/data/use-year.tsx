import {
  getFormYearApiV1YearYearIdGet,
  saveFormYearApiV1YearYearIdPost,
} from "@/client";
import type { ApplicationFormYearSaveRequest } from "@/client/types.gen";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
      const response = await saveFormYearApiV1YearYearIdPost({
        path: { year_id: Number(yearId) },
        body: data,
        throwOnError: true,
      });
      return response.data;
    },
    onSuccess: (_, { yearId }) => {
      // Invalidate year-specific queries
      queryClient.invalidateQueries({ queryKey: queryKeys.year.all(yearId) });
      // Also invalidate years list
      queryClient.invalidateQueries({ queryKey: queryKeys.years.all });
    },
  });
};
