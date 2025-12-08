/**
 * Query Key Factory
 *
 * Centralized factory for creating consistent query keys across the application.
 * This helps with cache invalidation, type safety, and maintainability.
 */

// Base query key prefixes
export const queryKeys = {
  // Years
  years: {
    all: ["years"] as const,
  },

  // Auth
  auth: {
    all: ["auth"] as const,
    me: () => [...queryKeys.auth.all, "me"] as const,
    refresh: () => [...queryKeys.auth.all, "refresh"] as const,
  },

  // Admin - Years
  admin: {
    all: ["admin"] as const,
    years: {
      all: () => [...queryKeys.admin.all, "years"] as const,
      lists: () => [...queryKeys.admin.years.all(), "list"] as const,
      list: (filters: Record<string, unknown> = {}) =>
        [...queryKeys.admin.years.lists(), { filters }] as const,
      details: () => [...queryKeys.admin.years.all(), "detail"] as const,
      detail: (id: string | number) =>
        [...queryKeys.admin.years.details(), id] as const,
    },

    // Admin - Days
    days: {
      all: () => [...queryKeys.admin.all, "days"] as const,
      lists: () => [...queryKeys.admin.days.all(), "list"] as const,
      list: (filters: Record<string, unknown> = {}) =>
        [...queryKeys.admin.days.lists(), { filters }] as const,
      details: () => [...queryKeys.admin.days.all(), "detail"] as const,
      detail: (id: string | number) =>
        [...queryKeys.admin.days.details(), id] as const,
      year: (yearId: string | number) =>
        [...queryKeys.admin.days.all(), "year", String(yearId)] as const,
    },

    // Admin - Positions
    positions: {
      all: () => [...queryKeys.admin.all, "positions"] as const,
      lists: () => [...queryKeys.admin.positions.all(), "list"] as const,
      list: (filters: Record<string, unknown> = {}) =>
        [...queryKeys.admin.positions.lists(), { filters }] as const,
      details: () => [...queryKeys.admin.positions.all(), "detail"] as const,
      detail: (id: string | number) =>
        [...queryKeys.admin.positions.details(), id] as const,
      year: (yearId: string | number) =>
        [...queryKeys.admin.positions.all(), "year", String(yearId)] as const,
    },

    // Admin - Halls
    halls: {
      all: () => [...queryKeys.admin.all, "halls"] as const,
      lists: () => [...queryKeys.admin.halls.all(), "list"] as const,
      list: (filters: Record<string, unknown> = {}) =>
        [...queryKeys.admin.halls.lists(), { filters }] as const,
      details: () => [...queryKeys.admin.halls.all(), "detail"] as const,
      detail: (id: string | number) =>
        [...queryKeys.admin.halls.details(), id] as const,
      year: (yearId: string | number) =>
        [...queryKeys.admin.halls.all(), "year", String(yearId)] as const,
    },

    // Admin - Assessments
    assessments: {
      all: () => [...queryKeys.admin.all, "assessments"] as const,
      lists: () => [...queryKeys.admin.assessments.all(), "list"] as const,
      list: (filters: Record<string, unknown> = {}) =>
        [...queryKeys.admin.assessments.lists(), { filters }] as const,
      details: () => [...queryKeys.admin.assessments.all(), "detail"] as const,
      detail: (id: string | number) =>
        [...queryKeys.admin.assessments.details(), id] as const,
    },

    // Admin - User Days
    userDays: {
      all: () => [...queryKeys.admin.all, "userDays"] as const,
      lists: () => [...queryKeys.admin.userDays.all(), "list"] as const,
      list: (filters: Record<string, unknown> = {}) =>
        [...queryKeys.admin.userDays.lists(), { filters }] as const,
      details: () => [...queryKeys.admin.userDays.all(), "detail"] as const,
      detail: (id: string | number) =>
        [...queryKeys.admin.userDays.details(), id] as const,
    },

    // Admin - Users
    users: {
      all: () => [...queryKeys.admin.all, "users"] as const,
      lists: () => [...queryKeys.admin.users.all(), "list"] as const,
      list: (yearId: string | number, filters: Record<string, unknown> = {}) =>
        [...queryKeys.admin.users.lists(), { yearId, filters }] as const,
      allUsers: () => [...queryKeys.admin.users.all(), "all"] as const,
      details: () => [...queryKeys.admin.users.all(), "detail"] as const,
      detail: (id: string | number) =>
        [...queryKeys.admin.users.details(), id] as const,
    },

    // Admin - Registration Forms
    registrationForms: {
      all: () => [...queryKeys.admin.all, "registrationForms"] as const,
      lists: () =>
        [...queryKeys.admin.registrationForms.all(), "list"] as const,
      list: (filters: Record<string, unknown> = {}) =>
        [...queryKeys.admin.registrationForms.lists(), { filters }] as const,
      year: (yearId: string | number) =>
        [
          ...queryKeys.admin.registrationForms.all(),
          "year",
          String(yearId),
        ] as const,
    },

    // Admin - Results
    results: {
      all: () => [...queryKeys.admin.all, "results"] as const,
      year: (yearId: string | number) =>
        [...queryKeys.admin.results.all(), "year", String(yearId)] as const,
    },

    // Admin - Assignments
    assignments: {
      all: () => [...queryKeys.admin.all, "assignments"] as const,
      lists: () => [...queryKeys.admin.assignments.all(), "list"] as const,
      list: (filters: Record<string, unknown> = {}) =>
        [...queryKeys.admin.assignments.lists(), { filters }] as const,
      day: (dayId: string | number) =>
        [...queryKeys.admin.assignments.all(), "day", String(dayId)] as const,
    },
  },

  // Year-specific data (for year pages)
  year: {
    all: (yearId: string | number) => ["year", String(yearId)] as const,
    form: (yearId: string | number) =>
      [...queryKeys.year.all(yearId), "form"] as const,
    dayAssignments: (yearId: string | number, dayId: string | number) =>
      [
        ...queryKeys.year.all(yearId),
        "day",
        String(dayId),
        "assignments",
      ] as const,
    attendance: (yearId: string | number) =>
      [...queryKeys.year.all(yearId), "attendance"] as const,
  },
} as const;

// Type helpers for better TypeScript support
export type QueryKey = typeof queryKeys;
export type YearsQueryKey = QueryKey["years"];
export type AuthQueryKey = QueryKey["auth"];
export type AdminQueryKey = QueryKey["admin"];
export type YearQueryKey = QueryKey["year"];

// Helper function to create query keys with consistent structure
export const createQueryKey = <T extends readonly unknown[]>(key: T): T => key;

// Helper function to check if a query key matches a pattern
export const matchesQueryKey = (
  queryKey: unknown[],
  pattern: readonly unknown[],
): boolean => {
  if (queryKey.length < pattern.length) return false;

  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] !== queryKey[i]) return false;
  }

  return true;
};

// Helper function to extract parameters from query keys
export const extractQueryKeyParams = <T extends Record<string, unknown>>(
  queryKey: unknown[],
  pattern: readonly unknown[],
): Partial<T> => {
  const params: Partial<T> = {};

  if (queryKey.length < pattern.length) return params;

  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] !== queryKey[i]) return params;
  }

  // Extract any additional parameters after the pattern
  const remaining = queryKey.slice(pattern.length);
  if (
    remaining.length > 0 &&
    typeof remaining[0] === "object" &&
    remaining[0] !== null
  ) {
    Object.assign(params, remaining[0]);
  }

  return params;
};
