import { meApiV1AuthMeGet } from "@/client";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "./query-keys";

// Auth query options
export const meQueryOptions = {
  queryKey: queryKeys.auth.me(),
  queryFn: async () => {
    const response = await meApiV1AuthMeGet({ throwOnError: true });
    return response.data;
  },
};

// Auth hooks
export const useMe = () => {
  return useQuery(meQueryOptions);
};
