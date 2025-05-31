import { getYearsApiV1YearGet } from "@/client";
import { useQuery } from "@tanstack/react-query";

export const yearsQueryOptions = {
  queryKey: ["years"],
  queryFn: async () =>
    (await getYearsApiV1YearGet({ throwOnError: true })).data,
};

export const useYears = () => {
  return useQuery(yearsQueryOptions);
};
