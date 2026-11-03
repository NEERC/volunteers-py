export function updateExcludedFormIds(
  excludedFormIds: number[],
  recipientFormIds: number[],
  allSelected: boolean,
): number[] {
  const next = new Set(excludedFormIds);
  for (const formId of recipientFormIds) {
    if (allSelected) next.add(formId);
    else next.delete(formId);
  }
  return [...next];
}
