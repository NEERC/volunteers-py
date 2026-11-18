import { type FilterFn, filterFns, type RowData } from "@tanstack/react-table";

export function matchesTelegramUsername(
  username: string | null | undefined,
  query: string,
): boolean {
  const term = query.trim().toLowerCase().replace(/^@/, "");
  return Boolean(
    term && username?.toLowerCase().replace(/^@/, "").includes(term),
  );
}

export const telegramGlobalFilter = <T extends RowData>(
  ...args: Parameters<FilterFn<T>>
): boolean => {
  const [row, columnId, query] = args;
  return columnId === "telegram"
    ? matchesTelegramUsername(row.getValue(columnId), query)
    : filterFns.includesString(...args);
};
