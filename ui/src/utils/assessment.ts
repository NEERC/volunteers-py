import type { AssessmentAuthorOut } from "@/client/types.gen";

export const getAssessmentAuthorLabel = (
  author: AssessmentAuthorOut | null,
  t: (key: string) => string,
): string => {
  if (!author) return t("Unknown author");

  return `${author.first_name_en} ${author.last_name_en}`;
};
