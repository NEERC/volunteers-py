type NamedUser = {
  user_id: number;
  first_name_ru: string;
  last_name_ru: string;
};

/** Lowercase, `ё` → `е`, letters only: "Фёдоров-Петров " and "федоровпетров" are the same name. */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replaceAll("ё", "е")
    .replace(/[^\p{L}]/gu, "");
}

/** Key of a user for duplicate search: normalized last and first names. */
export function duplicateKey(user: NamedUser): string | null {
  const last = normalizeName(user.last_name_ru);
  const first = normalizeName(user.first_name_ru);
  return last || first ? `${last} ${first}` : null;
}

/**
 * Users that share the duplicate key with another user, grouped together
 * and ordered by key, then by id.
 */
export function findSuspectedDuplicates<T extends NamedUser>(users: T[]): T[] {
  const groups = new Map<string, T[]>();
  for (const user of users) {
    const key = duplicateKey(user);
    if (key === null) continue;
    groups.set(key, [...(groups.get(key) ?? []), user]);
  }
  return [...groups.entries()]
    .filter(([, group]) => group.length > 1)
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([, group]) => group.sort((a, b) => a.user_id - b.user_id));
}
