import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { E2E_DIR } from "../stack.config.mjs";

/** Unique tag of the current run, see playwright.config.ts. */
export const RUN_TAG = process.env.E2E_RUN_TAG ?? "local";

export type UserKey = "admin" | "vol1" | "vol2" | "vol3";

export type TestUser = {
  key: string;
  /** Username on the mock ITMO ID login page, the Keycloak `sub` is `kc-<username>`. */
  username: string;
  firstNameRu: string;
  lastNameRu: string;
  patronymicRu: string;
  firstNameEn: string;
  lastNameEn: string;
  isuId: number;
  email: string;
};

const PROFILES: Record<string, [string, string, string, string]> = {
  // key: [first name ru, last name ru, first name en, last name en]
  admin: ["Админ", "Смоуков", "Admin", "Smokov"],
  vol1: ["Алиса", "Иванова", "Alice", "Ivanova"],
  vol2: ["Борис", "Петров", "Boris", "Petrov"],
  vol3: ["Вера", "Сидорова", "Vera", "Sidorova"],
};

/**
 * A user of the current run. Users are unique per run (the tag is in the
 * username and in the English last name), so runs don't affect each other.
 */
export function makeUser(key: string): TestUser {
  const [firstNameRu, lastNameRu, firstNameEn, lastNameEn] = PROFILES[key] ?? [
    "Тест",
    "Тестов",
    "Test",
    key.charAt(0).toUpperCase() + key.slice(1),
  ];
  const username = `e2e-${key}-${RUN_TAG}`;
  return {
    key,
    username,
    firstNameRu,
    lastNameRu,
    patronymicRu: "Тестович",
    firstNameEn,
    lastNameEn: `${lastNameEn}-${RUN_TAG}`,
    // Same in all workers of the run
    isuId:
      100000 +
      (createHash("sha256").update(username).digest().readUInt32BE(0) % 900000),
    email: `${username}@e2e.test`,
  };
}

/** Admin and volunteers registered by the setup project (tests/auth.setup.ts). */
export const users: Record<UserKey, TestUser> = {
  admin: makeUser("admin"),
  vol1: makeUser("vol1"),
  vol2: makeUser("vol2"),
  vol3: makeUser("vol3"),
};

export const VOLUNTEERS: UserKey[] = ["vol1", "vol2", "vol3"];

/** Session of a setup user. Per run, so concurrent runs don't overwrite each other's. */
export const authFile = (key: string) =>
  resolve(E2E_DIR, ".auth", RUN_TAG, `${key}.json`);

/** Users of the last run with their DB ids, written by the setup project. */
export const usersStateFile = resolve(E2E_DIR, ".state", "users.json");
