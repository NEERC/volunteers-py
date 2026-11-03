import type { RegistrationFormItem } from "@/client/types.gen";

export type VolunteerSort = "original" | "experience" | "newest" | "name";

export interface VolunteerListOptions {
  search: string;
  positionId: number | null;
  sort: VolunteerSort;
}

const nameCollator = new Intl.Collator("ru", { sensitivity: "base" });

function searchableName(form: RegistrationFormItem): string {
  return [
    form.first_name_ru,
    form.last_name_ru,
    form.patronymic_ru,
    form.first_name_en,
    form.last_name_en,
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase();
}

export function filterAndSortAvailableVolunteers(
  volunteers: readonly RegistrationFormItem[],
  { search, positionId, sort }: VolunteerListOptions,
): RegistrationFormItem[] {
  const terms = search.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const result = volunteers.filter(
    (form) =>
      (positionId === null ||
        form.desired_positions.some(
          (position) => position.position_id === positionId,
        )) &&
      terms.every((term) => searchableName(form).includes(term)),
  );

  switch (sort) {
    case "experience":
      return result.sort(
        (left, right) => right.previous_year_xp - left.previous_year_xp,
      );
    case "newest":
      return result.sort(
        (left, right) =>
          Date.parse(right.created_at) - Date.parse(left.created_at),
      );
    case "name":
      return result.sort((left, right) =>
        nameCollator.compare(
          `${left.last_name_ru} ${left.first_name_ru}`,
          `${right.last_name_ru} ${right.first_name_ru}`,
        ),
      );
    default:
      return result;
  }
}
