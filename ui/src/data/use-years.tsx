import { useQuery } from "@tanstack/react-query";
import { getYearsApiV1YearGet } from "@/client";

export const yearsQueryOptions = {
  queryKey: ["years"],
  queryFn: async () =>
    (await getYearsApiV1YearGet({ throwOnError: true })).data,
};

export const useYears = () => {
  return useQuery(yearsQueryOptions);
};
