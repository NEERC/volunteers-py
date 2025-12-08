export type Gender = "male" | "female" | "unspecified";

export const getGenderLabel = (
  gender: Gender | string | null,
  t: (key: string) => string,
): string => {
  if (!gender) return t("Not specified");

  switch (gender) {
    case "male":
      return t("Male");
    case "female":
      return t("Female");
    case "unspecified":
      return t("Prefer not to say");
    default:
      return t("Not specified");
  }
};

export const GENDER_OPTIONS: Gender[] = ["male", "female", "unspecified"];
