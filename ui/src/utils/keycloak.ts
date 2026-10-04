import { keycloakConfigApiV1AuthKeycloakConfigGet } from "@/client";

const STORAGE_KEY = "keycloak-login";

type StoredKeycloakLogin = {
  state: string;
  codeVerifier: string;
  redirectUri: string;
  pendingToken: string | null;
};

export type KeycloakCallback = {
  code: string;
  codeVerifier: string;
  redirectUri: string;
  pendingToken: string | null;
};

const base64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

const randomString = () =>
  base64Url(crypto.getRandomValues(new Uint8Array(32)));

const codeChallenge = async (verifier: string) =>
  base64Url(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)),
    ),
  );

/**
 * Redirect to the ITMO Keycloak login page (authorization code flow with PKCE).
 * The pending authentication token survives the redirect in session storage.
 */
export async function startKeycloakLogin(pendingToken: string | null) {
  const { data: config } = await keycloakConfigApiV1AuthKeycloakConfigGet({
    throwOnError: true,
  });
  const stored: StoredKeycloakLogin = {
    state: randomString(),
    codeVerifier: randomString(),
    redirectUri: `${window.location.origin}/login`,
    pendingToken,
  };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stored));

  const url = new URL(config.authorization_endpoint);
  url.searchParams.set("client_id", config.client_id);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", config.scope);
  url.searchParams.set("redirect_uri", stored.redirectUri);
  url.searchParams.set("state", stored.state);
  url.searchParams.set(
    "code_challenge",
    await codeChallenge(stored.codeVerifier),
  );
  url.searchParams.set("code_challenge_method", "S256");
  window.location.assign(url.toString());
}

/**
 * Read the Keycloak redirect parameters from the current URL, if any.
 * Removes them from the URL so that a reload doesn't reuse the code.
 */
export function consumeKeycloakCallback(): KeycloakCallback | "error" | null {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const state = params.get("state");
  const error = params.get("error");
  if (!state || (!code && !error)) {
    return null;
  }
  window.history.replaceState(null, "", window.location.pathname);

  const raw = sessionStorage.getItem(STORAGE_KEY);
  sessionStorage.removeItem(STORAGE_KEY);
  if (!raw) {
    return "error";
  }
  const stored = JSON.parse(raw) as StoredKeycloakLogin;
  if (error || !code || stored.state !== state) {
    return "error";
  }
  return {
    code,
    codeVerifier: stored.codeVerifier,
    redirectUri: stored.redirectUri,
    pendingToken: stored.pendingToken,
  };
}
