// Mock of the external systems used by the backend:
//  - ITMO Keycloak: OpenID Connect authorization code flow with PKCE
//    (/realms/<realm>/protocol/openid-connect/{auth,token,userinfo})
//  - Telegram Bot API: notifications sent by the backend (/bot<token>/<method>)
//
// The mock is stateless for Keycloak: the authorization code (and the access token)
// is the base64url-encoded user profile entered on the login page, so any username
// can be used for manual testing. Telegram calls are recorded in memory and can be
// read via GET /__mock/telegram/messages.
import { createHash, randomInt } from "node:crypto";
import { createServer } from "node:http";

const PORT = Number(process.env.E2E_MOCK_PORT ?? 8099);

const telegramCalls = [];

const encode = (value) =>
  Buffer.from(JSON.stringify(value)).toString("base64url");
const decode = (value) => {
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  } catch {
    return null;
  }
};

const readBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });

/** Parses urlencoded, JSON and simple (text-only) multipart bodies. */
const parseBody = (req, raw) => {
  const type = req.headers["content-type"] ?? "";
  if (type.includes("application/json")) {
    return raw ? JSON.parse(raw) : {};
  }
  if (type.includes("multipart/form-data")) {
    const fields = {};
    const re = /name="([^"]+)"\r\n(?:[^\r\n]*\r\n)*\r\n([\s\S]*?)\r\n--/g;
    for (const match of raw.matchAll(re)) {
      fields[match[1]] = match[2];
    }
    return fields;
  }
  return Object.fromEntries(new URLSearchParams(raw));
};

const send = (res, status, body, headers = {}) => {
  const isString = typeof body === "string";
  res.writeHead(status, {
    "content-type": isString
      ? "text/html; charset=utf-8"
      : "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    ...headers,
  });
  res.end(isString ? body : JSON.stringify(body));
};

const escapeHtml = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );

const loginPage = (params, error) => `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Mock ITMO ID</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 420px; margin: 48px auto; padding: 0 16px; }
  label { display: block; margin-top: 12px; font-size: 14px; }
  input { width: 100%; padding: 8px; box-sizing: border-box; }
  button { margin-top: 16px; padding: 10px 16px; }
  .error { color: #b00020; }
  .hint { color: #555; font-size: 13px; }
</style></head>
<body>
  <h1>Mock ITMO ID</h1>
  <p class="hint">Keycloak mock of the e2e stack. Any username works: the same username
  always maps to the same account.</p>
  ${error ? `<p class="error">${escapeHtml(error)}</p>` : ""}
  <form method="post" action="login">
    ${Object.entries(params)
      .map(
        ([k, v]) =>
          `<input type="hidden" name="${escapeHtml(k)}" value="${escapeHtml(v)}">`,
      )
      .join("\n    ")}
    <label>Username <input name="username" id="username" autocomplete="off" required></label>
    <label>First name <input name="given_name" id="given_name" autocomplete="off"></label>
    <label>Last name <input name="family_name" id="family_name" autocomplete="off"></label>
    <label>Email <input name="email" id="email" autocomplete="off"></label>
    <button type="submit" id="kc-login">Sign In</button>
  </form>
</body>
</html>`;

const pkceChallenge = (verifier) =>
  createHash("sha256").update(verifier).digest("base64url");

async function handleKeycloak(req, res, url, action) {
  if (action === "auth" && req.method === "GET") {
    const required = ["client_id", "redirect_uri", "state", "response_type"];
    const missing = required.filter((k) => !url.searchParams.get(k));
    if (missing.length > 0) {
      return send(res, 400, `Missing parameters: ${missing.join(", ")}`);
    }
    const params = Object.fromEntries(
      [
        "client_id",
        "redirect_uri",
        "state",
        "code_challenge",
        "code_challenge_method",
      ].map((k) => [k, url.searchParams.get(k) ?? ""]),
    );
    return send(res, 200, loginPage(params));
  }

  if (action === "login" && req.method === "POST") {
    const form = parseBody(req, await readBody(req));
    const username = (form.username ?? "").trim();
    if (!username) {
      return send(res, 200, loginPage(form, "Username is required"));
    }
    const code = encode({
      sub: `kc-${username}`,
      preferred_username: username,
      given_name: form.given_name || null,
      family_name: form.family_name || null,
      email: form.email || `${username}@e2e.test`,
      client_id: form.client_id,
      redirect_uri: form.redirect_uri,
      code_challenge: form.code_challenge || null,
    });
    const redirect = new URL(form.redirect_uri);
    redirect.searchParams.set("code", code);
    redirect.searchParams.set("state", form.state);
    redirect.searchParams.set("session_state", "e2e");
    res.writeHead(302, { location: redirect.toString() });
    return res.end();
  }

  if (action === "token" && req.method === "POST") {
    const form = parseBody(req, await readBody(req));
    const grant = decode(form.code ?? "");
    if (form.grant_type !== "authorization_code" || !grant) {
      return send(res, 400, { error: "invalid_grant" });
    }
    if (grant.redirect_uri && grant.redirect_uri !== form.redirect_uri) {
      return send(res, 400, {
        error: "invalid_grant",
        error_description: "Incorrect redirect_uri",
      });
    }
    if (
      grant.code_challenge &&
      pkceChallenge(form.code_verifier ?? "") !== grant.code_challenge
    ) {
      return send(res, 400, {
        error: "invalid_grant",
        error_description: "PKCE verification failed",
      });
    }
    const profile = {
      sub: grant.sub,
      preferred_username: grant.preferred_username,
      given_name: grant.given_name,
      family_name: grant.family_name,
      email: grant.email,
    };
    return send(res, 200, {
      access_token: encode(profile),
      token_type: "Bearer",
      expires_in: 300,
      scope: "openid profile email",
    });
  }

  if (action === "userinfo" && req.method === "GET") {
    const auth = req.headers.authorization ?? "";
    const profile = decode(auth.replace(/^Bearer\s+/i, ""));
    if (!profile?.sub) {
      return send(res, 401, { error: "invalid_token" });
    }
    return send(res, 200, profile);
  }

  return send(res, 404, { error: "not_found" });
}

async function handleTelegram(req, res, method) {
  const params = parseBody(req, await readBody(req));
  const call = { method, params, at: new Date().toISOString() };
  telegramCalls.push(call);
  console.log(`[telegram] ${method}: ${params.text ?? JSON.stringify(params)}`);
  if (method === "sendMessage") {
    return send(res, 200, {
      ok: true,
      result: {
        message_id: randomInt(1, 2 ** 31),
        date: Math.floor(Date.now() / 1000),
        chat: { id: Number(params.chat_id) || 0, type: "supergroup" },
        text: params.text ?? "",
      },
    });
  }
  return send(res, 200, { ok: true, result: true });
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
    const path = url.pathname;

    if (path === "/__mock/health") {
      return send(res, 200, { ok: true });
    }
    if (path === "/__mock/telegram/messages") {
      if (req.method === "DELETE") {
        telegramCalls.length = 0;
        return send(res, 200, { ok: true });
      }
      return send(res, 200, telegramCalls);
    }

    const kc = path.match(
      /^\/realms\/[^/]+\/(?:protocol\/openid-connect\/)?(auth|login|token|userinfo)$/,
    );
    if (kc) {
      return await handleKeycloak(req, res, url, kc[1]);
    }

    const tg = path.match(/^\/bot[^/]+\/([A-Za-z]+)$/);
    if (tg) {
      return await handleTelegram(req, res, tg[1]);
    }

    return send(res, 404, { error: "not_found", path });
  } catch (error) {
    console.error(error);
    return send(res, 500, { error: String(error) });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Mock of external systems listening on http://localhost:${PORT}`);
});
