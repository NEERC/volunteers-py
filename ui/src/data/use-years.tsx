import { useQuery } from "@tanstack/react-query";
import { getYearsApiV1YearGet } from "@/client";
import { queryKeys } from "./query-keys";

export const yearsQueryOptions = {
  queryKey: queryKeys.years.all,
  queryFn: async () =>
    (await getYearsApiV1YearGet({ throwOnError: true })).data,
};

export const useYears = () => {
  return useQuery(yearsQueryOptions);
};
